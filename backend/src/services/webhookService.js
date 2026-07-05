import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class WebhookService {
  /**
   * Register a new webhook subscription
   */
  async createSubscription(url, events) {
    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    const eventString = Array.isArray(events) ? events.join(',') : events;
    
    return prisma.webhookSubscription.create({
      data: {
        url,
        events: eventString,
        secret,
        active: true
      }
    });
  }

  /**
   * Retrieve all webhook subscriptions
   */
  async getSubscriptions() {
    return prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Rotate signing secret for a subscription
   */
  async rotateSecret(id) {
    const newSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    return prisma.webhookSubscription.update({
      where: { id },
      data: { secret: newSecret }
    });
  }

  /**
   * Toggle subscription active status
   */
  async toggleSubscription(id, active) {
    return prisma.webhookSubscription.update({
      where: { id },
      data: { active }
    });
  }

  /**
   * Delete a webhook subscription
   */
  async deleteSubscription(id) {
    return prisma.webhookSubscription.delete({
      where: { id }
    });
  }

  /**
   * Get delivery logs
   */
  async getDeliveryLogs(subscriptionId) {
    return prisma.webhookDeliveryLog.findMany({
      where: subscriptionId ? { subscriptionId } : {},
      orderBy: { timestamp: 'desc' },
      take: 50
    });
  }

  /**
   * Dispatch a webhook event asynchronously to all matching active subscriptions.
   */
  async dispatchEvent(event, payload) {
    try {
      const subs = await prisma.webhookSubscription.findMany({
        where: { active: true }
      });
      
      const payloadString = JSON.stringify(payload);
      
      for (const sub of subs) {
        const eventsList = sub.events.split(',');
        if (eventsList.includes(event) || eventsList.includes('*')) {
          this._dispatchToSubscriber(sub, event, payloadString);
        }
      }
    } catch (err) {
      console.error('[WebhookService] Failed to dispatch event:', err.message);
    }
  }

  /**
   * Internal worker carrying out signing, HTTP delivery, retry loop, and logging.
   */
  async _dispatchToSubscriber(sub, event, payloadString) {
    const maxAttempts = 3;
    let attempt = 0;
    let success = false;
    let lastStatus = null;
    let lastBody = '';

    while (attempt < maxAttempts && !success) {
      attempt++;
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', sub.secret)
        .update(`${timestamp}.${payloadString}`)
        .digest('hex');

      try {
        const response = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-KorriPay-Signature': `t=${timestamp},v1=${signature}`,
            'User-Agent': 'KorriPay-Webhooks/1.0'
          },
          body: payloadString,
          signal: AbortSignal.timeout(5000)
        });

        lastStatus = response.status;
        lastBody = await response.text();
        
        if (response.ok) {
          success = true;
        }
      } catch (err) {
        lastStatus = 500;
        lastBody = err.message;
      }

      if (!success && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    try {
      await prisma.webhookDeliveryLog.create({
        data: {
          subscriptionId: sub.id,
          event,
          payload: payloadString,
          responseStatus: lastStatus,
          responseBody: lastBody.substring(0, 1000),
          attempts: attempt,
          success
        }
      });
    } catch (logErr) {
      console.error('[WebhookService] Failed logging delivery:', logErr.message);
    }
  }
}

export const webhookService = new WebhookService();

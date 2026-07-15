import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

const prisma = new PrismaClient();
const dnsLookup = promisify(dns.lookup);

async function isSafeUrl(urlStr) {
  // If not running in production, allow localhost for development testing
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;
    
    // 1. Resolve host to IP
    const lookupResult = await dnsLookup(hostname).catch(() => null);
    if (!lookupResult) return false;
    
    const ip = lookupResult.address;
    
    // 2. Check if IP is private/loopback
    // Loopback
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) {
      return false;
    }
    // Private IPv4 ranges
    // 10.0.0.0/8
    if (ip.startsWith('10.')) return false;
    // 172.16.0.0/12
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      const secondPart = parseInt(parts[1], 10);
      if (secondPart >= 16 && secondPart <= 31) return false;
    }
    // 192.168.0.0/16
    if (ip.startsWith('192.168.')) return false;
    // Link-local 169.254.0.0/16
    if (ip.startsWith('169.254.')) return false;
    
    // IPv6 private ranges (fc00::/7 or fe80::/10)
    if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

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

    // Check SSRF safety
    const safe = await isSafeUrl(sub.url);
    if (!safe) {
      lastStatus = 400;
      lastBody = 'Blocked: SSRF protection active for private network destinations';
      try {
        await prisma.webhookDeliveryLog.create({
          data: {
            subscriptionId: sub.id,
            event,
            payload: payloadString,
            responseStatus: lastStatus,
            responseBody: lastBody,
            attempts: 0,
            success: false
          }
        });
      } catch (err) {
        console.error('[WebhookService] Failed to log blocked webhook:', err.message);
      }
      return;
    }

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

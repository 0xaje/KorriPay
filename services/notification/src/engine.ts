import { DomainMetrics, noopMetrics } from "@korripay/domain";
import type { INotificationProvider } from "@korripay/domain";

type NotificationChannel = "email" | "sms" | "push";

export interface PrepareNotificationCommand {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  correlationId: string;
}

export interface NotificationPayload {
  recipient: string;
  subject: string;
  body: string;
  channel: NotificationChannel;
  metadata: Record<string, unknown>;
}

export class NotificationEngine {
  constructor(
    private readonly provider?: INotificationProvider,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {}

  /** Build a notification payload (no delivery) — business preparation only */
  preparePayload(cmd: PrepareNotificationCommand): NotificationPayload {
    const payload: NotificationPayload = {
      recipient: cmd.userId,
      subject: cmd.title,
      body: cmd.message,
      channel: cmd.channel,
      metadata: {
        organizationId: cmd.organizationId,
        correlationId: cmd.correlationId,
        preparedAt: new Date().toISOString(),
      },
    };

    this.metrics.increment("notification.prepared", { channel: cmd.channel });
    return payload;
  }

  /** Select the best delivery channel based on urgency */
  selectChannel(urgency: "low" | "medium" | "high"): NotificationChannel {
    if (urgency === "high") return "sms";
    if (urgency === "medium") return "email";
    return "push";
  }

  /** Queue delivery via pluggable provider (no direct SMTP/webhook) */
  async send(payload: NotificationPayload): Promise<void> {
    if (!this.provider) {
      // No provider configured — log and skip (infrastructure plugs this in later)
      this.metrics.increment("notification.skipped", { channel: payload.channel });
      return;
    }
    await this.provider.send(payload.channel, payload.recipient, {
      subject: payload.subject,
      body: payload.body,
      metadata: payload.metadata,
    });
    this.metrics.increment("notification.sent", { channel: payload.channel });
  }
}

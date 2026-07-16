/**
 * CTO Enhancement: Domain-layer metrics instrumentation.
 * Exposes measurement points without any Prometheus coupling.
 * The Operations layer will collect and export these later.
 */

export interface MetricPoint {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

export type MetricCollector = (point: MetricPoint) => void;

export class DomainMetrics {
  private readonly collector: MetricCollector;

  constructor(collector: MetricCollector = () => {}) {
    this.collector = collector;
  }

  /** Record the duration of a domain operation in milliseconds */
  recordDuration(name: string, durationMs: number, tags: Record<string, string> = {}): void {
    this.collector({
      name: `domain.${name}.duration_ms`,
      value: durationMs,
      tags,
      timestamp: new Date(),
    });
  }

  /** Increment a counter (state transitions, events, errors) */
  increment(name: string, tags: Record<string, string> = {}): void {
    this.collector({ name: `domain.${name}.count`, value: 1, tags, timestamp: new Date() });
  }

  /** Record a gauge value (queue depth, pool balance, etc.) */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.collector({ name: `domain.${name}`, value, tags, timestamp: new Date() });
  }

  /** Time an async operation and record its duration */
  async time<T>(name: string, tags: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordDuration(name, Date.now() - start, { ...tags, status: "success" });
      return result;
    } catch (error) {
      this.recordDuration(name, Date.now() - start, { ...tags, status: "error" });
      throw error;
    }
  }
}

/** Shared no-op instance for use when metrics are not needed */
export const noopMetrics = new DomainMetrics();

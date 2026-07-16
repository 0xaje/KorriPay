export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function generateCorrelationId(): string {
  const g = globalThis as any;
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

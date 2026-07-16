export interface AuditLogPlaceholder {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
}

export type SupportedCurrency = "USD" | "EUR" | "GBP" | "XOF" | "NGN";

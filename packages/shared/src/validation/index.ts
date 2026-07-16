import { z } from "zod";
import { OrganizationType, LedgerEntryType, ComplianceStatus } from "../enums/index.js";

// ==========================================
// IDENTITY
// ==========================================

export const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  type: z.nativeEnum(OrganizationType),
});

export const addMemberSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

// ==========================================
// DOUBLE-ENTRY LEDGER
// ==========================================

export const ledgerEntrySchema = z.object({
  ledgerAccountId: z.string().uuid(),
  type: z.nativeEnum(LedgerEntryType),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency code must be 3 letters long"),
});

type Entry = z.infer<typeof ledgerEntrySchema>;

export const ledgerTransactionSchema = z.object({
  organizationId: z.string().uuid(),
  referenceId: z.string().min(1, "Reference ID is required"),
  description: z.string(),
  correlationId: z.string().uuid(),
  entries: z
    .array(ledgerEntrySchema)
    .min(2)
    .refine((entries: Entry[]) => {
      // True double-entry ledger check: matching sum of debits and credits
      const debits = entries
        .filter((e: Entry) => e.type === LedgerEntryType.Debit)
        .reduce((sum: number, e: Entry) => sum + e.amount, 0);
      const credits = entries
        .filter((e: Entry) => e.type === LedgerEntryType.Credit)
        .reduce((sum: number, e: Entry) => sum + e.amount, 0);
      // Use floating-point epsilon to avoid decimal issues in Javascript
      return Math.abs(debits - credits) < 0.0001;
    }, "Sum of debits must equal sum of credits"),
});

// ==========================================
// SETTLEMENT
// ==========================================

export const settlementRequestSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  payload: z.record(z.any()),
});

// ==========================================
// COMPLIANCE
// ==========================================

export const complianceAssessmentSchema = z.object({
  organizationId: z.string().uuid(),
  settlementId: z.string().uuid(),
  status: z.nativeEnum(ComplianceStatus),
  score: z.number().min(0).max(100),
  details: z.record(z.any()),
});

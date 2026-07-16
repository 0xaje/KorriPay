export enum Environment {
  Development = "development",
  Testing = "testing",
  Staging = "staging",
  Production = "production",
}

export enum OrganizationType {
  FinancialInstitution = "FINANCIAL_INSTITUTION",
  Corporate = "CORPORATE",
  Partner = "PARTNER",
  SystemOperator = "SYSTEM_OPERATOR",
}

export enum RoleType {
  SuperAdmin = "SUPER_ADMIN",
  Admin = "ADMIN",
  Operator = "OPERATOR",
  ComplianceOfficer = "COMPLIANCE_OFFICER",
  TreasuryManager = "TREASURY_MANAGER",
  Auditor = "AUDITOR",
}

export enum LedgerAccountType {
  Asset = "ASSET",
  Liability = "LIABILITY",
  Equity = "EQUITY",
  Revenue = "REVENUE",
  Expense = "EXPENSE",
}

export enum LedgerEntryType {
  Debit = "DEBIT",
  Credit = "CREDIT",
}

export enum TreasuryAccountType {
  Settlement = "SETTLEMENT",
  Reserve = "RESERVE",
  Clearing = "CLEARING",
  FeeCollection = "FEE_COLLECTION",
}

export enum SettlementStatus {
  Requested = "REQUESTED",
  IdentityVerified = "IDENTITY_VERIFIED",
  ComplianceApproved = "COMPLIANCE_APPROVED",
  LiquidityReserved = "LIQUIDITY_RESERVED",
  RouteSelected = "ROUTE_SELECTED",
  Ready = "READY",
  Submitted = "SUBMITTED",
  Accepted = "ACCEPTED",
  Finalized = "FINALIZED",
  Attested = "ATTESTED",
  ProofGenerated = "PROOF_GENERATED",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
  Rejected = "REJECTED",
}

export enum ComplianceStatus {
  Pending = "PENDING",
  Approved = "APPROVED",
  Flagged = "FLAGGED",
  Rejected = "REJECTED",
}

export enum KycStatus {
  Unverified = "UNVERIFIED",
  Pending = "PENDING",
  Verified = "VERIFIED",
  Rejected = "REJECTED",
}

export enum WebhookDeliveryStatus {
  Success = "SUCCESS",
  Failed = "FAILED",
  Retrieving = "RETRIEVING",
}

export enum RiskLevel {
  Low = "LOW",
  Medium = "MEDIUM",
  High = "HIGH",
  Critical = "CRITICAL",
}

export enum ProofStatus {
  Pending = "PENDING",
  Generated = "GENERATED",
  Verified = "VERIFIED",
  Failed = "FAILED",
}

export enum AttestationStatus {
  Pending = "PENDING",
  Attested = "ATTESTED",
  Revoked = "REVOKED",
}

export interface KorriPayConfig {
  /**
   * Base URL of the KorriPay API.
   * Defaults to 'http://localhost:5000/api/v1'
   */
  baseUrl?: string;

  /**
   * Session token or API authorization token.
   */
  token?: string;

  /**
   * Optional custom request headers.
   */
  headers?: Record<string, string>;
}

export interface Settlement {
  id: string;
  initiator: string;
  fromToken: string;
  toToken: string;
  amount: string;
  recipientDetails: string;
  status: 'Pending' | 'Completed' | 'Failed';
  txHash: string | null;
  confirmedTxHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface CreateSettlementParams {
  recipient: string;
  amount: number;
  recipientAddress?: string;
  txHash?: string;
  status?: 'Success' | 'Pending' | 'Failed';
}

export interface BalanceDetail {
  available: number;
  locked: number;
  pending: number;
}

export interface WalletBalances {
  USD: BalanceDetail;
  KRW: BalanceDetail;
  NGN: BalanceDetail;
  MockKRW: BalanceDetail;
}

export interface WalletCryptoBalances {
  BTC: number;
  ETH: number;
  USDC: number;
}

export interface Wallet {
  id: string;
  savings: number;
  balances: WalletBalances;
  crypto: WalletCryptoBalances;
}

export interface Proof {
  id: string;
  settlementId: string;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  proofData: string;
  status: 'Valid' | 'Invalid';
  createdAt: string;
}

export interface Attestation {
  id: string;
  issuer: string;
  subjectWallet: string;
  schema: 'Identity' | 'Merchant' | 'Business' | 'Payroll' | 'Compliance';
  details: Record<string, any>;
  status: 'Active' | 'Revoked';
  txHash: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface IdentityVerifyParams {
  status: 'Verified' | 'Pending' | 'Failed' | 'NotStarted';
}

export interface KYCRecord {
  id: string;
  userId: string;
  status: 'Verified' | 'Pending' | 'Failed' | 'NotStarted';
  createdAt: string;
  updatedAt: string;
}

export interface IdentityVerifyResponse {
  success: boolean;
  message: string;
  kyc: KYCRecord;
}

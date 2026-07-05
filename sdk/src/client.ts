import {
  KorriPayConfig,
  Settlement,
  CreateSettlementParams,
  Wallet,
  Proof,
  IdentityVerifyParams,
  IdentityVerifyResponse
} from './types.js';
import {
  KorriPayAuthenticationError,
  KorriPayAPIError,
  KorriPayValidationError
} from './errors.js';

export class KorriPayClient {
  private baseUrl: string;
  private token?: string;
  private headers: Record<string, string>;

  constructor(config: KorriPayConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:5000/api/v1';
    this.token = config.token;
    this.headers = config.headers || {};
  }

  /**
   * Helper method to perform authenticated HTTP requests to the KorriPay API.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers,
      ...options.headers,
    } as Record<string, string>;

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        throw new KorriPayAuthenticationError();
      }

      let data: any;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
        throw new KorriPayAPIError(errorMsg, response.status, data);
      }

      return data as T;
    } catch (err: any) {
      if (err instanceof KorriPayAuthenticationError || err instanceof KorriPayAPIError) {
        throw err;
      }
      throw new KorriPayAPIError(err.message || 'Network request failed', 500);
    }
  }

  /**
   * Creates a new L2 settlement request.
   *
   * @param params parameters for setting up the transfer.
   * @returns object containing the transaction and settlement info.
   */
  async createSettlement(params: CreateSettlementParams): Promise<{
    success: boolean;
    settlementId: string;
    settlement: Settlement;
    transaction: any;
    screening: any;
  }> {
    if (!params.recipient || params.recipient.trim() === '') {
      throw new KorriPayValidationError('Recipient name is required.');
    }
    if (typeof params.amount !== 'number' || params.amount <= 0) {
      throw new KorriPayValidationError('Amount must be a positive number.');
    }

    return this.request<{
      success: boolean;
      settlementId: string;
      settlement: Settlement;
      transaction: any;
      screening: any;
    }>('/settlements', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Retrieves a single settlement request by ID or transaction hash.
   *
   * @param id settlement ID or transaction hash.
   * @returns details of the settlement.
   */
  async getSettlement(id: string): Promise<Settlement> {
    if (!id || id.trim() === '') {
      throw new KorriPayValidationError('Settlement ID is required.');
    }

    const res = await this.request<{ success: boolean; settlement: Settlement }>(`/settlements/${encodeURIComponent(id)}`);
    return res.settlement;
  }

  /**
   * Updates or verifies user KYC identity status.
   *
   * @param params identity verification details.
   * @returns verification update details.
   */
  async verifyIdentity(params: IdentityVerifyParams): Promise<IdentityVerifyResponse> {
    const validStatuses = ['Verified', 'Pending', 'Failed', 'NotStarted'];
    if (!params.status || !validStatuses.includes(params.status)) {
      throw new KorriPayValidationError(`Status is required and must be one of: ${validStatuses.join(', ')}`);
    }

    return this.request<IdentityVerifyResponse>('/identity/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Retrieves the current user's multi-currency and crypto wallet details.
   *
   * @returns the multi-currency wallet details.
   */
  async getWallet(): Promise<Wallet> {
    const res = await this.request<{ success: boolean; wallet: Wallet }>('/wallets');
    return res.wallet;
  }

  /**
   * Retrieves the L2 cryptographic proof for a specific settlement.
   *
   * @param settlementId the unique settlement ID.
   * @returns the settlement proof or null if not yet generated.
   */
  async getProof(settlementId: string): Promise<Proof | null> {
    if (!settlementId || settlementId.trim() === '') {
      throw new KorriPayValidationError('Settlement ID is required.');
    }

    const res = await this.request<{ success: boolean; proofs: Proof[] }>(`/proofs?settlementId=${encodeURIComponent(settlementId)}`);
    if (res.proofs && res.proofs.length > 0) {
      return res.proofs[0];
    }
    return null;
  }
}

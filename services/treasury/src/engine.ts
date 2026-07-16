import {
  TreasuryValidator,
  TreasuryFactory,
  DomainMetrics,
  noopMetrics,
  LiquidityUnavailableError,
  makeCorrelationId,
} from "@korripay/domain";
import type { TreasuryRepository, AuditRepository } from "@korripay/database";

export interface ReserveFundsCommand {
  organizationId: string;
  settlementId: string;
  amount: number;
  currency: string;
  correlationId: string;
}

export class TreasuryEngine {
  constructor(
    private readonly treasuryRepo: TreasuryRepository,
    private readonly auditRepo: AuditRepository,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {}

  async reserveFunds(cmd: ReserveFundsCommand): Promise<string> {
    return this.metrics.time("treasury.reserve", { currency: cmd.currency }, async () => {
      TreasuryValidator.validatePositiveAmount(cmd.amount);

      const correlationId = makeCorrelationId(cmd.correlationId);

      // Find available ledger account for this org+currency
      const debitAccount = await this.treasuryRepo.findLedgerAccountByName(
        cmd.organizationId,
        `SETTLEMENT_${cmd.currency}`
      );
      const creditAccount = await this.treasuryRepo.findLedgerAccountByName(
        cmd.organizationId,
        `RESERVE_${cmd.currency}`
      );

      if (!debitAccount || !creditAccount) {
        throw new LiquidityUnavailableError(
          `${cmd.amount} ${cmd.currency}`,
          "No treasury accounts configured"
        );
      }

      // Verify available balance
      const balance = await this.treasuryRepo.computeLedgerAccountBalance(debitAccount.id);
      if (balance < cmd.amount) {
        throw new LiquidityUnavailableError(
          `${cmd.amount} ${cmd.currency}`,
          `${balance} ${cmd.currency}`
        );
      }

      const ref = TreasuryFactory.createLedgerRef(cmd.settlementId, "RESERVE");

      // Execute atomic double-entry transaction
      const tx = await this.treasuryRepo.executeLedgerTransaction(
        cmd.organizationId,
        ref,
        `Reserve funds for settlement ${cmd.settlementId}`,
        correlationId,
        debitAccount.id,
        creditAccount.id,
        cmd.amount,
        cmd.currency
      );

      await this.auditRepo.log(
        "FUNDS_RESERVED",
        "LedgerTransaction",
        tx.id,
        null,
        cmd.organizationId,
        correlationId,
        null,
        null,
        { amount: cmd.amount, currency: cmd.currency, settlementId: cmd.settlementId }
      );

      this.metrics.gauge("treasury.reserved", cmd.amount, { currency: cmd.currency });
      return tx.id;
    });
  }

  async releaseFunds(cmd: ReserveFundsCommand): Promise<string> {
    return this.metrics.time("treasury.release", { currency: cmd.currency }, async () => {
      TreasuryValidator.validatePositiveAmount(cmd.amount);

      const correlationId = makeCorrelationId(cmd.correlationId);

      // Release: reverse the direction (credit settlement, debit reserve)
      const creditAccount = await this.treasuryRepo.findLedgerAccountByName(
        cmd.organizationId,
        `SETTLEMENT_${cmd.currency}`
      );
      const debitAccount = await this.treasuryRepo.findLedgerAccountByName(
        cmd.organizationId,
        `RESERVE_${cmd.currency}`
      );

      if (!debitAccount || !creditAccount) {
        throw new LiquidityUnavailableError(
          `${cmd.amount} ${cmd.currency}`,
          "No accounts configured"
        );
      }

      const ref = TreasuryFactory.createLedgerRef(cmd.settlementId, "RELEASE");

      const tx = await this.treasuryRepo.executeLedgerTransaction(
        cmd.organizationId,
        ref,
        `Release reserved funds for settlement ${cmd.settlementId}`,
        correlationId,
        debitAccount.id,
        creditAccount.id,
        cmd.amount,
        cmd.currency
      );

      this.metrics.gauge("treasury.released", cmd.amount, { currency: cmd.currency });
      return tx.id;
    });
  }

  async getAvailableBalance(organizationId: string, currency: string): Promise<number> {
    const account = await this.treasuryRepo.findLedgerAccountByName(
      organizationId,
      `SETTLEMENT_${currency}`
    );
    if (!account) return 0;
    return this.treasuryRepo.computeLedgerAccountBalance(account.id);
  }

  async calculateFee(amount: number, feePercentage: number): Promise<number> {
    TreasuryValidator.validatePositiveAmount(amount);
    return Math.round(amount * (feePercentage / 100) * 100) / 100;
  }
}

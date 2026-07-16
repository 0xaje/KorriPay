import { BaseRepository } from "./base.js";
import { LedgerEntryType, LedgerAccountType, TreasuryAccountType } from "@korripay/shared";
import { ValidationError, InfrastructureError } from "@korripay/errors";

export class TreasuryRepository extends BaseRepository {
  async createTreasuryAccount(
    organizationId: string,
    name: string,
    type: TreasuryAccountType,
    currency: string
  ) {
    return this.prisma.treasuryAccount.create({
      data: { organizationId, name, type, currency },
    });
  }

  async createLiquidityPool(
    organizationId: string,
    name: string,
    currency: string,
    initialBalance = 0
  ) {
    return this.prisma.liquidityPool.create({
      data: { organizationId, name, currency, balance: initialBalance },
    });
  }

  async createLedgerAccount(
    organizationId: string,
    name: string,
    currency: string,
    type: LedgerAccountType
  ) {
    return this.prisma.ledgerAccount.create({
      data: { organizationId, name, currency, type },
    });
  }

  async findLedgerAccountByName(organizationId: string, name: string) {
    return this.prisma.ledgerAccount.findUnique({
      where: { organizationId_name: { organizationId, name } },
    });
  }

  // True double-entry ledger execution
  async executeLedgerTransaction(
    organizationId: string,
    referenceId: string,
    description: string,
    correlationId: string,
    debitAccountId: string,
    creditAccountId: string,
    amount: number,
    currency: string
  ) {
    if (amount <= 0) {
      throw new ValidationError("Transaction amount must be positive");
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.ledgerTransaction.create({
        data: {
          organizationId,
          referenceId,
          description,
          correlationId,
        },
      });

      // Create exactly one Debit
      await tx.ledgerEntry.create({
        data: {
          ledgerTransactionId: transaction.id,
          ledgerAccountId: debitAccountId,
          type: LedgerEntryType.Debit,
          amount,
          currency,
        },
      });

      // Create exactly one Credit
      await tx.ledgerEntry.create({
        data: {
          ledgerTransactionId: transaction.id,
          ledgerAccountId: creditAccountId,
          type: LedgerEntryType.Credit,
          amount,
          currency,
        },
      });

      return transaction;
    });
  }

  // Immutable overrides
  async updateLedgerEntry() {
    throw new InfrastructureError("Immutable Ledger: Updates are strictly prohibited");
  }

  async deleteLedgerEntry() {
    throw new InfrastructureError("Immutable Ledger: Deletes are strictly prohibited");
  }

  // Balances are computed from ledger entries as source of truth
  async computeLedgerAccountBalance(ledgerAccountId: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { ledgerAccountId },
    });

    const debits = entries
      .filter((e) => e.type === LedgerEntryType.Debit)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const credits = entries
      .filter((e) => e.type === LedgerEntryType.Credit)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return debits - credits;
  }
}

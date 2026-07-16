import {
  ProofFactory,
  DomainMetrics,
  noopMetrics,
  makeCorrelationId,
  ProofGenerationError,
  proofGeneratedEvent,
  makeSettlementId,
} from "@korripay/domain";
import type { ProofRepository, AuditRepository } from "@korripay/database";
import type { IEventDispatcher } from "@korripay/domain";

export interface GenerateProofCommand {
  organizationId: string;
  settlementId: string;
  proofType: string;
  payload: Record<string, unknown>;
  correlationId: string;
}

export class ProofEngine {
  constructor(
    private readonly proofRepo: ProofRepository,
    private readonly auditRepo: AuditRepository,
    private readonly eventDispatcher: IEventDispatcher,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {}

  async generateProof(cmd: GenerateProofCommand): Promise<{ proofId: string; hash: string }> {
    return this.metrics.time("proof.generate", { type: cmd.proofType }, async () => {
      const correlationId = makeCorrelationId(cmd.correlationId);

      try {
        const proofId = ProofFactory.createProofId();
        const content = JSON.stringify({ settlementId: cmd.settlementId, ...cmd.payload, proofId });
        const hash = ProofFactory.computeHash(content);

        await this.proofRepo.saveProof(
          cmd.organizationId,
          cmd.settlementId,
          cmd.proofType,
          { ...cmd.payload, proofId, hash },
          "GENERATED"
        );

        await this.eventDispatcher.dispatch(
          proofGeneratedEvent(
            { settlementId: makeSettlementId(cmd.settlementId), proofId, hash },
            correlationId
          )
        );

        await this.auditRepo.log(
          "PROOF_GENERATED",
          "SettlementProof",
          cmd.settlementId,
          null,
          cmd.organizationId,
          correlationId,
          null,
          null,
          { proofId, hash, type: cmd.proofType }
        );
        this.metrics.increment("proof.generated", { type: cmd.proofType });

        return { proofId, hash };
      } catch (error) {
        throw new ProofGenerationError(error instanceof Error ? error.message : "Unknown error");
      }
    });
  }

  async generateCertificate(
    organizationId: string,
    settlementId: string,
    _correlationId: string
  ): Promise<{ hash: string; signature: string }> {
    const proofs = await this.proofRepo.findProofsBySettlementId(settlementId);
    if (proofs.length === 0) {
      throw new ProofGenerationError("No proofs found for settlement — cannot issue certificate");
    }

    const content = JSON.stringify({
      settlementId,
      proofs: proofs.map((p) => p.id),
      issuedAt: new Date().toISOString(),
    });
    const hash = ProofFactory.computeHash(content);
    const signature = ProofFactory.computeHash(`SIGNED:${hash}:${organizationId}`);

    await this.proofRepo.saveCertificate(organizationId, settlementId, hash, signature);
    return { hash, signature };
  }

  async verifyProof(settlementId: string, proofId: string): Promise<boolean> {
    const proofs = await this.proofRepo.findProofsBySettlementId(settlementId);
    return proofs.some((p) => {
      const payload = p.payload as Record<string, unknown>;
      return payload["proofId"] === proofId;
    });
  }
}

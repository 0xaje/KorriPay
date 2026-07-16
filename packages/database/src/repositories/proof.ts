import { BaseRepository } from "./base.js";

export class ProofRepository extends BaseRepository {
  async saveProof(
    organizationId: string,
    settlementId: string,
    type: string,
    payload: any,
    status: string
  ) {
    return this.prisma.settlementProof.create({
      data: { organizationId, settlementId, type, payload, status },
    });
  }

  async findProofsBySettlementId(settlementId: string) {
    return this.prisma.settlementProof.findMany({
      where: { settlementId },
    });
  }

  async saveCertificate(
    organizationId: string,
    settlementId: string,
    hash: string,
    signature: string
  ) {
    return this.prisma.settlementCertificate.create({
      data: { organizationId, settlementId, hash, signature },
    });
  }

  async findCertificateBySettlementId(settlementId: string) {
    return this.prisma.settlementCertificate.findFirst({
      where: { settlementId },
    });
  }
}

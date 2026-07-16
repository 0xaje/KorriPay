import { BaseRepository } from "./base.js";
import { KycStatus } from "@korripay/shared";

export class IdentityRepository extends BaseRepository {
  async createProfile(
    organizationId: string,
    userId: string,
    kycLevel: string,
    documentHash: string
  ) {
    return this.prisma.identityProfile.create({
      data: { organizationId, userId, kycLevel, documentHash },
    });
  }

  async findProfileByUserId(organizationId: string, userId: string) {
    return this.prisma.identityProfile.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { credentials: true, verifications: true },
    });
  }

  async updateProfileStatus(profileId: string, status: KycStatus) {
    return this.prisma.identityProfile.update({
      where: { id: profileId },
      data: { status },
    });
  }

  async addCredential(
    organizationId: string,
    profileId: string,
    type: string,
    dataHash: string,
    issuer: string,
    expiresAt?: Date
  ) {
    return this.prisma.credential.create({
      data: { organizationId, profileId, type, dataHash, issuer, expiresAt },
    });
  }

  async createAttestation(
    organizationId: string,
    targetId: string,
    targetType: string,
    signature: string,
    schema: string
  ) {
    return this.prisma.attestation.create({
      data: { organizationId, targetId, targetType, signature, schema },
    });
  }

  async addVerificationRecord(
    organizationId: string,
    profileId: string,
    status: KycStatus,
    inspector: string,
    details: any
  ) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.verificationRecord.create({
        data: { organizationId, profileId, status, inspector, details },
      });

      await tx.identityProfile.update({
        where: { id: profileId },
        data: { status },
      });

      return record;
    });
  }
}

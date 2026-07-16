import { KycStatus } from "@korripay/shared";
import {
  DomainMetrics,
  noopMetrics,
  makeCorrelationId,
  IdentityVerificationFailedError,
} from "@korripay/domain";
import type { IdentityRepository, AuditRepository } from "@korripay/database";
import type { IAttestationProvider } from "@korripay/domain";

export interface VerifyIdentityCommand {
  organizationId: string;
  userId: string;
  kycLevel: string;
  documentHash: string;
  correlationId: string;
}

export interface TrustScoreResult {
  score: number; // 0–100
  level: "UNVERIFIED" | "LOW" | "MEDIUM" | "HIGH" | "INSTITUTIONAL";
  kycStatus: KycStatus;
}

const KYC_SCORE_MAP: Record<string, number> = {
  LEVEL_1: 40,
  LEVEL_2: 65,
  LEVEL_3: 85,
  INSTITUTIONAL: 100,
};

export class IdentityEngine {
  private readonly attestationProvider?: IAttestationProvider;

  constructor(
    private readonly identityRepo: IdentityRepository,
    private readonly auditRepo: AuditRepository,
    attestationProvider?: IAttestationProvider,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {
    this.attestationProvider = attestationProvider;
  }

  async verifyIdentity(cmd: VerifyIdentityCommand): Promise<TrustScoreResult> {
    return this.metrics.time("identity.verify", { org: cmd.organizationId }, async () => {
      const correlationId = makeCorrelationId(cmd.correlationId);

      if (!cmd.documentHash || cmd.documentHash.length < 10) {
        throw new IdentityVerificationFailedError("Invalid or missing document hash");
      }

      // Upsert identity profile
      let profile = await this.identityRepo.findProfileByUserId(cmd.organizationId, cmd.userId);
      if (!profile) {
        await this.identityRepo.createProfile(
          cmd.organizationId,
          cmd.userId,
          cmd.kycLevel,
          cmd.documentHash
        );
        // Re-fetch to get full record
        profile = await this.identityRepo.findProfileByUserId(cmd.organizationId, cmd.userId);
      }

      if (!profile) {
        throw new IdentityVerificationFailedError("Failed to create or locate identity profile");
      }

      const score = KYC_SCORE_MAP[cmd.kycLevel] ?? 30;
      const level = this.scoreToLevel(score);

      await this.identityRepo.updateProfileStatus(profile.id, KycStatus.Verified);
      await this.identityRepo.addVerificationRecord(
        cmd.organizationId,
        profile.id,
        KycStatus.Verified,
        "IdentityEngine",
        { kycLevel: cmd.kycLevel, score }
      );

      await this.auditRepo.log(
        "IDENTITY_VERIFIED",
        "IdentityProfile",
        profile.id,
        cmd.userId,
        cmd.organizationId,
        correlationId,
        null,
        null,
        { score, level }
      );

      this.metrics.gauge("identity.trust_score", score, { org: cmd.organizationId });
      return { score, level, kycStatus: KycStatus.Verified };
    });
  }

  async calculateTrustScore(organizationId: string, userId: string): Promise<number> {
    const profile = await this.identityRepo.findProfileByUserId(organizationId, userId);
    if (!profile || profile.status !== KycStatus.Verified) return 0;
    return KYC_SCORE_MAP[profile.kycLevel] ?? 30;
  }

  async validateCredential(organizationId: string, userId: string, type: string): Promise<boolean> {
    const profile = await this.identityRepo.findProfileByUserId(organizationId, userId);
    if (!profile) return false;
    return profile.credentials.some((c) => c.type === type);
  }

  async verifyAttestation(attestationUid: string): Promise<boolean> {
    if (this.attestationProvider) {
      return this.attestationProvider.verify(attestationUid);
    }
    return false;
  }

  private scoreToLevel(score: number): TrustScoreResult["level"] {
    if (score >= 100) return "INSTITUTIONAL";
    if (score >= 80) return "HIGH";
    if (score >= 60) return "MEDIUM";
    if (score >= 30) return "LOW";
    return "UNVERIFIED";
  }
}

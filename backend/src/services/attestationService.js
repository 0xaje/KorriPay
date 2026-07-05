import { PrismaClient } from '@prisma/client';
import { webhookService } from './webhookService.js';

const prisma = new PrismaClient();

// Valid schemas allowed by the abstraction layer
const VALID_SCHEMAS = ['Identity', 'Merchant', 'Business', 'Payroll', 'Compliance'];
const VALID_STATUSES = ['Active', 'Revoked', 'Expired'];

export class AttestationService {
  /**
   * Create and store a new attestation.
   */
  async createAttestation({ issuer, subjectWallet, schema, details }) {
    if (!issuer) {
      throw new Error("Attestation Failed: Issuer address is required");
    }
    if (!subjectWallet || !subjectWallet.startsWith('0x')) {
      throw new Error("Attestation Failed: Subject Wallet must be a valid EVM address");
    }
    if (!VALID_SCHEMAS.includes(schema)) {
      throw new Error(`Attestation Failed: Invalid schema. Must be one of: ${VALID_SCHEMAS.join(', ')}`);
    }

    const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : details) : null;

    const attestation = await prisma.attestation.create({
      data: {
        issuer,
        subjectWallet,
        schema,
        status: 'Active',
        details: detailsStr
      }
    });

    console.log(`[AttestationService] Created ${schema} attestation: ${attestation.id} for ${subjectWallet}`);
    
    // Dispatch Webhook Event: attestation.issued
    webhookService.dispatchEvent('attestation.issued', {
      attestationId: attestation.id,
      issuer: attestation.issuer,
      subjectWallet: attestation.subjectWallet,
      schema: attestation.schema,
      status: attestation.status,
      timestamp: attestation.timestamp.toISOString()
    });

    return attestation;
  }

  /**
   * Get an attestation by ID.
   */
  async getAttestation(id) {
    const attestation = await prisma.attestation.findUnique({
      where: { id }
    });
    if (attestation && attestation.details) {
      try {
        attestation.parsedDetails = JSON.parse(attestation.details);
      } catch (e) {
        attestation.parsedDetails = attestation.details;
      }
    }
    return attestation;
  }

  /**
   * List/filter attestations.
   */
  async listAttestations({ subjectWallet, schema, status } = {}) {
    const where = {};
    if (subjectWallet) where.subjectWallet = subjectWallet;
    if (schema) {
      if (!VALID_SCHEMAS.includes(schema)) {
        throw new Error(`Invalid schema filter. Must be one of: ${VALID_SCHEMAS.join(', ')}`);
      }
      where.schema = schema;
    }
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      where.status = status;
    }

    const list = await prisma.attestation.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });

    return list.map(att => {
      if (att.details) {
        try {
          att.parsedDetails = JSON.parse(att.details);
        } catch (e) {
          att.parsedDetails = att.details;
        }
      }
      return att;
    });
  }

  /**
   * Revoke an active attestation.
   */
  async revokeAttestation(id) {
    const attestation = await prisma.attestation.findUnique({ where: { id } });
    if (!attestation) {
      throw new Error("Attestation not found");
    }

    const updated = await prisma.attestation.update({
      where: { id },
      data: { status: 'Revoked' }
    });

    console.log(`[AttestationService] Revoked attestation: ${id}`);
    return updated;
  }

  /**
   * Verify if an attestation is valid (active and exists).
   */
  async verifyAttestation(id) {
    const attestation = await prisma.attestation.findUnique({ where: { id } });
    if (!attestation) {
      return { valid: false, error: "Attestation not found" };
    }
    if (attestation.status !== 'Active') {
      return { valid: false, status: attestation.status, error: `Attestation is ${attestation.status}` };
    }
    return { valid: true, attestation };
  }
}

export const attestationService = new AttestationService();

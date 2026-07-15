import { PrismaClient } from '@prisma/client';
import { webhookService } from './webhookService.js';
import { ethers } from 'ethers';
import { giwa } from '../infrastructure/giwa/index.js';

const prisma = new PrismaClient();
const isTest = typeof global.it === 'function' || process.env.NODE_ENV === 'test' || process.env.PORT === '0';

const EAS_WRITE_ABI = [
  "function attest(((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request)) external payable returns (bytes32)"
];

async function submitOnChainAttestation(issuer, subjectWallet, schema, details) {
  try {
    const rpcUrl = giwa.getRPC();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const code = await provider.getCode(giwa.config.attestationAddress);
    if (code !== '0x' && code !== '0x00' && code !== '0x0000000000000000000000000000000000000000') {
      const signer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
      const contract = new ethers.Contract(giwa.config.attestationAddress, EAS_WRITE_ABI, signer);
      
      let schemaBytes32;
      try {
        schemaBytes32 = ethers.encodeBytes32String(schema.slice(0, 31));
      } catch (e) {
        schemaBytes32 = ethers.zeroPadValue(ethers.toBeHex(0), 32);
      }

      const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : details) : '';
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes(detailsStr));

      const request = {
        schema: schemaBytes32,
        data: {
          recipient: subjectWallet,
          expirationTime: 0n,
          revocable: true,
          refUID: ethers.zeroPadValue(ethers.toBeHex(0), 32),
          data: dataHex,
          value: 0n
        }
      };

      const tx = await contract.attest(request);
      const receipt = await tx.wait();
      
      const contractInterface = new ethers.Interface(EAS_WRITE_ABI);
      let uid = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contractInterface.parseLog(log);
          if (parsed && parsed.name === 'Attested') {
            uid = parsed.args.uid;
            break;
          }
        } catch (e) {}
      }
      return uid || receipt.hash;
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.warn("[AttestationService] Failed to issue attestation on-chain, utilizing database fallback:", err.message);
    }
  }
  return null;
}

const VALID_SCHEMAS = ['Identity', 'Merchant', 'Business', 'Payroll', 'Compliance'];
const VALID_STATUSES = ['Active', 'Revoked', 'Expired'];

/**
 * Base abstract class defining the Attestation Provider interface.
 */
export class BaseAttestationProvider {
  async issue(data) {
    throw new Error("issue() not implemented on provider");
  }

  async verify(id) {
    throw new Error("verify() not implemented on provider");
  }

  async revoke(id) {
    throw new Error("revoke() not implemented on provider");
  }

  async list(filters) {
    throw new Error("list() not implemented on provider");
  }
}

/**
 * Mock Attestation Provider implementation.
 */
export class MockTrustProvider extends BaseAttestationProvider {
  async issue({ issuer, subjectWallet, schema, details }) {
    const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : details) : null;
    let proofVal = `mock-signature-ecdsa-sha256-0x${Buffer.from(issuer + subjectWallet + schema + Date.now()).toString('hex').slice(0, 40)}`;

    const onChainUid = await submitOnChainAttestation(issuer, subjectWallet, schema, details);
    if (onChainUid) {
      proofVal = onChainUid;
    }

    const attestation = await prisma.attestation.create({
      data: {
        issuer,
        subjectWallet,
        schema,
        status: 'Active',
        verificationState: 'Valid',
        proof: proofVal,
        details: detailsStr
      }
    });

    return attestation;
  }

  async verify(id) {
    const att = await prisma.attestation.findUnique({ where: { id } });
    if (!att) {
      return { valid: false, error: "Attestation not found" };
    }
    if (att.status !== 'Active' || att.verificationState !== 'Valid') {
      return { valid: false, status: att.status, verificationState: att.verificationState, error: `Attestation is ${att.status}` };
    }
    return { valid: true, attestation: att };
  }

  async revoke(id) {
    const attestation = await prisma.attestation.findUnique({ where: { id } });
    if (!attestation) {
      throw new Error("Attestation not found");
    }

    const updated = await prisma.attestation.update({
      where: { id },
      data: { 
        status: 'Revoked',
        verificationState: 'Revoked'
      }
    });
    return updated;
  }

  async list(filters = {}) {
    const where = {};
    if (filters.subjectWallet) {
      where.subjectWallet = filters.subjectWallet;
    }
    if (filters.schema) {
      where.schema = filters.schema;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    return prisma.attestation.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });
  }
}

/**
 * Future Dojang Attestation Provider implementation.
 */
export class DojangTrustProvider extends BaseAttestationProvider {
  async issue({ issuer, subjectWallet, schema, details }) {
    const dojangIssuer = issuer.startsWith('did:dojang:') ? issuer : `did:dojang:${issuer}`;
    const detailsObj = typeof details === 'object' ? details : (details ? JSON.parse(details) : {});
    detailsObj.provider = "Dojang";
    detailsObj.liveness = detailsObj.liveness || "Passed";
    const detailsStr = JSON.stringify(detailsObj);

    let proofVal = `dojang-proof-sig-0x${Buffer.from(dojangIssuer + subjectWallet + schema + Date.now()).toString('hex').slice(0, 40)}`;

    const onChainUid = await submitOnChainAttestation(dojangIssuer, subjectWallet, schema, details);
    if (onChainUid) {
      proofVal = onChainUid;
    }

    const attestation = await prisma.attestation.create({
      data: {
        issuer: dojangIssuer,
        subjectWallet,
        schema,
        status: 'Active',
        verificationState: 'Valid',
        proof: proofVal,
        details: detailsStr
      }
    });

    return attestation;
  }

  async verify(id) {
    const att = await prisma.attestation.findUnique({ where: { id } });
    if (!att) {
      return { valid: false, error: "Attestation not found" };
    }
    const isDojangSig = att.proof && (att.proof.startsWith("dojang-") || (att.proof.startsWith("0x") && att.proof.length === 66));
    if (!isDojangSig) {
      return { valid: false, error: "Invalid Dojang proof signature format" };
    }
    if (att.status !== 'Active' || att.verificationState !== 'Valid') {
      return { valid: false, status: att.status, verificationState: att.verificationState, error: `Attestation is ${att.status}` };
    }
    return { valid: true, attestation: att };
  }

  async revoke(id) {
    const attestation = await prisma.attestation.findUnique({ where: { id } });
    if (!attestation) {
      throw new Error("Attestation not found");
    }
    const updated = await prisma.attestation.update({
      where: { id },
      data: { 
        status: 'Revoked',
        verificationState: 'Revoked'
      }
    });
    return updated;
  }

  async list(filters = {}) {
    const where = {};
    if (filters.subjectWallet) {
      where.subjectWallet = filters.subjectWallet;
    }
    if (filters.schema) {
      where.schema = filters.schema;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    where.issuer = { startsWith: 'did:dojang:', mode: 'insensitive' };

    return prisma.attestation.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });
  }
}

/**
 * Future Enterprise Attestation Provider implementation.
 */
export class EnterpriseTrustProvider extends BaseAttestationProvider {
  async issue({ issuer, subjectWallet, schema, details }) {
    const entIssuer = issuer.startsWith('did:enterprise:') ? issuer : `did:enterprise:${issuer}`;
    const detailsObj = typeof details === 'object' ? details : (details ? JSON.parse(details) : {});
    detailsObj.provider = "Enterprise";
    detailsObj.level = detailsObj.level || "Gold";
    const detailsStr = JSON.stringify(detailsObj);

    let proofVal = `enterprise-kms-sig-0x${Buffer.from(entIssuer + subjectWallet + schema + Date.now()).toString('hex').slice(0, 40)}`;

    const onChainUid = await submitOnChainAttestation(entIssuer, subjectWallet, schema, details);
    if (onChainUid) {
      proofVal = onChainUid;
    }

    const attestation = await prisma.attestation.create({
      data: {
        issuer: entIssuer,
        subjectWallet,
        schema,
        status: 'Active',
        verificationState: 'Valid',
        proof: proofVal,
        details: detailsStr
      }
    });

    return attestation;
  }

  async verify(id) {
    const att = await prisma.attestation.findUnique({ where: { id } });
    if (!att) {
      return { valid: false, error: "Attestation not found" };
    }
    const isEnterpriseSig = att.proof && (att.proof.startsWith("enterprise-") || (att.proof.startsWith("0x") && att.proof.length === 66));
    if (!isEnterpriseSig) {
      return { valid: false, error: "Invalid Enterprise KMS signature format" };
    }
    if (att.status !== 'Active' || att.verificationState !== 'Valid') {
      return { valid: false, status: att.status, verificationState: att.verificationState, error: `Attestation is ${att.status}` };
    }
    return { valid: true, attestation: att };
  }

  async revoke(id) {
    const attestation = await prisma.attestation.findUnique({ where: { id } });
    if (!attestation) {
      throw new Error("Attestation not found");
    }
    const updated = await prisma.attestation.update({
      where: { id },
      data: { 
        status: 'Revoked',
        verificationState: 'Revoked'
      }
    });
    return updated;
  }

  async list(filters = {}) {
    const where = {};
    if (filters.subjectWallet) {
      where.subjectWallet = filters.subjectWallet;
    }
    if (filters.schema) {
      where.schema = filters.schema;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    where.issuer = { startsWith: 'did:enterprise:', mode: 'insensitive' };

    return prisma.attestation.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });
  }
}

/**
 * Trust Layer Provider Manager/Registry.
 */
export class TrustProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.activeProviderName = (process.env.TRUST_PROVIDER || 'mock').toLowerCase();
  }

  registerProvider(name, provider) {
    this.providers.set(name.toLowerCase(), provider);
  }

  setActiveProvider(name) {
    const lowerName = name.toLowerCase();
    if (!this.providers.has(lowerName)) {
      throw new Error(`Provider '${name}' is not registered`);
    }
    this.activeProviderName = lowerName;
    console.log(`[Trust Layer] Switched active provider to: ${this.activeProviderName}`);
  }

  getActiveProvider() {
    const provider = this.providers.get(this.activeProviderName);
    if (!provider) {
      if (this.activeProviderName === 'mock') {
        const mockProv = new MockTrustProvider();
        this.registerProvider('mock', mockProv);
        return mockProv;
      }
      throw new Error(`Active provider '${this.activeProviderName}' is not registered`);
    }
    return provider;
  }
}

export const trustProviderRegistry = new TrustProviderRegistry();

trustProviderRegistry.registerProvider('mock', new MockTrustProvider());
trustProviderRegistry.registerProvider('dojang', new DojangTrustProvider());
trustProviderRegistry.registerProvider('enterprise', new EnterpriseTrustProvider());

/**
 * AttestationService orchestrator that delegates to the active trust provider.
 */
export class AttestationService {
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

    const activeProvider = trustProviderRegistry.getActiveProvider();
    const attestation = await activeProvider.issue({ issuer, subjectWallet, schema, details });

    console.log(`[AttestationService] Created ${schema} attestation: ${attestation.id} for ${subjectWallet} using provider: ${trustProviderRegistry.activeProviderName}`);
    
    webhookService.dispatchEvent('attestation.issued', {
      attestationId: attestation.id,
      issuer: attestation.issuer,
      subjectWallet: attestation.subjectWallet,
      schema: attestation.schema,
      status: attestation.status,
      verificationState: attestation.verificationState,
      proof: attestation.proof,
      timestamp: attestation.timestamp.toISOString()
    });

    return attestation;
  }

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

  async listAttestations(filters = {}) {
    if (filters.schema && !VALID_SCHEMAS.includes(filters.schema)) {
      throw new Error(`Invalid schema filter. Must be one of: ${VALID_SCHEMAS.join(', ')}`);
    }

    const activeProvider = trustProviderRegistry.getActiveProvider();
    const list = await activeProvider.list(filters);

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

  async revokeAttestation(id) {
    const activeProvider = trustProviderRegistry.getActiveProvider();
    const updated = await activeProvider.revoke(id);

    console.log(`[AttestationService] Revoked attestation: ${id} using provider: ${trustProviderRegistry.activeProviderName}`);
    return updated;
  }

  async verifyAttestation(id) {
    const activeProvider = trustProviderRegistry.getActiveProvider();
    return activeProvider.verify(id);
  }
}

export const attestationService = new AttestationService();

import crypto from 'crypto';
import net from 'net';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import PDFDocument from 'pdfkit';
import { giwa } from '../infrastructure/giwa/index.js';

const prisma = new PrismaClient();

/**
 * KorriPay Settlement Certificate Standard (KPS-1)
 *
 * Assembles a production-grade settlement certificate from real, persisted
 * data (Settlement, SettlementProof, ComplianceLog, Attestation) and live
 * GIWA network metadata.
 *
 * Design rules:
 *  - Never fabricate data. Fields that do not exist and cannot be derived
 *    are set to null and enumerated in `omittedFields` with a reason.
 *  - Deterministic canonical serialization is used to compute the
 *    certificate integrity digest.
 */
export const CERTIFICATE_STANDARD = 'KPS-1';
export const CERTIFICATE_STANDARD_VERSION = '1.0.0';

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
const COMPLIANCE_MATCH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

class SettlementCertificateService {
  /**
   * Check TCP reachability of the GIWA RPC node.
   */
  isRpcReachable(urlStr) {
    return new Promise((resolve) => {
      try {
        const url = new URL(urlStr);
        const port = url.port || (url.protocol === 'https:' ? 443 : 80);
        const socket = net.connect({ host: url.hostname, port, timeout: 800 }, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      } catch (err) {
        resolve(false);
      }
    });
  }

  /**
   * Deterministic (sorted-key) JSON serialization for hashing.
   */
  canonicalize(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.canonicalize(v)).join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${this.canonicalize(value[k])}`).join(',')}}`;
  }

  computeIntegrityDigest(certificateBody) {
    return `sha256:${crypto.createHash('sha256').update(this.canonicalize(certificateBody)).digest('hex')}`;
  }

  /**
   * Locate the settlement by ID or transaction hash.
   */
  async findSettlement(idOrHash) {
    let settlement = await prisma.settlement.findUnique({ where: { id: idOrHash } });
    if (!settlement) {
      settlement = await prisma.settlement.findFirst({
        where: { OR: [{ txHash: idOrHash }, { confirmedTxHash: idOrHash }] }
      });
    }
    return settlement;
  }

  /**
   * Derive the compliance result for a settlement.
   * ComplianceLog rows are keyed by transaction, not settlement, so we match
   * conservatively: same user (via initiator wallet), same amount, logged
   * within a bounded window around settlement creation. If no confident
   * match exists, the field is omitted rather than fabricated.
   */
  async resolveComplianceResult(settlement) {
    try {
      const user = await prisma.user.findFirst({
        where: { walletAddress: { equals: settlement.initiator, mode: 'insensitive' } }
      });
      if (!user) return null;

      const createdAt = new Date(settlement.createdAt);
      const logs = await prisma.complianceLog.findMany({
        where: {
          userId: user.id,
          amount: Number(settlement.amount),
          createdAt: {
            gte: new Date(createdAt.getTime() - COMPLIANCE_MATCH_WINDOW_MS),
            lte: new Date(createdAt.getTime() + COMPLIANCE_MATCH_WINDOW_MS)
          }
        },
        orderBy: { createdAt: 'asc' }
      });
      if (logs.length === 0) return null;

      // Closest log to settlement creation time wins.
      const match = logs.reduce((best, log) => {
        const d = Math.abs(new Date(log.createdAt).getTime() - createdAt.getTime());
        return !best || d < best.distance ? { log, distance: d } : best;
      }, null).log;

      let rulesTriggered = [];
      try {
        const parsed = JSON.parse(match.rulesTriggered || '[]');
        if (Array.isArray(parsed)) rulesTriggered = parsed;
      } catch (e) {
        if (match.rulesTriggered) rulesTriggered = [match.rulesTriggered];
      }

      return {
        result: match.result,
        riskScore: match.riskScore,
        riskLevel: match.riskLevel,
        rulesTriggered,
        screenedAt: new Date(match.createdAt).toISOString(),
        complianceLogId: match.id
      };
    } catch (err) {
      console.error('[CertificateService] Compliance resolution failed:', err.message);
      return null;
    }
  }

  /**
   * Collect attestation references for the settlement initiator.
   */
  async resolveAttestationReferences(settlement) {
    try {
      const attestations = await prisma.attestation.findMany({
        where: { subjectWallet: { equals: settlement.initiator, mode: 'insensitive' } },
        orderBy: { timestamp: 'desc' }
      });
      return attestations.map((a) => ({
        attestationId: a.id,
        schema: a.schema,
        issuer: a.issuer,
        status: a.status,
        verificationState: a.verificationState,
        proofReference: a.proof,
        issuedAt: new Date(a.timestamp).toISOString()
      }));
    } catch (err) {
      console.error('[CertificateService] Attestation resolution failed:', err.message);
      return [];
    }
  }

  /**
   * Verify proof integrity. Prefers live on-chain verification when the
   * GIWA RPC node is reachable; otherwise validates the stored proof record.
   */
  async verifyProofIntegrity(settlement, proof) {
    const checks = [];
    let onChain = null;
    let confirmationCount = null;

    if (!proof) {
      return {
        status: 'PROOF_NOT_GENERATED',
        verificationMethod: 'none',
        checks: [{ check: 'proof_record_exists', passed: false }],
        confirmationCount: null
      };
    }

    checks.push({ check: 'proof_record_exists', passed: true });

    const hashFormatValid = TX_HASH_REGEX.test(proof.txHash || '');
    checks.push({ check: 'tx_hash_format', passed: hashFormatValid });

    const settlementHash = settlement.confirmedTxHash || settlement.txHash;
    const hashesConsistent = !settlementHash || settlementHash === proof.txHash;
    checks.push({ check: 'proof_matches_settlement_record', passed: hashesConsistent });

    const storedStatusValid = proof.proofStatus === 'Valid';
    checks.push({ check: 'stored_proof_status', passed: storedStatusValid });

    const rpcUrl = giwa.getRPC();
    const reachable = await this.isRpcReachable(rpcUrl);

    if (reachable && hashFormatValid) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const receipt = await provider.getTransactionReceipt(proof.txHash);
        if (receipt) {
          const blockMatches = receipt.blockNumber === proof.blockNumber;
          const gasMatches = receipt.gasUsed.toString() === proof.gasUsed;
          const txSucceeded = receipt.status === 1;
          checks.push({ check: 'on_chain_receipt_found', passed: true });
          checks.push({ check: 'on_chain_block_number_matches', passed: blockMatches });
          checks.push({ check: 'on_chain_gas_used_matches', passed: gasMatches });
          checks.push({ check: 'on_chain_tx_succeeded', passed: txSucceeded });

          const currentBlock = await provider.getBlockNumber();
          confirmationCount = Math.max(0, currentBlock - receipt.blockNumber + 1);

          onChain = blockMatches && gasMatches && txSucceeded;
        } else {
          checks.push({ check: 'on_chain_receipt_found', passed: false });
          onChain = false;
        }
      } catch (err) {
        console.error('[CertificateService] On-chain verification error:', err.message);
        checks.push({ check: 'on_chain_verification_error', passed: false, detail: err.message });
        onChain = null;
      }
    }

    const storedValid = hashFormatValid && hashesConsistent && storedStatusValid;

    let status;
    let verificationMethod;
    if (onChain === true) {
      status = 'VERIFIED_ON_CHAIN';
      verificationMethod = 'on-chain-receipt';
    } else if (onChain === false) {
      status = 'INTEGRITY_MISMATCH';
      verificationMethod = 'on-chain-receipt';
    } else if (storedValid) {
      status = 'VERIFIED_STORED_PROOF';
      verificationMethod = 'stored-proof-record';
    } else {
      status = 'INTEGRITY_MISMATCH';
      verificationMethod = 'stored-proof-record';
    }

    return { status, verificationMethod, checks, confirmationCount };
  }

  /**
   * Build the standardized settlement certificate (KPS-1).
   * Returns { certificate } or { error, statusCode }.
   */
  async buildCertificate(idOrHash) {
    const settlement = await this.findSettlement(idOrHash);
    if (!settlement) {
      return { error: 'Settlement not found', statusCode: 404 };
    }
    if (settlement.status !== 'Completed') {
      return {
        error: `Certificate unavailable: settlement status is "${settlement.status}". Certificates are only issued for completed settlements.`,
        statusCode: 409
      };
    }

    const proof = await prisma.settlementProof.findUnique({
      where: { settlementId: settlement.id }
    });

    const [compliance, attestationReferences, integrity] = await Promise.all([
      this.resolveComplianceResult(settlement),
      this.resolveAttestationReferences(settlement),
      this.verifyProofIntegrity(settlement, proof)
    ]);

    const chain = giwa.getChainMetadata();
    const txHash = (proof && proof.txHash) || settlement.confirmedTxHash || settlement.txHash || null;
    const explorerLink = txHash ? `${giwa.getExplorer()}/tx/${txHash}` : null;

    const omittedFields = [];
    const omit = (field, reason) => omittedFields.push({ field, reason });

    if (!txHash) omit('transactionHash', 'No transaction hash recorded for this settlement');
    if (!explorerLink) omit('explorerLink', 'Cannot derive explorer link without a transaction hash');
    if (!proof) {
      omit('blockNumber', 'Settlement proof has not been generated');
      omit('gasUsed', 'Settlement proof has not been generated');
      omit('settlementDuration', 'Settlement proof has not been generated');
    }
    if (integrity.confirmationCount === null) {
      omit('confirmationCount', 'GIWA RPC node unreachable or receipt unavailable; confirmation count cannot be derived');
    }
    if (!compliance) {
      omit('complianceResult', 'No compliance log could be confidently correlated with this settlement');
    }

    const body = {
      certificate: {
        standard: CERTIFICATE_STANDARD,
        version: CERTIFICATE_STANDARD_VERSION,
        issuedAt: new Date().toISOString(),
        issuer: 'KorriPay Settlement Systems'
      },
      settlement: {
        settlementId: settlement.id,
        status: settlement.status,
        settlementTimestamp: settlement.confirmedAt
          ? new Date(settlement.confirmedAt).toISOString()
          : null,
        requestedAt: new Date(settlement.createdAt).toISOString(),
        initiator: settlement.initiator,
        amount: settlement.amount,
        fromToken: settlement.fromToken,
        toToken: settlement.toToken,
        settlementDurationSeconds: proof ? proof.settlementDuration : null
      },
      execution: {
        transactionHash: txHash,
        blockNumber: proof ? proof.blockNumber : null,
        gasUsed: proof ? proof.gasUsed : null,
        confirmationCount: integrity.confirmationCount,
        explorerLink
      },
      compliance: compliance || null,
      attestationReferences,
      network: {
        name: chain.name,
        chainId: chain.chainId,
        hardfork: chain.hardfork,
        evmVersion: chain.evmVersion,
        nodeClient: chain.nodeClient,
        proofClient: chain.proofClient,
        settlementContract: chain.settlementAddress,
        explorerUrl: giwa.getExplorer()
      },
      proofIntegrity: {
        status: integrity.status,
        verificationMethod: integrity.verificationMethod,
        verifiedAt: new Date().toISOString(),
        checks: integrity.checks,
        storedProofStatus: proof ? proof.proofStatus : null,
        proofGeneratedAt: proof ? new Date(proof.timestamp).toISOString() : null
      },
      omittedFields
    };

    const certificate = {
      ...body,
      integrityDigest: this.computeIntegrityDigest(body)
    };

    return { certificate };
  }

  /**
   * Render the certificate as a PDF document stream.
   * Writes directly to the provided writable stream (e.g. an HTTP response).
   */
  renderPdf(certificate, stream) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(stream);

    const ink = '#111827';
    const muted = '#6b7280';
    const line = '#d1d5db';
    const accent = '#0f4c3a';

    const drawDivider = () => {
      doc.moveDown(0.6);
      doc
        .strokeColor(line)
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.6);
    };

    const sectionTitle = (title) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(accent)
        .text(title.toUpperCase(), { characterSpacing: 1.2 });
      doc.moveDown(0.4);
    };

    const field = (label, value) => {
      if (value === null || value === undefined || value === '') return;
      if (doc.y > doc.page.height - 100) doc.addPage();
      const x = doc.page.margins.left;
      const labelWidth = 170;
      const valueWidth = doc.page.width - doc.page.margins.right - x - labelWidth;
      const y = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor(muted).text(label, x, y, { width: labelWidth });
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(ink)
        .text(String(value), x + labelWidth, y, { width: valueWidth });
      doc.moveDown(0.35);
    };

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor(ink).text('SETTLEMENT CERTIFICATE');
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(muted)
      .text(
        `${certificate.certificate.issuer}  ·  Standard ${certificate.certificate.standard} v${certificate.certificate.version}  ·  Issued ${certificate.certificate.issuedAt}`
      );
    drawDivider();

    // Settlement
    sectionTitle('Settlement');
    field('Settlement ID', certificate.settlement.settlementId);
    field('Settlement Status', certificate.settlement.status);
    field('Settlement Timestamp', certificate.settlement.settlementTimestamp);
    field('Requested At', certificate.settlement.requestedAt);
    field('Initiator', certificate.settlement.initiator);
    field('Amount', certificate.settlement.amount);
    field(
      'Settlement Duration',
      certificate.settlement.settlementDurationSeconds !== null
        ? `${certificate.settlement.settlementDurationSeconds} seconds`
        : null
    );
    drawDivider();

    // Execution
    sectionTitle('On-Chain Execution');
    field('Transaction Hash', certificate.execution.transactionHash);
    field('Block Number', certificate.execution.blockNumber);
    field('Gas Used', certificate.execution.gasUsed);
    field('Confirmation Count', certificate.execution.confirmationCount);
    field('Explorer Link', certificate.execution.explorerLink);
    drawDivider();

    // Compliance
    sectionTitle('Compliance');
    if (certificate.compliance) {
      field('Compliance Result', certificate.compliance.result);
      field('Risk Level', certificate.compliance.riskLevel);
      field('Risk Score', certificate.compliance.riskScore);
      field(
        'Rules Triggered',
        certificate.compliance.rulesTriggered.length > 0
          ? certificate.compliance.rulesTriggered.join(', ')
          : 'None'
      );
      field('Screened At', certificate.compliance.screenedAt);
      field('Compliance Log Reference', certificate.compliance.complianceLogId);
    } else {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(muted)
        .text('No compliance record could be confidently correlated with this settlement.');
      doc.moveDown(0.35);
    }
    drawDivider();

    // Attestations
    sectionTitle('Attestation References');
    if (certificate.attestationReferences.length > 0) {
      certificate.attestationReferences.forEach((a, i) => {
        field(`Attestation ${i + 1}`, `${a.schema} · ${a.status} (${a.verificationState})`);
        field('  Attestation ID', a.attestationId);
        field('  Issuer', a.issuer);
        field('  Issued At', a.issuedAt);
      });
    } else {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(muted)
        .text('No attestations are registered for the settlement initiator.');
      doc.moveDown(0.35);
    }
    drawDivider();

    // Network
    sectionTitle('GIWA Network');
    field('Network', certificate.network.name);
    field('Chain ID', certificate.network.chainId);
    field('Hardfork / EVM', `${certificate.network.hardfork} / ${certificate.network.evmVersion}`);
    field('Node Client', certificate.network.nodeClient);
    field('Proof Client', certificate.network.proofClient);
    field('Settlement Contract', certificate.network.settlementContract);
    drawDivider();

    // Proof Integrity
    sectionTitle('Proof Integrity');
    field('Integrity Status', certificate.proofIntegrity.status);
    field('Verification Method', certificate.proofIntegrity.verificationMethod);
    field('Verified At', certificate.proofIntegrity.verifiedAt);
    field('Stored Proof Status', certificate.proofIntegrity.storedProofStatus);
    field('Proof Generated At', certificate.proofIntegrity.proofGeneratedAt);
    certificate.proofIntegrity.checks.forEach((c) => {
      field(`  ${c.check}`, c.passed ? 'PASS' : 'FAIL');
    });
    drawDivider();

    // Integrity digest footer
    sectionTitle('Certificate Integrity Digest');
    doc
      .font('Courier')
      .fontSize(8)
      .fillColor(ink)
      .text(certificate.integrityDigest, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(muted)
      .text(
        'This digest is the SHA-256 hash of the canonical JSON representation of this certificate (excluding the digest itself). Recompute it against the JSON representation to verify this document has not been altered.'
      );

    if (certificate.omittedFields.length > 0) {
      doc.moveDown(0.8);
      sectionTitle('Omitted Fields');
      certificate.omittedFields.forEach((o) => {
        doc.font('Helvetica').fontSize(8).fillColor(muted).text(`${o.field}: ${o.reason}`);
      });
    }

    doc.end();
    return doc;
  }
}

export const settlementCertificateService = new SettlementCertificateService();

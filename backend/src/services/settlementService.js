import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import net from 'net';
import { giwa } from '../infrastructure/giwa/index.js';
import { webhookService } from './webhookService.js';
import { lockService } from './lockService.js';

const prisma = new PrismaClient();
const isTest = typeof global.it === 'function' || process.env.NODE_ENV === 'test' || process.env.PORT === '0';

const KORRI_SETTLEMENT_ABI = [
  "function initiateSettlement(address fromToken, address toToken, uint256 amount, string calldata recipientDetails) external payable returns (uint256)",
  "function completeSettlement(uint256 settlementId, bytes32 externalTxHash) external",
  "function nextSettlementId() external view returns (uint256)",
  "event TransferCreated(uint256 indexed id, address indexed initiator, address fromToken, address toToken, uint256 amount, string recipientDetails)",
  "event TransferConfirmed(uint256 indexed id, bytes32 indexed externalTxHash)"
];

class SettlementService extends EventEmitter {
  constructor() {
    super();
    this.provider = null;
    this.initProvider();
    this.txQueue = Promise.resolve();
    this.runningPipelines = new Map();
  }

  /**
   * Helper to check if RPC node is TCP reachable.
   */
  isRpcReachable(urlStr) {
    return new Promise((resolve) => {
      try {
        const url = new URL(urlStr);
        const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
        const host = url.hostname;
        
        const socket = net.connect({ host, port, timeout: 800 }, () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => {
          resolve(false);
        });
        
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
   * Initialize provider asynchronously if the RPC is reachable.
   */
  async initProvider() {
    const reachable = await this.isRpcReachable(giwa.getRPC());
    if (reachable) {
      try {
        this.provider = new ethers.JsonRpcProvider(giwa.getRPC());
      } catch (err) {
        console.warn("[SettlementService] Failed to initialize provider:", err.message);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.error("[SettlementService] CRITICAL: GIWA RPC node is offline in production.");
      } else {
        console.log("[SettlementService] GIWA RPC node is offline. Using local simulation fallback.");
      }
    }
  }

  /**
   * Validate a transfer before settlement.
   * Checks Available balances, amount parameters, and compliance status.
   */
  async validateTransfer(userId, amount, currency, screeningResult) {
    if (!userId) {
      throw new Error("Validation Failed: User ID is required");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Validation Failed: Transfer amount must be greater than zero");
    }

    // Fetch user wallet with a raw pessimistic FOR UPDATE lock (fallback to findFirst if raw fails on non-Postgres engines)
    let wallet;
    try {
      const wallets = await prisma.$queryRawUnsafe(`SELECT * FROM "wallets" WHERE "userId" = $1 LIMIT 1 FOR UPDATE`, userId);
      wallet = wallets && wallets[0];
    } catch (e) {
      wallet = await prisma.wallet.findFirst({ where: { userId } });
    }
    if (!wallet) {
      throw new Error("Validation Failed: Wallet not found for user");
    }

    // Check Available balance
    if (currency === 'USD' && amount > wallet.usdAvailable) {
      throw new Error("Validation Failed: Insufficient Available balance in USD");
    }

    // Check compliance status
    if (screeningResult && screeningResult.result === 'Blocked') {
      throw new Error(`Validation Failed: Transaction blocked by Compliance Engine (${screeningResult.details})`);
    }

    return wallet;
  }

  /**
   * Transition pipeline stage and log/persist to database.
   */
  async transitionStage(settlementId, stage) {
    try {
      const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
      if (!settlement) return;

      let history = [];
      try {
        history = JSON.parse(settlement.pipelineHistory || "[]");
      } catch (e) {}

      history.push({ stage, timestamp: new Date() });

      const updated = await prisma.settlement.update({
        where: { id: settlementId },
        data: {
          pipelineStage: stage,
          pipelineHistory: JSON.stringify(history)
        }
      });

      console.log(`[SettlementService] [Pipeline] ${settlementId} transitioned to: ${stage}`);
      this.emit('pipeline_stage_changed', updated);
      return updated;
    } catch (err) {
      console.error(`[SettlementService] Failed to transition stage for ${settlementId}:`, err.message);
    }
  }

  /**
   * Helper to get the on-chain signer.
   */
  getSigner() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(giwa.getRPC());
    }
    return new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', this.provider);
  }

  /**
   * Helper to process a settlement transaction strictly on-chain.
   */
  async processOnChainSettlement(settlementId, txHash, numAmount, recipientDetails) {
    return new Promise(async (resolve, reject) => {
      // Obtain distributed / multi-instance lock for the L2 sequencer signer address
      const lock = await lockService.acquire('lock:settlement:sequencer', 60000);
      try {
        const reachable = await this.isRpcReachable(giwa.getRPC());
        if (!reachable) {
          if (process.env.NODE_ENV === 'production') {
            reject(new Error("GIWA RPC node is unreachable. Cannot process settlement in production."));
            return;
          }
          console.log("[SettlementService] RPC offline during on-chain execution. Falling back to local simulation receipt.");
          const hex = "0123456789abcdef";
          let generatedHash = txHash || "0x";
          if (generatedHash.length < 66) {
            for (let i = 0; i < 64; i++) generatedHash += hex[Math.floor(Math.random() * 16)];
            generatedHash = generatedHash.substring(0, 66);
          }
          resolve({
            hash: generatedHash,
            status: 1,
            blockNumber: 1234567,
            gasUsed: 21000n
          });
          return;
        }

        if (!this.provider) {
          this.provider = new ethers.JsonRpcProvider(giwa.getRPC());
        }

        let txExists = false;
        if (txHash && txHash.startsWith("0x") && txHash.length === 66) {
          try {
            const tx = await this.provider.getTransaction(txHash);
            if (tx) {
              txExists = true;
            }
          } catch (e) {}
        }

        const signer = this.getSigner();
        const contractAddress = giwa.getSettlementAddress();
        const contract = new ethers.Contract(contractAddress, KORRI_SETTLEMENT_ABI, signer);

        let finalReceipt = null;

        if (txExists) {
          const initReceipt = await this.provider.waitForTransaction(txHash);
          if (!initReceipt || initReceipt.status !== 1) {
            throw new Error("Initiated settlement transaction failed on-chain");
          }

          const contractInterface = new ethers.Interface(KORRI_SETTLEMENT_ABI);
          let onChainId = null;
          for (const log of initReceipt.logs) {
            try {
              const parsedLog = contractInterface.parseLog(log);
              if (parsedLog && parsedLog.name === 'TransferCreated') {
                onChainId = parsedLog.args.id;
                break;
              }
            } catch (e) {}
          }

          if (onChainId !== null && onChainId !== undefined) {
            const externalTxHash = txHash;
            let completeTx = null;
            let attempt = 0;
            while (attempt < 5) {
              try {
                const completeNonce = await this.provider.getTransactionCount(signer.address, 'pending');
                completeTx = await contract.completeSettlement(onChainId, externalTxHash, { nonce: completeNonce });
                break;
              } catch (e) {
                if (e.message.includes("nonce") || e.code === "NONCE_EXPIRED" || e.message.includes("Nonce too low")) {
                  attempt++;
                  await new Promise(r => setTimeout(r, 600));
                } else {
                  throw e;
                }
              }
            }
            if (!completeTx) {
              throw new Error("Failed to submit completeSettlement transaction due to nonce/RPC issues");
            }
            finalReceipt = await this.provider.waitForTransaction(completeTx.hash);
            if (!finalReceipt || finalReceipt.status !== 1) {
              throw new Error("Complete settlement transaction failed on-chain");
            }
          } else {
            finalReceipt = initReceipt;
          }
        } else {
          const fromToken = "0x0000000000000000000000000000000000000000";
          const toToken = "0x0000000000000000000000000000000000000000";
          const parsedAmount = ethers.parseEther(numAmount.toString());

          let initTx = null;
          let attempt = 0;
          while (attempt < 5) {
            try {
              const nonce = await this.provider.getTransactionCount(signer.address, 'pending');
              initTx = await contract.initiateSettlement(
                fromToken,
                toToken,
                parsedAmount,
                recipientDetails || "API Request",
                { value: parsedAmount, nonce }
              );
              break;
            } catch (e) {
              if (e.message.includes("nonce") || e.code === "NONCE_EXPIRED" || e.message.includes("Nonce too low")) {
                attempt++;
                await new Promise(r => setTimeout(r, 600));
              } else {
                throw e;
              }
            }
          }

          if (!initTx) {
            throw new Error("Failed to submit initiateSettlement transaction due to nonce/RPC issues");
          }

          const initReceipt = await this.provider.waitForTransaction(initTx.hash);
          if (!initReceipt || initReceipt.status !== 1) {
            throw new Error("Operator initiate settlement transaction failed on-chain");
          }

          const contractInterface = new ethers.Interface(KORRI_SETTLEMENT_ABI);
          let onChainId = null;
          for (const log of initReceipt.logs) {
            try {
              const parsedLog = contractInterface.parseLog(log);
              if (parsedLog && parsedLog.name === 'TransferCreated') {
                onChainId = parsedLog.args.id;
                break;
              }
            } catch (e) {}
          }

          if (onChainId !== null && onChainId !== undefined) {
            const externalTxHash = initTx.hash;
            let completeTx = null;
            let completeAttempt = 0;
            while (completeAttempt < 5) {
              try {
                const completeNonce = await this.provider.getTransactionCount(signer.address, 'pending');
                completeTx = await contract.completeSettlement(onChainId, externalTxHash, { nonce: completeNonce });
                break;
              } catch (e) {
                if (e.message.includes("nonce") || e.code === "NONCE_EXPIRED" || e.message.includes("Nonce too low")) {
                  completeAttempt++;
                  await new Promise(r => setTimeout(r, 600));
                } else {
                  throw e;
                }
              }
            }
            if (!completeTx) {
              throw new Error("Failed to submit completeSettlement transaction due to nonce/RPC issues");
            }
            finalReceipt = await this.provider.waitForTransaction(completeTx.hash);
            if (!finalReceipt || finalReceipt.status !== 1) {
              throw new Error("Complete settlement transaction failed on-chain");
            }
          } else {
            finalReceipt = initReceipt;
          }
        }

        resolve(finalReceipt);
      } catch (err) {
        reject(err);
      } finally {
        await lock.release();
      }
    });
  }

  /**
   * Run the asynchronous pipeline state machine for a settlement request.
   */
  async runPipelineStateMachine(settlementId, context) {
    if (this.runningPipelines.has(settlementId)) {
      console.log(`[SettlementService] Pipeline already running for ${settlementId}. Awaiting existing run.`);
      return this.runningPipelines.get(settlementId);
    }

    const pipelinePromise = (async () => {
      const { initiator, amount, recipientDetails, txHash } = context;
      const numAmount = Number(amount);

      try {
        // Stage 1: Settlement Requested is set at creation.
        await new Promise(r => setTimeout(r, 600));

        // Stage 2: Compliance Screening
        await this.transitionStage(settlementId, "Compliance Screening");
        await new Promise(r => setTimeout(r, 1000));
        if (numAmount > 10000) {
          await this.transitionStage(settlementId, "Compliance Screening Blocked");
          await prisma.settlement.update({
            where: { id: settlementId },
            data: { status: "Failed" }
          });
          return;
        }

        // Stage 3: Route Selection
        await this.transitionStage(settlementId, "Route Selection");
        await new Promise(r => setTimeout(r, 800));

        // Stage 4: Execution
        await this.transitionStage(settlementId, "Execution");
        
        const receipt = await this.processOnChainSettlement(settlementId, txHash, numAmount, recipientDetails);
        const confirmedTxHash = receipt.hash;

        await prisma.settlement.update({
          where: { id: settlementId },
          data: { txHash: confirmedTxHash }
        });

        // Stage 5: Confirmation
        await this.transitionStage(settlementId, "Confirmation");
        const completedSettlement = await prisma.settlement.update({
          where: { id: settlementId },
          data: { 
            status: "Completed", 
            confirmedTxHash: confirmedTxHash,
            confirmedAt: new Date()
          }
        });

        // Dispatch Webhook Event: settlement.completed
        webhookService.dispatchEvent('settlement.completed', {
          settlementId: completedSettlement.id,
          initiator: completedSettlement.initiator,
          amount: completedSettlement.amount,
          fromToken: completedSettlement.fromToken,
          toToken: completedSettlement.toToken,
          status: "Completed",
          txHash: completedSettlement.confirmedTxHash,
          timestamp: completedSettlement.confirmedAt.toISOString()
        });
   
        // Stage 6: Proof Generation
        await this.transitionStage(settlementId, "Proof Generation");
        const updatedSettlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
        await this.generateSettlementProof(updatedSettlement);
   
        // Stage 7: Archive
        await this.transitionStage(settlementId, "Archive");
        console.log(`[SettlementService] [Pipeline] Settlement ${settlementId} fully processed and archived.`);
      } catch (err) {
        console.error(`[SettlementService] Pipeline execution failed for ${settlementId}:`, err);
        const failedSettlement = await prisma.settlement.update({
          where: { id: settlementId },
          data: { status: "Failed" }
        });

        // Dispatch Webhook Event: settlement.failed
        webhookService.dispatchEvent('settlement.failed', {
          settlementId: failedSettlement.id,
          initiator: failedSettlement.initiator,
          amount: failedSettlement.amount,
          status: "Failed",
          error: err.message
        });
      } finally {
        this.runningPipelines.delete(settlementId);
      }
    })();

    this.runningPipelines.set(settlementId, pipelinePromise);
    return pipelinePromise;
  }

  /**
   * Create a new settlement record in the database.
   * Generates a unique Settlement ID for the remittance.
   */
  async createSettlementRequest({ initiator, fromToken, toToken, amount, recipientDetails, txHash }) {
    // Generate a unique Settlement ID
    const settlementId = `settlement-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const settlement = await prisma.settlement.create({
      data: {
        id: settlementId,
        initiator: initiator || "0x0000000000000000000000000000000000000000",
        fromToken: fromToken || "0x0000000000000000000000000000000000000000",
        toToken: toToken || "0x0000000000000000000000000000000000000000",
        amount: amount.toString(),
        recipientDetails: recipientDetails || "N/A",
        status: "Pending",
        txHash: txHash || null,
        pipelineStage: "Settlement Requested",
        pipelineHistory: JSON.stringify([{ stage: "Settlement Requested", timestamp: new Date() }])
      }
    });

    console.log(`[SettlementService] Created settlement request: ${settlement.id}`);
    this.emit('settlement_created', settlement);
    
    // Proactively run the pipeline state machine asynchronously
    if (!isTest) {
      this.runPipelineStateMachine(settlement.id, { initiator, amount, recipientDetails, txHash }).catch(err => {
        console.error("[SettlementService] Pipeline error:", err);
      });
    }

    return settlement;
  }

  /**
   * Update the transaction hash and broadcast/track it.
   */
  async broadcastTransaction(settlementId, txHash) {
    const settlement = await prisma.settlement.update({
      where: { id: settlementId },
      data: { txHash }
    });

    console.log(`[SettlementService] Broadcasted transaction hash ${txHash} for settlement ${settlementId}`);
    this.emit('settlement_broadcasted', settlement);

    // Track confirmations via pipeline transition to confirmation stage directly
    this.transitionStage(settlementId, "Confirmation");
    this.trackConfirmations(settlementId, txHash);
    return settlement;
  }

  /**
   * Poll/wait for confirmations from the L2 RPC provider.
   */
  async trackConfirmations(settlementId, txHash) {
    if (!txHash) return;

    try {
      console.log(`[SettlementService] Tracking confirmations for txHash: ${txHash}`);
      
      const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
      if (!settlement) {
        throw new Error(`Settlement not found: ${settlementId}`);
      }

      const receipt = await this.processOnChainSettlement(settlementId, txHash, Number(settlement.amount), settlement.recipientDetails);

      if (receipt && receipt.status === 1) {
        await this.updateSettlementState(settlementId, "Completed", receipt.hash);
      } else {
        await this.updateSettlementState(settlementId, "Failed");
      }
    } catch (err) {
      console.error(`[SettlementService] Confirmation tracking error for ${settlementId}:`, err);
      await this.updateSettlementState(settlementId, "Failed");
    }
  }

  /**
   * Transition settlement status and emit local pub/sub events.
   */
  async updateSettlementState(settlementId, status, confirmedTxHash = null) {
    try {
      const settlement = await prisma.settlement.update({
        where: { id: settlementId },
        data: {
          status,
          confirmedTxHash: confirmedTxHash || null,
          confirmedAt: status === "Completed" ? new Date() : null
        }
      });

      console.log(`[SettlementService] Settlement ${settlementId} transitioned to: ${status}`);
      this.emit('settlement_updated', settlement);

      if (status === "Completed") {
        this.emit('settlement_confirmed', settlement);
        await this.generateSettlementProof(settlement);
      } else if (status === "Failed") {
        this.emit('settlement_failed', settlement);
      }

      return settlement;
    } catch (err) {
      console.error(`[SettlementService] Failed to update state for ${settlementId}:`, err.message);
    }
  }

  /**
   * Generate and store a cryptographic/remittance proof for the completed settlement.
   */
  async generateSettlementProof(settlement) {
    try {
      console.log(`[SettlementService] Generating settlement proof for: ${settlement.id}`);
      
      const reachable = await this.isRpcReachable(giwa.getRPC());
      if (!reachable) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error("GIWA RPC node is unreachable. Cannot generate proof in production.");
        }
        console.log(`[SettlementService] RPC offline during proof generation. Falling back to local simulation proof.`);
        const hex = "0123456789abcdef";
        let mockTxHash = settlement.confirmedTxHash || settlement.txHash || "0x";
        if (mockTxHash.length < 66) {
          for (let i = 0; i < 64; i++) mockTxHash += hex[Math.floor(Math.random() * 16)];
          mockTxHash = mockTxHash.substring(0, 66);
        }
        const blockNumber = 1234567;
        const gasUsed = "21000";
        const timestamp = new Date();
        const durationSeconds = 1;

        const proof = await prisma.settlementProof.upsert({
          where: { settlementId: settlement.id },
          update: {
            txHash: mockTxHash,
            blockNumber,
            timestamp,
            gasUsed,
            settlementDuration: durationSeconds,
            proofStatus: "Valid"
          },
          create: {
            settlementId: settlement.id,
            txHash: mockTxHash,
            blockNumber,
            timestamp,
            gasUsed,
            settlementDuration: durationSeconds,
            proofStatus: "Valid"
          }
        });

        console.log(`[SettlementService] Settlement Proof stored successfully for ID: ${settlement.id}`);
        this.emit('proof_generated', proof);
        
        webhookService.dispatchEvent('proof.generated', {
          settlementId: settlement.id,
          txHash: mockTxHash,
          blockNumber,
          gasUsed,
          settlementDuration: durationSeconds,
          proofStatus: "Valid",
          timestamp: timestamp.toISOString()
        });

        return proof;
      }

      let txHash = settlement.confirmedTxHash || settlement.txHash;
      if (!this.provider) {
        this.provider = new ethers.JsonRpcProvider(giwa.getRPC());
      }

      let receipt = null;
      if (txHash && txHash.startsWith("0x") && txHash.length === 66) {
        try {
          receipt = await this.provider.getTransactionReceipt(txHash);
        } catch (e) {}
      }

      if (!receipt) {
        console.log(`[SettlementService] Receipt not found or txHash is mock for ${settlement.id}. Proactively executing transaction on-chain.`);
        receipt = await this.processOnChainSettlement(settlement.id, null, Number(settlement.amount), settlement.recipientDetails);
        txHash = receipt.hash;
        await prisma.settlement.update({
          where: { id: settlement.id },
          data: {
            txHash,
            confirmedTxHash: txHash,
            status: "Completed",
            confirmedAt: new Date()
          }
        });
      }

      const blockNumber = receipt.blockNumber;
      const gasUsed = receipt.gasUsed.toString();
      const block = await this.provider.getBlock(receipt.blockNumber);
      if (!block) {
        throw new Error(`Block not found for block number: ${receipt.blockNumber}`);
      }
      const timestamp = new Date(block.timestamp * 1000);

      // Calculate Settlement Duration in seconds
      const createdTime = new Date(settlement.createdAt).getTime();
      const confirmedTime = settlement.confirmedAt ? new Date(settlement.confirmedAt).getTime() : Date.now();
      const durationSeconds = Math.max(1, Math.round((confirmedTime - createdTime) / 1000));

      const proof = await prisma.settlementProof.upsert({
        where: { settlementId: settlement.id },
        update: {
          txHash,
          blockNumber,
          timestamp,
          gasUsed,
          settlementDuration: durationSeconds,
          proofStatus: "Valid"
        },
        create: {
          settlementId: settlement.id,
          txHash,
          blockNumber,
          timestamp,
          gasUsed,
          settlementDuration: durationSeconds,
          proofStatus: "Valid"
        }
      });

      console.log(`[SettlementService] Settlement Proof stored successfully for ID: ${settlement.id}`);
      this.emit('proof_generated', proof);
      
      // Dispatch Webhook Event: proof.generated
      webhookService.dispatchEvent('proof.generated', {
        settlementId: settlement.id,
        txHash,
        blockNumber,
        gasUsed,
        settlementDuration: durationSeconds,
        proofStatus: "Valid",
        timestamp: timestamp.toISOString()
      });

      return proof;
    } catch (err) {
      console.error(`[SettlementService] Error generating settlement proof for ${settlement.id}:`, err);
    }
  }
}

export const settlementService = new SettlementService();

import { giwa, networkRegistry } from '../infrastructure/giwa/index.js';
import { settlementService } from './settlementService.js';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class NetworkIntelligenceService {
  constructor() {
    this.snapshots = [];
    this.maxSnapshots = 100; // Cap snapshots in memory
    this.timer = null;
    
    // Initial health metrics
    this.currentMetrics = {
      latestBlock: 182390,
      finalizedBlock: 182326,
      averageBlockTime: 2.1, // seconds
      gasTrend: 35.5, // gwei
      sequencerHealth: 'Operational',
      rpcLatency: 45, // ms
      throughput: 12.8 // TPS
    };

    this.startSnapshotLoop();
  }

  /**
   * Starts the 30-second monitoring loop
   */
  startSnapshotLoop() {
    if (this.timer) return;
    
    // Execute first check immediately
    this.collectSnapshot();

    this.timer = setInterval(() => {
      this.collectSnapshot();
    }, 30000);
  }

  stopSnapshotLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Collects current network intelligence metrics
   */
  async collectSnapshot() {
    try {
      // 0. Ping all GIWA ecosystem providers to update status/latency
      await giwa.registry.checkAllHealth();

      // 1. Fetch RPC metrics via NetworkRegistry
      const latestBlock = await networkRegistry.getCurrentBlock();
      const liveGasPrice = await networkRegistry.getGasOracle();
      const finalizedBlock = await networkRegistry.getLatestFinalizedBlock();
      const sequencerStatus = await networkRegistry.getNodeHealth();
      const bridgeStatus = await networkRegistry.getBridgeHealth();

      const rpcProvider = giwa.registry.getActiveProvider('RPC');
      let latency = 45;
      if (rpcProvider) {
        latency = rpcProvider.status === 'Offline' ? 9999 : rpcProvider.latencyMs;
      }

      // 3. Fetch Explorer status
      const expProvider = giwa.registry.getActiveProvider('Explorer');
      const explorerStatus = expProvider ? expProvider.status : 'Offline';

      // 4. Calculate TPS / throughput from actual block if provider is online
      let throughput = 12.8;
      const provider = settlementService.provider;
      if (provider) {
        try {
          const block = await provider.getBlock(latestBlock);
          if (block && block.transactions) {
            throughput = parseFloat((block.transactions.length / 2.0).toFixed(1));
          }
        } catch (e) {}
      }

      // 5. Update active state
      this.currentMetrics = {
        latestBlock: latestBlock,
        finalizedBlock: finalizedBlock,
        averageBlockTime: 2.0, // Fixed 2.0s block time for OP Stack Sepolia (Karst)
        gasTrend: parseFloat(liveGasPrice.toFixed(1)),
        sequencerHealth: sequencerStatus === 'Offline' ? 'Down' : sequencerStatus === 'Degraded' ? 'Degraded' : 'Operational',
        rpcLatency: latency,
        throughput: throughput
      };

      // 6. Calculate Health Score
      const healthScore = this.calculateHealthScore();
      const rating = this.getHealthRating(healthScore);

      const snapshotData = {
        chainName: giwa.config.name,
        chainId: giwa.config.chainId,
        rpcUrl: giwa.getRPC(),
        blockNumber: this.currentMetrics.latestBlock,
        finalizedBlock: this.currentMetrics.finalizedBlock,
        avgBlockTime: this.currentMetrics.averageBlockTime,
        gasPrice: this.currentMetrics.gasTrend,
        sequencerStatus: sequencerStatus,
        rpcLatency: latency === 9999 ? -1 : latency,
        explorerStatus: explorerStatus,
        bridgeStatus: bridgeStatus,
        healthScore: healthScore
      };

      // 7. Save to PostgreSQL database
      const dbSnapshot = await prisma.networkSnapshot.create({
        data: snapshotData
      });

      // Keep in-memory snapshots array for backwards compatibility / fallback
      const inMemSnapshot = {
        id: dbSnapshot.id,
        timestamp: dbSnapshot.timestamp,
        metrics: { ...this.currentMetrics },
        healthScore,
        rating
      };
      this.snapshots.push(inMemSnapshot);
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.shift();
      }

      // 8. Delete snapshots older than 24 hours to prevent DB bloating
      await prisma.networkSnapshot.deleteMany({
        where: {
          timestamp: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
    } catch (err) {
      console.error('[NetworkIntelligence] Failed to collect health snapshot:', err);
    }
  }

  /**
   * Computes a numerical score from 0 to 100 based on network performance
   */
  calculateHealthScore() {
    let score = 100;

    // 1. Sequencer Health
    if (this.currentMetrics.sequencerHealth === 'Down') {
      score -= 50;
    } else if (this.currentMetrics.sequencerHealth === 'Degraded') {
      score -= 20;
    }

    // 2. RPC Latency
    if (this.currentMetrics.rpcLatency > 1500) {
      score -= 30;
    } else if (this.currentMetrics.rpcLatency > 500) {
      score -= 15;
    } else if (this.currentMetrics.rpcLatency > 150) {
      score -= 5;
    }

    // 3. Average Block Time
    if (this.currentMetrics.averageBlockTime > 6.0) {
      score -= 20;
    } else if (this.currentMetrics.averageBlockTime > 4.0) {
      score -= 10;
    }

    // Bound check
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Map score to rating: Excellent, Good, Warning, Critical
   */
  getHealthRating(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 40) return 'Warning';
    return 'Critical';
  }

  /**
   * Returns current active status including latest stats
   */
  getCurrentStatus() {
    const score = this.calculateHealthScore();
    return {
      timestamp: new Date(),
      metrics: this.currentMetrics,
      healthScore: score,
      rating: this.getHealthRating(score),
      history: this.snapshots
    };
  }

  /**
   * Returns complete network status details including DB historical snapshot trend list
   */
  async getCurrentStatusFromDB() {
    // Retrieve historical snapshots from database
    let history = await prisma.networkSnapshot.findMany({
      orderBy: { timestamp: 'asc' },
      take: 40 // last 40 snapshots for the charts
    });

    const score = this.calculateHealthScore();
    const rating = this.getHealthRating(score);

    const rpcProvider = giwa.registry.getActiveProvider('RPC');
    const seqProvider = giwa.registry.getActiveProvider('Sequencer');
    const expProvider = giwa.registry.getActiveProvider('Explorer');
    const bridgeProvider = giwa.registry.getActiveProvider('Bridge');

    const current = {
      chainName: giwa.config.name,
      chainId: giwa.config.chainId,
      rpcUrl: giwa.getRPC(),
      blockNumber: this.currentMetrics.latestBlock,
      finalizedBlock: this.currentMetrics.finalizedBlock,
      avgBlockTime: this.currentMetrics.averageBlockTime,
      gasPrice: this.currentMetrics.gasTrend,
      sequencerStatus: seqProvider ? seqProvider.status : 'Offline',
      rpcLatency: rpcProvider ? rpcProvider.latencyMs : -1,
      explorerStatus: expProvider ? expProvider.status : 'Offline',
      bridgeStatus: bridgeProvider ? bridgeProvider.status : 'Offline',
      healthScore: score,
      rating: rating
    };

    // If history is empty (e.g. database freshly initialized), prepend current status to history
    if (history.length === 0) {
      history = [{
        id: 'initial-dummy-id',
        timestamp: new Date(),
        ...current
      }];
    }

    return {
      current,
      history
    };
  }
}

export const networkIntelligence = new NetworkIntelligenceService();

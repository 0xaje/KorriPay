/**
 * GIWA Network Metadata configuration
 */
export const GIWA_NETWORK_CONFIG = {
  name: 'GIWA L2 Mainnet',
  chainId: 92837,
  peerCount: 148,
  sequencerAddress: '0x17F53eE27DaDbe44CE8928ddbe44ce8824c3bC86',
  bridgeAddress: '0x88F53eE27DaDbe44CE8928ddbe44ce8824c3bC87',
  rpcUrl: 'http://127.0.0.1:8545',
  explorerUrl: 'https://explorer.giwa.io',
  faucetUrl: 'https://faucet.giwa.io',
  resolverUrl: 'http://localhost:5000/api/v1/resolve',
  stablecoinAddress: '0x9b3f5ce66f6d40dbbad1a8a56a3bf87f7d92837f'
};

export const GIWA_SEQUENCER_CONFIG = {
  status: 'Operational',
  uptimePercentage: 99.98
};

/**
 * Future Dojang Integration Placeholder
 */
export class DojangIntegration {
  async getAttestationUrl(subject) {
    return `${GIWA_NETWORK_CONFIG.explorerUrl}/attestation/${subject}`;
  }
}

/**
 * Future KRW Stablecoin Integration Placeholder
 */
export class KRWStablecoinIntegration {
  getContractAddress() {
    return GIWA_NETWORK_CONFIG.stablecoinAddress;
  }
}

export class GiwaFrontendInfrastructure {
  constructor() {
    this.config = GIWA_NETWORK_CONFIG;
    this.sequencer = GIWA_SEQUENCER_CONFIG;
    this.dojang = new DojangIntegration();
    this.krwStablecoin = new KRWStablecoinIntegration();
  }

  getChainMetadata() {
    return this.config;
  }

  getRPC() {
    return this.config.rpcUrl;
  }

  getExplorer() {
    return this.config.explorerUrl;
  }

  getSequencer() {
    return this.config.sequencerAddress;
  }

  getBridge() {
    return this.config.bridgeAddress;
  }

  getFaucet() {
    return this.config.faucetUrl;
  }

  getNetworkStatus() {
    return {
      status: this.sequencer.status,
      uptimePercentage: this.sequencer.uptimePercentage,
      latencyMs: 12,
    };
  }

  getWalletResolver() {
    return this.config.resolverUrl;
  }

  getDojangIntegration() {
    return this.dojang;
  }

  getKRWStablecoin() {
    return this.krwStablecoin;
  }
  
  async checkHealth() {
    try {
      const start = Date.now();
      const res = await fetch(this.getRPC(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
      });
      const latency = Date.now() - start;
      if (res.ok) {
        return { status: 'Healthy', latencyMs: latency };
      }
      return { status: 'Degraded', latencyMs: latency };
    } catch (err) {
      return { status: 'Offline', latencyMs: -1 };
    }
  }
}

export const giwa = new GiwaFrontendInfrastructure();

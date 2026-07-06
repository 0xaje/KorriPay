export interface GiwaNetworkMetadata {
  name: string;
  chainId: number;
  peerCount: number;
  sequencerAddress: string;
  bridgeAddress: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
  resolverUrl: string;
  stablecoinAddress: string;
  settlementAddress?: string;
  hardfork?: string;
  evmVersion?: string;
  maxTxGasLimit?: number;
  nodeClient?: string;
  proofClient?: string;
  precompiles?: Record<string, string>;
}

export interface GiwaSequencerStatus {
  status: string;
  uptimePercentage: number;
}

export interface GiwaNetworkStatus {
  status: string;
  uptimePercentage: number;
  latencyMs: number;
}

export class DojangIntegration {
  getAttestationUrl(subject: string): Promise<string>;
}

export class KRWStablecoinIntegration {
  getContractAddress(): string;
}

export class GiwaFrontendInfrastructure {
  config: GiwaNetworkMetadata;
  sequencer: GiwaSequencerStatus;
  dojang: DojangIntegration;
  krwStablecoin: KRWStablecoinIntegration;
  constructor();
  getChainMetadata(): GiwaNetworkMetadata;
  getRPC(): string;
  getExplorer(): string;
  getSequencer(): string;
  getBridge(): string;
  getFaucet(): string;
  getSettlementAddress(): string;
  getNetworkStatus(): GiwaNetworkStatus;
  getWalletResolver(): string;
  getDojangIntegration(): DojangIntegration;
  getKRWStablecoin(): KRWStablecoinIntegration;
  checkHealth(): Promise<{ status: string; latencyMs: number }>;
}

export class NetworkRegistry {
  constructor(giwaInfra: GiwaFrontendInfrastructure);
  get RPC(): string;
  get Explorer(): string;
  get Bridge(): string;
  get Faucet(): string;
  get Sequencer(): string;
  getCurrentBlock(): number;
  getLatestFinalizedBlock(): number;
  get ClientVersion(): string;
  get KarstHardforkVersion(): string;
  getNodeHealth(): string;
  getGasOracle(): number;
  getBridgeHealth(): string;
  getSettlementAddress(): string;
}

export const GIWA_NETWORK_CONFIG: GiwaNetworkMetadata;
export const GIWA_SEQUENCER_CONFIG: GiwaSequencerStatus;
export const giwa: GiwaFrontendInfrastructure;
export const networkRegistry: NetworkRegistry;

export interface GiwaNetworkMetadata {
  name: string;
  chainId: number;
  peerCount: number;
  sequencerAddress: string;
  bridgeAddress: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
  settlementAddress: string;
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
  tps: number;
  blockNumber: number;
}

export interface GiwaConfig {
  name: string;
  chainId: number;
  peerCount: number;
  rpcUrl: string;
  rpcBackupUrl: string;
  explorerUrl: string;
  explorerBackupUrl: string;
  faucetUrl: string;
  sequencerAddress: string;
  bridgeAddress: string;
  attestationAddress: string;
  resolverUrl: string;
  stablecoinAddress: string;
  settlementAddress: string;
  hardfork?: string;
  evmVersion?: string;
  maxTxGasLimit?: number;
  nodeClient?: string;
  proofClient?: string;
  precompiles?: Record<string, string>;
}

export interface GiwaConfigProvider {
  getConfig(): GiwaConfig;
}

export class EnvironmentGiwaConfigProvider implements GiwaConfigProvider {
  getConfig(): GiwaConfig;
}

export class DojangIntegration {
  verifyAttestation(subjectAddress: string, schemaId: string): Promise<{
    verified: boolean;
    provider: string;
    timestamp: Date;
    metadata: Record<string, any>;
  }>;
}

export class KRWStablecoinIntegration {
  getContractAddress(): string;
  getBalance(address: string): Promise<bigint>;
  transfer(to: string, amount: bigint): Promise<{ success: boolean; txHash: string }>;
}

export class GiwaInfrastructure {
  config: GiwaConfig;
  constructor(configProvider?: GiwaConfigProvider);
  getChainMetadata(): GiwaNetworkMetadata;
  getRPC(): string;
  getExplorer(): string;
  getSequencer(): string;
  getBridge(): string;
  getFaucet(): string;
  getSettlementAddress(): string;
  getNetworkStatus(): Promise<GiwaNetworkStatus>;
  getWalletResolver(): string;
  getDojangIntegration(): DojangIntegration;
  getKRWStablecoin(): KRWStablecoinIntegration;
  checkHealth(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    status: string;
    latencyMs: number;
  }>>;
}

export class NetworkRegistry {
  constructor(giwaInfra: GiwaInfrastructure);
  get RPC(): string;
  get Explorer(): string;
  get Bridge(): string;
  get Faucet(): string;
  get Sequencer(): string;
  getCurrentBlock(): Promise<number>;
  getLatestFinalizedBlock(): Promise<number>;
  get ClientVersion(): string;
  get KarstHardforkVersion(): string;
  getNodeHealth(): Promise<string>;
  getGasOracle(): Promise<number>;
  getBridgeHealth(): Promise<string>;
}

export const giwa: GiwaInfrastructure;
export const networkRegistry: NetworkRegistry;

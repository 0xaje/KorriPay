export interface GiwaNetworkMetadata {
  name: string;
  chainId: number;
  peerCount: number;
  sequencerAddress: string;
  bridgeAddress: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
}

export interface GiwaSequencerStatus {
  status: string;
  uptimePercentage: number;
}

export const GIWA_NETWORK_CONFIG: GiwaNetworkMetadata;
export const GIWA_SEQUENCER_CONFIG: GiwaSequencerStatus;

import { giwa } from '../infrastructure/giwa/index.js';

const metadata = giwa.getChainMetadata();

/**
 * GIWA Network Metadata configuration
 */
export const GIWA_NETWORK_CONFIG = {
  name: metadata.name,
  chainId: metadata.chainId,
  peerCount: metadata.peerCount,
  sequencerAddress: metadata.sequencerAddress,
  bridgeAddress: metadata.bridgeAddress,
  rpcUrl: metadata.rpcUrl,
  explorerUrl: metadata.explorerUrl,
  faucetUrl: metadata.faucetUrl
};

/**
 * GIWA Sequencer baseline configuration
 */
export const GIWA_SEQUENCER_CONFIG = {
  status: 'Operational',
  uptimePercentage: Number(process.env.GIWA_SEQUENCER_UPTIME || '99.98')
};


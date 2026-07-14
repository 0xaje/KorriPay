import { networkRegistry } from "./src/infrastructure/giwa/index.js";

// ── ERC20 Minimal ABI ──────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
];

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];

// ── KorriSettlement Minimal ABI ────────────────────────────────────
const KORRI_SETTLEMENT_ABI = [
  {
    name: "initiateSettlement",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipientDetails", type: "string" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
];

// ── Token Contract Addresses ───────────────────────────────────────
const TOKEN_ADDRESSES = {
  11155111: {
    USDC:    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699",
  },
  137: {
    USDC:    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699",
  },
  8453: {
    USDC:    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699",
  },
  42161: {
    USDC:    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699",
  },
  10: {
    USDC:    "0x0b2C639c53A9c3CDb8B139AC7e10252dB62167b6",
    MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699",
  },
  1: {
    USDC:    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699",
  }
};

// ── KorriSettlement Contract Addresses ─────────────────────────────
const SETTLEMENT_ADDRESSES = {
  11155111: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // Local test / Sepolia mock
  31337:    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  137:      "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  8453:     "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  42161:    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  10:       "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  1:        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

// Dynamically register GIWA addresses from the NetworkRegistry
const giwaChainId = networkRegistry ? networkRegistry.giwa.config.chainId : 92837;
const giwaUSDC = networkRegistry ? networkRegistry.giwa.config.stablecoinAddress : "0x9b3f5ce66f6d40dbbad1a8a56a3bf87f7d92837f";
const giwaSettlementAddress = networkRegistry ? networkRegistry.getSettlementAddress() : "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

TOKEN_ADDRESSES[giwaChainId] = {
  USDC:    giwaUSDC,
  MockKRW: "0xdB281c7e997fE762888DDC80509653152778A699", // MockKRW on GIWA
};
SETTLEMENT_ADDRESSES[giwaChainId] = giwaSettlementAddress;

/**
 * Fetch the contract address of a token on a specific chain.
 */
function getTokenAddress(symbol, chainId) {
  const chainConfig = TOKEN_ADDRESSES[chainId] || TOKEN_ADDRESSES[11155111];
  return chainConfig[symbol] || null;
}

/**
 * Fetch ERC20 Token Balance directly from the blockchain
 */
async function fetchTokenBalance(symbol, walletAddress, chainId) {
  if (!window.WalletService) {
    console.warn("[TokenService] WalletService not found on window.");
    return "0.00";
  }

  const tokenAddress = getTokenAddress(symbol, chainId);
  if (!tokenAddress) {
    console.warn(`[TokenService] Token address not configured for ${symbol} on chain ${chainId}`);
    return "0.00";
  }

  try {
    const balanceResult = await window.WalletService.readContract({
      abi: ERC20_ABI,
      address: tokenAddress,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    let decimals = (symbol === "USDC") ? 6 : 18;
    try {
      const decimalsResult = await window.WalletService.readContract({
        abi: ERC20_ABI,
        address: tokenAddress,
        functionName: "decimals"
      });
      if (typeof decimalsResult === "number") {
        decimals = decimalsResult;
      }
    } catch (err) {
      console.warn(`[TokenService] Failed to fetch decimals for ${symbol}, using default ${decimals}:`, err);
    }

    const formatted = window.WalletService.formatUnits(balanceResult, decimals);
    console.info(`[TokenService] Fetched balance for ${symbol}: ${formatted} (Address: ${tokenAddress})`);
    return formatted;
  } catch (error) {
    console.error(`[TokenService] Error fetching balance for ${symbol} at address ${tokenAddress}:`, error);
    return "0.00";
  }
}

/**
 * Send money by calling KorriSettlement.initiateSettlement()
 * @param {string} symbol - "USDC" | "MockKRW" | "ETH"
 * @param {number|string} amount - Transfer amount
 * @param {string} recipientAddress - Bank details or address description
 */
async function sendSettlement(symbol, amount, recipientAddress) {
  if (!window.WalletService || !window.WalletService.isConnected()) {
    throw new Error("Wallet not connected");
  }

  const account = window.WalletService.getAccount();
  const chainId = account.chainId;

  const settlementAddress = SETTLEMENT_ADDRESSES[chainId] || SETTLEMENT_ADDRESSES[11155111];
  if (!settlementAddress) {
    throw new Error(`Settlement contract not configured for chain ${chainId}`);
  }

  const tokenAddress = getTokenAddress(symbol, chainId);
  const isNative = (symbol === "ETH" || !tokenAddress);

  let decimals = 18;
  if (!isNative) {
    decimals = (symbol === "USDC") ? 6 : 18;
  }
  const parsedAmount = window.WalletService.parseUnits(amount.toString(), decimals);

  console.info(`[TokenService] Preparing settlement for ${amount} ${symbol} (Parsed: ${parsedAmount.toString()})`);

  // Approval step for ERC20
  if (!isNative) {
    console.info(`[TokenService] Approving ${settlementAddress} to spend ${amount} ${symbol}...`);
    const approveTx = await window.WalletService.writeContract({
      abi: ERC20_APPROVE_ABI,
      address: tokenAddress,
      functionName: "approve",
      args: [settlementAddress, parsedAmount]
    });
    console.info(`[TokenService] Waiting for approval transaction receipt for: ${approveTx}`);
    await window.WalletService.waitForTransactionReceipt({ hash: approveTx });
    console.info(`[TokenService] Approval confirmed.`);
  }

  // Settlement step
  console.info(`[TokenService] Initiating settlement contract write...`);
  const fromTokenParam = isNative ? "0x0000000000000000000000000000000000000000" : tokenAddress;
  const toTokenParam = "0x0000000000000000000000000000000000000000";
  const valueParam = isNative ? parsedAmount : 0n;

  const settlementTx = await window.WalletService.writeContract({
    abi: KORRI_SETTLEMENT_ABI,
    address: settlementAddress,
    functionName: "initiateSettlement",
    args: [fromTokenParam, toTokenParam, parsedAmount, recipientAddress],
    value: valueParam
  });

  console.info(`[TokenService] Initiated settlement contract write, txHash: ${settlementTx}`);
  return settlementTx;
}

/**
 * Wait for a transaction confirmation
 * @param {string} txHash - Transaction hash to wait for
 */
async function waitForConfirmation(txHash) {
  if (!window.WalletService) {
    throw new Error("WalletService not initialized for confirmation wait");
  }

  console.info(`[TokenService] Waiting for settlement transaction confirmation: ${txHash}`);
  const receipt = await window.WalletService.waitForTransactionReceipt({ hash: txHash });
  console.info(`[TokenService] Settlement confirmed:`, receipt);
  return receipt;
}

// Expose on window for frontend components
window.TokenService = {
  fetchTokenBalance,
  getTokenAddress,
  TOKEN_ADDRESSES,
  sendSettlement,
  waitForConfirmation
};

export { fetchTokenBalance, getTokenAddress, TOKEN_ADDRESSES, sendSettlement, waitForConfirmation };

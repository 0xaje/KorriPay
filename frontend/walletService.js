/**
 * KorriPay — walletService.js
 * ─────────────────────────────────────────────────────────────────
 * Wallet service layer using Reown AppKit (Web3Modal v5) + Wagmi.
 * Loaded as an ES module. Exposes window.WalletService for use by
 * non-module scripts (app.js, index.html inline scripts).
 *
 * Dependencies loaded dynamically from CDN — no local bundler required.
 * ─────────────────────────────────────────────────────────────────
 */

import { giwa } from './src/infrastructure/giwa/index.js';

// ── Configuration ──────────────────────────────────────────────────
const WALLETCONNECT_PROJECT_ID = "YOUR_WALLETCONNECT_PROJECT_ID"; // ← Replace this

const CDN = {
  wagmiCore:     "https://esm.sh/@wagmi/core@2.13.5",
  viemChains:    "https://esm.sh/viem@2.21.49/chains",
  appKit:        "https://esm.sh/@reown/appkit@1.8.22",
  appKitAdapter: "https://esm.sh/@reown/appkit-adapter-wagmi@1.8.22",
};

// ── Supported networks ──────────────────────────────────────────────
const SUPPORTED_CHAINS = {
  ethereum:  { id: 1,     name: "Ethereum",        symbol: "ETH",   explorer: "https://etherscan.io" },
  polygon:   { id: 137,   name: "Polygon",          symbol: "MATIC", explorer: "https://polygonscan.com" },
  arbitrum:  { id: 42161, name: "Arbitrum One",     symbol: "ETH",   explorer: "https://arbiscan.io" },
  optimism:  { id: 10,    name: "Optimism",          symbol: "ETH",   explorer: "https://optimistic.etherscan.io" },
  base:      { id: 8453,  name: "Base",             symbol: "ETH",   explorer: "https://basescan.org" },
  sepolia:   { id: 11155111, name: "Sepolia Testnet", symbol: "ETH", explorer: "https://sepolia.etherscan.io" },
  giwa:      { 
    id: giwa.getChainMetadata().chainId, 
    name: giwa.getChainMetadata().name, 
    symbol: "ETH", 
    explorer: giwa.getExplorer() 
  }
};

// ── Internal state ──────────────────────────────────────────────────
let _config        = null;   // wagmi config
let _wagmi         = null;   // wagmi/core module
let _chains        = null;   // viem/chains module
let _appKit        = null;   // appKit module
let _appKitAdapter = null;   // appKit adapter module
let _appKitInstance= null;   // instantiated appKit modal
let _initialised   = false;
let _initialising  = false;
let _account       = { address: null, chainId: null, status: "disconnected" };
let _unwatch       = [];     // wagmi unsubscribe functions

// ── Event bus ───────────────────────────────────────────────────────
// Emits CustomEvents on window so any script can listen without coupling.
function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`korripay:wallet:${name}`, { detail }));
}

// ── Module loader ────────────────────────────────────────────────────
async function loadModules() {
  if (_wagmi) return; // already loaded

  try {
    [_wagmi, _chains, _appKit, _appKitAdapter] = await Promise.all([
      import(CDN.wagmiCore),
      import(CDN.viemChains),
      import(CDN.appKit),
      import(CDN.appKitAdapter),
    ]);
  } catch (err) {
    console.error("[WalletService] Failed to load modules from CDN:", err);
    throw new Error("Wallet library failed to load. Check your network connection.");
  }
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  if (_initialised)  return;
  if (_initialising) return;
  _initialising = true;

  await loadModules();

  const { watchAccount } = _wagmi;
  const { createAppKit } = _appKit;
  const { WagmiAdapter } = _appKitAdapter;

  const {
    mainnet,
    polygon,
    arbitrum,
    optimism,
    base,
    sepolia,
  } = _chains;

  // Use user-configured or fallback project ID
  const projectId = (WALLETCONNECT_PROJECT_ID && WALLETCONNECT_PROJECT_ID !== "YOUR_WALLETCONNECT_PROJECT_ID")
    ? WALLETCONNECT_PROJECT_ID
    : "b56e18d47c72ab683b10814fe9495694"; // Fallback demo ID

  const meta = giwa.getChainMetadata();
  const giwaChain = {
    id: meta.chainId,
    name: meta.name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [giwa.getRPC()] },
      public: { http: [giwa.getRPC()] }
    },
    blockExplorers: {
      default: { name: 'GIWA Explorer', url: giwa.getExplorer() }
    }
  };

  const networks = [mainnet, polygon, arbitrum, optimism, base, sepolia, giwaChain];

  // Set up Wagmi Adapter
  const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
  });

  _config = wagmiAdapter.wagmiConfig;

  // Create AppKit Modal instance with social & email features enabled
  _appKitInstance = createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata: {
      name:        "KorriPay",
      description: "Institutional-grade fintech dashboard",
      url:         window.location.origin,
      icons:       [`${window.location.origin}/favicon.ico`],
    },
    features: {
      analytics: false,
      email: true,
      socials: ['google', 'apple', 'x', 'github']
    }
  });

  // Subscribe to account state changes
  const unwatchAccount = watchAccount(_config, {
    onChange(account) {
      const prev = { ..._account };

      _account.address = account.address ?? null;
      _account.chainId = account.chainId ?? null;
      _account.status  = account.status;

      if (_account.status === "connected" && prev.status !== "connected") {
        emit("connected", { address: _account.address, chainId: _account.chainId });
      }
      if (_account.status === "disconnected" && prev.status !== "disconnected") {
        emit("disconnected", {});
      }
      if (_account.address && _account.address !== prev.address) {
        emit("accountChanged", { address: _account.address });
      }
      if (_account.chainId && _account.chainId !== prev.chainId) {
        emit("chainChanged", { chainId: _account.chainId, network: getNetworkInfo(_account.chainId) });
      }

      emit("stateChanged", { account: { ..._account } });
    },
  });

  _unwatch.push(unwatchAccount);

  _initialised  = true;
  _initialising = false;

  emit("ready", { account: { ..._account } });
  console.info("[WalletService] Initialised with Reown AppKit. Status:", _account.status);
}

// ── Helpers ──────────────────────────────────────────────────────────
function getNetworkInfo(chainId) {
  return Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId) ?? {
    id:   chainId,
    name: `Chain ${chainId}`,
    symbol: "ETH",
    explorer: "",
  };
}

function formatAddress(address, chars = 4) {
  if (!address) return null;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

function ensureInit() {
  if (!_initialised) throw new Error("[WalletService] Not initialised. Call WalletService.init() first.");
}


// ── Public API ───────────────────────────────────────────────────────

/**
 * open()
 * Opens the Reown AppKit connection modal.
 */
function open() {
  ensureInit();
  if (_appKitInstance) {
    _appKitInstance.open();
  }
}

/**
 * close()
 * Closes the Reown AppKit connection modal.
 */
function close() {
  ensureInit();
  if (_appKitInstance) {
    _appKitInstance.close();
  }
}

/**
 * connect()
 * Retained for backwards-compatibility; simply opens the AppKit modal.
 */
async function connect(type = "metamask") {
  open();
  return getAccount();
}

/**
 * disconnect()
 */
async function disconnect() {
  ensureInit();
  if (_appKitInstance) {
    await _appKitInstance.disconnect();
  }
}

/**
 * getAccount()
 * Returns current account state snapshot.
 */
function getAccount() {
  if (!_config) return { address: null, chainId: null, status: "disconnected", isConnected: false };
  const { getAccount: wagmiGetAccount } = _wagmi;
  const acc = wagmiGetAccount(_config);

  return {
    address:     acc.address ?? null,
    chainId:     acc.chainId ?? null,
    status:      acc.status,
    isConnected: acc.status === "connected",
    network:     getNetworkInfo(acc.chainId),
    shortAddress: formatAddress(acc.address),
  };
}

/**
 * getBalance(address?, chainId?)
 * Returns: { value: bigint, formatted: string, symbol: string }
 */
async function getBalance(address, chainId) {
  ensureInit();
  const { getBalance: wagmiGetBalance } = _wagmi;

  const targetAddress = address ?? _account.address;
  if (!targetAddress) throw new Error("No address connected.");

  const result = await wagmiGetBalance(_config, {
    address: targetAddress,
    chainId: chainId ?? _account.chainId,
  });

  return {
    value:     result.value,
    formatted: parseFloat(result.formatted).toFixed(6),
    symbol:    result.symbol,
  };
}

/**
 * switchNetwork(chainId)
 */
async function switchNetwork(chainId) {
  ensureInit();
  const { switchChain } = _wagmi;
  await switchChain(_config, { chainId });
}

/**
 * signMessage(message)
 * Returns: signature string (for auth/verification)
 */
async function signMessage(message) {
  ensureInit();
  const { signMessage: wagmiSignMessage } = _wagmi;
  return wagmiSignMessage(_config, { message });
}

/**
 * getSupportedChains()
 */
function getSupportedChains() {
  return SUPPORTED_CHAINS;
}

/**
 * isConnected()
 */
function isConnected() {
  return _account.status === "connected";
}

/**
 * formatAddress(address, chars)
 */
function formatAddressPublic(address, chars = 4) {
  return formatAddress(address ?? _account.address, chars);
}

/**
 * destroy()
 * Clean up watchers (call on page unload if needed)
 */
function destroy() {
  _unwatch.forEach((fn) => fn());
  _unwatch = [];
  _initialised  = false;
  _initialising = false;
}

// ── Attach to window ─────────────────────────────────────────────────
window.WalletService = {
  init,
  open,
  close,
  connect,
  disconnect,
  getAccount,
  getBalance,
  switchNetwork,
  signMessage,
  getSupportedChains,
  isConnected,
  formatAddress: formatAddressPublic,
  destroy,
  SUPPORTED_CHAINS,
  getConfig: () => _config,
};

// Auto-init on load
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await init();
  } catch (err) {
    console.error("[WalletService] Auto-init failed:", err);
    emit("error", { message: err.message });
  }
});

export { init, open, close, connect, disconnect, getAccount, getBalance, switchNetwork, signMessage };

/**
 * KorriPay — walletService.js
 * ─────────────────────────────────────────────────────────────────
 * Wallet service layer using @wagmi/core + viem + WalletConnect.
 * Loaded as an ES module. Exposes window.WalletService for use by
 * non-module scripts (app.js, index.html inline scripts).
 *
 * Dependencies loaded from CDN — no build step required.
 *
 * SETUP REQUIRED:
 *   1. Get a free WalletConnect Project ID at https://cloud.walletconnect.com
 *   2. Replace WALLETCONNECT_PROJECT_ID below with your real ID.
 * ─────────────────────────────────────────────────────────────────
 */

// ── Configuration ──────────────────────────────────────────────────
const WALLETCONNECT_PROJECT_ID = "YOUR_WALLETCONNECT_PROJECT_ID"; // ← Replace this

const CDN = {
  wagmiCore:       "https://esm.sh/@wagmi/core@2.13.5",
  wagmiConnectors: "https://esm.sh/@wagmi/connectors@5.3.5",
  viem:            "https://esm.sh/viem@2.21.49",
  viemChains:      "https://esm.sh/viem@2.21.49/chains",
};

// ── Supported networks ──────────────────────────────────────────────
const SUPPORTED_CHAINS = {
  ethereum:  { id: 1,     name: "Ethereum",        symbol: "ETH",   explorer: "https://etherscan.io" },
  polygon:   { id: 137,   name: "Polygon",          symbol: "MATIC", explorer: "https://polygonscan.com" },
  arbitrum:  { id: 42161, name: "Arbitrum One",     symbol: "ETH",   explorer: "https://arbiscan.io" },
  optimism:  { id: 10,    name: "Optimism",          symbol: "ETH",   explorer: "https://optimistic.etherscan.io" },
  base:      { id: 8453,  name: "Base",             symbol: "ETH",   explorer: "https://basescan.org" },
  sepolia:   { id: 11155111, name: "Sepolia Testnet", symbol: "ETH", explorer: "https://sepolia.etherscan.io" },
};

// ── Internal state ──────────────────────────────────────────────────
let _config        = null;   // wagmi config
let _wagmi         = null;   // wagmi/core module
let _connectors    = null;   // wagmi/connectors module
let _chains        = null;   // viem/chains module
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
    [_wagmi, _connectors, _chains] = await Promise.all([
      import(CDN.wagmiCore),
      import(CDN.wagmiConnectors),
      import(CDN.viemChains),
    ]);
  } catch (err) {
    console.error("[WalletService] Failed to load wagmi modules from CDN:", err);
    throw new Error("Wallet library failed to load. Check your network connection.");
  }
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  if (_initialised)  return;
  if (_initialising) return;
  _initialising = true;

  await loadModules();

  const {
    createConfig,
    http,
    reconnect,
    watchAccount,
    watchChainId,
  } = _wagmi;

  const { injected, walletConnect } = _connectors;

  const {
    mainnet,
    polygon,
    arbitrum,
    optimism,
    base,
    sepolia,
  } = _chains;

  // Use user-configured or fallback project ID for demo purposes
  const projectId = (WALLETCONNECT_PROJECT_ID && WALLETCONNECT_PROJECT_ID !== "YOUR_WALLETCONNECT_PROJECT_ID")
    ? WALLETCONNECT_PROJECT_ID
    : "b56e18d47c72ab683b10814fe9495694"; // Fallback demo ID (safe for localhost)

  // Build wagmi config
  _config = createConfig({
    chains: [mainnet, polygon, arbitrum, optimism, base, sepolia],
    connectors: [
      injected({ target: "metaMask" }),
      injected({ target: "coinbaseWallet" }),
      walletConnect({
        projectId: projectId,
        metadata: {
          name:        "KorriPay",
          description: "Institutional-grade fintech dashboard",
          url:         window.location.origin,
          icons:       [`${window.location.origin}/favicon.ico`],
        },
        showQrModal: true,
      }),
    ],
    transports: {
      [mainnet.id]:  http(),
      [polygon.id]:  http(),
      [arbitrum.id]: http(),
      [optimism.id]: http(),
      [base.id]:     http(),
      [sepolia.id]:  http(),
    },
    storage: {
      // Persist session to localStorage under korripay namespace
      getItem:    (key) => localStorage.getItem(`korripay_wallet_${key}`),
      setItem:    (key, value) => localStorage.setItem(`korripay_wallet_${key}`, value),
      removeItem: (key) => localStorage.removeItem(`korripay_wallet_${key}`),
    },
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

  // Attempt to restore previous session from storage
  try {
    await reconnect(_config);
  } catch {
    // No previous session — that's fine
  }

  _initialised  = true;
  _initialising = false;

  emit("ready", { account: { ..._account } });
  console.info("[WalletService] Initialised. Status:", _account.status);
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

function resolveConnector(type) {
  if (!_config) throw new Error("[WalletService] Config not ready.");

  const connectors = _config.connectors;

  if (type === "metamask" || type === "injected") {
    return connectors.find((c) => c.id === "metaMask" || c.type === "injected") ?? connectors[0];
  }
  if (type === "coinbase") {
    return connectors.find((c) => c.id === "coinbaseWallet") ?? connectors[0];
  }
  if (type === "walletconnect" || type === "wc") {
    return connectors.find((c) => c.id === "walletConnect") ?? connectors[connectors.length - 1];
  }
  // Default: first available (usually MetaMask if installed)
  return connectors[0];
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * connect(type)
 * type: "metamask" | "coinbase" | "walletconnect" | "injected"
 * Returns: { address, chainId, network }
 */
async function connect(type = "metamask") {
  ensureInit();

  const { connect: wagmiConnect } = _wagmi;
  const connector = resolveConnector(type);

  try {
    const result = await wagmiConnect(_config, { connector });
    const network = getNetworkInfo(result.chainId);

    return {
      address:  result.accounts[0],
      chainId:  result.chainId,
      network,
    };
  } catch (err) {
    if (err.name === "ConnectorAlreadyConnectedError") {
      return getAccount();
    }
    throw err;
  }
}

/**
 * disconnect()
 */
async function disconnect() {
  ensureInit();
  const { disconnect: wagmiDisconnect } = _wagmi;
  await wagmiDisconnect(_config);
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

export { init, connect, disconnect, getAccount, getBalance, switchNetwork, signMessage };

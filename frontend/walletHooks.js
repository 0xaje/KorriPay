/**
 * KorriPay — walletHooks.js
 * ─────────────────────────────────────────────────────────────────
 * Vanilla JS observable hooks that wrap WalletService events.
 * Provides reactive-like patterns without a framework.
 *
 * Also handles automatic DOM binding to existing KorriPay elements:
 *   - #profile-wallet-address
 *   - #btn-copy-wallet
 *   - #btn-disconnect-wallet
 *   - #side-btn-disconnect
 *   - .wallet-opt-btn (index.html connector buttons)
 *   - #wallet-options / #wallet-connecting (index.html modal)
 *   - #connecting-status-text
 *
 * Exposes window.WalletHooks for use by non-module scripts.
 * ─────────────────────────────────────────────────────────────────
 */

// ── Subscriber registry ────────────────────────────────────────────
const _subscribers = {
  connected:      [],
  disconnected:   [],
  accountChanged: [],
  chainChanged:   [],
  stateChanged:   [],
  error:          [],
  ready:          [],
};

function subscribe(event, callback) {
  if (!_subscribers[event]) _subscribers[event] = [];
  _subscribers[event].push(callback);

  // Return unsubscribe function
  return () => {
    _subscribers[event] = _subscribers[event].filter((cb) => cb !== callback);
  };
}

// Listen to all WalletService CustomEvents and forward to subscribers
Object.keys(_subscribers).forEach((event) => {
  window.addEventListener(`korripay:wallet:${event}`, (e) => {
    _subscribers[event].forEach((cb) => {
      try { cb(e.detail); } catch (err) { console.error(`[WalletHooks] Error in '${event}' handler:`, err); }
    });
  });
});

// ── Hook factory ────────────────────────────────────────────────────

/** Called when wallet connects. Receives { address, chainId, network } */
function onConnect(cb)         { return subscribe("connected", cb); }

/** Called when wallet disconnects. */
function onDisconnect(cb)      { return subscribe("disconnected", cb); }

/** Called when account address changes. Receives { address } */
function onAccountChange(cb)   { return subscribe("accountChanged", cb); }

/** Called when chain/network changes. Receives { chainId, network } */
function onChainChange(cb)     { return subscribe("chainChanged", cb); }

/** Called on any state change. Receives { account: { address, chainId, status } } */
function onStateChange(cb)     { return subscribe("stateChanged", cb); }

/** Called when WalletService is fully ready (modules loaded, reconnect attempted). */
function onReady(cb)           { return subscribe("ready", cb); }

/** Called on any error. Receives { message } */
function onError(cb)           { return subscribe("error", cb); }

// ── Reactive state snapshot ─────────────────────────────────────────
let _state = {
  isConnected:  false,
  address:      null,
  shortAddress: null,
  chainId:      null,
  network:      null,
  balance:      null,
};

function getState() {
  return { ..._state };
}

function refreshState() {
  if (!window.WalletService) return;
  const acc   = window.WalletService.getAccount();
  _state = {
    isConnected:  acc.isConnected,
    address:      acc.address,
    shortAddress: acc.shortAddress,
    chainId:      acc.chainId,
    network:      acc.network,
    balance:      _state.balance, // preserved from last fetch
  };
}

// Sync state on every stateChanged event
onStateChange(({ account }) => {
  _state.isConnected  = account.status === "connected";
  _state.address      = account.address;
  _state.shortAddress = window.WalletService?.formatAddress(account.address) ?? null;
  _state.chainId      = account.chainId;
  _state.network      = window.WalletService
    ? window.WalletService.getAccount()?.network ?? null
    : null;
});

// ── DOM auto-binding ─────────────────────────────────────────────────

/**
 * Safely get a DOM element. Returns null without throwing if not found.
 */
function el(id) { return document.getElementById(id); }

/**
 * Update the wallet address display in both the profile and the sidebar.
 */
function updateAddressDisplay(address) {
  const displayEl = el("profile-wallet-address");
  const sidebarEl = el("sidebar-wallet-address");
  const formatted = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

  if (displayEl) {
    displayEl.textContent = formatted;
    if (address) displayEl.title = address;
  }
  if (sidebarEl) {
    sidebarEl.textContent = formatted;
    if (address) sidebarEl.title = address;
  }
}

/**
 * Update the active network display in the profile.
 */
function updateNetworkDisplay(network) {
  const networkEl = el("profile-network-display");
  if (networkEl) {
    networkEl.textContent = network ? network.name : "Not connected";
  }
}

/**
 * Wire the connect buttons in index.html's #modal-wallet.
 * Button data-name="MetaMask" → connects injected
 * Button data-name="Coinbase Wallet" → connects coinbase
 * Button data-name="WalletConnect" → connects walletconnect
 */
function bindConnectButtons() {
  const optionButtons = document.querySelectorAll(".wallet-opt-btn");
  const optionsPanel  = el("wallet-options");
  const connectingPanel = el("wallet-connecting");
  const statusText    = el("connecting-status-text");

  optionButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.WalletService) {
        alert("Wallet service is still loading. Please wait a moment.");
        return;
      }

      const name = btn.getAttribute("data-name") ?? "";

      let type = "metamask";
      if (name.toLowerCase().includes("coinbase"))          type = "coinbase";
      if (name.toLowerCase().includes("walletconnect"))     type = "walletconnect";

      // Show connecting UI
      if (optionsPanel)    optionsPanel.classList.add("hidden");
      if (connectingPanel) connectingPanel.classList.remove("hidden");
      if (statusText)      statusText.textContent = `Connecting to ${name}...`;

      try {
        const result = await window.WalletService.connect(type);

        if (statusText) statusText.textContent = "Requesting Auth Nonce...";

        // 1. Get nonce from server
        const nonceRes = await fetch("http://localhost:5000/api/auth/nonce");
        if (!nonceRes.ok) throw new Error("Failed to retrieve nonce from server");
        const { nonce, tempId } = await nonceRes.json();

        if (statusText) statusText.textContent = "Please sign SIWE request in wallet...";

        // 2. Format SIWE message
        const message = `Sign in to KorriPay.\nHost: localhost:5000\nAddress: ${result.address}\nNonce: ${nonce}\nStatement: Authenticate session.`;

        // 3. Request signature from wallet
        const signature = await window.WalletService.signMessage(message);

        if (statusText) statusText.textContent = "Verifying signature...";

        // 4. Verify signature on server
        const verifyRes = await fetch("http://localhost:5000/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature, address: result.address, tempId })
        });

        if (!verifyRes.ok) {
          const verifyErr = await verifyRes.json();
          throw new Error(verifyErr.error || "SIWE verification failed");
        }

        const authData = await verifyRes.json();

        // 5. Store session token
        localStorage.setItem("korripay_session_token", authData.token);

        if (statusText) statusText.textContent = "Authenticated successfully!";
        updateAddressDisplay(result.address);

        setTimeout(() => {
          window.location.href = `dashboard.html#home`;
        }, 800);

      } catch (err) {
        console.error("[WalletHooks] SIWE Connection error:", err);

        // Disconnect wallet if connected but SIWE failed to ensure clean state
        try { await window.WalletService.disconnect(); } catch (e) {}

        // Reset modal back to options
        if (optionsPanel)    optionsPanel.classList.remove("hidden");
        if (connectingPanel) connectingPanel.classList.add("hidden");
        if (statusText)      statusText.textContent = "Connecting...";

        const message = err.message?.includes("User rejected")
          ? "Signature request cancelled by user."
          : err.message ?? "Authentication failed.";

        alert(message);
      }
    });
  });
}

/**
 * Wire the copy wallet button in dashboard.html.
 * Overrides the hardcoded address in app.js with the real connected address.
 */
function bindCopyButton() {
  const copyBtn = el("btn-copy-wallet");
  if (!copyBtn) return;

  copyBtn.addEventListener("click", async () => {
    const address = _state.address;
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);

      // Visual feedback
      const icon = copyBtn.querySelector(".material-symbols-outlined");
      if (icon) {
        const original = icon.textContent;
        icon.textContent = "check";
        setTimeout(() => { icon.textContent = original; }, 2000);
      }

      if (typeof showToast === "function") {
        showToast("Wallet address copied!");
      }
    } catch {
      if (typeof showToast === "function") {
        showToast("Failed to copy address", "error");
      }
    }
  });
}

/**
 * Wire both disconnect buttons (profile + sidebar).
 */
function bindDisconnectButtons() {
  const btns = [el("btn-disconnect-wallet"), el("side-btn-disconnect")];

  btns.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const confirmed = confirm("Disconnect your wallet from KorriPay?");
      if (!confirmed) return;

      try {
        await window.WalletService.disconnect();

        if (typeof showToast === "function") {
          showToast("Wallet disconnected.");
        }

        // Redirect to landing page after brief delay
        setTimeout(() => { window.location.href = "index.html"; }, 1000);

      } catch (err) {
        console.error("[WalletHooks] Disconnect error:", err);
        if (typeof showToast === "function") {
          showToast("Failed to disconnect", "error");
        }
      }
    });
  });
}

/**
 * Wire the hero "Connect Wallet" button on index.html.
 */
function bindHeroConnectButton() {
  const heroBtn = el("btn-hero-connect");
  if (!heroBtn) return;

  heroBtn.addEventListener("click", () => {
    // Re-use existing wallet modal if present
    const fabBtn = el("btn-fab-connect");
    if (fabBtn) {
      fabBtn.click();
      return;
    }
    // Otherwise trigger WalletConnect directly
    window.WalletService?.connect("walletconnect").catch(console.error);
  });
}

/**
 * Auto-update all wallet-related DOM when state changes.
 */
onStateChange(() => {
  updateAddressDisplay(_state.address);
  updateNetworkDisplay(_state.network);
});

onConnect(({ address, chainId, network }) => {
  updateAddressDisplay(address);
  updateNetworkDisplay(network);

  if (typeof showToast === "function") {
    const networkName = network?.name ?? `Chain ${chainId}`;
    showToast(`Wallet connected on ${networkName}`);
  }
});

onDisconnect(() => {
  updateAddressDisplay(null);
  updateNetworkDisplay(null);
});

// ── Balance fetching utility ─────────────────────────────────────────

/**
 * fetchBalance(address?, chainId?)
 * Fetches native balance and stores in state. Returns formatted result.
 */
async function fetchBalance(address, chainId) {
  if (!window.WalletService?.isConnected()) return null;

  try {
    const result = await window.WalletService.getBalance(address, chainId);
    _state.balance = result;
    return result;
  } catch (err) {
    console.error("[WalletHooks] Failed to fetch balance:", err);
    return null;
  }
}

// ── Guard: require wallet to access dashboard ────────────────────────

function requireWallet(redirectTo = "index.html") {
  const token = localStorage.getItem("korripay_session_token");
  if (!token) {
    console.info("[WalletHooks] No session token found — redirecting to", redirectTo);
    window.location.href = redirectTo;
    return;
  }

  onReady(({ account }) => {
    const isDemoSession = token.startsWith("session-demo-");
    if (account.status !== "connected" && !isDemoSession) {
      console.info("[WalletHooks] No wallet connected and not in demo mode — redirecting to", redirectTo);
      window.location.href = redirectTo;
    }
  });
}

// ── DOM initialisation ───────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  bindConnectButtons();
  bindCopyButton();
  bindDisconnectButtons();
  bindHeroConnectButton();
  refreshState();
});

// ── Expose on window ─────────────────────────────────────────────────
window.WalletHooks = {
  // Subscriptions
  onConnect,
  onDisconnect,
  onAccountChange,
  onChainChange,
  onStateChange,
  onReady,
  onError,

  // State
  getState,
  refreshState,
  fetchBalance,

  // Guards
  requireWallet,
};

export {
  onConnect,
  onDisconnect,
  onAccountChange,
  onChainChange,
  onStateChange,
  onReady,
  onError,
  getState,
  fetchBalance,
  requireWallet,
};

// Auto-guard dashboard.html pages
if (window.location.pathname.includes("dashboard.html")) {
  requireWallet("index.html");
}

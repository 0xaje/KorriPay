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
  optionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      window.WalletService?.open();
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
        localStorage.removeItem("korripay_logged_in");

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
    window.WalletService?.open();
  });
}

/**
 * Auto-update all wallet-related DOM when state changes.
 */
onStateChange(() => {
  updateAddressDisplay(_state.address);
  updateNetworkDisplay(_state.network);
});

onConnect(async ({ address, chainId, network }) => {
  updateAddressDisplay(address);
  updateNetworkDisplay(network);

  if (typeof showToast === "function") {
    const networkName = network?.name ?? `Chain ${chainId}`;
    showToast(`Wallet connected on ${networkName}`);
  }

  // Check if they need authentication (if they aren't logged in on backend)
  const isLoggedIn = localStorage.getItem("korripay_logged_in") === "true";
  if (!isLoggedIn) {
    // Show signature request dialog or overlay
    const optionsPanel = el("wallet-options");
    const connectingPanel = el("wallet-connecting");
    const statusText = el("connecting-status-text");
    const overlay = el("modal-overlay");
    const walletModal = el("modal-wallet");

    // Make sure overlay is visible
    if (overlay && walletModal) {
      overlay.classList.remove("hidden");
      walletModal.classList.remove("hidden");
      overlay.classList.add("opacity-100");
      walletModal.classList.add("opacity-100", "scale-100");
      walletModal.classList.remove("scale-95", "opacity-0");
    }

    if (optionsPanel) optionsPanel.classList.add("hidden");
    if (connectingPanel) {
      connectingPanel.classList.remove("hidden");
      connectingPanel.style.display = "flex";
    }
    if (statusText) statusText.textContent = "Requesting Auth Nonce...";

    try {
      // 1. Get nonce from server
      const nonceRes = await fetch("http://localhost:5000/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Failed to retrieve nonce from server");
      const { nonce, tempId } = await nonceRes.json();

      if (statusText) statusText.textContent = "Please sign GIWA request in wallet...";

      // 2. Format GIWA message
      const message = `Sign in to KorriPay.\nHost: localhost:5000\nAddress: ${address}\nNonce: ${nonce}\nStatement: Authenticate session.`;

      // 3. Request signature from wallet
      const signature = await window.WalletService.signMessage(message);

      if (statusText) statusText.textContent = "Verifying signature...";

      // 4. Verify signature on server
      const verifyRes = await fetch("http://localhost:5000/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, address, tempId })
      });

      if (!verifyRes.ok) {
        const verifyErr = await verifyRes.json();
        throw new Error(verifyErr.error || "GIWA verification failed");
      }

      const authData = await verifyRes.json();

      // 5. Store session status
      localStorage.setItem("korripay_logged_in", "true");

      if (statusText) statusText.textContent = "Authenticated successfully!";
      updateAddressDisplay(address);

      setTimeout(() => {
        window.location.href = `dashboard.html#home`;
      }, 800);

    } catch (err) {
      console.error("[WalletHooks] GIWA Connection error during auto-sign:", err);
      try { await window.WalletService.disconnect(); } catch (e) {}
      localStorage.removeItem("korripay_logged_in");

      // Reset modal UI
      if (optionsPanel) optionsPanel.classList.remove("hidden");
      if (connectingPanel) connectingPanel.classList.add("hidden");
      if (statusText) statusText.textContent = "Connecting...";

      // Hide modal
      if (overlay && walletModal) {
        overlay.classList.remove("opacity-100");
        walletModal.classList.remove("opacity-100", "scale-100");
        walletModal.classList.add("scale-95", "opacity-0");
        setTimeout(() => {
          overlay.classList.add("hidden");
          walletModal.classList.add("hidden");
        }, 300);
      }

      let errorMsg = "Authentication failed.";
      if (err.message?.includes("User rejected")) {
        errorMsg = "Signature request cancelled by user.";
      } else {
        errorMsg = err.message ?? "Authentication failed.";
      }
      alert(errorMsg);
    }
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
  const token = localStorage.getItem("korripay_logged_in");
  if (!token) {
    console.info("[WalletHooks] No session token found — redirecting to", redirectTo);
    window.location.href = redirectTo;
    return;
  }
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

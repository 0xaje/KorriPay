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
    ? window.WalletService.getSupportedChains?.()[account.chainId] ?? null
    : null;
});

// ── DOM auto-binding ─────────────────────────────────────────────────

/**
 * Safely get a DOM element. Returns null without throwing if not found.
 */
function el(id) { return document.getElementById(id); }

/**
 * Update the profile wallet address display.
 */
function updateAddressDisplay(address) {
  const displayEl = el("profile-wallet-address");
  if (displayEl && address) {
    displayEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
    displayEl.title       = address; // full address on hover
  }
  if (displayEl && !address) {
    displayEl.textContent = "Not connected";
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

        if (statusText) statusText.textContent = "Connected!";

        // Update address display immediately
        updateAddressDisplay(result.address);

        // Small delay then navigate to dashboard
        setTimeout(() => {
          window.location.href = `dashboard.html#home`;
        }, 800);

      } catch (err) {
        console.error("[WalletHooks] Connection error:", err);

        // Reset modal back to options
        if (optionsPanel)    optionsPanel.classList.remove("hidden");
        if (connectingPanel) connectingPanel.classList.add("hidden");
        if (statusText)      statusText.textContent = "Connecting...";

        // Show error (use app's toast if available, otherwise alert)
        const message = err.message?.includes("User rejected")
          ? "Connection cancelled by user."
          : err.message ?? "Failed to connect wallet.";

        if (typeof showToast === "function") {
          showToast(message, "error");
        } else {
          console.warn("[WalletHooks]", message);
        }
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
});

onConnect(({ address, chainId, network }) => {
  updateAddressDisplay(address);

  if (typeof showToast === "function") {
    const networkName = network?.name ?? `Chain ${chainId}`;
    showToast(`Wallet connected on ${networkName}`);
  }
});

onDisconnect(() => {
  updateAddressDisplay(null);
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

/**
 * requireWallet(redirectTo)
 * Call on dashboard pages. Redirects to landing if no wallet connected.
 * NOTE: This is a soft guard (client-side only). Server auth needed for production.
 */
function requireWallet(redirectTo = "index.html") {
  onReady(({ account }) => {
    if (account.status !== "connected") {
      console.info("[WalletHooks] No wallet connected — redirecting to", redirectTo);
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

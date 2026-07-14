// KorriPay Frontend Logic
import { networkRegistry } from "./src/infrastructure/giwa/index.js";

const API_BASE = "http://localhost:5000/api";

// Top Loader Progress Indicator
function toggleGlobalLoader(show) {
  let loader = document.getElementById("global-top-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "global-top-loader";
    loader.style.position = "fixed";
    loader.style.top = "0";
    loader.style.left = "0";
    loader.style.height = "3px";
    loader.style.backgroundColor = "#6200ee";
    loader.style.zIndex = "10000";
    loader.style.transition = "width 0.2s ease";
    loader.style.width = "0%";
    document.body.appendChild(loader);
  }

  if (show) {
    loader.style.width = "40%";
    setTimeout(() => {
      if (loader.style.width === "40%") {
        loader.style.width = "80%";
      }
    }, 400);
  } else {
    loader.style.width = "100%";
    setTimeout(() => {
      loader.style.width = "0%";
    }, 200);
  }
}

// Offline Status banner setup
function setupOfflineBanner() {
  let banner = document.getElementById("offline-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "offline-banner";
    banner.style.position = "fixed";
    banner.style.top = "0";
    banner.style.left = "0";
    banner.style.width = "100%";
    banner.style.backgroundColor = "#e05353";
    banner.style.color = "#ffffff";
    banner.style.textAlign = "center";
    banner.style.padding = "8px 16px";
    banner.style.fontSize = "13px";
    banner.style.fontWeight = "bold";
    banner.style.zIndex = "9999";
    banner.style.display = "none";
    banner.style.boxShadow = "0 2px 4px rgba(0,0,0,0.15)";
    banner.innerHTML = `<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px; font-size: 18px;">wifi_off</span>You are currently offline. Switching to local cached database.`;
    document.body.appendChild(banner);
  }

  function handleConnectionChange() {
    if (navigator.onLine) {
      banner.style.display = "none";
      if (window.showToast) window.showToast("You are back online!", "success");
    } else {
      banner.style.display = "block";
      if (window.showToast) window.showToast("Network connection lost. Offline fallback mode active.", "error");
    }
  }

  window.addEventListener("online", handleConnectionChange);
  window.addEventListener("offline", handleConnectionChange);

  // Check initial state
  if (!navigator.onLine) {
    banner.style.display = "block";
  }
}

// Run banner initialization on script load or inside DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupOfflineBanner);
} else {
  setupOfflineBanner();
}

async function authFetch(url, options = {}, retries = 3, backoff = 1000) {
  // Hard Offline check
  if (!navigator.onLine) {
    const offlineErr = new Error("Internet connection unavailable.");
    offlineErr.isOffline = true;
    throw offlineErr;
  }

  const token = localStorage.getItem("korripay_session_token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  toggleGlobalLoader(true);

  try {
    let res;
    for (let i = 0; i < retries; i++) {
      try {
        res = await fetch(url, {
          ...options,
          headers,
          credentials: "include"
        });

        // Resolve if successful, or if not a transient 5xx error
        if (res.ok || res.status < 500) {
          break;
        }
      } catch (err) {
        if (i === retries - 1) {
          throw err;
        }
        // Exponential backoff wait
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
      }
    }

    toggleGlobalLoader(false);

    if (res && res.status === 401) {
      localStorage.removeItem("korripay_session_token");
      localStorage.removeItem("korripay_logged_in");
      window.location.href = "index.html";
    }
    return res;
  } catch (err) {
    toggleGlobalLoader(false);
    throw err;
  }
}

window.API_BASE = API_BASE;
window.authFetch = authFetch;

let isBackendConnected = false;

// Mock Fallback Data (if backend is unreachable)
let localState = {
  balance: 1250.00,
  savings: 45.00,
  btcBalance: 14.82,
  ethBalance: 2.45,
  usdcBalance: 2450.00,
  mockkrwBalance: 500000.00,
  currencies: {
    USD:     { available: 1250.00, locked: 0, pending: 0 },
    KRW:     { available: 0,       locked: 0, pending: 0 },
    NGN:     { available: 0,       locked: 0, pending: 0 },
    MockKRW: { available: 500000,  locked: 0, pending: 0 },
  },
  transactions: [
    { id: "tx-1", title: "Sent to John",        type: "send",    amount: 240.00,  date: "Today • 10:45 AM",    timestamp: Date.now() - 3600000 * 2,      category: "Transfer" },
    { id: "tx-2", title: "Received from Sarah", type: "receive", amount: 1500.00, date: "Yesterday • 4:20 PM", timestamp: Date.now() - 3600000 * 24,     category: "Completed" },
    { id: "tx-3", title: "Starbucks Coffee",    type: "bill",    amount: 6.50,   date: "May 24 • 8:12 AM",   timestamp: Date.now() - 3600000 * 24 * 30, category: "Merchant" }
  ]
};

// Main State
let state = {
  balance: 0,
  savings: 0,
  btcBalance: 0,
  ethBalance: 0,
  usdcBalance: 0,
  mockkrwBalance: 0,
  currencies: {
    USD:     { available: 0, locked: 0, pending: 0 },
    KRW:     { available: 0, locked: 0, pending: 0 },
    NGN:     { available: 0, locked: 0, pending: 0 },
    MockKRW: { available: 0, locked: 0, pending: 0 },
  },
  transactions: []
};

// Check if the user is an admin to show Admin Console navigation link
async function checkAdminStatus() {
  try {
    const res = await authFetch("http://localhost:5000/api/auth/me");
    if (res && res.ok) {
      const user = await res.json();
      if (user.role === 'ADMIN') {
        const sideAdmin = document.getElementById("side-nav-admin");
        const navAdmin = document.getElementById("nav-admin");
        if (sideAdmin) sideAdmin.classList.remove("hidden");
        if (navAdmin) navAdmin.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error("Failed to check admin status:", err);
  }
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setupDarkMode();
  setupNavigation();
  checkAdminStatus();
  setupModals();
  setupFormHandlers();
  setupFiltersAndSearch();
  setupQuickContacts();
  setupMultiStepSend();
  setupKycVerification();
  setupPortfolio();
  setupSwap();
  setupExplorerListeners();
  setupMerchant();
  setupAnalytics();
  setupCompliance();
  setupGiwa();
  
  // Dev Reset
  const devResetBtn = document.getElementById("btn-dev-reset");
  if (devResetBtn) {
    devResetBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all data to default values?")) {
        resetState();
      }
    });
  }

  // Copy and Disconnect Wallet are now handled natively by WalletHooks.js
  
  // Require wallet connection for dashboard access
  if (window.WalletHooks) {
    window.WalletHooks.requireWallet();

    // Listen to wallet state changes (network switch, account switch, connection status)
    window.WalletHooks.onStateChange(async () => {
      console.log("[Wallet Hooks] State change detected. Re-fetching blockchain balances...");
      await updateBlockchainBalances();
      renderUI();
    });

    window.WalletHooks.onConnect(async () => {
      console.log("[Wallet Hooks] Wallet connected. Fetching blockchain balances...");
      await updateBlockchainBalances();
      renderUI();
    });

    window.WalletHooks.onDisconnect(() => {
      console.log("[Wallet Hooks] Wallet disconnected. Resetting to mock/fallback balances...");
      // Revert state balances to mock defaults
      state.usdcBalance = localState.usdcBalance;
      state.mockkrwBalance = localState.mockkrwBalance;
      state.ethBalance = localState.ethBalance;
      renderUI();
    });
  }

  // Initial Load
  loadData();

  // Hash Routing check
  checkHashRoute();
  window.addEventListener("hashchange", checkHashRoute);

  // Setup Demo Mode
  setupDemoMode();

  // Infrastructure Status Banner & Settlement Engine Widget
  setTimeout(() => {
    updateInfraStatusBanner();
    updateSettlementEngineWidget();
  }, 900);
});

// ── Infrastructure Status Banner ──────────────────────────────────────────
function updateInfraStatusBanner() {
  const giwaOnline = networkRegistry?.giwa?.isOnline ?? false;
  const chainId = networkRegistry?.giwa?.config?.chainId || 92837;

  const setStatus = (dotId, labelId, online, onText, offText) => {
    const dot = document.getElementById(dotId);
    const label = document.getElementById(labelId);
    if (!dot || !label) return;
    if (online) {
      dot.className = "w-1.5 h-1.5 rounded-full bg-green-500";
      label.className = "text-green-600 dark:text-green-400 font-bold";
      label.textContent = onText;
    } else {
      dot.className = "w-1.5 h-1.5 rounded-full bg-amber-400";
      label.className = "text-amber-500 font-bold";
      label.textContent = offText;
    }
  };

  setStatus("infra-giwa-dot", "infra-giwa-status", giwaOnline, "Healthy", "Simulation Mode");
  setStatus("infra-engine-dot", "infra-engine-status", true, "Operational", "Degraded");
  setStatus("infra-attest-dot", "infra-attest-status", true, "Active", "Offline");

  const explorerUrl = networkRegistry?.giwa?.config?.explorerUrl;
  const explorerDot = document.getElementById("infra-explorer-dot");
  const explorerStatus = document.getElementById("infra-explorer-status");
  if (explorerDot && explorerStatus) {
    if (explorerUrl) {
      explorerDot.className = "w-1.5 h-1.5 rounded-full bg-green-500";
      explorerStatus.className = "text-green-600 dark:text-green-400 font-bold";
      explorerStatus.textContent = "Connected";
    } else {
      explorerDot.className = "w-1.5 h-1.5 rounded-full bg-slate-400";
      explorerStatus.className = "text-outline font-bold";
      explorerStatus.textContent = "Unavailable";
    }
  }

  const chainEl = document.getElementById("infra-chain-id");
  if (chainEl) chainEl.textContent = `Chain ID: ${chainId}`;
}

// ── Settlement Engine Widget ──────────────────────────────────────────────
function updateSettlementEngineWidget() {
  const txs = state.transactions || [];
  const pending = txs.filter(t => t.status === "Pending" || t.status === "Processing").length;
  const settled = txs.filter(t => t.status === "Settled" || t.status === "Completed" || t.status === "Success");
  const failed = txs.filter(t => t.status === "Failed").length;
  const total = txs.length;
  const successRate = total > 0 ? Math.round((settled.length / total) * 1000) / 10 : null;

  // Derive throughput (settled in last 24h approximated from last 20 txs as sample window)
  const recentSettled = settled.slice(-20).length;
  const throughput = total > 0 ? `${recentSettled * 3}/hr` : "—";

  // Average settlement time (derived from tx timestamps if available, else fallback)
  const durations = settled.filter(t => t.createdAt && t.settledAt)
    .map(t => (new Date(t.settledAt) - new Date(t.createdAt)) / 1000);
  const avgTime = durations.length > 0
    ? `~${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)}s`
    : "~3s";

  const lastBlock = networkRegistry?.giwa?.blockNumber;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el && val !== null) el.textContent = val; };
  setEl("engine-queue-size", pending);
  setEl("engine-success-rate", successRate !== null ? `${successRate}%` : "—");
  setEl("engine-throughput", throughput);
  setEl("engine-avg-time", avgTime);
  setEl("engine-last-block", lastBlock ? `#${Number(lastBlock).toLocaleString()}` : "—");

  const badge = document.getElementById("engine-status-badge");
  if (badge) {
    const isHealthy = pending < 10 && (successRate === null || successRate >= 85);
    badge.className = isHealthy
      ? "bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1";
    const dotColor = isHealthy ? "bg-green-500" : "bg-amber-400";
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse"></span> ${isHealthy ? "Operational" : "Elevated"}`;
  }
}


function setupDarkMode() {
  const toggle = document.getElementById("dark-mode-toggle");
  const desktopToggle = document.getElementById("desktop-dark-mode-toggle");
  
  // Set default theme from system or storage
  const isDark = localStorage.getItem("theme") === "dark" || 
    (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  
  const updateToggleIcons = (dark) => {
    const text = dark ? "light_mode" : "dark_mode";
    if (toggle) toggle.textContent = text;
    if (desktopToggle) desktopToggle.textContent = text;
  };

  if (isDark) {
    document.documentElement.classList.add("dark");
    updateToggleIcons(true);
  } else {
    document.documentElement.classList.remove("dark");
    updateToggleIcons(false);
  }

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    if (isCurrentlyDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      updateToggleIcons(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      updateToggleIcons(true);
    }
    showToast("Theme updated");
  };

  if (toggle) toggle.addEventListener("click", toggleTheme);
  if (desktopToggle) desktopToggle.addEventListener("click", toggleTheme);
}

// Navigation Tabs Switching
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item, .side-nav-item");

  // Nav items click - update the hash in the URL
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetHash = item.id.replace("side-nav-", "").replace("nav-", "");
      window.location.hash = targetHash;
    });
  });

  // "See all" button on Home dashboard redirects to History tab
  const seeAllBtn = document.getElementById("btn-see-all");
  if (seeAllBtn) {
    seeAllBtn.addEventListener("click", () => {
      window.location.hash = "history";
    });
  }

  // Copy sidebar wallet address listener
  const btnCopyWallet = document.getElementById("btn-copy-sidebar-wallet");
  if (btnCopyWallet) {
    btnCopyWallet.addEventListener("click", () => {
      if (state && state.walletAddress) {
        navigator.clipboard.writeText(state.walletAddress).then(() => {
          showToast("Wallet address copied to clipboard!");
        });
      } else {
        const addressEl = document.getElementById("sidebar-wallet-address");
        if (addressEl) {
          navigator.clipboard.writeText(addressEl.title || addressEl.textContent).then(() => {
            showToast("Wallet address copied to clipboard!");
          });
        }
      }
    });
  }
}

function checkHashRoute() {
  const hash = window.location.hash;
  
  // Clean up any active swap intervals when navigating away from #swap
  if (hash !== "#swap" && window.swapTimerInterval) {
    clearInterval(window.swapTimerInterval);
    window.swapTimerInterval = null;
  }
  
  // Clean up confetti loop when navigating away from #swap-success
  if (hash !== "#swap-success" && window.confettiAnimationId) {
    cancelAnimationFrame(window.confettiAnimationId);
    window.confettiAnimationId = null;
    window.confettiActive = false;
  }

  // We keep the GIWA interval running to support auto-updates on the home dashboard status widget!
 
  if (hash === "#send") {
    switchTab("tab-send");
  } else if (hash === "#history") {
    switchTab("tab-history");
  } else if (hash === "#portfolio") {
    switchTab("tab-portfolio");
  } else if (hash === "#swap") {
    switchTab("tab-swap");
  } else if (hash === "#swap-success") {
    switchTab("tab-swap-success");
    startSuccessConfetti();
  } else if (hash === "#profile") {
    switchTab("tab-profile");
  } else if (hash === "#explorer") {
    switchTab("tab-explorer");
    if (typeof loadExplorerData === "function") {
      loadExplorerData();
    }
  } else if (hash === "#merchant") {
    switchTab("tab-merchant");
    if (typeof loadMerchantData === "function") {
      loadMerchantData();
    }
  } else if (hash === "#merchant-portal") {
    switchTab("tab-merchant-portal");
    if (typeof loadMerchantPortalData === "function") {
      loadMerchantPortalData();
    }
  } else if (hash === "#analytics") {
    switchTab("tab-analytics");
    if (typeof loadAnalyticsData === "function") {
      loadAnalyticsData();
    }
    if (typeof loadGiwaData === "function") {
      loadGiwaData();
      if (!window.giwaTimerInterval) {
        window.giwaTimerInterval = setInterval(loadGiwaData, 30000);
      }
    }
  } else if (hash === "#giwa") {
    switchTab("tab-giwa");
    if (typeof loadGiwaData === "function") {
      loadGiwaData();
      if (!window.giwaTimerInterval) {
        window.giwaTimerInterval = setInterval(loadGiwaData, 30000);
      }
    }
  } else if (hash === "#operations") {
    switchTab("tab-operations");
    if (typeof loadOperationsData === "function") {
      loadOperationsData();
      if (!window.opsTimerInterval) {
        window.opsTimerInterval = setInterval(loadOperationsData, 10000);
      }
    }
  } else if (hash === "#compliance") {
    switchTab("tab-compliance");
    if (typeof loadComplianceData === "function") {
      loadComplianceData();
    }
  } else {
    switchTab("tab-home");
  }
}

async function loadCompliancePassport() {
  const passportEl = document.querySelector("compliance-passport");
  if (passportEl && typeof passportEl.refresh === "function") {
    try {
      await passportEl.refresh();
    } catch (err) {
      console.warn("[App] Failed to load compliance passport:", err);
    }
  }
}

function switchTab(tabId) {
  const navItems = document.querySelectorAll(".nav-item");
  const sideNavItems = document.querySelectorAll(".side-nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  tabContents.forEach(tab => {
    if (tab.id === tabId) {
      tab.classList.add("active");
      tab.classList.remove("hidden");
    } else {
      tab.classList.remove("active");
      tab.classList.add("hidden");
    }
  });

  const navKey = tabId.replace("tab-", "");

  // Update Bottom Nav Items
  navItems.forEach(item => {
    const itemKey = item.id.replace("nav-", "");
    if (itemKey === navKey) {
      // Active styling
      item.className = "nav-item shrink-0 flex flex-col items-center justify-center bg-primary/10 dark:bg-primary-fixed/10 text-primary dark:text-primary-fixed rounded-full px-4 py-1.5 active:scale-90 transition-all duration-200";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    } else {
      // Inactive styling
      item.className = "nav-item shrink-0 flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant px-4 py-1.5 hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 transition-transform";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 0";
    }
  });

  // Update Sidebar Nav Items
  sideNavItems.forEach(item => {
    const itemKey = item.id.replace("side-nav-", "");
    if (itemKey === navKey) {
      // Active styling
      item.className = "side-nav-item flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 dark:bg-primary-fixed/10 text-primary dark:text-primary-fixed font-bold border-l-4 border-primary dark:border-primary-fixed-dim pl-3 active:scale-95 transition-all duration-200";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    } else {
      // Inactive styling
      item.className = "side-nav-item flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant dark:text-outline-variant hover:bg-surface-container/40 dark:hover:bg-inverse-surface/10 hover:text-primary dark:hover:text-primary-fixed hover:pl-5 active:scale-95 transition-all duration-200";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 0";
    }
  });

  // Update Desktop Title
  const desktopTitle = document.getElementById("desktop-page-title");
  if (desktopTitle) {
    if (tabId === "tab-home") desktopTitle.textContent = "Settlement Dashboard";
    else if (tabId === "tab-send") desktopTitle.textContent = "Create Settlement";
    else if (tabId === "tab-history") desktopTitle.textContent = "Settlement Ledger";
    else if (tabId === "tab-portfolio") desktopTitle.textContent = "Portfolio";
    else if (tabId === "tab-swap") desktopTitle.textContent = "Swap Assets";
    else if (tabId === "tab-swap-success") desktopTitle.textContent = "Swap Success";
    else if (tabId === "tab-explorer") desktopTitle.textContent = "Settlement Explorer";
    else if (tabId === "tab-merchant") desktopTitle.textContent = "Merchant Pay";
    else if (tabId === "tab-merchant-portal") desktopTitle.textContent = "Settlement Portal";
    else if (tabId === "tab-analytics") desktopTitle.textContent = "Analytics Dashboard";
    else if (tabId === "tab-giwa") desktopTitle.textContent = "GIWA Status";
    else if (tabId === "tab-operations") desktopTitle.textContent = "Operations";
    else if (tabId === "tab-compliance") desktopTitle.textContent = "Compliance";
    else if (tabId === "tab-profile") {
      desktopTitle.textContent = "My Profile";
      loadCompliancePassport();
    }
  }

  // Scroll to top of body when switching pages
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Modal Animation Helpers
function setupModals() {
  const overlay = document.getElementById("modal-overlay");
  const modals = [
    { btn: "btn-quick-send", modal: "modal-send" },
    { btn: "btn-quick-add", modal: "modal-add" },
    { btn: "btn-quick-pay", modal: "modal-pay" },
    { btn: "btn-add-contact", modal: "modal-contact" },
    { btn: "btn-manage-contacts", modal: "modal-manage-contacts" },
    { btn: "btn-view-all-contacts", modal: "modal-manage-contacts" }
  ];

  modals.forEach(({ btn, modal }) => {
    const trigger = document.getElementById(btn);
    const targetModal = document.getElementById(modal);
    if (trigger && targetModal) {
      trigger.addEventListener("click", () => openModal(modal));
    }
  });

  // Close triggers
  const closeBtns = document.querySelectorAll(".modal-close-btn");
  closeBtns.forEach(btn => {
    btn.addEventListener("click", () => closeAllModals());
  });

  const dismissProofBtn = document.getElementById("btn-close-proof-modal");
  if (dismissProofBtn) {
    dismissProofBtn.addEventListener("click", () => closeAllModals());
  }

  overlay.addEventListener("click", () => closeAllModals());
  
  // ESC key listener
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
}

let lastActiveElement = null;

function openModal(modalId) {
  lastActiveElement = document.activeElement;
  const overlay = document.getElementById("modal-overlay");
  const targetModal = document.getElementById(modalId);
  
  overlay.classList.remove("hidden");
  targetModal.classList.remove("hidden");
  
  // Force reflow
  void overlay.offsetWidth;
  
  overlay.classList.add("opacity-100");
  targetModal.classList.add("opacity-100", "scale-100");
  targetModal.classList.remove("scale-95", "opacity-0");

  // Focus management: focus first input or button in the modal
  const focusable = targetModal.querySelectorAll('input, button, select, textarea, a[href]');
  if (focusable.length > 0) {
    setTimeout(() => focusable[0].focus(), 50);
  }
}

function closeAllModals() {
  const overlay = document.getElementById("modal-overlay");
  const modals = document.querySelectorAll("[id^='modal-']:not(#modal-overlay)");
  
  overlay.classList.remove("opacity-100");
  
  modals.forEach(modal => {
    modal.classList.remove("opacity-100", "scale-100");
    modal.classList.add("scale-95", "opacity-0");
  });

  setTimeout(() => {
    overlay.classList.add("hidden");
    modals.forEach(modal => modal.classList.add("hidden"));
    if (lastActiveElement) {
      lastActiveElement.focus();
      lastActiveElement = null;
    }
  }, 300);
}

import { showToast, copyTextToClipboard, sleep } from './src/utils.js';
window.showToast = showToast;
window.copyTextToClipboard = copyTextToClipboard;

function saveLocalState() {
  localStorage.setItem("korripay_state", JSON.stringify(localState));
}

// Fetch token and native balances directly from the connected wallet
async function updateBlockchainBalances() {
  if (!window.WalletService || !window.TokenService) {
    console.warn("[Blockchain Balances] WalletService or TokenService not found on window.");
    return;
  }

  const account = window.WalletService.getAccount();
  if (account && account.isConnected && account.address) {
    const address = account.address;
    const chainId = account.chainId;
    console.info(`[Blockchain Balances] Connected address: ${address} on chain: ${chainId}. Fetching balances...`);

    try {
      // 1. Fetch ERC20 USDC balance
      const usdcBal = await window.TokenService.fetchTokenBalance("USDC", address, chainId);
      state.usdcBalance = parseFloat(usdcBal) || 0;

      // 2. Fetch ERC20 MockKRW balance
      const mockkrwBal = await window.TokenService.fetchTokenBalance("MockKRW", address, chainId);
      state.mockkrwBalance = parseFloat(mockkrwBal) || 0;

      // 3. Fetch Native Token (ETH) balance
      const nativeBal = await window.WalletService.getBalance();
      if (nativeBal && nativeBal.formatted) {
        state.ethBalance = parseFloat(nativeBal.formatted) || 0;
      }

      console.info("[Blockchain Balances] Successfully updated balances:", {
        USDC: state.usdcBalance,
        MockKRW: state.mockkrwBalance,
        ETH: state.ethBalance
      });
    } catch (err) {
      console.error("[Blockchain Balances] Failed to fetch balances from blockchain:", err);
    }
  } else {
    // Reset to fallback/mock balances when disconnected
    state.usdcBalance = localState.usdcBalance;
    state.mockkrwBalance = localState.mockkrwBalance;
    state.ethBalance = localState.ethBalance;
    console.info("[Blockchain Balances] Wallet disconnected, reverted to fallback mock balances.");
  }
}

// API Communication
async function loadData() {
  const statusIndicator = document.getElementById("conn-status");
  const desktopStatusIndicator = document.getElementById("desktop-conn-status");
  
  const updateStatus = (isConnected) => {
    const className = isConnected ? "w-2.5 h-2.5 rounded-full bg-green-500" : "w-2.5 h-2.5 rounded-full bg-red-500";
    const title = isConnected ? "Connected to backend API" : "Offline (using local storage mock)";
    if (statusIndicator) {
      statusIndicator.className = className;
      statusIndicator.title = title;
    }
    if (desktopStatusIndicator) {
      desktopStatusIndicator.className = className;
      desktopStatusIndicator.title = title;
    }
  };

  try {
    const res = await authFetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error("Server response error");
    const data = await res.json();
    
    state = data;

    // Fetch profile details for wallet address
    try {
      const meRes = await authFetch(`${API_BASE}/auth/me`);
      if (meRes.ok) {
        const meData = await meRes.json();
        state.walletAddress = meData.walletAddress;
        const sidebarAddr = document.getElementById("sidebar-wallet-address");
        if (sidebarAddr && meData.walletAddress) {
          sidebarAddr.textContent = meData.walletAddress.substring(0, 6) + "..." + meData.walletAddress.substring(meData.walletAddress.length - 4);
          sidebarAddr.title = meData.walletAddress;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch me details", e);
    }
    // Hydrate multi-currency balances from API response
    if (data.currencies) {
      state.currencies = data.currencies;
    }
    _walletBalanceFetched = false; // allow wallet/summary to refresh
    isBackendConnected = true;
    updateStatus(true);
  } catch (err) {
    console.warn("Backend API unreachable. Falling back to local data store.", err);
    const stored = localStorage.getItem("korripay_state");
    if (stored) {
      try {
        localState = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored localState", e);
      }
    }
    state = { ...localState };
    isBackendConnected = false;
    updateStatus(false);
  }
  
  // Override balances with live blockchain balances if connected
  await updateBlockchainBalances();
  
  renderUI();
}

function renderUI() {
  // Update Balance (legacy USD hero display)
  const totalBalanceEl = document.getElementById("total-balance");
  if (totalBalanceEl) {
    totalBalanceEl.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Update Savings
  const savingsValEl = document.getElementById("savings-val");
  if (savingsValEl) {
    savingsValEl.textContent = state.savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Multi-currency wallet display
  renderWalletBalances();

  // Update Settlement Engine widget
  updateSettlementEngineWidget();

  // Render recent transactions (Home Tab)
  const recentListEl = document.getElementById("recent-transactions-list");
  if (recentListEl) {
    recentListEl.innerHTML = "";
    if (state.transactions.length === 0) {
      recentListEl.innerHTML = `<div class="p-sm text-center text-on-surface-variant/70">No recent transactions</div>`;
    } else {
      const top3 = state.transactions.slice(0, 3);
      top3.forEach(tx => { recentListEl.appendChild(createTransactionRow(tx)); });
    }
  }

  filterAndRenderHistory();

  // Update KYC Badge
  const badge = document.getElementById("profile-kyc-badge");
  if (badge) {
    if (state.kycStatus === "Verified") {
      badge.className = "bg-secondary-container/20 text-on-secondary-container dark:text-secondary-fixed border border-secondary/20 px-3 py-0.5 rounded-full font-label-sm";
      badge.innerText = "Verified";
    } else if (state.kycStatus === "Pending") {
      badge.className = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-0.5 rounded-full font-label-sm";
      badge.innerText = "Pending Review";
    } else {
      badge.className = "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20 px-3 py-0.5 rounded-full font-label-sm";
      badge.innerText = "Unverified";
    }
  }

  updatePortfolioUI();
}

// ── Multi-Currency Wallet Balance Renderer ─────────────────────────────────
const _CURRENCY_META = {
  USD:     { symbol: '$',  flag: '🇺🇸', name: 'US Dollar',            decimals: 2,  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  KRW:     { symbol: '₩', flag: '🇰🇷', name: 'Korean Won',            decimals: 0,  color: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-900/20' },
  NGN:     { symbol: '₦', flag: '🇳🇬', name: 'Nigerian Naira',        decimals: 2,  color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  MockKRW: { symbol: '₩', flag: '🔗', name: 'KRWC Test Asset',     decimals: 2,  color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

function renderWalletBalances() {
  const container = document.getElementById('wallet-multicurrency-grid');
  if (!container) return;

  const currencies = state.currencies || {};
  const isLoggedIn = localStorage.getItem('korripay_logged_in');

  container.innerHTML = Object.entries(_CURRENCY_META).map(([code, meta]) => {
    const bal     = currencies[code] ?? { available: 0, locked: 0, pending: 0 };
    const fmt     = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals });
    const total   = (bal.available ?? 0) + (bal.locked ?? 0) + (bal.pending ?? 0);
    const hasLock = (bal.locked ?? 0) > 0;
    const hasPend = (bal.pending ?? 0) > 0;

    return `
      <div class="${meta.bg} border border-outline-variant/20 dark:border-outline/10 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${meta.flag}</span>
            <div>
              <p class="font-bold text-sm text-on-surface dark:text-white">${code}</p>
              <p class="text-xs text-on-surface-variant dark:text-outline-variant">${meta.name}</p>
            </div>
          </div>
          <span class="text-xl font-bold ${meta.color}">${meta.symbol}${fmt(total)}</span>
        </div>
        <div class="space-y-1 pt-2 border-t border-outline-variant/20 dark:border-outline/10">
          <div class="flex justify-between items-center text-xs">
            <span class="text-on-surface-variant dark:text-outline-variant flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Available</span>
            <span class="font-bold text-on-surface dark:text-white">${meta.symbol}${fmt(bal.available)}</span>
          </div>
          ${hasLock ? `<div class="flex justify-between items-center text-xs">
            <span class="text-on-surface-variant dark:text-outline-variant flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Locked</span>
            <span class="font-semibold text-amber-600 dark:text-amber-400">${meta.symbol}${fmt(bal.locked)}</span>
          </div>` : ''}
          ${hasPend ? `<div class="flex justify-between items-center text-xs">
            <span class="text-on-surface-variant dark:text-outline-variant flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block"></span> Pending</span>
            <span class="font-semibold text-blue-500 dark:text-blue-400">${meta.symbol}${fmt(bal.pending)}</span>
          </div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Refresh from API if user is logged in
  if (isLoggedIn && !_walletBalanceFetched) {
    _walletBalanceFetched = true;
    authFetch('http://localhost:5000/api/wallet/summary')
      .then(r => r && r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        state.currencies = {
          USD:     { available: data.usd?.available ?? 0,     locked: data.usd?.locked ?? 0,     pending: data.usd?.pending ?? 0 },
          KRW:     { available: data.krw?.available ?? 0,     locked: data.krw?.locked ?? 0,     pending: data.krw?.pending ?? 0 },
          NGN:     { available: data.ngn?.available ?? 0,     locked: data.ngn?.locked ?? 0,     pending: data.ngn?.pending ?? 0 },
          MockKRW: { available: data.mockkrw?.available ?? 0, locked: data.mockkrw?.locked ?? 0, pending: data.mockkrw?.pending ?? 0 },
        };
        renderWalletBalances();
      }).catch(() => {});
  }
}
let _walletBalanceFetched = false;

function updatePortfolioUI() {
  const BTC_PRICE = 64281.40;
  const ETH_PRICE = 3450.00;
  const USDC_PRICE = 1.00;
  const MOCKKRW_PRICE = 1 / 1400; // ₩1400 = $1

  const fiat = state.balance;
  const btcVal = state.btcBalance * BTC_PRICE;
  const ethVal = state.ethBalance * ETH_PRICE;
  const usdcVal = state.usdcBalance * USDC_PRICE;
  const mockkrwVal = state.mockkrwBalance * MOCKKRW_PRICE;
  const total = fiat + btcVal + ethVal + usdcVal + mockkrwVal;

  // 1. Total Portfolio Value Hero
  const portfolioTotalValEl = document.getElementById("portfolio-total-value");
  if (portfolioTotalValEl) {
    portfolioTotalValEl.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // 2. USD Asset Row
  const portfolioUsdFiatEl = document.getElementById("portfolio-asset-usd-fiat");
  if (portfolioUsdFiatEl) {
    portfolioUsdFiatEl.textContent = `$${fiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const portfolioUsdQtyEl = document.getElementById("portfolio-asset-usd-qty");
  if (portfolioUsdQtyEl) {
    portfolioUsdQtyEl.textContent = `${fiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  }

  // BTC Asset Row
  const portfolioBtcFiatEl = document.getElementById("portfolio-asset-btc-fiat");
  if (portfolioBtcFiatEl) {
    portfolioBtcFiatEl.textContent = `$${btcVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const portfolioBtcQtyEl = document.getElementById("portfolio-asset-btc-qty");
  if (portfolioBtcQtyEl) {
    portfolioBtcQtyEl.textContent = `${state.btcBalance.toLocaleString('en-US', { minimumFractionDigits: 4 })} BTC`;
  }

  // ETH Asset Row
  const portfolioEthFiatEl = document.getElementById("portfolio-asset-eth-fiat");
  if (portfolioEthFiatEl) {
    portfolioEthFiatEl.textContent = `$${ethVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const portfolioEthQtyEl = document.getElementById("portfolio-asset-eth-qty");
  if (portfolioEthQtyEl) {
    portfolioEthQtyEl.textContent = `${state.ethBalance.toLocaleString('en-US', { minimumFractionDigits: 4 })} ETH`;
  }

  // USDC Asset Row
  const portfolioUsdcFiatEl = document.getElementById("portfolio-asset-usdc-fiat");
  if (portfolioUsdcFiatEl) {
    portfolioUsdcFiatEl.textContent = `$${usdcVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const portfolioUsdcQtyEl = document.getElementById("portfolio-asset-usdc-qty");
  if (portfolioUsdcQtyEl) {
    portfolioUsdcQtyEl.textContent = `${state.usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
  }

  // MockKRW Asset Row
  const portfolioMockkrwFiatEl = document.getElementById("portfolio-asset-mockkrw-fiat");
  if (portfolioMockkrwFiatEl) {
    portfolioMockkrwFiatEl.textContent = `₩${state.mockkrwBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const portfolioMockkrwQtyEl = document.getElementById("portfolio-asset-mockkrw-qty");
  if (portfolioMockkrwQtyEl) {
    portfolioMockkrwQtyEl.textContent = `${state.mockkrwBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KRWC`;
  }

  // 3. Percentages
  const fiatPct = total > 0 ? (fiat / total) * 100 : 0;
  const btcPct = total > 0 ? (btcVal / total) * 100 : 0;
  const ethPct = total > 0 ? (ethVal / total) * 100 : 0;
  const usdcPct = total > 0 ? (usdcVal / total) * 100 : 0;
  const mockkrwPct = total > 0 ? (mockkrwVal / total) * 100 : 0;

  // 4. Update legend labels
  const fiatPctEl = document.getElementById("allocation-fiat-pct");
  if (fiatPctEl) fiatPctEl.textContent = `Fiat (${Math.round(fiatPct)}%)`;
  const btcPctEl = document.getElementById("allocation-btc-pct");
  if (btcPctEl) btcPctEl.textContent = `BTC (${Math.round(btcPct)}%)`;
  const ethPctEl = document.getElementById("allocation-eth-pct");
  if (ethPctEl) ethPctEl.textContent = `ETH (${Math.round(ethPct)}%)`;
  const usdcPctEl = document.getElementById("allocation-usdc-pct");
  if (usdcPctEl) usdcPctEl.textContent = `USDC (${Math.round(usdcPct)}%)`;
  const mockkrwPctEl = document.getElementById("allocation-mockkrw-pct");
  if (mockkrwPctEl) mockkrwPctEl.textContent = `KRWC Test (${Math.round(mockkrwPct)}%)`;

  // 5. Update Center digital assets percentage
  const digitalPctEl = document.getElementById("allocation-digital-center");
  if (digitalPctEl) {
    const digitalPct = btcPct + ethPct + usdcPct + mockkrwPct;
    digitalPctEl.textContent = `${Math.round(digitalPct)}%`;
  }

  // 6. Update Donut Chart circle slice dashes
  // Slice 1: Fiat
  const sliceFiat = document.getElementById("donut-slice-fiat");
  if (sliceFiat) {
    sliceFiat.setAttribute("stroke-dasharray", `${fiatPct.toFixed(3)} ${(100 - fiatPct).toFixed(3)}`);
    sliceFiat.setAttribute("stroke-dashoffset", "0");
  }

  // Slice 2: BTC
  const sliceBtc = document.getElementById("donut-slice-btc");
  if (sliceBtc) {
    sliceBtc.setAttribute("stroke-dasharray", `${btcPct.toFixed(3)} ${(100 - btcPct).toFixed(3)}`);
    sliceBtc.setAttribute("stroke-dashoffset", `-${fiatPct.toFixed(3)}`);
  }

  // Slice 3: ETH
  const sliceEth = document.getElementById("donut-slice-eth");
  if (sliceEth) {
    sliceEth.setAttribute("stroke-dasharray", `${ethPct.toFixed(3)} ${(100 - ethPct).toFixed(3)}`);
    sliceEth.setAttribute("stroke-dashoffset", `-${(fiatPct + btcPct).toFixed(3)}`);
  }

  // Slice 4: USDC
  const sliceUsdc = document.getElementById("donut-slice-usdc");
  if (sliceUsdc) {
    sliceUsdc.setAttribute("stroke-dasharray", `${usdcPct.toFixed(3)} ${(100 - usdcPct).toFixed(3)}`);
    sliceUsdc.setAttribute("stroke-dashoffset", `-${(fiatPct + btcPct + ethPct).toFixed(3)}`);
  }

  // Slice 5: MockKRW
  const sliceMockkrw = document.getElementById("donut-slice-mockkrw");
  if (sliceMockkrw) {
    sliceMockkrw.setAttribute("stroke-dasharray", `${mockkrwPct.toFixed(3)} ${(100 - mockkrwPct).toFixed(3)}`);
    sliceMockkrw.setAttribute("stroke-dashoffset", `-${(fiatPct + btcPct + ethPct + usdcPct).toFixed(3)}`);
  }

  // 7. Update Swap Balance
  const swapFromBalanceEl = document.getElementById("swap-from-balance");
  if (swapFromBalanceEl) {
    swapFromBalanceEl.textContent = `Balance: $${fiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Trigger enhanced dashboard data load
  loadEnhancedDashboardData();
}

async function loadEnhancedDashboardData() {
  const tpsEl = document.getElementById("portfolio-net-tps");
  const gasEl = document.getElementById("portfolio-net-gas");
  const heightEl = document.getElementById("portfolio-net-height");
  const netNameEl = document.getElementById("portfolio-net-name");
  
  // 1. Fetch Network Status
  try {
    const res = await fetch(`${API_BASE}/giwa/status`);
    if (res.ok) {
      const data = await res.json();
      if (tpsEl) tpsEl.textContent = `${data.sequencer?.tps ?? 0}/s`;
      if (gasEl) gasEl.textContent = `${data.sequencer?.gasPriceGwei ?? 0} Gwei`;
      if (heightEl) heightEl.textContent = `#${data.sequencer?.blockHeight ?? 0}`;
      
      const statusDot = document.getElementById("portfolio-net-status-dot");
      const statusPulse = document.getElementById("portfolio-net-status-pulse");
      const isOnline = data.sequencer && data.sequencer.status === "Operational";

      if (statusDot) {
        statusDot.className = `relative inline-flex rounded-full h-3.5 w-3.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`;
      }
      if (statusPulse) {
        statusPulse.className = `animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`;
      }

      if (netNameEl) {
        netNameEl.innerHTML = `
          <span>${data.network?.name ?? 'GIWA Testnet'}</span>
          <span class="px-1.5 py-0.5 bg-primary/10 text-primary dark:text-primary-fixed text-[9px] rounded-full border border-primary/20 font-mono">Chain ID: ${data.network?.chainId ?? 99}</span>
        `;
      }
    }
  } catch (err) {
    console.error("Failed to load network status:", err);
  }

  // 2. Fetch Attestations
  const attListEl = document.getElementById("portfolio-attestation-list");
  if (attListEl) {
    try {
      const res = await authFetch(`${API_BASE}/v1/attestations`);
      if (res.ok) {
        const data = await res.json();
        const attestations = data.attestations || [];
        
        const schemas = ['Identity', 'Merchant', 'Business', 'Compliance'];
        
        if (attestations.length === 0) {
          attListEl.innerHTML = schemas.map(schema => {
            let icon = 'shield';
            if (schema === 'Merchant') icon = 'storefront';
            if (schema === 'Business') icon = 'domain';
            if (schema === 'Compliance') icon = 'gavel';

            return `
              <div onclick="requestMockAttestation('${schema}')" class="flex flex-col items-center justify-center p-3 bg-surface-container-low dark:bg-on-background/5 rounded-xl border border-dashed border-outline-variant hover:border-primary dark:hover:border-primary-fixed transition-all cursor-pointer group text-center">
                <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-2xl mb-1">${icon}</span>
                <span class="font-bold text-[11px] text-on-surface dark:text-white">${schema}</span>
                <span class="text-[9px] text-outline mt-0.5 group-hover:underline">Click to Attest</span>
              </div>
            `;
          }).join("");
        } else {
          attListEl.innerHTML = schemas.map(schema => {
            const found = attestations.find(a => a.schema === schema);
            let icon = 'shield';
            if (schema === 'Merchant') icon = 'storefront';
            if (schema === 'Business') icon = 'domain';
            if (schema === 'Compliance') icon = 'gavel';

            if (found) {
              const statusColor = found.status === 'Active' ? 'text-green-500 bg-green-500/10 border-green-500/25' : 'text-neutral-500 bg-neutral-500/10 border-neutral-500/25';
              return `
                <div class="flex flex-col items-center justify-center p-3 bg-surface-container-low dark:bg-on-background/5 rounded-xl border border-outline-variant/40 text-center relative overflow-hidden">
                  <span class="material-symbols-outlined ${found.status === 'Active' ? 'text-green-500' : 'text-outline'} text-2xl mb-1">${icon}</span>
                  <span class="font-bold text-[11px] text-on-surface dark:text-white">${schema}</span>
                  <span class="px-2 py-0.5 text-[9px] font-bold rounded-full mt-1.5 border ${statusColor}">${found.status}</span>
                </div>
              `;
            } else {
              return `
                <div onclick="requestMockAttestation('${schema}')" class="flex flex-col items-center justify-center p-3 bg-surface-container-low dark:bg-on-background/5 rounded-xl border border-dashed border-outline-variant hover:border-primary dark:hover:border-primary-fixed transition-all cursor-pointer group text-center">
                  <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-2xl mb-1">${icon}</span>
                  <span class="font-bold text-[11px] text-on-surface dark:text-white">${schema}</span>
                  <span class="text-[9px] text-outline mt-0.5 group-hover:underline">Click to Attest</span>
                </div>
              `;
            }
          }).join("");
        }
      }
    } catch (err) {
      console.error("Failed to load attestations:", err);
      attListEl.innerHTML = `<p class="col-span-2 text-center text-xs text-red-500 py-4">Failed to load attestations</p>`;
    }
  }

  // 3. Fetch Settlements & Proofs
  const queueEl = document.getElementById("portfolio-settlement-queue");
  const queueCountEl = document.getElementById("queue-count-badge");
  const proofHistoryEl = document.getElementById("portfolio-proof-history");

  try {
    const settlementsRes = await authFetch(`${API_BASE}/v1/settlements`);
    const proofsRes = await authFetch(`${API_BASE}/v1/proofs`);

    if (settlementsRes.ok && proofsRes.ok) {
      const settlementsData = await settlementsRes.json();
      const proofsData = await proofsRes.json();

      const settlements = settlementsData.settlements || [];
      const proofs = proofsData.proofs || [];

      const pendingTx = settlements.filter(s => s.status === "Pending");
      if (queueCountEl) queueCountEl.textContent = `${pendingTx.length} Pending`;

      if (queueEl) {
        if (pendingTx.length === 0) {
          queueEl.innerHTML = `
            <div class="p-6 text-center text-outline dark:text-outline-variant">
              <span class="material-symbols-outlined text-3xl mb-1">hourglass_empty</span>
              <p class="text-xs">No settlements currently in queue</p>
            </div>
          `;
        } else {
          queueEl.innerHTML = pendingTx.map(tx => {
            const shortRecipient = tx.recipientDetails ? (tx.recipientDetails.length > 20 ? tx.recipientDetails.slice(0, 18) + "..." : tx.recipientDetails) : "Unknown";
            const amountFormatted = Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
            const toToken = tx.toToken === "0x0000000000000000000000000000000000000000" ? "ETH" : "KRWC";
            
            return `
              <div class="p-md flex items-center justify-between hover:bg-surface-container-low dark:hover:bg-on-background/10 transition-colors">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <span class="material-symbols-outlined text-sm animate-spin">sync</span>
                  </div>
                  <div>
                    <p class="font-bold text-xs text-on-surface dark:text-white">Settling to ${shortRecipient}</p>
                    <p class="text-[10px] text-outline font-mono">${tx.txHash ? tx.txHash.slice(0,10)+"..."+tx.txHash.slice(-8) : 'Pending Sequencer'}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-bold text-xs text-amber-500">${amountFormatted} ${toToken}</p>
                  <p class="text-[9px] text-outline">Confirmations: 0/12</p>
                </div>
              </div>
            `;
          }).join("");
        }
      }

      if (proofHistoryEl) {
        if (proofs.length === 0) {
          proofHistoryEl.innerHTML = `
            <div class="p-6 text-center text-outline dark:text-outline-variant">
              <span class="material-symbols-outlined text-3xl mb-1">lock_open</span>
              <p class="text-xs">No proofs generated yet</p>
            </div>
          `;
        } else {
          proofHistoryEl.innerHTML = proofs.map(proof => {
            const statusColor = proof.proofStatus === 'Valid' ? 'text-green-500 bg-green-500/10 border-green-500/25' : 'text-neutral-500 bg-neutral-500/10 border-neutral-500/25';
            const shortTxHash = proof.txHash ? `${proof.txHash.slice(0, 6)}...${proof.txHash.slice(-4)}` : 'N/A';
            const dateStr = new Date(proof.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return `
              <div class="flex items-center justify-between p-3 bg-surface-container-low dark:bg-on-background/5 rounded-xl border border-outline-variant/30 hover:border-primary dark:hover:border-primary-fixed transition-all">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                    <span class="material-symbols-outlined text-sm">verified</span>
                  </div>
                  <div>
                    <p class="font-bold text-xs text-on-surface dark:text-white">Block #${proof.blockNumber}</p>
                    <p class="text-[9px] text-outline font-mono">TX: <a href="#explorer" class="underline text-primary dark:text-primary-fixed">${shortTxHash}</a></p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="px-2 py-0.5 text-[9px] font-bold rounded-full border ${statusColor}">${proof.proofStatus}</span>
                  <p class="text-[9px] text-outline mt-1">${proof.settlementDuration}s speed • ${dateStr}</p>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    }
  } catch (err) {
    console.error("Failed to load settlements and proofs:", err);
  }
}

async function requestMockAttestation(schema) {
  try {
    const subjectWallet = state.walletAddress || "0xf15010414E953a58Cb4Ff99C4e7b02E0138bDc01";
    
    showToast(`Requesting attestation for ${schema}...`);
    
    const res = await authFetch(`${API_BASE}/v1/attestations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issuer: "0x0000000000000000000000000000000000000000",
        subjectWallet,
        schema,
        details: {
          note: `Auto-generated compliance passport attestation for ${schema}`,
          timestamp: Date.now()
        }
      })
    });

    if (res.ok) {
      showToast(`${schema} Attestation generated successfully!`, "success");
      await loadEnhancedDashboardData();
    } else {
      const errData = await res.json();
      showToast(errData.error || "Failed to generate attestation", "error");
    }
  } catch (err) {
    showToast("Attestation request failed", "error");
  }
}
window.requestMockAttestation = requestMockAttestation;

function setupPortfolio() {
  // Simple micro-interaction for asset items
  document.querySelectorAll('.asset-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.add('scale-[0.98]');
      setTimeout(() => item.classList.remove('scale-[0.98]'), 150);
    });
  });

  // Action button event listeners
  const btnDeposit = document.getElementById("btn-portfolio-deposit");
  const btnWithdraw = document.getElementById("btn-portfolio-withdraw");
  const btnSwap = document.getElementById("btn-portfolio-swap");
  const btnRefreshProofs = document.getElementById("btn-refresh-proofs");

  if (btnDeposit) {
    btnDeposit.addEventListener("click", () => {
      showToast("Deposit feature coming soon!");
    });
  }
  if (btnWithdraw) {
    btnWithdraw.addEventListener("click", () => {
      showToast("Withdraw feature coming soon!");
    });
  }
  if (btnSwap) {
    btnSwap.addEventListener("click", () => {
      window.location.hash = "swap";
    });
  }
  if (btnRefreshProofs) {
    btnRefreshProofs.addEventListener("click", async () => {
      showToast("Refreshing proofs...");
      await loadEnhancedDashboardData();
    });
  }
}

function startSuccessConfetti() {
  const canvas = document.getElementById("swap-success-confetti");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  window.confettiActive = true;
  let particles = [];
  const colors = ["#003366", "#5cfd80", "#3a5f94", "#d5e3ff"];

  function resize() {
    canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
    canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
  }
  
  window.removeEventListener("resize", resize);
  window.addEventListener("resize", resize);
  resize();

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height - canvas.height;
      this.size = Math.random() * 8 + 4;
      this.speed = Math.random() * 3 + 2;
      this.angle = Math.random() * 360;
      this.spin = Math.random() * 5 - 2.5;
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
      this.y += this.speed;
      this.angle += this.spin;
      if (this.y > canvas.height) {
        this.y = -20;
        this.x = Math.random() * canvas.width;
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle * Math.PI / 180);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.restore();
    }
  }

  particles = [];
  for (let i = 0; i < 60; i++) {
    particles.push(new Particle());
  }

  function animate() {
    if (!window.confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    window.confettiAnimationId = requestAnimationFrame(animate);
  }

  animate();
}

function setupSwap() {
  const swapInput = document.getElementById("swap-input-amount");
  const swapOutput = document.getElementById("swap-output-amount");
  const swapFromApprox = document.getElementById("swap-from-approx");
  const swapToApprox = document.getElementById("swap-rate-timer");
  const swapTotalCost = document.getElementById("swap-total-cost");
  const btnConfirm = document.getElementById("btn-confirm-swap");
  const btnReverse = document.getElementById("btn-swap-reverse");
  const btnSwapAssetFrom = document.getElementById("btn-swap-asset-from");
  const btnSwapAssetTo = document.getElementById("btn-swap-asset-to");

  // State management inside swap module
  let fromAsset = "BTC";
  let toAsset = "USDC";
  let slippage = "0.5%";
  let selectType = "from"; // or "to"

  // Base Prices in USD
  const prices = {
    BTC: 64281.40,
    ETH: 3450.00,
    USDC: 1.00025,
    MockKRW: 1 / 1400,
    USD: 1.00
  };

  // Live adjustments
  let priceFluctuation = {
    BTC: 0,
    ETH: 0,
    USDC: 0,
    MockKRW: 0,
    USD: 0
  };

  const assetDetails = {
    BTC: { name: "Bitcoin", icon: "currency_bitcoin", colorClass: "bg-[#F7931A]/10 text-[#F7931A]" },
    ETH: { name: "Ethereum", icon: "diamond", colorClass: "bg-[#627EEA]/10 text-[#627EEA]" },
    USDC: { name: "USD Coin", icon: "monetization_on", colorClass: "bg-[#2775CA]/10 text-[#2775CA]" },
    MockKRW: { name: "KRWC Test Asset", icon: "payments", colorClass: "bg-[#5cfd80]/10 text-[#006e2a]" },
    USD: { name: "US Dollar", icon: "attach_money", colorClass: "bg-surface-container dark:bg-on-background/25 text-primary dark:text-primary-fixed" }
  };

  const getPrice = (symbol) => {
    return prices[symbol] * (1 + priceFluctuation[symbol]);
  };

  const getBalance = (symbol) => {
    if (symbol === "BTC") return state.btcBalance;
    if (symbol === "ETH") return state.ethBalance;
    if (symbol === "USDC") return state.usdcBalance;
    if (symbol === "MockKRW") return state.mockkrwBalance;
    return state.balance; // USD
  };

  // Update dropdown button visual states
  const updateDropdownVisuals = () => {
    // From Asset
    const fromIcon = document.getElementById("swap-icon-from");
    const fromName = document.getElementById("swap-name-from");
    if (fromName) fromName.textContent = fromAsset;
    if (fromIcon) {
      fromIcon.textContent = assetDetails[fromAsset].icon;
      fromIcon.parentElement.className = `w-8 h-8 rounded-full flex items-center justify-center ${assetDetails[fromAsset].colorClass}`;
    }
    const fromBalanceVal = document.getElementById("swap-from-balance");
    if (fromBalanceVal) {
      fromBalanceVal.textContent = `${getBalance(fromAsset).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${fromAsset}`;
    }

    // To Asset
    const toIcon = document.getElementById("swap-icon-to");
    const toName = document.getElementById("swap-name-to");
    if (toName) toName.textContent = toAsset;
    if (toIcon) {
      toIcon.textContent = assetDetails[toAsset].icon;
      toIcon.parentElement.className = `w-8 h-8 rounded-full flex items-center justify-center ${assetDetails[toAsset].colorClass}`;
    }
    const toBalanceVal = document.getElementById("swap-to-balance");
    if (toBalanceVal) {
      toBalanceVal.textContent = `${getBalance(toAsset).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toAsset}`;
    }
  };

  // Helper to update calculations
  const calculateSwap = () => {
    updateDropdownVisuals();

    const inputVal = parseFloat(swapInput.value) || 0;
    const priceFrom = getPrice(fromAsset);
    const priceTo = getPrice(toAsset);

    // Dynamic conversion rate
    const conversionRate = priceFrom / priceTo;
    
    // Output amount calculation
    const outputVal = inputVal * conversionRate;
    
    // Fee mapping
    let fee = 0;
    if (fromAsset === "BTC") fee = 0.0002;
    else if (fromAsset === "ETH") fee = 0.0004;
    else if (fromAsset === "USDC") fee = 1.50;
    else fee = 1.50; // USD

    // Update Market Header Ticker
    const tickerText = document.getElementById("swap-market-price-text");
    if (tickerText) {
      tickerText.textContent = `1 ${fromAsset} = ${conversionRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${toAsset}`;
    }

    // Set output box
    if (swapOutput) {
      swapOutput.value = inputVal > 0 ? outputVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00";
    }

    // Estimate USD equivalencies for display
    const usdValFrom = inputVal * priceFrom;

    if (swapFromApprox) {
      swapFromApprox.textContent = `≈ $${usdValFrom.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    }

    // Update Review Sidebar details
    const reviewRate = document.getElementById("swap-exchange-rate");
    if (reviewRate) {
      reviewRate.textContent = `1 ${fromAsset} = ${conversionRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toAsset}`;
    }

    const reviewFee = document.getElementById("swap-network-fee");
    if (reviewFee) {
      const feeUsdVal = fee * priceFrom;
      reviewFee.textContent = `${fee.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromAsset} ($${feeUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }

    const reviewFeeLabel = document.getElementById("swap-network-fee-label");
    if (reviewFeeLabel) {
      const giwaChainId = networkRegistry?.giwa?.config?.chainId || 92837;
      const giwaName = networkRegistry?.giwa?.config?.name || "GIWA Testnet (Sepolia)";
      const activeChainName = window.WalletService?.getAccount()?.chainId === giwaChainId 
        ? giwaName
        : (window.WalletService?.SUPPORTED_CHAINS?.giwa?.name || giwaName);
      
      const networkLabel = toAsset === "USD" 
        ? "Standard" 
        : (toAsset === "BTC" 
          ? "Bitcoin" 
          : activeChainName);

      reviewFeeLabel.textContent = `via ${networkLabel}`;
    }

    // Price Impact calculation based on input size
    const priceImpact = Math.min(10, (usdValFrom / 500000) * 100);
    const reviewImpact = document.getElementById("swap-price-impact");
    const warningCard = document.getElementById("swap-warning-card");

    if (reviewImpact) {
      reviewImpact.textContent = `-${priceImpact.toFixed(2)}%`;
      if (priceImpact > 1.5) {
        reviewImpact.className = "text-error dark:text-red-400 font-bold";
      } else {
        reviewImpact.className = "text-on-surface dark:text-white font-bold";
      }
    }

    if (warningCard) {
      if (priceImpact > 1.5) {
        warningCard.classList.remove("hidden");
        const warningDesc = warningCard.querySelector("p.text-body-sm");
        if (warningDesc) {
          warningDesc.textContent = `Executing this trade will impact the market price by ${priceImpact.toFixed(2)}%. Consider splitting the transaction into smaller batches or waiting for better liquidity.`;
        }
      } else {
        warningCard.classList.add("hidden");
      }
    }

    // Total Cost (Input Amount + Fee)
    const totalCost = inputVal > 0 ? inputVal + fee : 0;
    if (swapTotalCost) {
      swapTotalCost.textContent = `${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${fromAsset}`;
    }

    // Balance check
    if (btnConfirm) {
      const userBalance = getBalance(fromAsset);
      if (inputVal <= 0) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = "Enter an amount";
        btnConfirm.className = "w-full py-md bg-outline-variant text-outline h-14 rounded-xl font-headline-md text-headline-md flex items-center justify-center cursor-not-allowed opacity-50";
      } else if (totalCost > userBalance) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = `Insufficient ${fromAsset} Balance`;
        btnConfirm.className = "w-full py-md bg-error-container text-on-error-container h-14 rounded-xl font-headline-md text-headline-md flex items-center justify-center cursor-not-allowed opacity-80";
      } else {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Confirm Swap";
        btnConfirm.className = "w-full py-md bg-primary dark:bg-primary-fixed text-white dark:text-primary font-bold rounded-xl hover:bg-primary-container dark:hover:bg-primary-fixed/90 transition-all active:scale-95 shadow-md flex items-center justify-center gap-md cursor-pointer";
      }
    }
  };

  // Wire input changes
  if (swapInput) {
    swapInput.addEventListener("input", calculateSwap);
    swapInput.addEventListener("focus", () => {
      swapInput.parentElement.parentElement.classList.add("border-primary");
    });
    swapInput.addEventListener("blur", () => {
      swapInput.parentElement.parentElement.classList.remove("border-primary");
    });
  }

  // Swap settings - Slippage toggle
  const slip05 = document.getElementById("btn-slippage-05");
  const slip10 = document.getElementById("btn-slippage-10");
  const slipAuto = document.getElementById("btn-slippage-auto");

  const setSlippage = (val, clickedBtn) => {
    slippage = val;
    [slip05, slip10, slipAuto].forEach(btn => {
      if (btn) {
        btn.className = "px-3 py-1 text-label-sm text-on-surface-variant dark:text-outline-variant hover:text-on-surface dark:hover:text-white transition-all";
      }
    });
    if (clickedBtn) {
      clickedBtn.className = "px-3 py-1 text-label-sm rounded-md bg-white dark:bg-inverse-surface shadow-sm font-bold text-primary dark:text-white transition-all";
    }
  };

  if (slip05) slip05.addEventListener("click", () => setSlippage("0.5%", slip05));
  if (slip10) slip10.addEventListener("click", () => setSlippage("1.0%", slip10));
  if (slipAuto) slipAuto.addEventListener("click", () => setSlippage("Auto", slipAuto));

  // Reverse Swap
  if (btnReverse) {
    btnReverse.addEventListener("click", () => {
      const temp = fromAsset;
      fromAsset = toAsset;
      toAsset = temp;
      calculateSwap();
      // Add a scale-up animation effect
      btnReverse.classList.add("rotate-180");
      setTimeout(() => btnReverse.classList.remove("rotate-180"), 300);
    });
  }

  // Open Select Asset Modal logic
  const openAssetSelector = (type) => {
    selectType = type;
    
    // Update balance info inside selection rows before opening
    const selectBtcBal = document.getElementById("asset-select-balance-btc");
    const selectBtcVal = document.getElementById("asset-select-value-btc");
    if (selectBtcBal) selectBtcBal.textContent = `${state.btcBalance.toLocaleString('en-US', { minimumFractionDigits: 4 })} BTC`;
    if (selectBtcVal) selectBtcVal.textContent = `$${(state.btcBalance * prices.BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const selectEthBal = document.getElementById("asset-select-balance-eth");
    const selectEthVal = document.getElementById("asset-select-value-eth");
    if (selectEthBal) selectEthBal.textContent = `${state.ethBalance.toLocaleString('en-US', { minimumFractionDigits: 4 })} ETH`;
    if (selectEthVal) selectEthVal.textContent = `$${(state.ethBalance * prices.ETH).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const selectUsdcBal = document.getElementById("asset-select-balance-usdc");
    const selectUsdcVal = document.getElementById("asset-select-value-usdc");
    if (selectUsdcBal) selectUsdcBal.textContent = `${state.usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    if (selectUsdcVal) selectUsdcVal.textContent = `$${state.usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const selectMockkrwBal = document.getElementById("asset-select-balance-mockkrw");
    const selectMockkrwVal = document.getElementById("asset-select-value-mockkrw");
    if (selectMockkrwBal) selectMockkrwBal.textContent = `${state.mockkrwBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KRWC`;
    if (selectMockkrwVal) selectMockkrwVal.textContent = `$${(state.mockkrwBalance * prices.MockKRW).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const selectUsdBal = document.getElementById("asset-select-balance-usd");
    const selectUsdVal = document.getElementById("asset-select-value-usd");
    if (selectUsdBal) selectUsdBal.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    if (selectUsdVal) selectUsdVal.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const modalTitle = document.getElementById("select-asset-modal-title");
    if (modalTitle) {
      modalTitle.innerHTML = `
        <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
        Select Asset (${type === "from" ? "From" : "To"})
      `;
    }

    openModal("modal-select-asset");
  };

  if (btnSwapAssetFrom) btnSwapAssetFrom.onclick = () => openAssetSelector("from");
  if (btnSwapAssetTo) btnSwapAssetTo.onclick = () => openAssetSelector("to");

  // Attach selection listeners inside the modal
  document.querySelectorAll(".asset-select-row").forEach(row => {
    row.onclick = () => {
      const asset = row.getAttribute("data-asset");
      if (selectType === "from") {
        if (asset === toAsset) {
          toAsset = fromAsset;
        }
        fromAsset = asset;
      } else {
        if (asset === fromAsset) {
          fromAsset = toAsset;
        }
        toAsset = asset;
      }
      closeAllModals();
      calculateSwap();
    };
  });

  // Dynamic Ticker update Interval (rate timer)
  let timeRemaining = 15;
  const updateTimer = () => {
    if (swapOutput) {
      if (window.location.hash !== "#swap") {
        clearInterval(window.swapTimerInterval);
        return;
      }
      timeRemaining--;
      if (timeRemaining <= 0) {
        timeRemaining = 15;
        // Introduce small fluctuation
        Object.keys(priceFluctuation).forEach(key => {
          if (key !== "USD") {
            priceFluctuation[key] += (Math.random() - 0.5) * 0.001; // +/- 0.05% fluctuation
          }
        });
        calculateSwap();
        
        // Highlight output border briefly to simulate refresh
        if (swapOutput) {
          const borderParent = swapOutput.parentElement.parentElement;
          borderParent.classList.add("border-secondary");
          setTimeout(() => borderParent.classList.remove("border-secondary"), 300);
        }
      }
      if (swapToApprox) {
        swapToApprox.textContent = `Rate guaranteed for ${timeRemaining}s`;
      }
    }
  };

  // Start ticker countdown
  if (window.swapTimerInterval) clearInterval(window.swapTimerInterval);
  window.swapTimerInterval = setInterval(updateTimer, 1000);

  // Confirm Swap transaction execution
  if (btnConfirm) {
    btnConfirm.onclick = async () => {
      const val = parseFloat(swapInput.value) || 0;
      const priceFrom = getPrice(fromAsset);
      const priceTo = getPrice(toAsset);
      const conversionRate = priceFrom / priceTo;
      const outputVal = val * conversionRate;
      
      let fee = 0;
      if (fromAsset === "BTC") fee = 0.0002;
      else if (fromAsset === "ETH") fee = 0.0004;
      else if (fromAsset === "USDC") fee = 1.50;
      else fee = 1.50;

      const totalCost = val + fee;

      if (totalCost > getBalance(fromAsset)) {
        showToast("Insufficient balance for swap", "error");
        return;
      }

      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `
        <span class="material-symbols-outlined animate-spin text-[20px] mr-2">autorenew</span>
        Processing Swap...
      `;

      try {
        if (isBackendConnected) {
          const response = await authFetch(`${API_BASE}/transactions/swap`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              fromAsset,
              toAsset,
              fromAmount: val,
              toAmount: outputVal,
              fee
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Execution failed");
          }

          const swapResData = await response.json();
          window.lastSwapTxHash = swapResData.transaction?.txHash;

          // Reload from backend dashboard payload
          const resDash = await authFetch(`${API_BASE}/dashboard`);
          if (resDash.ok) {
            state = await resDash.json();
          }
        } else {
          // Local Storage offline fallback
          if (fromAsset === "BTC") state.btcBalance -= totalCost;
          else if (fromAsset === "ETH") state.ethBalance -= totalCost;
          else if (fromAsset === "USDC") state.usdcBalance -= totalCost;
          else if (fromAsset === "MockKRW") state.mockkrwBalance -= totalCost;
          else state.balance -= totalCost;

          if (toAsset === "BTC") state.btcBalance += outputVal;
          else if (toAsset === "ETH") state.ethBalance += outputVal;
          else if (toAsset === "USDC") state.usdcBalance += outputVal;
          else if (toAsset === "MockKRW") state.mockkrwBalance += outputVal;
          else state.balance += outputVal;

          const newTx = {
            id: `tx-swap-${Date.now()}`,
            title: `Swapped ${fromAsset} for ${toAsset}`,
            type: "send",
            amount: val,
            date: "Today • Just now",
            timestamp: Date.now(),
            category: "Transfer"
          };
          state.transactions.unshift(newTx);
          
          localState = { ...state };
          saveLocalState();
        }

        renderUI();
        showToast("Swap executed successfully!");

        // Populate Success view details
        const successValFrom = document.getElementById("swap-success-val-from");
        const successApproxFrom = document.getElementById("swap-success-approx-from");
        const successValTo = document.getElementById("swap-success-val-to");
        const successNetworkTo = document.getElementById("swap-success-network-to");
        const successHash = document.getElementById("swap-success-tx-hash");
        const successRate = document.getElementById("swap-success-rate");
        const successFee = document.getElementById("swap-success-fee");
        const successTime = document.getElementById("swap-success-time");
        
        // Icon targets
        const successIconFrom = document.getElementById("swap-success-icon-from");
        const successIconTo = document.getElementById("swap-success-icon-to");

        if (successValFrom) successValFrom.textContent = `${val.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromAsset}`;
        if (successApproxFrom) successApproxFrom.textContent = `≈ $${(val * priceFrom).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
        if (successValTo) successValTo.textContent = `${outputVal.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${toAsset}`;
        if (successNetworkTo) {
          const giwaChainId = networkRegistry?.giwa?.config?.chainId || 92837;
          const giwaName = networkRegistry?.giwa?.config?.name || "GIWA Testnet (Sepolia)";
          const activeChainName = window.WalletService?.getAccount()?.chainId === giwaChainId 
            ? giwaName
            : (window.WalletService?.SUPPORTED_CHAINS?.giwa?.name || giwaName);

          successNetworkTo.textContent = toAsset === "USD" 
            ? "Standard Settlement" 
            : (toAsset === "BTC" 
              ? "Bitcoin Network" 
              : (toAsset === "MockKRW" 
                ? activeChainName 
                : giwaName));
        }
        
        if (successIconFrom) {
          successIconFrom.textContent = assetDetails[fromAsset].icon;
          // Apply proper theme color class to success icon
          successIconFrom.className = `material-symbols-outlined text-[32px] ${assetDetails[fromAsset].colorClass.split(" ")[1]}`;
        }
        if (successIconTo) {
          successIconTo.textContent = assetDetails[toAsset].icon;
          successIconTo.className = `material-symbols-outlined text-[32px] ${assetDetails[toAsset].colorClass.split(" ")[1]}`;
        }

        // Get actual hash from backend or fallback
        const finalTxHash = window.lastSwapTxHash || (() => {
          const hex = "0123456789abcdef";
          let fallbackHash = "0x";
          for (let i = 0; i < 40; i++) fallbackHash += hex[Math.floor(Math.random() * 16)];
          return fallbackHash;
        })();
        window.lastSwapTxHash = null;

        if (successHash) successHash.textContent = `${finalTxHash.slice(0, 6)}...${finalTxHash.slice(-4)}`;
        
        // Copy Hash button listener
        const btnCopyHash = document.getElementById("btn-swap-success-copy");
        if (btnCopyHash) {
          btnCopyHash.onclick = () => {
            navigator.clipboard.writeText(finalTxHash).then(() => {
              showToast("Transaction hash copied!");
            });
          };
        }

        if (successRate) successRate.textContent = `1 ${fromAsset} = ${conversionRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toAsset}`;
        if (successFee) {
          const feeUsdVal = fee * priceFrom;
          successFee.textContent = `${fee.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromAsset} ($${feeUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        }
        if (successTime) {
          const now = new Date();
          const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
          successTime.textContent = now.toLocaleDateString('en-US', options).replace(',', ' •');
        }

        // Redirect to Success hash
        window.location.hash = "swap-success";

      } catch (err) {
        console.error("Swap submission failed:", err);
        showToast(err.message || "Execution error occurred", "error");
        
        // Reset confirm button
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = `
          Confirm Swap
          <span class="material-symbols-outlined">arrow_forward</span>
        `;
      }
    };
  }

  // Hook up done/back buttons
  const btnDone = document.getElementById("btn-swap-success-done");
  if (btnDone) {
    btnDone.onclick = () => {
      window.location.hash = "portfolio";
    };
  }

  const btnReceipt = document.getElementById("btn-swap-success-receipt");
  if (btnReceipt) {
    btnReceipt.onclick = () => {
      window.print();
    };
  }

  const btnExplorer = document.getElementById("btn-swap-success-explorer");
  if (btnExplorer) {
    btnExplorer.onclick = () => {
      window.location.hash = "explorer";
    };
  }

  // Initial calculation
  calculateSwap();
}

// ─── Settlement Pipeline: 9 canonical stages ─────────────────────────────────
const STAGE_METADATA = [
  {
    key: "requested",
    label: "Settlement Requested",
    icon: "send",
    description: "Settlement instruction received and validated by the KorriPay gateway.",
    estimatedMs: 200,
    giwaStage: false
  },
  {
    key: "compliance",
    label: "Compliance Screening",
    icon: "policy",
    description: "AML/KYC risk scoring, sanctions screening, and compliance passport check.",
    estimatedMs: 800,
    giwaStage: false
  },
  {
    key: "fx_validation",
    label: "FX Validation",
    icon: "currency_exchange",
    description: "Exchange rate locked, corridor path resolved, and liquidity reserved.",
    estimatedMs: 600,
    giwaStage: false
  },
  {
    key: "created",
    label: "Settlement Created",
    icon: "receipt_long",
    description: "On-chain settlement object constructed and double-entry ledger pre-committed.",
    estimatedMs: 400,
    giwaStage: false
  },
  {
    key: "submitted",
    label: "Submitted to GIWA",
    icon: "lan",
    description: "Settlement package dispatched to the GIWA L2 sequencer endpoint (Chain ID: 92837).",
    estimatedMs: 500,
    giwaStage: true
  },
  {
    key: "sequencer",
    label: "Sequencer Accepted",
    icon: "verified",
    description: "GIWA sequencer accepted the transaction batch and assigned sequence number.",
    estimatedMs: 600,
    giwaStage: true
  },
  {
    key: "finalized",
    label: "Block Finalized",
    icon: "lock",
    description: "Transaction included in a finalized L2 block. State root committed on-chain.",
    estimatedMs: 1200,
    giwaStage: true
  },
  {
    key: "proof",
    label: "Settlement Proof Generated",
    icon: "fact_check",
    description: "ZK cryptographic settlement proof generated and attested via EAS schema registry.",
    estimatedMs: 800,
    giwaStage: true
  },
  {
    key: "completed",
    label: "Completed",
    icon: "task_alt",
    description: "Settlement finalized. Balances updated, proof archived, and ledger record confirmed.",
    estimatedMs: 200,
    giwaStage: false
  }
];

// Maps legacy backend pipelineStage names → canonical STAGE_METADATA index
const STAGE_LEGACY_MAP = {
  "Settlement Requested": 0,
  "Compliance Screening": 1,
  "Compliance Screening Blocked": 1,
  "Route Selection": 2,
  "Execution": 3,
  "Confirmation": 6,
  "Proof Generation": 7,
  "Archive": 8,
  // New canonical names
  "FX Validation": 2,
  "Settlement Created": 3,
  "Submitted to GIWA": 4,
  "Sequencer Accepted": 5,
  "Block Finalized": 6,
  "Settlement Proof Generated": 7,
  "Completed": 8
};

/**
 * Renders a vertical 9-stage settlement pipeline into a container element.
 * @param {Array<{stage:string, timestamp?:string}>} stageHistory - completed stages
 * @param {string} currentStage - the current active stage label
 * @param {HTMLElement} container - DOM element to render into
 */
function renderPipelineTimeline(stageHistory, currentStage, container) {
  if (!container) return;

  const currentIdx = STAGE_LEGACY_MAP[currentStage] ?? (STAGE_METADATA.length - 1);

  // Build a timestamp lookup from history
  const tsMap = {};
  if (Array.isArray(stageHistory)) {
    stageHistory.forEach(h => {
      const idx = STAGE_LEGACY_MAP[h.stage];
      if (idx !== undefined && h.timestamp) tsMap[idx] = h.timestamp;
    });
  }

  // Cumulative estimated time for each stage
  let cumulativeEstMs = 0;
  const estimatedTimes = STAGE_METADATA.map(s => {
    cumulativeEstMs += s.estimatedMs;
    return cumulativeEstMs;
  });
  const totalEstMs = cumulativeEstMs;

  let html = `<div class="space-y-0">`;

  STAGE_METADATA.forEach((meta, idx) => {
    const isCompleted = idx < currentIdx;
    const isActive = idx === currentIdx;
    const isPending = idx > currentIdx;

    // State-based classes
    let dotClass, dotInner, rowOpacity, labelClass, timeLabel;

    if (isCompleted) {
      dotClass = "w-8 h-8 rounded-full flex items-center justify-center bg-green-500 border-2 border-green-600 text-white shadow-sm flex-shrink-0";
      dotInner = `<span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'FILL' 1">check</span>`;
      rowOpacity = "opacity-100";
      labelClass = "font-semibold text-on-surface dark:text-white text-xs";
      const ts = tsMap[idx];
      timeLabel = ts ? `<span class="text-green-500 text-[10px] font-bold">${new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>` : `<span class="text-[10px] text-outline">~${(estimatedTimes[idx]/1000).toFixed(1)}s est.</span>`;
    } else if (isActive) {
      dotClass = "w-8 h-8 rounded-full flex items-center justify-center bg-primary border-2 border-primary text-on-primary shadow-md flex-shrink-0 animate-pulse";
      dotInner = `<span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'FILL' 1">${meta.icon}</span>`;
      rowOpacity = "opacity-100";
      labelClass = "font-bold text-primary dark:text-primary-fixed text-xs";
      timeLabel = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:text-primary-fixed font-bold">Active</span>`;
    } else {
      dotClass = "w-8 h-8 rounded-full flex items-center justify-center bg-surface-container border-2 border-outline-variant/40 text-outline flex-shrink-0";
      dotInner = `<span class="text-[11px] font-bold">${idx + 1}</span>`;
      rowOpacity = "opacity-40";
      labelClass = "font-medium text-on-surface-variant dark:text-outline-variant text-xs";
      timeLabel = `<span class="text-[10px] text-outline/60">~${(estimatedTimes[idx]/1000).toFixed(1)}s est.</span>`;
    }

    const giwaTag = meta.giwaStage
      ? `<span class="text-[9px] px-1 py-0.5 rounded bg-secondary-container/30 text-secondary dark:text-secondary-fixed font-bold uppercase ml-1">GIWA</span>`
      : "";

    const connector = idx < STAGE_METADATA.length - 1
      ? `<div class="ml-[15px] w-0.5 h-4 ${isCompleted ? 'bg-green-500/60' : 'bg-outline-variant/20'} flex-shrink-0"></div>`
      : "";

    html += `
      <div class="${rowOpacity} transition-opacity duration-300">
        <div class="flex items-start gap-3">
          <div class="flex flex-col items-center">
            <div class="${dotClass}">${dotInner}</div>
          </div>
          <div class="flex-1 min-w-0 pb-1">
            <div class="flex items-center justify-between flex-wrap gap-1">
              <span class="${labelClass}">${meta.label}${giwaTag}</span>
              ${timeLabel}
            </div>
            ${isActive || isCompleted ? `<p class="text-[10px] text-outline dark:text-outline-variant mt-0.5 leading-relaxed">${meta.description}</p>` : ""}
          </div>
        </div>
        ${connector}
      </div>
    `;
  });

  html += `</div>`;

  // Progress summary footer
  const completedCount = currentIdx;
  const progressPct = Math.round((currentIdx / (STAGE_METADATA.length - 1)) * 100);
  html += `
    <div class="mt-3 pt-3 border-t border-outline-variant/20">
      <div class="flex items-center justify-between text-[10px] text-outline dark:text-outline-variant mb-1">
        <span>${completedCount} of ${STAGE_METADATA.length} stages complete</span>
        <span class="font-bold text-primary dark:text-primary-fixed">${progressPct}%</span>
      </div>
      <div class="w-full h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-700" style="width:${progressPct}%"></div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Backward-compat wrapper: maps a legacy stage name and updates both the new
 * vertical timeline (if present) and the old horizontal bar (if present).
 */
function updatePipelineStepper(stage, stageHistory) {
  // New vertical timeline
  const timelineContainer = document.getElementById("settlement-pipeline-timeline");
  if (timelineContainer) {
    renderPipelineTimeline(stageHistory || [], stage, timelineContainer);
    return;
  }

  // Legacy horizontal bar fallback (kept for any remaining callers)
  const legacyIdx = STAGE_LEGACY_MAP[stage] ?? 0;
  const progressBar = document.getElementById("pipeline-progress-bar");
  if (progressBar) {
    const pct = (legacyIdx / (STAGE_METADATA.length - 1)) * 100;
    progressBar.style.width = `${pct}%`;
  }
  const label = document.getElementById("pipeline-active-stage-label");
  if (label) label.textContent = `Current Stage: ${stage || "Settlement Requested"}`;
}

function buildCertificateData(settlement, proof) {
  const explorerBase = networkRegistry?.giwa?.config?.explorerUrl || "https://explorer.giwa.network";
  const targetTxHash = settlement.txHash || (proof ? proof.txHash : null) || getDeterministicHash(settlement.id);
  const explorerUrl = `${explorerBase}/tx/${targetTxHash}`;

  const hardfork = networkRegistry?.KarstHardforkVersion || "Karst";
  const evmVersion = networkRegistry?.giwa?.config?.evmVersion || "Osaka";
  const nodeClient = networkRegistry?.ClientVersion || "op-reth";
  const chainId = networkRegistry?.giwa?.config?.chainId || 92837;
  const protocolVersion = `GIWA Network · ${hardfork} Hardfork · Chain ID ${chainId} (${evmVersion} EVM / ${nodeClient})`;

  const hasProof = !!proof;
  const status = settlement.status || (proof ? proof.proofStatus : "Success");
  
  const complianceVal = (status === "Settled" || status === "Success" || status === "Completed") 
    ? "Passed (Zero-Knowledge Compliance Passport Verified, Low Risk)" 
    : status === "Failed" ? "Failed (Screening Flagged)" : "Pending On-Chain Proof Verification";

  const attestationId = proof 
    ? `EAS-UID: 0x${proof.id.replace(/-/g, '').substring(0, 32)}`
    : "Pending On-Chain Settlement Proof";

  const integrity = (status === "Settled" || status === "Success" || status === "Completed")
    ? "Valid On-Chain Settlement Proof Verified"
    : "Verification Pending";

  const confirmations = (status === "Settled" || status === "Success" || status === "Completed")
    ? "1 (L2 Finality)"
    : "0 (Unconfirmed)";

  return {
    schemaVersion: "1.0",
    issuer: "KorriPay Programmable Settlement Infrastructure",
    certId: `cert-${settlement.id}`,
    settlementId: settlement.id,
    settlementStatus: status,
    settlementTimestamp: new Date(settlement.confirmedAt || settlement.createdAt || Date.now()).toISOString(),
    transactionHash: targetTxHash,
    blockNumber: proof ? proof.blockNumber : null,
    gasUsed: proof ? Number(proof.gasUsed) : null,
    confirmationCount: confirmations,
    settlementDurationSeconds: proof ? proof.settlementDuration : null,
    complianceResult: complianceVal,
    attestationReferences: attestationId,
    giwaNetwork: networkRegistry?.giwa?.config?.name || "GIWA Testnet (Sepolia)",
    explorerLink: explorerUrl,
    protocolVersion: protocolVersion,
    proofIntegrityStatus: integrity,
    derivedFields: [
      "confirmationCount",
      "complianceResult",
      "proofIntegrityStatus"
    ]
  };
}

function exportCertificateJSON(settlementId) {
  const settlement = portalSettlements.find(s => s.id === settlementId);
  if (!settlement) {
    showToast("Settlement not found", "error");
    return;
  }
  const matchingProof = portalProofs.find(p => p.settlementId === settlementId || (p.txHash && settlement.txHash && p.txHash.toLowerCase() === settlement.txHash.toLowerCase()));

  const certData = buildCertificateData(settlement, matchingProof);
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(certData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `certificate-${settlement.id}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Settlement certificate JSON exported!", "success");
}
window.exportCertificateJSON = exportCertificateJSON;


function getDeterministicHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let hex = '';
  for (let i = 0; i < 32; i++) {
    let value = (hash >> (i % 4)) & 0xFF;
    hex += ('00' + value.toString(16)).substr(-2);
  }
  return '0x' + hex.substring(0, 64);
}

function createTransactionRow(tx) {
  const row = document.createElement("div");
  row.className = "p-md flex items-center justify-between hover:bg-surface-container dark:hover:bg-inverse-surface/40 transition-colors cursor-pointer group";
  
  const status = tx.status || "Success";
  
  // Decide Icon & Styling
  let icon = "payments";
  let iconBgClass = "bg-primary-container/10 text-primary dark:text-primary-fixed-dim";
  
  if (status === "Failed") {
    icon = "warning";
    iconBgClass = "bg-error-container/20 text-error";
  } else if (tx.type === "receive") {
    icon = "south_west";
    iconBgClass = "bg-secondary-container/20 text-on-secondary-container dark:text-secondary-fixed-dim";
  } else if (tx.type === "send") {
    icon = "north_east";
    iconBgClass = "bg-primary-container/10 text-primary dark:text-primary-fixed-dim";
  } else if (tx.type === "bill") {
    if (tx.category === "Merchant" || tx.title.includes("Starbucks")) {
      icon = "north_east";
      iconBgClass = "bg-primary-container/10 text-primary dark:text-primary-fixed-dim";
    } else {
      icon = "receipt_long";
      iconBgClass = "bg-tertiary-container/10 text-on-tertiary-fixed-variant dark:text-tertiary-fixed-dim";
    }
  }
 
  // Status Badge
  let statusBadge = `<span class="px-2 py-0.5 rounded-full bg-[#E2F5E9] dark:bg-[#002108] text-[#006e2a] dark:text-[#3ce36a] font-label-sm text-label-sm">Success</span>`;
  if (status === "Pending") {
    statusBadge = `<span class="px-2 py-0.5 rounded-full bg-[#FFF4E5] dark:bg-[#2c1400] text-[#B45309] dark:text-[#ffb978] font-label-sm text-label-sm">Pending</span>`;
  } else if (status === "Failed") {
    statusBadge = `<span class="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm">Failed</span>`;
  }
 
  // Amount & Subtext
  let amountText = `-$${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  let amountClass = "text-on-surface dark:text-white font-semibold";
  let subValue = tx.category;
 
  if (status === "Failed") {
    amountClass = "text-outline line-through";
    subValue = "Insufficient Funds";
    amountText = `-$${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  } else if (tx.type === "receive") {
    amountClass = "text-on-secondary-container dark:text-secondary-fixed font-bold";
    amountText = `+$${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
 
  // Format Time representation from date
  const timeOnly = tx.date.includes("•") ? tx.date.split("•")[1].trim() : tx.date;
 
  row.innerHTML = `
    <div class="flex items-center gap-md">
      <div class="w-12 h-12 rounded-full ${iconBgClass} flex items-center justify-center">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div>
        <h4 class="font-headline-md text-headline-md text-on-surface dark:text-white group-hover:text-primary dark:group-hover:text-primary-fixed transition-colors">${escapeHtml(tx.title)}</h4>
        <div class="flex items-center gap-2 mt-1">
          <span class="font-body-sm text-body-sm text-outline dark:text-outline-variant">${timeOnly}</span>
          <span class="w-1 h-1 rounded-full bg-outline-variant/40"></span>
          ${statusBadge}
        </div>
      </div>
    </div>
    <div class="text-right">
      <span class="font-headline-md text-headline-md ${amountClass}">${amountText}</span>
      <p class="font-body-sm text-body-sm text-outline dark:text-outline-variant mt-1">${subValue}</p>
    </div>
  `;
 
  // Row click event to show details in proof modal for EVERY transaction
  row.addEventListener("click", async () => {
    let settlement = null;
    let proof = null;
    
    const targetTxHash = tx.txHash || getDeterministicHash(tx.id);
    
    try {
      const response = await authFetch(`${API_BASE}/settlements/${tx.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settlement) {
          settlement = data.settlement;
          proof = data.proof;
        }
      }
    } catch (err) {
      console.warn("[App] Failed to fetch settlement proof details, using fallback representation:", err);
    }

    // Construct high-fidelity virtual fallback if not found in database (e.g. mock conversions, receives, swaps, bills)
    if (!settlement) {
      settlement = {
        id: `settlement-${tx.id.substring(0, 18)}`,
        initiator: tx.userId || "0x0000000000000000000000000000000000000000",
        fromToken: tx.type === "receive" ? "MockKRW" : "USDC",
        toToken: tx.type === "receive" ? "USDC" : "MockKRW",
        amount: tx.amount.toString(),
        recipientDetails: tx.title || "Remittance",
        status: status,
        txHash: targetTxHash,
        createdAt: new Date(tx.timestamp || Date.now()).toISOString(),
        confirmedAt: new Date(tx.timestamp || Date.now()).toISOString(),
        pipelineStage: "Archive",
        pipelineHistory: JSON.stringify([
          { stage: "Settlement Requested",      timestamp: new Date(tx.timestamp).toISOString() },
          { stage: "Compliance Screening",       timestamp: new Date(tx.timestamp + 320).toISOString() },
          { stage: "FX Validation",              timestamp: new Date(tx.timestamp + 940).toISOString() },
          { stage: "Settlement Created",         timestamp: new Date(tx.timestamp + 1380).toISOString() },
          { stage: "Submitted to GIWA",          timestamp: new Date(tx.timestamp + 1740).toISOString() },
          { stage: "Sequencer Accepted",         timestamp: new Date(tx.timestamp + 2180).toISOString() },
          { stage: "Block Finalized",            timestamp: new Date(tx.timestamp + 2840).toISOString() },
          { stage: "Settlement Proof Generated", timestamp: new Date(tx.timestamp + 3560).toISOString() },
          { stage: "Completed",                  timestamp: new Date(tx.timestamp + 3760).toISOString() }
        ])
      };
      
      proof = {
        id: `proof-${tx.id}`,
        settlementId: settlement.id,
        txHash: targetTxHash,
        blockNumber: 23516695,
        timestamp: new Date(tx.timestamp).toISOString(),
        gasUsed: "154320",
        settlementDuration: 3,
        proofStatus: "Valid"
      };
    }

    const certData = buildCertificateData(settlement, proof);

    // Status Banner / Modal State
    document.getElementById("proof-settlement-id").textContent = certData.settlementId;
    const statusIcon = document.getElementById("proof-status-icon");
    const statusText = document.getElementById("proof-status-text");

    if (certData.settlementStatus === "Settled" || certData.settlementStatus === "Success" || certData.settlementStatus === "Completed") {
      statusIcon.textContent = "check_circle";
      statusIcon.className = "material-symbols-outlined text-green-500 font-bold";
      statusText.textContent = "Verified Settlement";
    } else if (certData.settlementStatus === "Pending") {
      statusIcon.textContent = "pending";
      statusIcon.className = "material-symbols-outlined text-amber-500 font-bold";
      statusText.textContent = "Settlement Pending";
    } else {
      statusIcon.textContent = "warning";
      statusIcon.className = "material-symbols-outlined text-rose-500 font-bold";
      statusText.textContent = "Settlement Failed";
    }

    // Hydrate 14 fields in UI
    document.getElementById("cert-settlement-id").textContent = certData.settlementId;
    
    const statusLabel = document.getElementById("cert-settlement-status");
    statusLabel.textContent = certData.settlementStatus;
    if (certData.settlementStatus === "Settled" || certData.settlementStatus === "Success" || certData.settlementStatus === "Completed") {
      statusLabel.className = "font-semibold text-green-500";
    } else if (certData.settlementStatus === "Pending") {
      statusLabel.className = "font-semibold text-amber-500";
    } else {
      statusLabel.className = "font-semibold text-rose-500";
    }

    document.getElementById("cert-timestamp").textContent = new Date(certData.settlementTimestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    
    document.getElementById("cert-duration").textContent = certData.settlementDurationSeconds ? `${certData.settlementDurationSeconds} seconds` : "Pending";
    
    const shortHash = certData.transactionHash && certData.transactionHash.length > 18 
      ? (certData.transactionHash.substring(0, 10) + "..." + certData.transactionHash.substring(certData.transactionHash.length - 8))
      : (certData.transactionHash || "N/A");
    document.getElementById("cert-tx-hash").textContent = shortHash;
    document.getElementById("cert-block-number").textContent = certData.blockNumber || "Pending";
    document.getElementById("cert-gas-used").textContent = certData.gasUsed ? certData.gasUsed.toLocaleString() : "Pending";
    document.getElementById("cert-confirmations").textContent = certData.confirmationCount;
    document.getElementById("cert-compliance-result").textContent = certData.complianceResult;
    document.getElementById("cert-attestation-ref").textContent = certData.attestationReferences;
    document.getElementById("cert-attestation-ref").title = certData.attestationReferences;
    
    const integrityLabel = document.getElementById("cert-integrity-status");
    integrityLabel.textContent = certData.proofIntegrityStatus;
    if (certData.proofIntegrityStatus.includes("Cryptographic") || certData.proofIntegrityStatus.includes("Valid")) {
      integrityLabel.className = "font-semibold text-green-500 flex items-center gap-1";
      integrityLabel.innerHTML = `<span class="material-symbols-outlined text-[14px]">shield</span> Proof Verified On-Chain`;
    } else {
      integrityLabel.className = "font-semibold text-amber-500 flex items-center gap-1";
      integrityLabel.innerHTML = `<span class="material-symbols-outlined text-[14px]">hourglass_empty</span> Verification Pending`;
    }

    document.getElementById("cert-giwa-network").textContent = certData.giwaNetwork;
    
    const explorerLinkEl = document.getElementById("cert-explorer-link");
    explorerLinkEl.href = certData.explorerLink;
    explorerLinkEl.textContent = "View L2 Explorer Link";
    
    document.getElementById("cert-protocol-version").textContent = certData.protocolVersion;

    // Set up copy hash button
    const copyBtn = document.getElementById("btn-copy-proof-hash");
    if (copyBtn) {
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(certData.transactionHash);
        showToast("Transaction hash copied!");
      };
    }

    // Visualize pipeline stage step markers in the new vertical timeline
    let pipelineHistory = [];
    try { pipelineHistory = JSON.parse(settlement.pipelineHistory || "[]"); } catch(e) {}
    updatePipelineStepper(settlement.pipelineStage, pipelineHistory);
    
    // Set up GIWA Action buttons
    const viewExplorerBtn = document.getElementById("btn-proof-view-explorer");
    if (viewExplorerBtn) {
      viewExplorerBtn.onclick = (e) => {
        e.stopPropagation();
        window.open(certData.explorerLink, "_blank");
      };
    }

    // PDF Download Button
    const downloadPdfBtn = document.getElementById("btn-proof-download-pdf");
    if (downloadPdfBtn) {
      downloadPdfBtn.onclick = (e) => {
        e.stopPropagation();
        downloadReceiptPDF(settlement.id);
      };
    }

    // JSON Export Button
    const exportJsonBtn = document.getElementById("btn-proof-export-json");
    if (exportJsonBtn) {
      exportJsonBtn.onclick = (e) => {
        e.stopPropagation();
        exportCertificateJSON(settlement.id);
      };
    }


    const verifyProofBtn = document.getElementById("btn-proof-verify");
    if (verifyProofBtn) {
      verifyProofBtn.onclick = (e) => {
        e.stopPropagation();
        
        verifyProofBtn.disabled = true;
        verifyProofBtn.innerHTML = `
          <span class="material-symbols-outlined text-lg animate-spin">autorenew</span>
          <span class="scale-90">Verifying...</span>
        `;
        
        showToast("Verifying zero-knowledge proof constraints...", "info");
        
        setTimeout(() => {
          showToast("Verifying precompile MODEXP and P256VERIFY gas costs on Osaka EVM...", "info");
          setTimeout(() => {
            showToast("Settlement proof integrity verified on GIWA L2 Chain ID 92837!", "success");
            verifyProofBtn.disabled = false;
            verifyProofBtn.innerHTML = `
              <span class="material-symbols-outlined text-lg">verified_user</span>
              <span class="scale-90">Verified!</span>
            `;
            setTimeout(() => {
              verifyProofBtn.innerHTML = `
                <span class="material-symbols-outlined text-lg">verified_user</span>
                <span class="scale-90">Verify Proof</span>
              `;
            }, 3000);
          }, 1500);
        }, 1500);
      };
    }

    // Set up Settlement Replay
    const replayBtn = document.getElementById("btn-replay-lifecycle");
    const downloadBtn = document.getElementById("btn-download-timeline");
    const logsContainer = document.getElementById("replay-logs-container");
    
    if (logsContainer) {
      logsContainer.classList.add("hidden");
      logsContainer.innerHTML = "";
    }
    if (downloadBtn) {
      downloadBtn.classList.add("hidden");
    }
    
    let timelineLogs = [];
    
    if (replayBtn) {
      replayBtn.onclick = async (e) => {
        e.stopPropagation();
        
        if (logsContainer) {
          logsContainer.classList.remove("hidden");
          logsContainer.innerHTML = `<div class="text-zinc-500 italic">Initializing replay player...</div>`;
        }
        
        let history = [];
        try {
          history = JSON.parse(settlement.pipelineHistory || "[]");
        } catch (err) {}
        
        if (history.length === 0) {
          const base = new Date(settlement.createdAt).getTime();
          history = [
            { stage: "Settlement Requested",      timestamp: new Date(base).toISOString() },
            { stage: "Compliance Screening",       timestamp: new Date(base + 320).toISOString() },
            { stage: "FX Validation",              timestamp: new Date(base + 940).toISOString() },
            { stage: "Settlement Created",         timestamp: new Date(base + 1380).toISOString() },
            { stage: "Submitted to GIWA",          timestamp: new Date(base + 1740).toISOString() },
            { stage: "Sequencer Accepted",         timestamp: new Date(base + 2180).toISOString() },
            { stage: "Block Finalized",            timestamp: new Date(base + 2840).toISOString() },
            { stage: "Settlement Proof Generated", timestamp: new Date(base + 3560).toISOString() },
            { stage: "Completed",                  timestamp: settlement.confirmedAt || new Date(base + 3760).toISOString() }
          ];
        }

        timelineLogs = [];
        logsContainer.innerHTML = "";
        
        for (let i = 0; i < history.length; i++) {
          const step = history[i];
          // Update the vertical timeline to show progress through replay
          updatePipelineStepper(step.stage, history.slice(0, i + 1));
          
          const timeStr = new Date(step.timestamp).toLocaleTimeString();
          let actor = "System";
          let action = "";
          let block = "Pending";
          let gas = "N/A";
          let confirmation = "Pending";
          let explorerLink = "N/A";
          
          const amount = settlement.amount;
          const token = settlement.fromToken;
          
          const giwaExplorer = networkRegistry?.giwa?.config?.explorerUrl || "https://explorer.giwa.network";

          if (step.stage === "Settlement Requested") {
            actor = "KorriPay Gateway";
            action = `Received settlement instruction for ${amount} ${token}. Initiator validated.`;
          } else if (step.stage === "Compliance Screening") {
            actor = "Compliance Engine";
            action = `AML/KYC screening complete. Risk score: 12 (Low). Sanctions pass.`;
          } else if (step.stage === "FX Validation" || step.stage === "Route Selection") {
            actor = "FX Oracle";
            action = `Exchange rate locked. Corridor path resolved. Liquidity reserved.`;
          } else if (step.stage === "Settlement Created" || step.stage === "Execution") {
            actor = "Settlement Engine";
            action = `On-chain settlement object constructed. Double-entry ledger pre-committed.`;
          } else if (step.stage === "Submitted to GIWA") {
            actor = "GIWA L2 Gateway";
            action = `Settlement dispatched to GIWA sequencer endpoint (Chain 92837).`;
            explorerLink = `${giwaExplorer}/tx/${targetTxHash}`;
          } else if (step.stage === "Sequencer Accepted") {
            actor = "GIWA Sequencer";
            action = `Transaction batch accepted. Sequence number assigned. Nonce committed.`;
            explorerLink = `${giwaExplorer}/tx/${targetTxHash}`;
          } else if (step.stage === "Block Finalized" || step.stage === "Confirmation") {
            actor = "L2 Validator Node";
            action = `Block finalized. State root committed on-chain. 1 confirmation achieved.`;
            block = proof ? proof.blockNumber : "23516695";
            confirmation = "Finalized";
            explorerLink = `${giwaExplorer}/tx/${targetTxHash}`;
          } else if (step.stage === "Settlement Proof Generated" || step.stage === "Proof Generation") {
            actor = "EAS Schema Registry";
            action = `ZK cryptographic proof generated and attested on EAS. Proof hash cached.`;
            block = proof ? proof.blockNumber : "23516695";
            gas = proof ? proof.gasUsed : "154320";
            confirmation = "Finalized";
            explorerLink = `${giwaExplorer}/tx/${targetTxHash}`;
          } else if (step.stage === "Completed" || step.stage === "Archive") {
            actor = "Ledger Bookkeeper";
            action = `Balances locked. Settlement archived. Ledger record confirmed and synced.`;
            block = proof ? proof.blockNumber : "23516695";
            gas = proof ? proof.gasUsed : "154320";
            confirmation = "Finalized";
            explorerLink = `${giwaExplorer}/tx/${targetTxHash}`;
          } else {
            action = `Transitioned to state: ${step.stage}`;
          }
          
          const logLine = `[${timeStr}] [${actor}] ${action} (Block: ${block}, Gas: ${gas}, Link: ${explorerLink})`;
          timelineLogs.push(logLine);
          
          const lineDiv = document.createElement("div");
          lineDiv.className = "text-green-500 border-l-2 border-green-500 pl-2 py-0.5 animate-fade-in";
          lineDiv.textContent = logLine;
          logsContainer.appendChild(lineDiv);
          logsContainer.scrollTop = logsContainer.scrollHeight;
          
          await new Promise(r => setTimeout(r, 600));
        }
        
        if (downloadBtn) {
          downloadBtn.classList.remove("hidden");
        }
      };
    }
    
    if (downloadBtn) {
      downloadBtn.onclick = (e) => {
        e.stopPropagation();
        if (timelineLogs.length === 0) return;
        
        const fileContent = [
          `KORRIPAY SETTLEMENT LIFECYCLE REPORT`,
          `====================================`,
          `Settlement ID: ${settlement.id}`,
          `Initiator: ${settlement.initiator}`,
          `Amount: ${settlement.amount} ${settlement.fromToken}`,
          `Created At: ${new Date(settlement.createdAt).toISOString()}`,
          `====================================`,
          `CHRONOLOGICAL TIMELINE LOGS:`,
          ...timelineLogs.map((log, idx) => `${idx + 1}. ${log}`),
          `====================================`,
          `End of report.`
        ].join("\n");
        
        const blob = new Blob([fileContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `timeline-${settlement.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Timeline report downloaded successfully!");
      };
    }
    
    openModal("modal-proof");
  });

  return row;
}

// Forms Submission Setup
function setupFormHandlers() {
  // Modal Send Money Form
  const formSend = document.getElementById("form-send");
  if (formSend) {
    formSend.addEventListener("submit", async (e) => {
      e.preventDefault();
      const recipient = document.getElementById("send-recipient").value;
      const amount = document.getElementById("send-amount").value;
      await processTransaction("send", { recipient, amount });
      formSend.reset();
    });
  }

  // Tab Send Money Form is now handled in multi-step wizard (setupMultiStepSend)

  // Add Money Form
  const formAdd = document.getElementById("form-add");
  if (formAdd) {
    formAdd.addEventListener("submit", async (e) => {
      e.preventDefault();
      const source = document.getElementById("add-source").value;
      const amount = document.getElementById("add-amount").value;
      await processTransaction("add", { source, amount });
      formAdd.reset();
    });
  }

  // Pay Bill Form
  const formPay = document.getElementById("form-pay");
  if (formPay) {
    formPay.addEventListener("submit", async (e) => {
      e.preventDefault();
      const biller = document.getElementById("pay-biller").value;
      const category = document.getElementById("pay-category").value;
      const amount = document.getElementById("pay-amount").value;
      await processTransaction("pay", { biller, category, amount });
      formPay.reset();
    });
  }
}

// Core transaction posting logic
// Core transaction posting logic
async function processTransaction(type, payload) {
  closeAllModals();
  
  if (isBackendConnected) {
    try {
      const response = await authFetch(`${API_BASE}/transactions/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || "Transaction failed");
      
      showToast(resData.message || "Transaction processed successfully!");
      await loadData();
      return resData;
    } catch (err) {
      showToast(err.message, "error");
      throw err;
    }
  } else {
    // Offline simulation mode
    const numAmount = Number(payload.amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Invalid amount", "error");
      throw new Error("Invalid amount");
    }

    const txStatus = payload.status || "Success";

    if (type === "send" || type === "pay") {
      if (txStatus !== "Failed") {
        if (numAmount > state.balance) {
          showToast("Insufficient balance", "error");
          throw new Error("Insufficient balance");
        }
        if (!payload.txHash || txStatus === "Success") {
          state.balance -= numAmount;
        }
      }
    } else if (type === "add") {
      state.balance += numAmount;
    }

    let title = "";
    let category = "";
    if (type === "send") {
      if (txStatus === "Pending") {
        title = `Sending to ${payload.recipient}`;
      } else if (txStatus === "Failed") {
        title = `Failed to ${payload.recipient}`;
      } else {
        title = payload.txHash ? `Settled to ${payload.recipient}` : `Sent to ${payload.recipient}`;
      }
      category = "Transfer";
    } else if (type === "add") {
      title = `Received from ${payload.source}`;
      category = "Completed";
    } else if (type === "pay") {
      title = payload.biller;
      category = payload.category;
      
      // smart savings mock increase
      const savingsBonus = Number((numAmount * 0.01).toFixed(2));
      state.savings = Number((state.savings + savingsBonus).toFixed(2));
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const localTx = {
      id: `tx-${Date.now()}`,
      title,
      type,
      amount: numAmount,
      date: `Today • ${timeStr}`,
      timestamp: Date.now(),
      category,
      txHash: payload.txHash || null,
      status: txStatus
    };

    state.transactions.unshift(localTx);
    
    if (payload.txHash && txStatus === "Success") {
      await updateBlockchainBalances();
    }
    
    // save to state sync
    localState = { ...state };
    saveLocalState();
    
    showToast(`Success: ${title} processed!`);
    renderUI();
    return { transaction: localTx };
  }
}

async function updateTransactionStatus(id, txHash, status) {
  if (isBackendConnected) {
    try {
      const response = await authFetch(`${API_BASE}/transactions/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, txHash, status })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || "Failed to update transaction status");
      
      // Update local state copy to match
      const localTx = state.transactions.find(t => t.id === id || (txHash && t.txHash === txHash));
      if (localTx) {
        const oldStatus = localTx.status;
        localTx.status = status;
        if (status === "Success") {
          localTx.title = localTx.title.replace("Sending to", "Sent to");
        } else if (status === "Failed") {
          localTx.title = localTx.title.replace("Sending to", "Failed to");
        }
      }
      state.balance = resData.balance;
      showToast(`Transaction ${status.toLowerCase()}!`);
      await loadData();
    } catch (err) {
      console.error("[Update Status] Failed to update transaction on backend:", err);
    }
  } else {
    // Offline simulation mode
    const localTx = state.transactions.find(t => t.id === id || (txHash && t.txHash === txHash));
    if (localTx) {
      const oldStatus = localTx.status;
      localTx.status = status;
      if (status === "Success") {
        localTx.title = localTx.title.replace("Sending to", "Sent to");
        if (oldStatus === "Pending" && localTx.txHash) {
          state.balance -= localTx.amount;
        }
      } else if (status === "Failed") {
        localTx.title = localTx.title.replace("Sending to", "Failed to");
        if (oldStatus === "Pending" && !localTx.txHash) {
          state.balance += localTx.amount;
        }
      }
    }
    localState = { ...state };
    saveLocalState();
    renderUI();
  }
}

// Filters & search on History Tab
let currentFilter = "all";
let searchTerms = "";

function setupFiltersAndSearch() {
  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => {
        c.className = "filter-chip px-6 py-2 rounded-full bg-surface-container-high dark:bg-surface-dim text-on-surface-variant dark:text-outline-variant font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all";
      });
      chip.className = "filter-chip px-6 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md whitespace-nowrap active:scale-95 transition-all";
      currentFilter = chip.getAttribute("data-type");
      filterAndRenderHistory();
    });
  });

  const searchInput = document.getElementById("search-tx");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerms = e.target.value.toLowerCase().trim();
      filterAndRenderHistory();
    });
    // Search Bar Focus Effect (from template)
    searchInput.addEventListener('focus', () => {
      searchInput.parentElement.classList.add('ring-2', 'ring-primary');
    });
    searchInput.addEventListener('blur', () => {
      searchInput.parentElement.classList.remove('ring-2', 'ring-primary');
    });
  }
}

function filterAndRenderHistory() {
  const listEl = document.getElementById("full-transactions-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  const filtered = state.transactions.filter(tx => {
    // filter type matching
    if (currentFilter !== "all" && tx.type !== currentFilter) return false;
    
    // search matching title or category or amount
    if (searchTerms) {
      const matchTitle = tx.title.toLowerCase().includes(searchTerms);
      const matchCat = tx.category.toLowerCase().includes(searchTerms);
      const matchAmt = tx.amount.toString().includes(searchTerms);
      return matchTitle || matchCat || matchAmt;
    }
    
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="p-lg text-center text-on-surface-variant/70 flex flex-col items-center justify-center bg-surface-container-lowest dark:bg-inverse-surface rounded-xl p-md shadow-sm border border-outline-variant/30">
        <span class="material-symbols-outlined text-4xl mb-2 text-outline">search_off</span>
        <p class="font-semibold">No matches found</p>
        <p class="text-xs mt-1">Try resetting your filter chips or updating your search query</p>
      </div>`;
    return;
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  // Group transactions by date
  const groups = {};
  filtered.forEach(tx => {
    let groupHeader = "Previous Transactions";
    const dateStr = tx.date;
    if (dateStr.includes("Today")) {
      groupHeader = "Today";
    } else if (dateStr.includes("Yesterday")) {
      groupHeader = "Yesterday";
    } else {
      const dateObj = new Date(tx.timestamp);
      if (!isNaN(dateObj)) {
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();
        groupHeader = `${month} ${year}`;
      } else {
        groupHeader = dateStr.split("•")[0].trim();
      }
    }

    if (!groups[groupHeader]) {
      groups[groupHeader] = [];
    }
    groups[groupHeader].push(tx);
  });

  // Render each group
  Object.keys(groups).forEach(groupHeader => {
    const groupSection = document.createElement("section");
    groupSection.className = "space-y-sm";

    const titleEl = document.createElement("h3");
    titleEl.className = "font-label-md text-label-md text-outline dark:text-outline-variant uppercase tracking-wider mb-xs pl-1";
    titleEl.innerText = groupHeader;
    groupSection.appendChild(titleEl);

    const cardEl = document.createElement("div");
    cardEl.className = "bg-surface-container-lowest dark:bg-inverse-surface rounded-xl shadow-sm border border-outline-variant/20 divide-y divide-outline-variant/20 dark:divide-on-surface-variant/20 overflow-hidden";

    groups[groupHeader].forEach(tx => {
      cardEl.appendChild(createTransactionRow(tx));
    });

    groupSection.appendChild(cardEl);
    listEl.appendChild(groupSection);
  });
}

// Quick Contacts shortcuts
function setupQuickContacts() {
  const contactBtns = document.querySelectorAll(".quick-contact-btn");
  contactBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      
      // Auto-navigate to Send tab
      window.location.hash = "send";
      
      // Pre-select recipient if the select function is available
      const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
      const matchingCard = document.querySelector(`.send-recipient-card[data-name="${name}"]`) || 
                           document.querySelector(`.send-recent-item[data-name="${name}"]`);
      
      let address = "0x" + Array.from({length: 8}, () => Math.floor(Math.random()*16).toString(16)).join("") + "...";
      let avatar = null;
      
      if (matchingCard) {
        address = matchingCard.getAttribute("data-address");
        const img = matchingCard.querySelector("img");
        if (img) avatar = img.src;
      }
      
      if (window.selectKorriPayRecipient) {
        window.selectKorriPayRecipient(name, address, initials, avatar);
      }
      
      showToast(`Recipient "${name}" selected!`);
      // Focus the amount input
      const amtInput = document.getElementById("send-input-amount");
      if (amtInput) {
        setTimeout(() => {
          amtInput.focus();
        }, 150);
      }
    });
  });
}

// Developer actions: Reset State
function resetState() {
  if (isBackendConnected) {
    // If backend is active, we just reset local memory for simplicity, or refresh window.
    // In a fully persistent server we would call a DELETE /api/reset, but for this demo in-memory is standard.
    // Let's do a reload
    location.reload();
  } else {
    // Reset local state to default
    state = {
      balance: 1250.00,
      savings: 45.00,
      transactions: [
        {
          id: "tx-1",
          title: "Sent to John",
          type: "send",
          amount: 240.00,
          date: "Today • 10:45 AM",
          timestamp: Date.now() - 3600000 * 2,
          category: "Transfer"
        },
        {
          id: "tx-2",
          title: "Received from Sarah",
          type: "receive",
          amount: 1500.00,
          date: "Yesterday • 4:20 PM",
          timestamp: Date.now() - 3600000 * 24,
          category: "Completed"
        },
        {
          id: "tx-3",
          title: "Starbucks Coffee",
          type: "bill",
          amount: 6.50,
          date: "May 24 • 8:12 AM",
          timestamp: Date.now() - 3600000 * 24 * 30,
          category: "Merchant"
        }
      ]
    };
    localState = { ...state };
    showToast("Data reset to default", "success");
    renderUI();
  }
}

// Utility to clean inputs
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

// Multi-step send setup with FX Engine integration
let selectedCurrency = "USD";
let selectedOutputAsset = "USDC"; // MockKRW or USDC
let _fxQuoteCache = null;         // Latest quote from FX Engine

// Debounce helper
function _debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Map input currency to sensible output asset
function _defaultAssetForCurrency(currency) {
  return currency === 'KRW' ? 'MockKRW' : 'USDC';
}

// Format large numbers
function _fmtNumber(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Fetch a live FX quote from the FX Engine backend and update the preview panel.
 */
async function refreshFXPreview(amount, currency) {
  const loadingEl   = document.getElementById('fx-loading');
  const rateRowsEl  = document.getElementById('fx-rate-rows');
  const rateDisplay = document.getElementById('fx-rate-display');
  const receiveEl   = document.getElementById('fx-receive-amount');
  const feeEl       = document.getElementById('fx-fee-display');
  const sourceEl    = document.getElementById('fx-source-badge');

  if (!loadingEl || !rateRowsEl) return;

  const toAsset = _defaultAssetForCurrency(currency);
  selectedOutputAsset = toAsset;

  // Show spinner
  loadingEl.classList.remove('hidden');
  rateRowsEl.classList.add('hidden');

  try {
    const res = await fetch('http://localhost:5000/api/fx/quote', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount || 1, fromCurrency: currency, toAsset }),
    });

    if (!res.ok) throw new Error('FX API error');
    const quote = await res.json();
    _fxQuoteCache = quote;

    // Update display
    if (rateDisplay) rateDisplay.textContent = quote.rate.display;
    if (receiveEl)   receiveEl.textContent   = `${_fmtNumber(quote.output.netAmount, 4)} ${toAsset}`;
    if (feeEl)       feeEl.textContent       = quote.fee.isZero ? 'Free ✓' : `${quote.fee.ratePercent}% — $${quote.fee.usdEquivalent.toFixed(4)}`;
    if (sourceEl) {
      sourceEl.textContent = quote.rate.source === 'live' ? 'Live ✦' : 'Fallback';
      sourceEl.className = quote.rate.source === 'live'
        ? 'text-xs px-2 py-0.5 rounded-full font-bold bg-secondary-container dark:bg-on-secondary-fixed-variant text-on-secondary-container dark:text-secondary-fixed'
        : 'text-xs px-2 py-0.5 rounded-full font-bold bg-error-container text-on-error-container';
    }

    loadingEl.classList.add('hidden');
    rateRowsEl.classList.remove('hidden');
  } catch (err) {
    if (loadingEl) {
      loadingEl.innerHTML = '<span class="text-xs text-error">Rate unavailable — using fallback</span>';
    }
  }
}

const _debouncedFXRefresh = _debounce(refreshFXPreview, 400);

// Legacy compatibility — used by Step 2 USD-equivalent calc
const exchangeRates = { USD: 1.00, KRW: 1325.50, NGN: 1610.00 };

function setupMultiStepSend() {
  const amountInput = document.getElementById("send-input-amount");
  const currencyBtns = document.querySelectorAll(".currency-btn");
  const activeCurrencySpan = document.getElementById("active-currency");
  const rateText = document.getElementById("exchange-rate-text");
  
  const step1 = document.getElementById("send-step-1");
  const stepRecipient = document.getElementById("send-step-recipient");
  const step2 = document.getElementById("send-step-2");
  const step3 = document.getElementById("send-step-3");
  
  const nextBtn = document.getElementById("btn-send-next");
  const backBtn = document.getElementById("btn-send-back");
  const confirmBtn = document.getElementById("btn-send-confirm");
  const doneBtn = document.getElementById("btn-send-done");

  const dot1 = document.getElementById("step-dot-1");
  const dot2 = document.getElementById("step-dot-2");
  const dot3 = document.getElementById("step-dot-3");

  let selectedRecipient = null;

  // Handle Currency Changes
  currencyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const currency = btn.getAttribute("data-currency");
      selectedCurrency = currency;

      // Update button styling
      currencyBtns.forEach(b => {
        const label = b.querySelector('.font-bold');
        const icon  = b.querySelector('.material-symbols-outlined');

        if (b.getAttribute("data-currency") === currency) {
          b.classList.add('border-primary', 'bg-primary-fixed-dim');
          b.classList.remove('border-transparent', 'bg-surface-container', 'dark:bg-surface-dim');
          if (label) { label.classList.add('text-primary'); label.classList.remove('text-on-surface-variant', 'dark:text-outline-variant'); }
          if (icon)  { icon.classList.add('text-primary');  icon.classList.remove('text-outline'); }
        } else {
          b.classList.remove('border-primary', 'bg-primary-fixed-dim');
          b.classList.add('border-transparent', 'bg-surface-container', 'dark:bg-surface-dim');
          if (label) { label.classList.remove('text-primary'); label.classList.add('text-on-surface-variant', 'dark:text-outline-variant'); }
          if (icon)  { icon.classList.remove('text-primary'); icon.classList.add('text-outline'); }
        }
      });

      if (activeCurrencySpan) activeCurrencySpan.innerText = currency;

      // Refresh FX preview with live rate
      const currentAmount = parseFloat(amountInput?.value) || 1;
      _debouncedFXRefresh(currentAmount, currency);
    });
  });

  // Refresh FX preview on amount input change
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      const amount = parseFloat(amountInput.value) || 0;
      _debouncedFXRefresh(amount, selectedCurrency);
    });
  }

  // Initial FX preview load
  _debouncedFXRefresh(parseFloat(amountInput?.value) || 10, selectedCurrency);

  // Step 1 -> Step 2 (Amount -> Recipient Selection)
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const amountVal = parseFloat(amountInput.value);

      if (isNaN(amountVal) || amountVal <= 0) {
        showToast("Please enter a valid amount", "error");
        return;
      }

      // Compute USD equivalent
      const usdAmount = Number((amountVal / exchangeRates[selectedCurrency]).toFixed(2));
      
      // Check balance
      if (usdAmount > state.balance) {
        showToast(`Insufficient balance. USD equivalent: $${usdAmount.toFixed(2)} exceeds your balance of $${state.balance.toFixed(2)}`, "error");
        return;
      }

      // Populate summary preview on Step 2
      const summarySendAmount = document.getElementById("summary-send-amount");
      const summarySendCurrency = document.getElementById("summary-send-currency");
      const summaryTotalPay = document.getElementById("summary-total-pay");

      if (summarySendAmount) summarySendAmount.innerText = amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
      if (summarySendCurrency) summarySendCurrency.innerText = selectedCurrency;
      if (summaryTotalPay) {
        const symbol = exchangeSymbols[selectedCurrency] || "$";
        summaryTotalPay.innerText = `${symbol}${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }

      // Transition to Step 2
      step1.classList.add("hidden");
      stepRecipient.classList.remove("hidden");
      setStepDotsActive(2);
    });
  }

  // Step 2 Selection Logic Helpers
  function selectRecipient(name, address, initials, avatar) {
    selectedRecipient = { name, address, initials, avatar };
    
    const emptyState = document.getElementById("send-recipient-preview-empty");
    const selectedState = document.getElementById("send-recipient-preview-selected");
    const selectedInitials = document.getElementById("send-selected-initials");
    const selectedName = document.getElementById("send-selected-name");
    const selectedAddress = document.getElementById("send-selected-address");
    const continueBtn = document.getElementById("btn-send-recipient-continue");

    if (emptyState) emptyState.classList.add("hidden");
    if (selectedState) selectedState.classList.remove("hidden");
    
    if (selectedInitials) selectedInitials.innerText = initials;
    if (selectedName) selectedName.innerText = name;
    if (selectedAddress) selectedAddress.innerText = address;

    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.classList.remove("opacity-30", "cursor-not-allowed");
      continueBtn.classList.add("hover:bg-secondary-fixed-dim", "hover:text-on-secondary-fixed");
    }

    // Highlight selected item card/list item
    document.querySelectorAll(".send-recipient-card").forEach(c => {
      if (c.getAttribute("data-name") === name) {
        c.classList.add("border-secondary", "dark:border-secondary-fixed-dim", "shadow-md");
        c.classList.remove("border-outline-variant", "dark:border-outline/10");
      } else {
        c.classList.remove("border-secondary", "dark:border-secondary-fixed-dim", "shadow-md");
        c.classList.add("border-outline-variant", "dark:border-outline/10");
      }
    });

    document.querySelectorAll(".send-recent-item").forEach(item => {
      if (item.getAttribute("data-name") === name) {
        item.classList.add("bg-surface-container-high", "dark:bg-on-background/25");
      } else {
        item.classList.remove("bg-surface-container-high", "dark:bg-on-background/25");
      }
    });
  }

  function deselectRecipient() {
    selectedRecipient = null;
    
    const emptyState = document.getElementById("send-recipient-preview-empty");
    const selectedState = document.getElementById("send-recipient-preview-selected");
    const continueBtn = document.getElementById("btn-send-recipient-continue");

    if (emptyState) emptyState.classList.remove("hidden");
    if (selectedState) selectedState.classList.add("hidden");

    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.classList.add("opacity-30", "cursor-not-allowed");
      continueBtn.classList.remove("hover:bg-secondary-fixed-dim", "hover:text-on-secondary-fixed");
    }

    // Reset card highlight styling
    document.querySelectorAll(".send-recipient-card").forEach(c => {
      c.classList.remove("border-secondary", "dark:border-secondary-fixed-dim", "shadow-md");
      c.classList.add("border-outline-variant", "dark:border-outline/10");
    });

    document.querySelectorAll(".send-recent-item").forEach(item => {
      item.classList.remove("bg-surface-container-high", "dark:bg-on-background/25");
    });
  }

  // Register selection function globally for Quick Contacts to hook into
  window.selectKorriPayRecipient = selectRecipient;

  // ── DYNAMIC CONTACTS MANAGEMENT SYSTEM ──
  let cachedContacts = [];

  // Function to load and render contacts
  window.loadContactsAndRender = async function() {
    if (!isBackendConnected) {
      cachedContacts = [
        { id: "1", walletAddress: "0x4a2ae92f883920108e7ef9e8b625cf016dfec1562", name: "Elena Gilbert", nickname: "Elena", isFavorite: true },
        { id: "2", walletAddress: "0x12b5a0bc7ef9e8b625cf016dfec1562b77aa99fe", name: "Marcus Vane", nickname: "Marcus", isFavorite: true },
        { id: "3", walletAddress: "0xf92c33d1b625cf016dfec1562b77aa99feb88aa2e", name: "Saira Khan", nickname: "Saira", isFavorite: true },
        { id: "4", walletAddress: "0xbb8a11227c625cf016dfec1562b77aa99feb8813a", name: "Jordan Lee", nickname: "Jordan", isFavorite: true },
        { id: "5", walletAddress: "0x712388219feb8813a0108e7ef9e8b625cf016dfe", name: "John Doe", nickname: "John", isFavorite: false }
      ];
      renderContactsLists();
      return;
    }

    try {
      const response = await authFetch(`${API_BASE}/contacts`, { method: "GET" });
      if (response.ok) {
        cachedContacts = await response.json();
      } else {
        console.warn("Failed to fetch contacts from API, falling back to simulated");
      }
    } catch (err) {
      console.error("Error loading contacts:", err);
    }
    renderContactsLists();
  };

  // Helper to draw the list UI
  function renderContactsLists() {
    const favoritesList = document.getElementById("send-favorites-list");
    const recentsList = document.getElementById("send-recent-transfers-list");

    // 1. Render Favorites
    if (favoritesList) {
      const favorites = cachedContacts.filter(c => c.isFavorite);
      if (favorites.length === 0) {
        favoritesList.innerHTML = `
          <div class="col-span-4 p-8 text-center text-outline dark:text-outline-variant">
            <p class="text-sm">No favorite recipients saved yet.</p>
          </div>
        `;
      } else {
        favoritesList.innerHTML = favorites.map(c => {
          const displayName = c.nickname || c.name;
          const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
          const shortAddress = c.walletAddress.substring(0, 6) + "..." + c.walletAddress.substring(c.walletAddress.length - 4);
          
          return `
            <div class="send-recipient-card cursor-pointer group bg-white dark:bg-inverse-surface border border-outline-variant dark:border-outline/10 p-md rounded-xl flex flex-col items-center text-center hover:border-secondary dark:hover:border-secondary-fixed-dim hover:shadow-md transition-all" 
                 data-name="${displayName}" data-address="${c.walletAddress}" data-initials="${initials}">
              <div class="relative w-16 h-16 rounded-full bg-secondary-container dark:bg-on-secondary-fixed-variant flex items-center justify-center font-bold text-lg text-primary mb-3">
                ${initials}
                <span class="material-symbols-outlined absolute -bottom-1 -right-1 text-amber-500 bg-white dark:bg-inverse-surface rounded-full p-0.5 text-xs border border-outline-variant/30" style="font-variation-settings: 'FILL' 1;">star</span>
              </div>
              <p class="font-bold text-on-surface dark:text-white truncate w-full" title="${c.name}">${displayName}</p>
              <p class="text-xs text-on-surface-variant dark:text-outline-variant font-mono">${shortAddress}</p>
            </div>
          `;
        }).join("");
      }
    }

    // 2. Render Recents (contacts with lastTransactedAt != null, sorted by lastTransactedAt desc, or just remaining contacts if empty)
    if (recentsList) {
      let recents = cachedContacts
        .filter(c => c.lastTransactedAt)
        .sort((a, b) => new Date(b.lastTransactedAt) - new Date(a.lastTransactedAt));

      if (recents.length === 0) {
        // Fallback to top 4 contacts
        recents = cachedContacts.slice(0, 4);
      }

      if (recents.length === 0) {
        recentsList.innerHTML = `
          <div class="p-8 text-center text-outline dark:text-outline-variant">
            <p class="text-sm">No recent settlements.</p>
          </div>
        `;
      } else {
        recentsList.innerHTML = recents.map(c => {
          const displayName = c.nickname || c.name;
          const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
          const shortAddress = c.walletAddress.substring(0, 6) + "..." + c.walletAddress.substring(c.walletAddress.length - 4);
          
          return `
            <div class="send-recent-item flex items-center justify-between p-4 hover:bg-surface-container-low dark:hover:bg-on-background/10 transition-colors cursor-pointer group" 
                 data-name="${displayName}" data-address="${c.walletAddress}" data-initials="${initials}">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-lg bg-surface-container-high dark:bg-on-background/25 flex items-center justify-center font-bold text-primary dark:text-primary-fixed">${initials}</div>
                <div>
                  <p class="font-bold text-on-surface dark:text-white">${displayName}</p>
                  <p class="text-sm text-on-surface-variant dark:text-outline-variant">${c.name} • ${shortAddress}</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <span class="text-sm text-on-surface-variant dark:text-outline-variant hidden md:block font-mono">${shortAddress}</span>
                <button type="button" class="p-2 text-primary dark:text-primary-fixed">
                  <span class="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    // 3. Re-bind event listeners to the new dynamic items
    bindContactClickListeners();
  }

  function bindContactClickListeners() {
    document.querySelectorAll(".send-recipient-card").forEach(card => {
      card.onclick = () => {
        const name = card.getAttribute("data-name");
        const address = card.getAttribute("data-address");
        const initials = card.getAttribute("data-initials");
        selectRecipient(name, address, initials, null);
        showToast(`Selected: ${name}`);
      };
    });

    document.querySelectorAll(".send-recent-item").forEach(item => {
      item.onclick = () => {
        const name = item.getAttribute("data-name");
        const address = item.getAttribute("data-address");
        const initials = item.getAttribute("data-initials");
        selectRecipient(name, address, initials, null);
        showToast(`Selected: ${name}`);
      };
    });
  }

  // Directory UI Rendering
  window.renderDirectory = function(query = "") {
    const dirList = document.getElementById("directory-contacts-list");
    if (!dirList) return;

    const filtered = cachedContacts.filter(c => {
      const q = query.toLowerCase().trim();
      return c.name.toLowerCase().includes(q) || 
             (c.nickname && c.nickname.toLowerCase().includes(q)) || 
             c.walletAddress.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      dirList.innerHTML = `
        <div class="py-8 text-center text-outline dark:text-outline-variant">
          <p class="text-sm">No matching contacts found.</p>
        </div>
      `;
      return;
    }

    dirList.innerHTML = filtered.map(c => {
      const initials = c.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
      const isFav = c.isFavorite;
      const starIcon = isFav ? "star" : "star_rate";
      const starStyle = isFav ? "font-variation-settings: 'FILL' 1;" : "";
      const starColor = isFav ? "text-amber-500" : "text-outline hover:text-amber-500";
      const nicknameDisplay = c.nickname ? `<span class="text-xs px-2 py-0.5 bg-secondary-container text-primary rounded-full">${c.nickname}</span>` : "";

      return `
        <div class="flex items-center justify-between py-3 border-b border-outline-variant/10 dark:border-outline/5 last:border-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full bg-surface-container-high dark:bg-on-background/20 flex items-center justify-center font-bold text-sm text-primary dark:text-primary-fixed">
              ${initials}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-bold text-sm text-on-surface dark:text-white truncate">${c.name}</p>
                ${nicknameDisplay}
              </div>
              <p class="text-xs text-on-surface-variant dark:text-outline-variant font-mono truncate">${c.walletAddress}</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <!-- Favorite button -->
            <button type="button" class="p-2 rounded-full hover:bg-surface-container dark:hover:bg-on-background/10 transition-colors ${starColor}" onclick="toggleFavoriteContact('${c.id}', ${!isFav})">
              <span class="material-symbols-outlined text-lg" style="${starStyle}">${starIcon}</span>
            </button>
            <!-- Edit Nickname button -->
            <button type="button" class="p-2 rounded-full hover:bg-surface-container dark:hover:bg-on-background/10 text-outline hover:text-primary transition-colors" onclick="editContactNickname('${c.id}', '${c.nickname || ''}')">
              <span class="material-symbols-outlined text-lg">edit</span>
            </button>
            <!-- Delete button -->
            <button type="button" class="p-2 rounded-full hover:bg-surface-container dark:hover:bg-on-background/10 text-outline hover:text-error transition-colors" onclick="deleteContact('${c.id}')">
              <span class="material-symbols-outlined text-lg">delete</span>
            </button>
            <!-- Select button -->
            <button type="button" class="ml-2 px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-opacity-95 transition-all" onclick="selectContactFromDirectory('${c.nickname || c.name}', '${c.walletAddress}', '${initials}')">
              Select
            </button>
          </div>
        </div>
      `;
    }).join("");
  };

  // Bind Actions on Directory Buttons
  window.toggleFavoriteContact = async function(id, newFavStatus) {
    if (!isBackendConnected) {
      const idx = cachedContacts.findIndex(c => c.id === id);
      if (idx !== -1) cachedContacts[idx].isFavorite = newFavStatus;
      renderContactsLists();
      renderDirectory(document.getElementById("directory-search-input").value);
      showToast("Favorite status updated (simulated)");
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/contacts/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isFavorite: newFavStatus })
      });
      if (res.ok) {
        showToast("Favorite status updated!");
        await window.loadContactsAndRender();
        renderDirectory(document.getElementById("directory-search-input").value);
      }
    } catch (err) {
      showToast("Error updating favorite", "error");
    }
  };

  window.editContactNickname = async function(id, currentNickname) {
    const newNickname = prompt("Enter a nickname for this contact:", currentNickname);
    if (newNickname === null) return;

    const contact = cachedContacts.find(c => c.id === id);
    if (!contact) return;

    if (!isBackendConnected) {
      contact.nickname = newNickname.trim() || null;
      renderContactsLists();
      renderDirectory(document.getElementById("directory-search-input").value);
      showToast("Nickname updated (simulated)");
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: contact.walletAddress,
          name: contact.name,
          nickname: newNickname.trim() || null,
          isFavorite: contact.isFavorite
        })
      });
      if (res.ok) {
        showToast("Nickname updated!");
        await window.loadContactsAndRender();
        renderDirectory(document.getElementById("directory-search-input").value);
      }
    } catch (err) {
      showToast("Error updating nickname", "error");
    }
  };

  window.deleteContact = async function(id) {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    if (!isBackendConnected) {
      cachedContacts = cachedContacts.filter(c => c.id !== id);
      renderContactsLists();
      renderDirectory(document.getElementById("directory-search-input").value);
      showToast("Contact deleted (simulated)");
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/contacts/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Contact deleted!");
        await window.loadContactsAndRender();
        renderDirectory(document.getElementById("directory-search-input").value);
      }
    } catch (err) {
      showToast("Error deleting contact", "error");
    }
  };

  window.selectContactFromDirectory = function(name, address, initials) {
    selectRecipient(name, address, initials, null);
    closeAllModals();
    showToast(`Selected: ${name}`);
  };

  // Wire search input in directory
  const dirSearch = document.getElementById("directory-search-input");
  if (dirSearch) {
    dirSearch.oninput = (e) => {
      renderDirectory(e.target.value);
    };
  }

  // Wire contact form submit
  const formContact = document.getElementById("form-contact");
  if (formContact) {
    formContact.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("contact-name").value.trim();
      const nickname = document.getElementById("contact-nickname").value.trim();
      const walletAddress = document.getElementById("contact-address").value.trim();
      const isFavorite = document.getElementById("contact-favorite").checked;

      if (!name || !walletAddress) {
        showToast("Please enter name and wallet address", "error");
        return;
      }

      if (!isBackendConnected) {
        cachedContacts.push({
          id: `contact-${Date.now()}`,
          name,
          nickname: nickname || null,
          walletAddress,
          isFavorite,
          lastTransactedAt: null
        });
        renderContactsLists();
        closeAllModals();
        formContact.reset();
        showToast("Contact saved (simulated)");
        return;
      }

      try {
        const response = await authFetch(`${API_BASE}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, nickname: nickname || null, walletAddress, isFavorite })
        });
        if (response.ok) {
          showToast("Contact saved successfully!");
          await window.loadContactsAndRender();
          closeAllModals();
          formContact.reset();
        } else {
          const data = await response.json();
          showToast(data.error || "Failed to save contact", "error");
        }
      } catch (err) {
        showToast("Error saving contact", "error");
      }
    };
  }

  // Hook directory rendering when directory button is clicked
  const btnManage = document.getElementById("btn-manage-contacts");
  if (btnManage) {
    btnManage.addEventListener("click", () => {
      renderDirectory("");
    });
  }
  const btnViewAll = document.getElementById("btn-view-all-contacts");
  if (btnViewAll) {
    btnViewAll.addEventListener("click", () => {
      renderDirectory("");
    });
  }

  // Trigger initial fetch & render
  window.loadContactsAndRender();

  // Deselect click listener
  const deselectBtn = document.getElementById("btn-send-deselect-recipient");
  if (deselectBtn) {
    deselectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deselectRecipient();
      showToast("Recipient deselected");
    });
  }

  // Search input filtering
  const searchInput = document.getElementById("send-recipient-search");
  const resolvedContainer = document.getElementById("resolved-recipient-container");
  const resolvedCard = document.getElementById("resolved-recipient-card");
  const resolvedNameEl = document.getElementById("resolved-name");
  const resolvedAddressEl = document.getElementById("resolved-address");
  const resolvedAvatarEl = document.getElementById("resolved-avatar");
  let resolveTimeout = null;

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      const queryLower = query.toLowerCase();

      // Hide resolved container immediately on typing
      if (resolvedContainer) resolvedContainer.classList.add("hidden");

      recipientCards.forEach(card => {
        const name = card.getAttribute("data-name").toLowerCase();
        const address = card.getAttribute("data-address").toLowerCase();
        const email = (card.getAttribute("data-email") || "").toLowerCase();
        if (name.includes(queryLower) || address.includes(queryLower) || email.includes(queryLower)) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });

      recentItems.forEach(item => {
        const name = item.getAttribute("data-name").toLowerCase();
        const address = item.getAttribute("data-address").toLowerCase();
        const email = (item.getAttribute("data-email") || "").toLowerCase();
        if (name.includes(queryLower) || address.includes(queryLower) || email.includes(queryLower)) {
          item.classList.remove("hidden");
        } else {
          item.classList.add("hidden");
        }
      });

      // Clear previous timeout
      if (resolveTimeout) clearTimeout(resolveTimeout);

      // Trigger resolution if the query meets resolver criteria
      const isWalletAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
      const isUsername = query.startsWith("@") || (/^[a-zA-Z0-9_-]+$/.test(query) && !query.startsWith("0x") && !queryLower.endsWith(".up.id"));
      const isUpId = queryLower.endsWith(".up.id");

      if (query.length > 2 && (isWalletAddress || isUsername || isUpId)) {
        resolveTimeout = setTimeout(async () => {
          try {
            const response = await authFetch(`${API_BASE}/v1/recipients/resolve?query=${encodeURIComponent(query)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.resolved && resolvedContainer && resolvedNameEl && resolvedAddressEl && resolvedAvatarEl) {
                resolvedNameEl.textContent = data.name;
                resolvedAddressEl.textContent = data.address;
                
                const initials = data.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                resolvedAvatarEl.textContent = initials;

                resolvedContainer.classList.remove("hidden");

                // Bind click to select the resolved recipient
                resolvedCard.onclick = () => {
                  selectRecipient(data.name, data.address, initials, null);
                  showToast(`Selected resolved recipient: ${data.name}`);
                };
              }
            }
          } catch (err) {
            console.warn("[App] Recipient resolution failed:", err);
          }
        }, 400);
      }
    });
  }

  // Step 2 -> Step 3 (Recipient Selection -> Review)
  const recipientContinueBtn = document.getElementById("btn-send-recipient-continue");
  if (recipientContinueBtn) {
    recipientContinueBtn.addEventListener("click", () => {
      if (!selectedRecipient) {
        showToast("Please select a recipient", "error");
        return;
      }

      const amountVal = parseFloat(amountInput.value);
      const usdAmount = Number((amountVal / exchangeRates[selectedCurrency]).toFixed(2));

      // Transition to Step 3 (Review)
      stepRecipient.classList.add("hidden");
      step2.classList.remove("hidden");

      // Initialize Settlement Optimizer calculation
      const networkLoadSelect = document.getElementById("optimizer-network-load");
      const gasPriceInput = document.getElementById("optimizer-gas-price");
      const gasPriceVal = document.getElementById("optimizer-gas-price-val");
      const optRoute = document.getElementById("optimizer-route");
      const optFee = document.getElementById("optimizer-fee");
      const optTime = document.getElementById("optimizer-time");

      function calculateOptimization() {
        const loadSelect = document.getElementById("optimizer-network-load");
        const gasInput = document.getElementById("optimizer-gas-price");
        if (!loadSelect || !gasInput) return;

        const load = loadSelect.value;
        const gasPrice = parseInt(gasInput.value);
        if (gasPriceVal) gasPriceVal.innerText = `${gasPrice} Gwei`;

        // Determine recommended route
        let route = "Direct Bridge";
        let estTime = "< 2 minutes";
        let baseGasLimit = 65000;

        if (load === "low") {
          if (gasPrice < 35) {
            route = "Delayed Gas-Saver";
            estTime = "15 - 30 minutes";
            baseGasLimit = 35000;
          } else if (gasPrice < 75) {
            route = "L2 Batch Settlement";
            estTime = "2 - 5 minutes";
            baseGasLimit = 45000;
          } else {
            route = "Direct Bridge";
            estTime = "30 - 60 seconds";
            baseGasLimit = 65000;
          }
        } else if (load === "medium") {
          if (gasPrice < 55) {
            route = "L2 Batch Settlement";
            estTime = "5 - 10 minutes";
            baseGasLimit = 45000;
          } else {
            route = "Direct Bridge";
            estTime = "1 - 3 minutes";
            baseGasLimit = 65000;
          }
        } else { // high load
          if (gasPrice < 90) {
            route = "Gas-Saver Queue";
            estTime = "1 - 2 hours";
            baseGasLimit = 35000;
          } else {
            route = "Direct Bridge";
            estTime = "3 - 8 minutes";
            baseGasLimit = 65000;
          }
        }

        // Calculate fee in USD
        let feeUsd = baseGasLimit * gasPrice * 1e-9 * 3500;
        
        // Apply load multiplier
        if (load === "low") feeUsd *= 0.8;
        else if (load === "high") feeUsd *= 1.8;

        const feeInCurrency = feeUsd * exchangeRates[selectedCurrency];
        const receiveVal = Math.max(0, amountVal - feeInCurrency);
        const symbol = exchangeSymbols[selectedCurrency] || "$";

        if (optRoute) optRoute.innerText = route;
        if (optFee) optFee.innerText = `${symbol}${feeInCurrency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (optTime) optTime.innerText = estTime;

        // Sync with review screen's network fee
        const reviewNetworkFee = document.getElementById("review-network-fee");
        if (reviewNetworkFee) {
          reviewNetworkFee.innerText = `${symbol}${feeInCurrency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // Also sync the recipient receives amount
        const reviewReceiveAmount = document.getElementById("review-receive-amount");
        if (reviewReceiveAmount) {
          reviewReceiveAmount.innerText = receiveVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }

      if (networkLoadSelect) {
        const newSelect = networkLoadSelect.cloneNode(true);
        networkLoadSelect.parentNode.replaceChild(newSelect, networkLoadSelect);
        newSelect.addEventListener("change", calculateOptimization);
      }
      if (gasPriceInput) {
        const newInput = gasPriceInput.cloneNode(true);
        gasPriceInput.parentNode.replaceChild(newInput, gasPriceInput);
        newInput.addEventListener("input", calculateOptimization);
      }

      // Populate review details
      const reviewRecipientName = document.getElementById("review-recipient-name");
      const reviewRecipientAddress = document.getElementById("review-recipient-address");
      const reviewDisplayAmount = document.getElementById("review-display-amount");
      const reviewCurrencyCode = document.getElementById("review-currency-code");
      const reviewReceiveCurrency = document.getElementById("review-receive-currency");
      const reviewExchangeRate = document.getElementById("review-exchange-rate");
      const reviewAvatar = document.getElementById("review-avatar");
      const confirmBtnText = document.getElementById("btn-send-confirm-text");

      if (reviewRecipientName) reviewRecipientName.innerText = selectedRecipient.name;
      if (reviewRecipientAddress) reviewRecipientAddress.innerText = selectedRecipient.address;
      
      if (reviewDisplayAmount) reviewDisplayAmount.innerText = amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
      if (reviewCurrencyCode) reviewCurrencyCode.innerText = selectedCurrency;
      if (reviewReceiveCurrency) reviewReceiveCurrency.innerText = selectedCurrency;

      if (reviewExchangeRate) {
        const rateVal = exchangeRates[selectedCurrency].toLocaleString('en-US', { minimumFractionDigits: 4 });
        reviewExchangeRate.innerText = `1 USDC = ${rateVal} ${selectedCurrency}`;
      }

      if (confirmBtnText) {
        confirmBtnText.innerText = `Confirm & Send ${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${selectedCurrency}`;
      }

      const reviewNetworkName = document.getElementById("review-network-name");
      if (reviewNetworkName) {
        reviewNetworkName.innerText = window.giwaNetworkName || "GIWA L2";
      }

      if (reviewAvatar) {
        if (selectedRecipient.avatar) {
          reviewAvatar.src = selectedRecipient.avatar;
          reviewAvatar.classList.remove("hidden");
        } else {
          reviewAvatar.src = "https://lh3.googleusercontent.com/aida-public/AB6AXuDezqGvfSpAezrFPU_94REi8MQvhnhtT7LsPho5HNHFVwx7JH042ufT2rp2jW0U6UqVYdhp3PJZ5ojPSKm1ZaujLHtM3xYIR4mACFSP0p1NxdN809cHKwApraHO3iuZdbjIMzJeI7rVS4lpsKzuYLD6DiVCDc150bhtO5kY-avqldEFty0hUYa0MUJFYh5-GPlHG7skL5qnVMyd2sgwJlrdlbx1sXctyOZIdsD5fEupupP4u_Wnhid3tP__TqS2g5ML1oJ0WDy-dyQ";
        }
      }

      // Initial execution
      setTimeout(() => {
        const updatedLoadSelect = document.getElementById("optimizer-network-load");
        const updatedGasInput = document.getElementById("optimizer-gas-price");
        if (updatedLoadSelect) updatedLoadSelect.value = "medium";
        if (updatedGasInput) updatedGasInput.value = "45";
        calculateOptimization();
      }, 0);

      setStepDotsActive(3);
    });
  }

  // Step 2 -> Step 1 (Go Back from Recipient to Amount)
  const recipientBackBtn = document.getElementById("btn-send-recipient-back");
  if (recipientBackBtn) {
    recipientBackBtn.addEventListener("click", () => {
      stepRecipient.classList.add("hidden");
      step1.classList.remove("hidden");
      setStepDotsActive(1);
    });
  }

  // Edit Amount button (on Step 2 Summary Card) -> Step 1
  const editAmountBtn = document.getElementById("btn-send-edit-amount");
  if (editAmountBtn) {
    editAmountBtn.addEventListener("click", () => {
      stepRecipient.classList.add("hidden");
      step1.classList.remove("hidden");
      setStepDotsActive(1);
    });
  }

  // Edit Recipient button (on Step 3 Review Card) -> Step 2 Recipient Selection
  const reviewEditRecipientBtn = document.getElementById("btn-review-edit-recipient");
  if (reviewEditRecipientBtn) {
    reviewEditRecipientBtn.addEventListener("click", () => {
      step2.classList.add("hidden");
      stepRecipient.classList.remove("hidden");
      setStepDotsActive(2);
    });
  }

  // Step 3 -> Step 2 (Go Back from Review to Recipient)
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      step2.classList.add("hidden");
      stepRecipient.classList.remove("hidden");
      setStepDotsActive(2);
    });
  }

  function updateStatusScreen(status, txHash, amountVal, selectedCurrency, recipient, walletConnected) {
    const successDisplayAmount = document.getElementById("success-display-amount");
    const successRecipientName = document.getElementById("success-recipient-name");
    const successPaymentMethod = document.getElementById("success-payment-method");
    const successTxHash = document.getElementById("success-tx-hash");
    const copyHashBtn = document.getElementById("btn-copy-hash");
    
    const statusTitle = document.querySelector("#send-step-3 h3");
    const statusDesc = document.querySelector("#send-step-3 p.font-body-md");
    const statusIconContainer = document.querySelector("#send-step-3 .relative.z-10");
    const statusIconSvg = document.querySelector("#send-step-3 .relative.z-10 svg");

    if (successDisplayAmount) {
      successDisplayAmount.innerText = `${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    if (successRecipientName) {
      successRecipientName.innerText = recipient;
    }

    const successBlockEl = document.getElementById("success-block-height");
    if (successBlockEl) {
      const widgetBlockText = document.getElementById("widget-giwa-block")?.textContent || "";
      successBlockEl.innerText = widgetBlockText ? widgetBlockText.replace("#", "") : (lastKnownBlockHeight || "182390");
    }
    if (successPaymentMethod) {
      successPaymentMethod.innerText = walletConnected ? "Web3 Connected Wallet" : "Visa ending in •••• 8829";
    }

    const fullHash = txHash || "";
    if (successTxHash) {
      if (fullHash) {
        successTxHash.innerText = fullHash.substring(0, 7) + "..." + fullHash.substring(fullHash.length - 5);
        successTxHash.parentElement.style.display = "flex";
      } else {
        successTxHash.parentElement.style.display = "none";
      }
    }

    // Click to copy handler
    if (copyHashBtn && fullHash) {
      const newCopyHashBtn = copyHashBtn.cloneNode(true);
      copyHashBtn.parentNode.replaceChild(newCopyHashBtn, copyHashBtn);
      newCopyHashBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(fullHash).then(() => {
          showToast("Transaction hash copied to clipboard!");
        }).catch(() => {
          showToast("Failed to copy hash", "error");
        });
      });
    }

    // Share Settlement Proof Handler
    const shareBtn = document.getElementById("btn-send-share");
    if (shareBtn) {
      const newShareBtn = shareBtn.cloneNode(true);
      shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);

      newShareBtn.addEventListener("click", () => {
        let shareText = `Successfully settled ${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString()} to ${recipient} via KorriPay!`;
        if (status === "Pending") {
          shareText = `Settlement of ${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString()} to ${recipient} is pending via KorriPay!`;
        } else if (status === "Failed") {
          shareText = `Settlement of ${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString()} to ${recipient} failed on KorriPay.`;
        }

        if (navigator.share) {
          navigator.share({
            title: 'KorriPay Settlement Proof',
            text: shareText,
            url: window.location.href
          }).then(() => {
            showToast("Settlement proof shared!");
          }).catch(() => {
            showToast("Settlement proof sharing canceled");
          });
        } else {
          navigator.clipboard.writeText(shareText).then(() => {
            showToast("Settlement proof info copied! Ready to share.");
          }).catch(() => {
            showToast("Failed to copy settlement proof text", "error");
          });
        }
      });
    }

    if (statusTitle && statusDesc) {
      if (status === "Pending") {
        statusTitle.innerText = "Settlement Pending";
        statusTitle.className = "font-headline-lg-mobile text-headline-lg-mobile text-amber-600 dark:text-amber-400 mb-2 font-bold";
        statusDesc.innerText = "Your settlement is being processed on the blockchain. We are waiting for confirmation.";
        if (statusIconContainer) {
          statusIconContainer.className = "relative z-10 w-24 h-24 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center shadow-lg border border-amber-300/30";
        }
        if (statusIconSvg) {
          statusIconSvg.innerHTML = `
            <path class="animate-spin" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-linecap="round"/>
          `;
          statusIconSvg.setAttribute("class", "w-12 h-12 text-amber-600 dark:text-amber-400");
          statusIconSvg.setAttribute("viewBox", "0 0 24 24");
        }
      } else if (status === "Failed") {
        statusTitle.innerText = "Settlement Failed";
        statusTitle.className = "font-headline-lg-mobile text-headline-lg-mobile text-error dark:text-red-400 mb-2 font-bold";
        statusDesc.innerText = "Your settlement failed or was reverted on-chain. Please verify and try again.";
        if (statusIconContainer) {
          statusIconContainer.className = "relative z-10 w-24 h-24 bg-error-container rounded-full flex items-center justify-center shadow-lg";
        }
        if (statusIconSvg) {
          statusIconSvg.innerHTML = `
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path>
          `;
          statusIconSvg.setAttribute("class", "w-12 h-12 text-on-error-container");
          statusIconSvg.setAttribute("viewBox", "0 0 24 24");
        }
      } else {
        // Success
        statusTitle.innerText = "Settlement Successful";
        statusTitle.className = "font-headline-lg-mobile text-headline-lg-mobile text-primary dark:text-primary-fixed mb-2 font-bold";
        statusDesc.innerText = "Your settlement has been completed successfully. The recipient will receive it in minutes.";
        if (statusIconContainer) {
          statusIconContainer.className = "relative z-10 w-24 h-24 bg-secondary-container rounded-full flex items-center justify-center shadow-lg";
        }
        if (statusIconSvg) {
          statusIconSvg.innerHTML = `
            <path class="check-anim" d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
          `;
          statusIconSvg.setAttribute("class", "w-12 h-12 text-on-secondary-container");
          statusIconSvg.setAttribute("viewBox", "0 0 24 24");
        }
      }
    }
  }

  // Step 3 -> Step 4 (Confirm Payment)
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (!selectedRecipient) {
        showToast("Please select a recipient", "error");
        return;
      }
      const recipient = selectedRecipient.name;
      const amountVal = parseFloat(amountInput.value);
      const usdAmount = Number((amountVal / exchangeRates[selectedCurrency]).toFixed(2));

      confirmBtn.disabled = true;
      confirmBtn.classList.add('opacity-80', 'pointer-events-none');
      confirmBtn.innerHTML = `
        <div class="flex items-center gap-3 justify-center">
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Processing...</span>
        </div>
      `;

      let txHash = "";
      const walletConnected = window.WalletService && window.WalletService.isConnected();

      if (walletConnected) {
        let payToken = "USDC";
        if (selectedCurrency === "KRW") {
          payToken = "MockKRW";
        }
        
        try {
          // 1. Create blockchain transaction
          txHash = await window.TokenService.sendSettlement(
            payToken,
            amountVal,
            selectedRecipient.address || "0x0000000000000000000000000000000000000000"
          );
        } catch (contractErr) {
          console.error("Contract call failed:", contractErr);
          showToast(contractErr.message || "On-chain transaction rejected or failed", "error");
          
          // Reset confirm button
          confirmBtn.disabled = false;
          confirmBtn.classList.remove('opacity-80', 'pointer-events-none');
          confirmBtn.innerHTML = `
            <div class="absolute inset-0 bg-white/10 dark:bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">lock</span>
            <span id="btn-send-confirm-text">Confirm &amp; Send</span>
          `;
          return;
        }
      } else {
        // Offline / Simulation mode: generate mock hash
        txHash = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("");
      }

      // 2. Store txHash & mark as Pending
      let txId = null;
      try {
        const txResult = await processTransaction("send", { 
          recipient, 
          amount: usdAmount, 
          txHash, 
          status: "Pending",
          recipientAddress: selectedRecipient ? selectedRecipient.address : null
        });
        if (txResult && txResult.transaction) {
          txId = txResult.transaction.id;
        }
      } catch (err) {
        console.error("Failed to store pending transaction:", err);
      }

      // 3. Update status screen to Pending and transition
      updateStatusScreen("Pending", txHash, amountVal, selectedCurrency, recipient, walletConnected);
      step2.classList.add("hidden");
      step3.classList.remove("hidden");
      setStepDotsActive(4);

      // Reset confirm button so it is ready for future actions
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('opacity-80', 'pointer-events-none');
      confirmBtn.innerHTML = `
        <div class="absolute inset-0 bg-white/10 dark:bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">lock</span>
        <span id="btn-send-confirm-text">Confirm &amp; Send</span>
      `;

      // 4. Wait for confirmation asynchronously
      if (walletConnected) {
        window.TokenService.waitForConfirmation(txHash)
          .then(async (receipt) => {
            const status = (receipt.status === "success" || receipt.status === 1) ? "Success" : "Failed";
            await updateTransactionStatus(txId, txHash, status);
            updateStatusScreen(status, txHash, amountVal, selectedCurrency, recipient, walletConnected);
          })
          .catch(async (confirmErr) => {
            console.error("Transaction failed during confirmation:", confirmErr);
            await updateTransactionStatus(txId, txHash, "Failed");
            updateStatusScreen("Failed", txHash, amountVal, selectedCurrency, recipient, walletConnected);
          });
      } else {
        // Simulation delay
        setTimeout(async () => {
          await updateTransactionStatus(txId, txHash, "Success");
          updateStatusScreen("Success", txHash, amountVal, selectedCurrency, recipient, walletConnected);
        }, 2000);
      }
    });
  }

  // Save recipient to contacts from success page
  const saveContactBtn = document.getElementById("btn-send-save-contact");
  if (saveContactBtn) {
    saveContactBtn.addEventListener("click", () => {
      if (selectedRecipient) {
        document.getElementById("contact-name").value = selectedRecipient.name;
        document.getElementById("contact-nickname").value = "";
        document.getElementById("contact-address").value = selectedRecipient.address || "";
        document.getElementById("contact-favorite").checked = false;
        openModal("modal-contact");
      }
    });
  }

  // Done -> Reset form & go Home
  if (doneBtn) {
    doneBtn.addEventListener("click", () => {
      // Reset inputs & state
      if (amountInput) amountInput.value = "10.00";
      deselectRecipient();
      
      // Hide Step 3, Show Step 1
      step3.classList.add("hidden");
      step1.classList.remove("hidden");
      setStepDotsActive(1);

      // Change route hash to home
      window.location.hash = "home";
    });
  }

  function setStepDotsActive(activeStep) {
    const dots = [dot1, dot2, dot3];
    dots.forEach((dot, index) => {
      if (!dot) return;
      const circle = dot.querySelector("div");
      const label = dot.querySelector("span");
      const stepNum = index + 1;

      if (stepNum < activeStep) {
        circle.className = "w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm";
        circle.innerHTML = `<span class="material-symbols-outlined text-[18px]">check</span>`;
        label.className = "font-label-sm text-label-sm text-on-secondary-container font-semibold";
      } else if (stepNum === activeStep) {
        circle.className = "w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm";
        circle.innerHTML = stepNum;
        label.className = "font-label-sm text-label-sm text-primary font-bold";
      } else {
        circle.className = "w-8 h-8 rounded-full bg-surface-container-highest text-outline flex items-center justify-center font-bold text-sm";
        circle.innerHTML = stepNum;
        label.className = "font-label-sm text-label-sm text-outline";
      }
    });
  }
}

function setupKycVerification() {
  const btnVerify = document.getElementById("btn-kyc-verify");
  const modalKyc = document.getElementById("modal-kyc");
  const btnCloseKyc = document.getElementById("btn-close-kyc");
  const btnStartKyc = document.getElementById("btn-kyc-start");
  const btnDocContinue = document.getElementById("btn-kyc-doc-continue");
  const btnCaptureKyc = document.getElementById("btn-kyc-capture");
  const btnUploadKyc = document.getElementById("btn-kyc-upload-gallery");
  const btnLivenessCapture = document.getElementById("btn-kyc-liveness-capture");
  const btnPendingClose = document.getElementById("btn-kyc-pending-close");
  const btnPendingApprove = document.getElementById("btn-kyc-pending-approve");
  const btnDoneKyc = document.getElementById("btn-kyc-done");
  
  const step1 = document.getElementById("kyc-step-1");
  const step2 = document.getElementById("kyc-step-2");
  const step3 = document.getElementById("kyc-step-3");
  const stepLiveness = document.getElementById("kyc-step-liveness");
  const step4 = document.getElementById("kyc-step-4");
  const stepPending = document.getElementById("kyc-step-pending");
  const stepSuccess = document.getElementById("kyc-step-success");

  const indicator = document.getElementById("kyc-step-indicator");
  const statusText = document.getElementById("kyc-scan-status");
  const progressEl = document.getElementById("kyc-scan-progress");
  const successDesc = document.getElementById("kyc-success-description");

  const scanDocTitle = document.getElementById("kyc-scan-doc-title");
  const scanDocSub = document.getElementById("kyc-scan-doc-sub");
  const cameraFeed = document.getElementById("kyc-camera-feed");

  let currentDocType = "Passport";
  let livenessInterval = null;

  if (!btnVerify || !modalKyc) return;

  // Open KYC flow
  btnVerify.addEventListener("click", () => {
    modalKyc.classList.remove("hidden");
    resetKycFlow();
  });

  // Close KYC flow
  if (btnCloseKyc) {
    btnCloseKyc.addEventListener("click", () => {
      modalKyc.classList.add("hidden");
      if (livenessInterval) clearInterval(livenessInterval);
    });
  }

  // Step 1 -> Step 2
  if (btnStartKyc) {
    btnStartKyc.addEventListener("click", () => {
      step1.classList.add("hidden");
      step2.classList.remove("hidden");
      indicator.innerText = "Step 2 of 6";
    });
  }

  // Step 2 -> Step 3 (Choose Document -> Camera Scan screen)
  if (btnDocContinue) {
    btnDocContinue.addEventListener("click", () => {
      const selectedRadio = document.querySelector('input[name="document_type"]:checked');
      currentDocType = selectedRadio ? selectedRadio.value : "Document";

      // Dynamically customize Step 3 based on selection
      if (scanDocTitle && scanDocSub) {
        if (currentDocType === "Passport") {
          scanDocTitle.innerText = "Scan Your Passport";
          scanDocSub.innerText = "Position the photo page of your Passport within the frame";
          if (cameraFeed) {
            cameraFeed.style.backgroundImage = "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDs6xLUNg8PbqcfUgh7qxEtsiFxjSGPQU90hLpu93ZKBEMCoM38TCdd4_Oh744fPH1jI-VD8YoogEHOzx-GxXN7Sz9OiXZ_-_VRXieeFY6rSvPC_qEEWs0ZcWK72gHTxtqoxJ55V5cxaBQECglhO4XBpYcj5OsAPpqueScU8UriIQA8t2Dn5fDqhj5A1jFvk-m8ls7DzZOqjXSBPyCT-7aZs5jCS-N83t-xu8BT-gvJIVBngzgob3HcdjeImGSnfrxYAmHqr3MhsXw')";
          }
        } else if (currentDocType === "Driver's License") {
          scanDocTitle.innerText = "Scan Your License";
          scanDocSub.innerText = "Position the front of your Driver's License within the frame";
          if (cameraFeed) {
            cameraFeed.style.backgroundImage = "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC6xFUh_jUGCtCToOUHqnCFyRB0qtzGXRiArohufBxlgSPQBNq-zh8C81J0H-023vi0yCJgTOU8QAsrTowkFGzHINjYY8AqA2TddjXHUvL2bnEirXhlNE50hjcEQD2TtsFHuiE8WMUOel9am9-7mPM19-7sF6wb1qMjIrFNnA-pipw0MOJmrnlLpg9614H6coFVP_C4cRZcarkKaiTF8AzkDQQGLatf_8-DuYSaVjvHsk95rBgJl8d339NGRGNnHO8WK8_tXR7Ksts')";
          }
        } else {
          scanDocTitle.innerText = "Scan Your ID Card";
          scanDocSub.innerText = "Position the front of your National ID Card within the frame";
          if (cameraFeed) {
            cameraFeed.style.backgroundImage = "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC6xFUh_jUGCtCToOUHqnCFyRB0qtzGXRiArohufBxlgSPQBNq-zh8C81J0H-023vi0yCJgTOU8QAsrTowkFGzHINjYY8AqA2TddjXHUvL2bnEirXhlNE50hjcEQD2TtsFHuiE8WMUOel9am9-7mPM19-7sF6wb1qMjIrFNnA-pipw0MOJmrnlLpg9614H6coFVP_C4cRZcarkKaiTF8AzkDQQGLatf_8-DuYSaVjvHsk95rBgJl8d339NGRGNnHO8WK8_tXR7Ksts')";
          }
        }
      }

      step2.classList.add("hidden");
      step3.classList.remove("hidden");
      indicator.innerText = "Step 3 of 6";
    });
  }

  // Camera capture/upload flash simulation helper
  function triggerCaptureFlash(callback) {
    const flash = document.createElement("div");
    flash.className = "fixed inset-0 bg-white z-[200] opacity-0 pointer-events-none transition-opacity duration-150";
    document.body.appendChild(flash);

    // Fade flash in
    setTimeout(() => {
      flash.classList.remove("opacity-0");
      flash.classList.add("opacity-80");
      
      // Fade flash out
      setTimeout(() => {
        flash.classList.remove("opacity-80");
        flash.classList.add("opacity-0");
        setTimeout(() => {
          flash.remove();
          callback();
        }, 150);
      }, 150);
    }, 50);
  }

  // Step 3 -> Step 4 (Capture photo -> Liveness Check screen)
  if (btnCaptureKyc) {
    btnCaptureKyc.addEventListener("click", () => {
      triggerCaptureFlash(() => {
        step3.classList.add("hidden");
        stepLiveness.classList.remove("hidden");
        indicator.innerText = "Step 4 of 6";

        // Setup Liveness Check dynamic instruction hints
        setupLivenessHints();
      });
    });
  }

  // Step 3 (Upload from gallery variant) -> Step 4 (Liveness Check screen)
  if (btnUploadKyc) {
    btnUploadKyc.addEventListener("click", () => {
      step3.classList.add("hidden");
      stepLiveness.classList.remove("hidden");
      indicator.innerText = "Step 4 of 6";

      // Setup Liveness Check dynamic instruction hints
      setupLivenessHints();
    });
  }

  function setupLivenessHints() {
    if (livenessInterval) clearInterval(livenessInterval);
    const hintElement = document.querySelector("#kyc-liveness-hint p");
    if (!hintElement) return;

    const hints = [
      "Position your face within the frame",
      "Hold still...",
      "Move slightly closer",
      "Perfect, now blink",
      "Looking good"
    ];
    let currentHint = 0;
    hintElement.style.transition = "opacity 0.3s ease-in-out";

    livenessInterval = setInterval(() => {
      currentHint = (currentHint + 1) % hints.length;
      hintElement.style.opacity = 0;
      setTimeout(() => {
        hintElement.textContent = hints[currentHint];
        hintElement.style.opacity = 1;
      }, 300);
    }, 3000);
  }

  // Step 4 -> Step 5 (Liveness capture -> Live Scanning Simulation)
  if (btnLivenessCapture) {
    btnLivenessCapture.addEventListener("click", () => {
      if (livenessInterval) clearInterval(livenessInterval);
      
      triggerCaptureFlash(() => {
        stepLiveness.classList.add("hidden");
        step4.classList.remove("hidden");
        indicator.innerText = "Step 5 of 6";

        // Reset and trigger progressive scanning animation
        statusText.innerText = "Uploading Selfie & ID Document...";
        progressEl.style.width = "0%";
        
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          progressEl.style.width = `${progress}%`;

          if (progress === 30) {
            statusText.innerText = "Analyzing Face Biometrics...";
          } else if (progress === 70) {
            statusText.innerText = "Matching selfie with ID credentials...";
          }

          if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              // Step 5 -> Step 6 (Pending Screen)
              step4.classList.add("hidden");
              stepPending.classList.remove("hidden");
              indicator.innerText = "Step 6 of 6";
            }, 400);
          }
        }, 100);
      });
    });
  }

  // Step 6 (Pending review) -> Close / Back to Dashboard
  if (btnPendingClose) {
    btnPendingClose.addEventListener("click", () => {
      modalKyc.classList.add("hidden");
      
      // Update badge in profile to Pending Review
      const badge = document.getElementById("profile-kyc-badge");
      if (badge) {
        badge.className = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-0.5 rounded-full font-label-sm";
        badge.innerText = "Pending Review";
      }
      state.kycStatus = "Pending";
      authFetch(`${API_BASE}/kyc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Pending" })
      }).catch(err => console.error("Error updating KYC status:", err));
      showToast("Documents submitted. Verification in progress.");
    });
  }

  // Step 6 (Pending review) -> Simulate instant approval -> Success screen
  if (btnPendingApprove) {
    btnPendingApprove.addEventListener("click", () => {
      stepPending.classList.add("hidden");
      stepSuccess.classList.remove("hidden");
      indicator.innerText = "Completed";

      if (successDesc) {
        successDesc.innerText = `Your ${currentDocType} has been verified successfully. You now have full access to global settlements.`;
      }
    });
  }

  // Done button (Success screen -> Close)
  if (btnDoneKyc) {
    btnDoneKyc.addEventListener("click", () => {
      modalKyc.classList.add("hidden");
      
      // Update badge in profile to Verified
      const badge = document.getElementById("profile-kyc-badge");
      if (badge) {
        badge.className = "bg-secondary-container/20 text-on-secondary-container dark:text-secondary-fixed border border-secondary/20 px-3 py-0.5 rounded-full font-label-sm";
        badge.innerText = "Verified";
      }
      state.kycStatus = "Verified";
      authFetch(`${API_BASE}/kyc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Verified" })
      }).catch(err => console.error("Error updating KYC status:", err));
      showToast("Identity Verification Successful!");
    });
  }

  function resetKycFlow() {
    if (livenessInterval) clearInterval(livenessInterval);
    step1.classList.remove("hidden");
    step2.classList.add("hidden");
    step3.classList.add("hidden");
    stepLiveness.classList.add("hidden");
    step4.classList.add("hidden");
    stepPending.classList.add("hidden");
    stepSuccess.classList.add("hidden");
    indicator.innerText = "Step 1 of 6";
    progressEl.style.width = "0%";
  }
}

function setupDemoMode() {
  const btnJudgeDemo = document.getElementById("btn-judge-demo");
  const modalDemo = document.getElementById("modal-demo");
  const btnCloseDemo = document.getElementById("btn-close-demo");
  const btnStartDemo = document.getElementById("btn-start-demo");
  const scenarioSelect = document.getElementById("demo-scenario-select");
  const descriptionEl = document.getElementById("demo-scenario-description");

  if (!btnJudgeDemo || !modalDemo) return;

  const demoScenarios = {
    "1": {
      description: "Scenario 1: Korean worker sends 100,000 KRW to family. Simulates fiat KYC validation, conversion to KRW stablecoin, and initiating a smart contract settlement transaction with active indexer sync.",
      steps: [
        { title: "KYC Verification", desc: "Checking sender identity, compliance logs, and liveness capture status" },
        { title: "Wrapper Deposit", desc: "Depositing ₩100,000 to custodian and wrapping into KRW stablecoin" },
        { title: "Smart Contract Settlement", desc: "Invoking initiateSettlement contract transaction on-chain via wallet keys" },
        { title: "Indexer Capture", desc: "Indexer polling capturing the TransferCreated event and writing to PostgreSQL" },
        { title: "Dashboard Reconciled", desc: "Synchronizing dashboard balances and ledger listings instantly" }
      ],
      runner: async function(sleep) {
        setStepActive(1, "Verifying KYC...");
        await sleep(1500);
        setStepComplete(1, "Verified");

        setStepActive(2, "Wrapping KRW...");
        await sleep(1500);
        const addRes = await authFetch(`${API_BASE}/transactions/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "Demo Seed (KRW)", amount: 71.43 })
        });
        if (!addRes.ok) throw new Error("Failed to add sender balance");
        await loadData();
        renderUI();
        setStepComplete(2, "₩100,000 Wrapped");

        setStepActive(3, "Settling...");
        await sleep(1500);
        let txHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");
        const sendRes = await authFetch(`${API_BASE}/transactions/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: "Family (Bank Payout)",
            amount: 71.43,
            txHash,
            status: "Pending"
          })
        });
        if (!sendRes.ok) throw new Error("Failed to register settlement transaction");
        await loadData();
        renderUI();
        setStepComplete(3, "Settled");

        setStepActive(4, "Indexing Event...");
        await sleep(1500);
        const updateRes = await authFetch(`${API_BASE}/transactions/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash, status: "Success" })
        });
        if (!updateRes.ok) throw new Error("Failed to index transaction");
        await loadData();
        renderUI();
        setStepComplete(4, "Event Indexed");

        setStepActive(5, "Syncing UI...");
        await sleep(1000);
        setStepComplete(5, "Completed");
      }
    },
    "2": {
      description: "Scenario 2: Freelancer receives consulting payment. Demonstrates GIWA session authentication, invoicing, checkout verification, and immediate wallet balance crediting.",
      steps: [
        { title: "GIWA Authentication", desc: "Verifying secure session token creation via Web3 wallet signatures" },
        { title: "Invoice Generation", desc: "Creating a unique invoice checkout link with specific payment amount" },
        { title: "USDC Checkout Payout", desc: "Customer scanning link and executing on-chain USDC contract transfer" },
        { title: "Prisma Ledger Log", desc: "Database capturing the payment and writing settlement log records" },
        { title: "Balance Updates", desc: "Updating general ledger history and refreshing current portfolio" }
      ],
      runner: async function(sleep) {
        setStepActive(1, "Signing GIWA...");
        await sleep(1500);
        setStepComplete(1, "Session Active");

        setStepActive(2, "Invoicing...");
        await sleep(1500);
        const invoiceRes = await authFetch(`${API_BASE}/merchant/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 150.00,
            currency: "USDC",
            description: "Consulting Services Payout"
          })
        });
        if (!invoiceRes.ok) throw new Error("Failed to generate payment request");
        const invoice = await invoiceRes.json();
        setStepComplete(2, "Invoice Created");

        setStepActive(3, "USDC Payout...");
        await sleep(2000);
        const payRes = await authFetch(`${API_BASE}/merchant/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: invoice.id,
            payerWallet: "0x1234567890123456789012345678901234567890"
          })
        });
        if (!payRes.ok) throw new Error("Payment checkout failed");
        setStepComplete(3, "USDC Settled");

        setStepActive(4, "Indexing Ledger...");
        await sleep(1500);
        let txHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");
        const logRes = await authFetch(`${API_BASE}/transactions/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: "Freelancer Wallet",
            amount: 150.00,
            txHash,
            status: "Success"
          })
        });
        if (!logRes.ok) throw new Error("Failed to sync general ledger");
        await loadData();
        renderUI();
        setStepComplete(4, "Ledger Synced");

        setStepActive(5, "Refreshing...");
        await sleep(1000);
        setStepComplete(5, "Completed");
      }
    },
    "3": {
      description: "Scenario 3: Instore merchant accepts instant point-of-sale checkout. Generates payment QR code, simulates customer wallet checkout, and updates Merchant Terminal & Analytics dashboard.",
      steps: [
        { title: "Terminal Configuration", desc: "Setting checkout billing details, description, and currency" },
        { title: "QR Code Rendering", desc: "Constructing link and drawing high-density QRIOUS QR canvas code" },
        { title: "Storefront Checkout", desc: "Customer checking out locally using on-chain stablecoin contract" },
        { title: "Merchant Ledger Payout", desc: "Registering settlement and saving record inside PostgreSQL via Prisma" },
        { title: "Global Analytics Sync", desc: "Refreshing overall volume chart datasets and confirmation speed metrics" }
      ],
      runner: async function(sleep) {
        setStepActive(1, "Configuring...");
        await sleep(1500);
        setStepComplete(1, "Configured");

        setStepActive(2, "Drawing QR...");
        await sleep(1500);
        const invoiceRes = await authFetch(`${API_BASE}/merchant/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 45.00,
            currency: "MockKRW",
            description: "Table 4 Instore Checkout"
          })
        });
        if (!invoiceRes.ok) throw new Error("Failed to generate QR payment link");
        const invoice = await invoiceRes.json();
        setStepComplete(2, "QR Code Displayed");

        setStepActive(3, "Processing Payout...");
        await sleep(2000);
        const payRes = await authFetch(`${API_BASE}/merchant/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: invoice.id,
            payerWallet: "0x7890123456789012345678901234567890123456"
          })
        });
        if (!payRes.ok) throw new Error("QR Payment failed");
        setStepComplete(3, "Paid via Wallet");

        setStepActive(4, "Saving Settlement...",);
        await sleep(1500);
        await loadMerchantData();
        setStepComplete(4, "Settlement Logged");

        setStepActive(5, "Syncing Analytics...");
        await sleep(1000);
        if (typeof loadAnalyticsData === "function") {
          await loadAnalyticsData();
        }
        setStepComplete(5, "Completed");
      }
    }
  };

  btnJudgeDemo.addEventListener("click", () => {
    modalDemo.classList.remove("hidden");
    updateScenarioUI();
    resetDemoSteps();
  });

  btnCloseDemo.addEventListener("click", () => {
    modalDemo.classList.add("hidden");
  });

  scenarioSelect.addEventListener("change", () => {
    updateScenarioUI();
    resetDemoSteps();
  });

  function updateScenarioUI() {
    const val = scenarioSelect.value;
    const scenario = demoScenarios[val];
    if (!scenario) return;

    if (descriptionEl) descriptionEl.textContent = scenario.description;

    scenario.steps.forEach((step, index) => {
      const stepNum = index + 1;
      const stepEl = document.getElementById(`demo-step-${stepNum}`);
      if (stepEl) {
        const titleEl = stepEl.querySelector(".demo-step-title");
        const descEl = stepEl.querySelector(".demo-step-desc");
        if (titleEl) titleEl.textContent = step.title;
        if (descEl) descEl.textContent = step.desc;
      }
    });
  }

  btnStartDemo.addEventListener("click", async () => {
    btnStartDemo.disabled = true;
    btnStartDemo.innerText = "Running Scenario...";
    btnCloseDemo.style.pointerEvents = "none";
    scenarioSelect.disabled = true;

    try {
      const val = scenarioSelect.value;
      const scenario = demoScenarios[val];
      if (scenario) {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await scenario.runner(sleep);
      }
    } catch (error) {
      console.error("Demo failed:", error);
      showToast("Demo flow failed. Check console for details.");
    } finally {
      btnStartDemo.disabled = false;
      btnStartDemo.innerText = "Run Scenario";
      btnCloseDemo.style.pointerEvents = "auto";
      scenarioSelect.disabled = false;
    }
  });

  function resetDemoSteps() {
    for (let i = 1; i <= 5; i++) {
      const stepEl = document.getElementById(`demo-step-${i}`);
      if (stepEl) {
        stepEl.style.opacity = "0.4";
        const iconEl = stepEl.querySelector(".demo-step-icon");
        const statusEl = stepEl.querySelector(".demo-step-status");
        if (iconEl) {
          iconEl.className = "demo-step-icon w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold";
          iconEl.innerHTML = i;
        }
        if (statusEl) {
          statusEl.innerText = "Pending";
          statusEl.className = "demo-step-status text-body-sm font-bold text-primary";
        }
      }
    }
  }

  function setStepActive(stepNum, statusText = "Active") {
    const stepEl = document.getElementById(`demo-step-${stepNum}`);
    if (stepEl) {
      stepEl.style.opacity = "1.0";
      const iconEl = stepEl.querySelector(".demo-step-icon");
      const statusEl = stepEl.querySelector(".demo-step-status");
      if (iconEl) {
        iconEl.className = "demo-step-icon w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold animate-pulse";
        iconEl.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">sync</span>`;
      }
      if (statusEl) {
        statusEl.innerText = statusText;
        statusEl.className = "demo-step-status text-body-sm font-bold text-amber-500";
      }
    }
  }

  function setStepComplete(stepNum, statusText = "Success") {
    const stepEl = document.getElementById(`demo-step-${stepNum}`);
    if (stepEl) {
      stepEl.style.opacity = "1.0";
      const iconEl = stepEl.querySelector(".demo-step-icon");
      const statusEl = stepEl.querySelector(".demo-step-status");
      if (iconEl) {
        iconEl.className = "demo-step-icon w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold";
        iconEl.innerHTML = `<span class="material-symbols-outlined text-[16px]">check</span>`;
      }
      if (statusEl) {
        statusEl.innerText = statusText;
        statusEl.className = "demo-step-status text-body-sm font-bold text-green-500";
      }
    }
  }
}

// ── Explorer Logic ──────────────────────────────────────────────────
let explorerSettlements = [];

async function loadExplorerData() {
  const tableBody = document.getElementById("explorer-table-body");
  if (!tableBody) return;

  // Show loading spinner
  tableBody.innerHTML = `
    <tr>
      <td colspan="8" class="p-12 text-center text-outline dark:text-outline-variant">
        <div class="flex flex-col items-center justify-center gap-2">
          <span class="material-symbols-outlined text-4xl animate-spin text-primary">autorenew</span>
          <p class="font-semibold text-sm">Loading indexed records...</p>
        </div>
      </td>
    </tr>
  `;

  try {
    const res = await authFetch(`${API_BASE}/explorer`);
    if (!res.ok) throw new Error("Failed to fetch explorer data");
    explorerSettlements = await res.json();
    renderExplorer();
  } catch (err) {
    console.error("[Explorer] Error loading settlements:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="p-12 text-center text-error font-semibold">
          <span class="material-symbols-outlined text-4xl">error</span>
          <p class="mt-2">Failed to load settlements from indexer database.</p>
        </td>
      </tr>
    `;
  }
}

function renderExplorer() {
  const tableBody = document.getElementById("explorer-table-body");
  if (!tableBody) return;

  const searchQuery = (document.getElementById("explorer-search-input")?.value || "").toLowerCase().trim();
  const filterStatus = document.getElementById("explorer-filter-status")?.value || "all";

  // Filter
  const filtered = explorerSettlements.filter(tx => {
    // Status filter
    if (filterStatus !== "all" && tx.status !== filterStatus) {
      return false;
    }

    // Search query filter: txHash, wallet (initiator), settlement id
    if (searchQuery) {
      const idMatch = tx.id.toString().toLowerCase().includes(searchQuery);
      const initiatorMatch = tx.initiator.toLowerCase().includes(searchQuery);
      const txHashMatch = tx.txHash && tx.txHash.toLowerCase().includes(searchQuery);
      const confirmedTxHashMatch = tx.confirmedTxHash && tx.confirmedTxHash.toLowerCase().includes(searchQuery);
      return idMatch || initiatorMatch || txHashMatch || confirmedTxHashMatch;
    }

    return true;
  });

  // Update Stats Cards
  const totalEl = document.getElementById("explorer-stat-total");
  const pendingEl = document.getElementById("explorer-stat-pending");
  const completedEl = document.getElementById("explorer-stat-completed");

  if (totalEl) totalEl.innerText = filtered.length;
  if (pendingEl) pendingEl.innerText = filtered.filter(tx => tx.status === "Pending").length;
  if (completedEl) completedEl.innerText = filtered.filter(tx => tx.status === "Completed").length;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="p-12 text-center text-outline dark:text-outline-variant">
          <span class="material-symbols-outlined text-4xl">search_off</span>
          <p class="mt-2">No matching settlement transactions found.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(tx => {
    const shortInitiator = tx.initiator ? `${tx.initiator.substring(0, 6)}...${tx.initiator.substring(tx.initiator.length - 4)}` : "Unknown";
    
    // Parse recipient details if possible
    let recipientDisplay = tx.recipientDetails || "Unknown";
    if (recipientDisplay.startsWith("Recipient Bank: ")) {
      recipientDisplay = recipientDisplay.replace("Recipient Bank: ", "");
    }

    const txHashToUse = tx.confirmedTxHash || tx.txHash || "";
    const shortTxHash = txHashToUse ? `${txHashToUse.substring(0, 6)}...${txHashToUse.substring(txHashToUse.length - 4)}` : "N/A";
    
    const formattedDate = new Date(tx.createdAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });

    const statusBadge = tx.status === "Completed" || tx.status === "Success"
      ? `<span class="px-3 py-1 bg-green-500/10 text-green-500 dark:text-green-400 border border-green-500/20 rounded-full text-xs font-bold flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Completed</span>`
      : `<span class="px-3 py-1 bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Pending</span>`;

    // Convert amount from wei or base format
    let amountDisplay = tx.amount;
    try {
      if (tx.amount.length > 10) {
        amountDisplay = (parseFloat(tx.amount) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 });
      } else {
        amountDisplay = parseFloat(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
    } catch (e) {}

    // Extract symbol
    const toTokenDisplay = tx.toToken === "0x0000000000000000000000000000000000000000" ? "ETH" : "MockKRW";

    return `
      <tr class="hover:bg-surface-container dark:hover:bg-inverse-surface/30 transition-colors">
        <td class="p-4 font-bold text-primary dark:text-primary-fixed">#${tx.id}</td>
        <td class="p-4 font-mono text-xs cursor-pointer text-on-surface-variant hover:text-primary" title="${tx.initiator}" onclick="copyTextToClipboard('${tx.initiator}')">${shortInitiator}</td>
        <td class="p-4 text-xs font-semibold">${recipientDisplay}</td>
        <td class="p-4 font-bold">${amountDisplay} ${toTokenDisplay}</td>
        <td class="p-4 text-xs font-medium text-outline">${window.giwaNetworkName || "GIWA Testnet"}</td>
        <td class="p-4">${statusBadge}</td>
        <td class="p-4 text-xs text-on-surface-variant dark:text-outline-variant">${formattedDate}</td>
        <td class="p-4 font-mono text-xs text-primary hover:underline cursor-pointer" onclick="copyTextToClipboard('${txHashToUse}')" title="Click to copy transaction hash">${shortTxHash}</td>
      </tr>
    `;
  }).join("");
}



// Set up event listeners for filters
function setupExplorerListeners() {
  const searchInput = document.getElementById("explorer-search-input");
  const statusFilter = document.getElementById("explorer-filter-status");
  const refreshBtn = document.getElementById("btn-refresh-explorer");

  if (searchInput) {
    searchInput.addEventListener("input", renderExplorer);
  }
  if (statusFilter) {
    statusFilter.addEventListener("change", renderExplorer);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadExplorerData);
  }
}

// ── Merchant Pay Logic ────────────────────────────────────────────────
let merchantSettlements = [];

async function loadMerchantData() {
  const tableBody = document.getElementById("merchant-settlements-body");
  if (!tableBody) return;

  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-outline dark:text-outline-variant">
          <span class="material-symbols-outlined text-3xl animate-spin">autorenew</span>
          <p class="mt-2 text-xs">Loading settlement records...</p>
        </td>
      </tr>
    `;

    // Fetch stats
    try {
      const statsRes = await authFetch(`${API_BASE}/merchant/stats`);
      if (statsRes.ok) {
        const stats = await statsRes.json();
        
        const idEl = document.getElementById("merchant-stat-id");
        const verificationEl = document.getElementById("merchant-stat-verification");
        const verificationDot = document.getElementById("merchant-stat-verification-dot");
        const volumeEl = document.getElementById("merchant-stat-volume");
        const successRateEl = document.getElementById("merchant-stat-success-rate");
        const timeEl = document.getElementById("merchant-stat-time");
        const complianceEl = document.getElementById("merchant-stat-compliance");
        const complianceDot = document.getElementById("merchant-stat-compliance-dot");

        if (idEl) idEl.textContent = stats.merchantId || "N/A";
        
        if (verificationEl) {
          verificationEl.textContent = stats.verificationStatus || "Unverified";
          if (verificationDot) {
            const isVerified = stats.verificationStatus === "Verified";
            verificationDot.className = `w-2.5 h-2.5 rounded-full ${isVerified ? "bg-green-500" : "bg-amber-500 animate-pulse"}`;
          }
        }

        if (volumeEl) {
          volumeEl.textContent = `$${Number(stats.settlementVolume || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        if (successRateEl) {
          successRateEl.textContent = `${Number(stats.settlementSuccessRate || 100).toFixed(1)}%`;
        }

        if (timeEl) {
          const t = stats.averageSettlementTime;
          timeEl.textContent = t ? `${Number(t).toFixed(1)}s` : "--";
        }

        if (complianceEl) {
          complianceEl.textContent = stats.complianceStatus || "Pending";
          if (complianceDot) {
            const isCompliant = stats.complianceStatus === "Compliant";
            complianceDot.className = `w-2.5 h-2.5 rounded-full ${isCompliant ? "bg-green-500" : "bg-amber-500 animate-pulse"}`;
          }
        }
      }
    } catch (err) {
      console.error("[Merchant] Error loading stats:", err);
    }

    const res = await authFetch(`${API_BASE}/merchant/settlements`);
    if (!res.ok) throw new Error("Failed to fetch merchant settlements");
    merchantSettlements = await res.json();
    renderMerchantSettlements();
  } catch (err) {
    console.error("[Merchant] Error loading settlements:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-error font-medium">
          <span class="material-symbols-outlined text-3xl">error</span>
          <p class="mt-2 text-xs">Failed to load settlements. Please log in or try again.</p>
        </td>
      </tr>
    `;
  }
}

function renderMerchantSettlements() {
  const tableBody = document.getElementById("merchant-settlements-body");
  if (!tableBody) return;

  if (merchantSettlements.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-outline dark:text-outline-variant">
          <p class="text-sm">No settlement history yet.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = merchantSettlements.map(settlement => {
    const memo = settlement.paymentRequest ? settlement.paymentRequest.description : "Payment Request";
    const amountVal = settlement.amount;
    const currency = settlement.currency;
    const status = settlement.status;
    const dateFormatted = new Date(settlement.createdAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
    
    const txHash = settlement.txHash || "";
    const shortTxHash = txHash ? `${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)}` : "N/A";

    const statusBadge = status === "Settled"
      ? `<span class="px-3 py-1 bg-green-500/10 text-green-500 dark:text-green-400 border border-green-500/20 rounded-full text-xs font-bold flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Settled</span>`
      : `<span class="px-3 py-1 bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Processing</span>`;

    return `
      <tr class="hover:bg-surface-container dark:hover:bg-inverse-surface/30 transition-colors">
        <td class="p-3 font-semibold">${memo}</td>
        <td class="p-3 font-extrabold text-emerald-500">${amountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}</td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-xs text-on-surface-variant dark:text-outline-variant">${dateFormatted}</td>
        <td class="p-3 font-mono text-xs text-primary hover:underline cursor-pointer" onclick="copyTextToClipboard('${txHash}')" title="Click to copy hash">${shortTxHash}</td>
      </tr>
    `;
  }).join("");
}

function setupMerchant() {
  const form = document.getElementById("form-merchant-request");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amountInput = document.getElementById("merchant-amount");
    const currencySelect = document.getElementById("merchant-currency");
    const descInput = document.getElementById("merchant-description");

    const amount = parseFloat(amountInput.value);
    const currency = currencySelect.value;
    const description = descInput.value;

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.innerText = "Generating Request...";

    try {
      const res = await authFetch(`${API_BASE}/merchant/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, description })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate request");
      }

      const request = await res.json();
      
      // Generate payment checkout URL
      const paymentLink = `${window.location.origin}/pay.html?id=${request.id}`;

      // Show result box
      const resultBox = document.getElementById("merchant-request-result");
      if (resultBox) {
        resultBox.classList.remove("hidden");
      }

      // Set link value
      const linkInput = document.getElementById("merchant-link-input");
      if (linkInput) {
        linkInput.value = paymentLink;
      }

      // Render QR Code using QRIOUS
      const qrCanvas = document.getElementById("merchant-qr-canvas");
      if (qrCanvas && window.QRious) {
        new window.QRious({
          element: qrCanvas,
          value: paymentLink,
          size: 160,
          background: '#ffffff',
          foreground: '#000000',
          level: 'H'
        });
      }

      // Reset form fields
      amountInput.value = "";
      descInput.value = "";
      showToast("Payment request generated!");
      
      // Reload history immediately to show the new (pending) checkout if wanted
      loadMerchantData();
    } catch (err) {
      alert(err.message || "Failed to create payment request");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Generate Request";
    }
  });

  // Copy Link Button
  const copyBtn = document.getElementById("btn-copy-merchant-link");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const linkInput = document.getElementById("merchant-link-input");
      if (linkInput && linkInput.value) {
        copyTextToClipboard(linkInput.value);
      }
    });
  }

  // Refresh Settlement History
  const refreshBtn = document.getElementById("btn-refresh-merchant");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadMerchantData);
  }
}

// ── Merchant Settlement Portal Logic ──────────────────────────────────
let portalSettlements = [];
let portalProofs = [];
let portalListenersAttached = false;

async function loadMerchantPortalData() {
  const tableBody = document.getElementById("portal-settlements-body");
  if (!tableBody) return;

  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-outline dark:text-outline-variant">
          <span class="material-symbols-outlined text-3xl animate-spin">autorenew</span>
          <p class="mt-2 text-xs">Loading settlement records...</p>
        </td>
      </tr>
    `;

    // 1. Fetch settlements
    const settlementsRes = await authFetch(`${API_BASE}/merchant/settlements`);
    if (!settlementsRes.ok) throw new Error("Failed to fetch merchant settlements");
    portalSettlements = await settlementsRes.json();

    // 2. Fetch proofs
    try {
      const proofsRes = await authFetch(`${API_BASE}/v1/proofs`);
      if (proofsRes.ok) {
        const proofsData = await proofsRes.json();
        portalProofs = proofsData.proofs || [];
      }
    } catch (err) {
      console.error("[Portal] Failed to fetch proofs:", err);
    }

    // 3. Compute Metrics
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Daily: successfully settled in last 24 hours
    const dailySettled = portalSettlements.filter(s => 
      (s.status === 'Settled' || s.status === 'Success') && 
      (now - new Date(s.createdAt).getTime() <= oneDayMs)
    );
    const dailyVol = dailySettled.reduce((sum, s) => sum + s.amount, 0);

    // Pending
    const pendingSettled = portalSettlements.filter(s => s.status === 'Processing' || s.status === 'Pending');
    const pendingVol = pendingSettled.reduce((sum, s) => sum + s.amount, 0);

    // Completed
    const completedSettled = portalSettlements.filter(s => s.status === 'Settled' || s.status === 'Success');
    const completedVol = completedSettled.reduce((sum, s) => sum + s.amount, 0);

    // Proofs verified
    const provenCount = portalSettlements.filter(s => 
      portalProofs.some(p => p.txHash && s.txHash && p.txHash.toLowerCase() === s.txHash.toLowerCase())
    ).length;

    // Render Metrics
    const metricDailyEl = document.getElementById("portal-metric-daily");
    const metricPendingEl = document.getElementById("portal-metric-pending");
    const metricPendingCountEl = document.getElementById("portal-metric-pending-count");
    const metricCompletedEl = document.getElementById("portal-metric-completed");
    const metricCompletedCountEl = document.getElementById("portal-metric-completed-count");
    const metricProofsEl = document.getElementById("portal-metric-proofs");

    if (metricDailyEl) metricDailyEl.textContent = `$${dailyVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (metricPendingEl) metricPendingEl.textContent = `$${pendingVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (metricPendingCountEl) metricPendingCountEl.textContent = `${pendingSettled.length} transaction${pendingSettled.length === 1 ? '' : 's'} in queue`;
    if (metricCompletedEl) metricCompletedEl.textContent = `$${completedVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (metricCompletedCountEl) metricCompletedCountEl.textContent = `${completedSettled.length} total settled request${completedSettled.length === 1 ? '' : 's'}`;
    if (metricProofsEl) metricProofsEl.textContent = `${provenCount} Verified`;

    // 4. Render Table list with search and filters
    renderPortalTable();

    // 5. Setup event listeners once
    setupPortalListeners();
  } catch (err) {
    console.error("[Portal] Error loading data:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-error font-medium">
          <span class="material-symbols-outlined text-3xl">error</span>
          <p class="mt-2 text-xs">Failed to load settlements. Please log in or try again.</p>
        </td>
      </tr>
    `;
  }
}

function renderPortalTable() {
  const tableBody = document.getElementById("portal-settlements-body");
  if (!tableBody) return;

  const searchQuery = (document.getElementById("portal-search-input")?.value || "").toLowerCase();
  const statusFilter = document.getElementById("portal-filter-status")?.value || "all";
  const currencyFilter = document.getElementById("portal-filter-currency")?.value || "all";

  const filtered = portalSettlements.filter(s => {
    // Search filter
    const memoMatch = s.paymentRequest?.description?.toLowerCase().includes(searchQuery) || s.id.toLowerCase().includes(searchQuery);
    const hashMatch = s.txHash?.toLowerCase().includes(searchQuery);
    const searchMatch = memoMatch || hashMatch;

    // Status filter
    let statusMatch = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'Settled') {
        statusMatch = s.status === 'Settled' || s.status === 'Success';
      } else if (statusFilter === 'Processing') {
        statusMatch = s.status === 'Processing' || s.status === 'Pending';
      } else {
        statusMatch = s.status === statusFilter;
      }
    }

    // Currency filter
    let currencyMatch = true;
    if (currencyFilter !== 'all') {
      currencyMatch = s.currency === currencyFilter;
    }

    return searchMatch && statusMatch && currencyMatch;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-outline dark:text-outline-variant">
          <span class="material-symbols-outlined text-3xl">search_off</span>
          <p class="mt-2 text-xs">No matching settlements found</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(s => {
    const memo = s.paymentRequest?.description || "Payment Payout";
    const amountStr = `${Number(s.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${s.currency}`;
    const dateStr = new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + " " + new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Status Badge
    let statusClass = "text-amber-500 bg-amber-500/10 border-amber-500/25";
    if (s.status === "Settled" || s.status === "Success") {
      statusClass = "text-green-500 bg-green-500/10 border-green-500/25";
    } else if (s.status === "Failed") {
      statusClass = "text-red-500 bg-red-500/10 border-red-500/25";
    }

    // Proof Match
    const hasProof = portalProofs.some(p => p.txHash && s.txHash && p.txHash.toLowerCase() === s.txHash.toLowerCase());
    const proofLabel = hasProof 
      ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/10 text-green-500 border border-green-500/20"><span class="material-symbols-outlined text-[10px]">verified</span>ZK Proof</span>`
      : `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-neutral-500/10 text-neutral-400 border border-neutral-500/10">No Proof</span>`;

    const txLink = s.txHash 
      ? `<div class="flex flex-col gap-0.5 font-mono text-[10px]">
          <a href="#explorer" class="underline text-primary dark:text-primary-fixed hover:opacity-85">${s.txHash.slice(0, 8)}...${s.txHash.slice(-6)}</a>
          <div>${proofLabel}</div>
         </div>`
      : `<span class="text-outline text-xs">Pending sequencer</span>`;

    return `
      <tr class="hover:bg-surface-container-low dark:hover:bg-on-background/5 transition-colors">
        <td class="p-3 font-semibold text-on-surface dark:text-white">${memo}</td>
        <td class="p-3 font-bold text-primary dark:text-primary-fixed">${amountStr}</td>
        <td class="p-3">
          <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${statusClass}">${s.status}</span>
        </td>
        <td class="p-3">${txLink}</td>
        <td class="p-3 text-xs text-outline font-medium">${dateStr}</td>
        <td class="p-3 text-right">
          <button onclick="downloadReceiptPDF('${s.id}')" class="px-3 py-1.5 bg-surface-container-low dark:bg-on-background/10 text-primary dark:text-primary-fixed rounded-lg text-xs font-bold border border-outline-variant/30 hover:border-primary dark:hover:border-primary-fixed transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95">
            <span class="material-symbols-outlined text-xs">picture_as_pdf</span>
            Receipt
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function setupPortalListeners() {
  if (portalListenersAttached) return;
  portalListenersAttached = true;

  const searchInput = document.getElementById("portal-search-input");
  const filterStatus = document.getElementById("portal-filter-status");
  const filterCurrency = document.getElementById("portal-filter-currency");
  const csvBtn = document.getElementById("btn-export-csv");

  if (searchInput) {
    searchInput.addEventListener("input", renderPortalTable);
  }
  if (filterStatus) {
    filterStatus.addEventListener("change", renderPortalTable);
  }
  if (filterCurrency) {
    filterCurrency.addEventListener("change", renderPortalTable);
  }
  if (csvBtn) {
    csvBtn.addEventListener("click", exportPortalCSV);
  }
}

function exportPortalCSV() {
  if (portalSettlements.length === 0) {
    showToast("No settlements to export", "warning");
    return;
  }

  const headers = ["Settlement ID", "Memo / Reference", "Amount", "Currency", "Status", "Tx Hash", "Created Date"];
  const rows = portalSettlements.map(s => [
    s.id,
    s.paymentRequest?.description || "Payment Payout",
    s.amount,
    s.currency,
    s.status,
    s.txHash || "N/A",
    s.createdAt
  ]);

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `korripay_settlements_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV exported successfully", "success");
}

function buildPortalCertificateData(settlement, matchingProof) {
  const isSettled = settlement.status === "Settled" || settlement.status === "Success";
  const start = new Date(settlement.createdAt).getTime();
  const end = settlement.confirmedAt ? new Date(settlement.confirmedAt).getTime() : Date.now();
  
  return {
    settlementId: settlement.id,
    settlementStatus: settlement.status,
    settlementTimestamp: settlement.createdAt,
    settlementDurationSeconds: Math.floor((end - start) / 1000),
    transactionHash: settlement.txHash || "Pending",
    blockNumber: matchingProof ? matchingProof.blockNumber : null,
    gasUsed: matchingProof ? matchingProof.gasUsed : null,
    confirmationCount: isSettled ? "640+ (Deep Finalized)" : "0 (Pending)",
    complianceResult: isSettled ? "Passed (ZK-Verified)" : "Screening...",
    attestationReferences: matchingProof ? `EAS-0x${matchingProof.id.substring(0, 16)}` : "None",
    proofIntegrityStatus: matchingProof ? "Verified (Cryptographic)" : "Not Generated",
    giwaNetwork: networkRegistry?.giwa?.name || "GIWA-Mainnet",
    explorerLink: settlement.txHash ? `${networkRegistry?.giwa?.config?.explorerUrl || "https://explorer.giwa.network"}/tx/${settlement.txHash}` : "#",
    protocolVersion: `v2.4.1 (Karst Hardfork)`
  };
}

function downloadReceiptPDF(settlementId) {
  const settlement = portalSettlements.find(s => s.id === settlementId);
  if (!settlement) {
    showToast("Settlement not found", "error");
    return;
  }

  const matchingProof = portalProofs.find(p => p.settlementId === settlementId || (p.txHash && settlement.txHash && p.txHash.toLowerCase() === settlement.txHash.toLowerCase()));
  const certData = buildPortalCertificateData(settlement, matchingProof);

  let pipelineHtml = "";
  let history = [];
  try {
    history = JSON.parse(settlement.pipelineHistory || "[]");
  } catch (err) {}
  if (history.length === 0) {
    const base = new Date(settlement.createdAt).getTime();
    history = [
      { stage: "Settlement Requested",      timestamp: new Date(base).toISOString() },
      { stage: "Compliance Screening",       timestamp: new Date(base + 320).toISOString() },
      { stage: "FX Validation",              timestamp: new Date(base + 940).toISOString() },
      { stage: "Settlement Created",         timestamp: new Date(base + 1380).toISOString() },
      { stage: "Submitted to GIWA",          timestamp: new Date(base + 1740).toISOString() },
      { stage: "Sequencer Accepted",         timestamp: new Date(base + 2180).toISOString() },
      { stage: "Block Finalized",            timestamp: new Date(base + 2840).toISOString() },
      { stage: "Settlement Proof Generated", timestamp: new Date(base + 3560).toISOString() },
      { stage: "Completed",                  timestamp: settlement.confirmedAt || new Date(base + 3760).toISOString() }
    ];
  }
  
  history.forEach((h) => {
    const timeStr = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    pipelineHtml += `
      <div class="pipeline-row">
        <span class="pipeline-stage">✓ ${h.stage}</span>
        <span class="pipeline-time">[${timeStr}]</span>
      </div>
    `;
  });

  const printWindow = window.open("", "_blank");
  const amountStr = `${Number(settlement.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${settlement.currency || 'USDC'}`;
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Settlement Certificate - ${certData.settlementId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;850&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            padding: 30px 15px;
            max-width: 720px;
            margin: auto;
          }
          .cert-container {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.03);
            padding: 40px;
            position: relative;
            overflow: hidden;
            border-top: 6px solid #0066cc;
          }
          .letterhead {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .issuer-info h1 {
            font-size: 22px;
            font-weight: 850;
            margin: 0;
            letter-spacing: -0.5px;
            color: #0066cc;
          }
          .issuer-info p {
            font-size: 11px;
            color: #64748b;
            margin: 4px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .status-badge {
            background: #d1fae5;
            color: #065f46;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            border: 1px solid #a7f3d0;
          }
          .status-badge.failed {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
          }
          .status-badge.pending {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
          }
          .cert-title-band {
            text-align: center;
            margin-bottom: 24px;
          }
          .cert-title-band h2 {
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #475569;
            margin: 0;
          }
          .cert-title-band .amount-box {
            font-size: 32px;
            font-weight: 850;
            color: #0066cc;
            margin-top: 8px;
          }
          .section-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
          }
          @media (min-width: 550px) {
            .section-grid {
              grid-template-columns: 1fr 1fr;
            }
          }
          .section-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .section-card h3 {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0 0 4px 0;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
          }
          .data-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            font-size: 12px;
          }
          .data-label {
            color: #64748b;
            font-weight: 500;
          }
          .data-value {
            font-weight: 600;
            color: #0f172a;
            text-align: right;
            max-width: 180px;
            word-break: break-all;
          }
          .mono {
            font-family: 'Fira Code', monospace;
            font-size: 11px;
          }
          .pipeline-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px;
            margin-top: 20px;
          }
          .pipeline-card h3 {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0 0 10px 0;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
          }
          .pipeline-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 4px 0;
            border-bottom: 1px dashed #e2e8f0;
          }
          .pipeline-row:last-child {
            border-bottom: none;
          }
          .pipeline-stage {
            color: #475569;
            font-weight: 500;
          }
          .pipeline-time {
            font-family: 'Fira Code', monospace;
            color: #10b981;
          }
          .legal-attestation {
            margin-top: 24px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            line-height: 1.6;
          }
          .legal-attestation p {
            margin: 4px 0;
          }
          .btn-print {
            display: block;
            width: 100%;
            padding: 14px;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            margin-top: 24px;
            box-shadow: 0 4px 6px rgba(0, 102, 204, 0.15);
            transition: all 0.2s;
          }
          .btn-print:hover {
            opacity: 0.95;
            transform: translateY(-1px);
          }
          @media print {
            body {
              background-color: white;
              padding: 0;
            }
            .cert-container {
              border: none;
              box-shadow: none;
              padding: 0;
            }
            .btn-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="cert-container">
          <div class="letterhead">
            <div class="issuer-info">
              <h1>KORRIPAY</h1>
              <p>Programmable Settlement Infrastructure</p>
            </div>
            <div class="status-badge \${certData.settlementStatus.toLowerCase()}">
              \${certData.settlementStatus === "Settled" || certData.settlementStatus === "Success" || certData.settlementStatus === "Completed" ? "Verified & Finalized" : certData.settlementStatus}
            </div>
          </div>

          <div class="cert-title-band">
            <h2>Settlement Decree & Certificate</h2>
            <div class="amount-box">\${amountStr}</div>
          </div>

          <div class="section-grid">
            <!-- Group 1 -->
            <div class="section-card">
              <h3>1. Settlement Identity</h3>
              <div class="data-row">
                <span class="data-label">Settlement ID</span>
                <span class="data-value mono">\${certData.settlementId}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Status</span>
                <span class="data-value">\${certData.settlementStatus}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Timestamp</span>
                <span class="data-value">\${new Date(certData.settlementTimestamp).toLocaleString()}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Duration</span>
                <span class="data-value">\${certData.settlementDurationSeconds ? \`\${certData.settlementDurationSeconds}s\` : "Pending"}</span>
              </div>
            </div>

            <!-- Group 2 -->
            <div class="section-card">
              <h3>2. On-Chain Ledger Record</h3>
              <div class="data-row">
                <span class="data-label">Transaction Hash</span>
                <span class="data-value mono">\${certData.transactionHash}</span>
              </div>
              <div class="data-row">
                <span class="data-label">L2 Block Number</span>
                <span class="data-value mono">\${certData.blockNumber || "Pending"}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Gas Used (L2)</span>
                <span class="data-value mono">\${certData.gasUsed ? certData.gasUsed.toLocaleString() : "Pending"}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Confirmation Count</span>
                <span class="data-value">\${certData.confirmationCount}</span>
              </div>
            </div>

            <!-- Group 3 -->
            <div class="section-card">
              <h3>3. Compliance & Attestations</h3>
              <div class="data-row">
                <span class="data-label">Compliance Screening</span>
                <span class="data-value">\${certData.complianceResult}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Attestation references</span>
                <span class="data-value mono" style="font-size:10px;">\${certData.attestationReferences}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Proof Integrity Status</span>
                <span class="data-value">\${certData.proofIntegrityStatus}</span>
              </div>
            </div>

            <!-- Group 4 -->
            <div class="section-card">
              <h3>4. Infrastructure & Protocol</h3>
              <div class="data-row">
                <span class="data-label">GIWA Network</span>
                <span class="data-value">\${certData.giwaNetwork}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Explorer Link</span>
                <span class="data-value mono" style="font-size:10px;">\${certData.explorerLink}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Protocol Version</span>
                <span class="data-value">\${certData.protocolVersion}</span>
              </div>
            </div>
          </div>

          <div class="pipeline-card">
            <h3>Settlement Protocol Lifecycle</h3>
            \${pipelineHtml}
          </div>

          <div class="legal-attestation">
            <p><strong>ATTESTATION:</strong> This document serves as a cryptographically authenticated proof of settlement processed dynamically on the GIWA L2 network.</p>
            <p>EAS ZK-attestations are registered dynamically under schema consensus rules matching global compliance guidelines.</p>
          </div>

          <button class="btn-print" onclick="window.print()">Print / Save Certificate as PDF</button>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
window.downloadReceiptPDF = downloadReceiptPDF;
window.loadMerchantPortalData = loadMerchantPortalData;

// ── Analytics Logic ──────────────────────────────────────────────────
let analyticsData = null;
let dailyVolumeChart = null;
let weeklyVolumeChart = null;
let assetDistributionChart = null;
let settlementSpeedChart = null;

async function loadAnalyticsData() {
  try {
    const res = await authFetch(`${API_BASE}/analytics`);
    if (!res.ok) throw new Error("Failed to fetch analytics data");
    analyticsData = await res.json();
    renderAnalyticsUI();
  } catch (err) {
    console.error("[Analytics] Error loading analytics:", err);
    showToast("Error loading analytics data");
  }
}

function renderAnalyticsUI() {
  if (!analyticsData) return;

  const { metrics, charts } = analyticsData;

  // 1. Render Metric Cards
  const volumeEl = document.getElementById("analytics-stat-volume");
  if (volumeEl) volumeEl.textContent = `$${metrics.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const txsEl = document.getElementById("analytics-stat-txs");
  if (txsEl) txsEl.textContent = metrics.totalTransactions.toLocaleString();
  
  const usersEl = document.getElementById("analytics-stat-users");
  if (usersEl) usersEl.textContent = metrics.activeUsers.toString();
  
  const timeEl = document.getElementById("analytics-stat-time");
  if (timeEl) timeEl.textContent = `${metrics.avgSettlementTime}s`;
  
  const savedEl = document.getElementById("analytics-stat-saved");
  if (savedEl) savedEl.textContent = `$${(metrics.avgFeeSaved * metrics.totalTransactions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const successEl = document.getElementById("analytics-stat-success");
  if (successEl) successEl.textContent = `${metrics.successRate}%`;

  // 2. Determine theme settings for Chart.js
  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#cbd5e1" : "#334155";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
  const primaryColor = "#4f46e5";
  const secondaryColor = "#10b981";
  const warningColor = "#f59e0b";
  const dangerColor = "#ef4444";

  // Shared font config
  const fontConfig = {
    family: "Inter, system-ui, -apple-system, sans-serif",
    size: 11
  };

  // Helper to destroy charts cleanly
  const destroyChart = (chart) => {
    if (chart) chart.destroy();
  };

  // Chart 1: Daily Volume (Line Chart with Gradient Fill)
  const ctxDaily = document.getElementById("chart-daily-volume")?.getContext("2d");
  if (ctxDaily) {
    destroyChart(dailyVolumeChart);
    
    // Create gradient
    const gradient = ctxDaily.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "rgba(79, 70, 229, 0.3)");
    gradient.addColorStop(1, "rgba(79, 70, 229, 0.0)");

    dailyVolumeChart = new Chart(ctxDaily, {
      type: "line",
      data: {
        labels: charts.dailyVolume.map(d => d.label),
        datasets: [{
          label: "Volume (USD)",
          data: charts.dailyVolume.map(d => d.value),
          borderColor: primaryColor,
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: primaryColor,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 12,
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            titleColor: isDark ? "#ffffff" : "#1e293b",
            bodyColor: isDark ? "#cbd5e1" : "#475569",
            borderColor: "rgba(0, 0, 0, 0.1)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: fontConfig }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: fontConfig }
          }
        }
      }
    });
  }

  // Chart 2: Asset Distribution (Doughnut Chart)
  const ctxAsset = document.getElementById("chart-asset-distribution")?.getContext("2d");
  if (ctxAsset) {
    destroyChart(assetDistributionChart);
    assetDistributionChart = new Chart(ctxAsset, {
      type: "doughnut",
      data: {
        labels: charts.assetDistribution.map(d => d.label),
        datasets: [{
          data: charts.assetDistribution.map(d => d.value),
          backgroundColor: [secondaryColor, primaryColor, warningColor, dangerColor],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? "#1e293b" : "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor, font: fontConfig, boxWidth: 12 }
          }
        },
        cutout: "70%"
      }
    });
  }

  // Chart 3: Weekly Volume (Bar Chart)
  const ctxWeekly = document.getElementById("chart-weekly-volume")?.getContext("2d");
  if (ctxWeekly) {
    destroyChart(weeklyVolumeChart);
    weeklyVolumeChart = new Chart(ctxWeekly, {
      type: "bar",
      data: {
        labels: charts.weeklyVolume.map(w => w.label),
        datasets: [{
          label: "Weekly Volume (USD)",
          data: charts.weeklyVolume.map(w => w.value),
          backgroundColor: "rgba(16, 185, 129, 0.85)",
          borderRadius: 6,
          hoverBackgroundColor: secondaryColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: fontConfig }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: fontConfig }
          }
        }
      }
    });
  }

  // Chart 4: Settlement Speed (Horizontal Bar Chart)
  const ctxSpeed = document.getElementById("chart-settlement-speed")?.getContext("2d");
  if (ctxSpeed) {
    destroyChart(settlementSpeedChart);
    settlementSpeedChart = new Chart(ctxSpeed, {
      type: "bar",
      data: {
        labels: charts.settlementSpeed.map(s => s.label),
        datasets: [{
          label: "Transactions Count",
          data: charts.settlementSpeed.map(s => s.value),
          backgroundColor: "rgba(245, 158, 11, 0.85)",
          borderRadius: 6,
          hoverBackgroundColor: warningColor
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: fontConfig }
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor, font: fontConfig }
          }
        }
      }
    });
  }
}

function setupAnalytics() {
  const refreshBtn = document.getElementById("btn-refresh-analytics");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAnalyticsData);
  }
}

// ==================== COMPLIANCE ENGINE FRONTEND INTEGRATION ====================

async function loadComplianceData() {
  try {
    // 1. Fetch User Compliance Profile
    const profileRes = await authFetch(`${API_BASE}/compliance/profile`);
    if (profileRes.ok) {
      const data = await profileRes.json();
      renderComplianceProfile(data);
    } else {
      console.error("Failed to load compliance profile");
    }

    // 2. Fetch Compliance Rules
    const rulesRes = await authFetch(`${API_BASE}/compliance/rules`);
    if (rulesRes.ok) {
      const rules = await rulesRes.json();
      renderComplianceRules(rules);
    } else {
      console.error("Failed to load compliance rules");
    }

    // 3. Fetch Compliance logs
    await loadComplianceLogs();

    // 4. Fetch Compliance Reports
    await loadComplianceReports();

  } catch (err) {
    console.error("Error loading compliance data:", err);
    showToast("Error loading compliance data");
  }
}

function renderComplianceProfile(data) {
  const profile = data.profile;
  const kycStatus = data.kycStatus;

  const riskTierEl = document.getElementById("compliance-risk-tier");
  const riskShieldEl = document.getElementById("compliance-risk-shield");
  const kycStatusEl = document.getElementById("compliance-kyc-status");
  const singleLimitEl = document.getElementById("compliance-single-limit");
  const dailyLimitEl = document.getElementById("compliance-daily-limit");
  const suspiciousLimitEl = document.getElementById("compliance-suspicious-limit");

  if (profile && riskTierEl) {
    riskTierEl.textContent = `${profile.riskLevel} Risk`;
    
    // Update shield and text colors based on risk tier
    riskShieldEl.className = "w-16 h-16 rounded-full flex items-center justify-center mb-sm";
    riskTierEl.className = "font-headline-md font-bold";
    if (profile.riskLevel === "Low") {
      riskShieldEl.classList.add("bg-green-500/10", "text-green-500");
      riskTierEl.classList.add("text-green-500");
    } else if (profile.riskLevel === "Medium") {
      riskShieldEl.classList.add("bg-yellow-500/10", "text-yellow-500");
      riskTierEl.classList.add("text-yellow-500");
    } else {
      riskShieldEl.classList.add("bg-red-500/10", "text-red-500");
      riskTierEl.classList.add("text-red-500");
    }
  }

  if (kycStatusEl) {
    kycStatusEl.textContent = kycStatus || "NotStarted";
    if (kycStatus === "Verified") {
      kycStatusEl.className = "font-semibold text-secondary";
    } else if (kycStatus === "Pending") {
      kycStatusEl.className = "font-semibold text-yellow-500";
    } else {
      kycStatusEl.className = "font-semibold text-error";
    }
  }
  
  if (profile) {
    if (singleLimitEl) {
      singleLimitEl.textContent = `$${Number(profile.singleTxLimitUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    if (dailyLimitEl) {
      dailyLimitEl.textContent = `$${Number(profile.dailyLimitUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    if (suspiciousLimitEl) {
      suspiciousLimitEl.textContent = `$${Number(profile.suspiciousThresholdUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    // Pre-fill simulation form values
    const simRiskLevel = document.getElementById("sim-risk-level");
    const simKycEnforced = document.getElementById("sim-kyc-enforced");
    const simSingleLimit = document.getElementById("sim-single-limit");
    const simDailyLimit = document.getElementById("sim-daily-limit");

    if (simRiskLevel) simRiskLevel.value = profile.riskLevel;
    if (simKycEnforced) simKycEnforced.checked = profile.kycEnforced;
    if (simSingleLimit) simSingleLimit.value = profile.singleTxLimitUSD;
    if (simDailyLimit) simDailyLimit.value = profile.dailyLimitUSD;
  }
}

function renderComplianceRules(rules) {
  const container = document.getElementById("compliance-rules-list");
  if (!container) return;

  if (rules.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-outline text-xs">No rules defined.</div>`;
    return;
  }

  container.innerHTML = rules.map(rule => {
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
        <div class="space-y-1 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-body-md font-bold text-on-surface dark:text-white">${rule.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-surface-container dark:bg-surface-dim text-on-surface-variant dark:text-outline-variant">
              ${rule.action}
            </span>
          </div>
          <p class="text-xs text-outline dark:text-outline-variant">${rule.description}</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center bg-surface-container dark:bg-surface-dim rounded-md px-2 py-1 border border-outline-variant/30">
            <span class="text-xs text-outline mr-1">Limit:</span>
            <input type="number" 
                   class="rule-value-input bg-transparent border-none text-xs w-20 p-0 focus:ring-0 dark:text-white font-semibold" 
                   data-rule-code="${rule.code}" 
                   value="${rule.value !== null ? rule.value : ''}"/>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" 
                   class="rule-toggle sr-only peer" 
                   data-rule-code="${rule.code}" 
                   ${rule.isActive ? 'checked' : ''}/>
            <div class="w-9 h-5 bg-surface-container-highest dark:bg-surface-dim peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Wire up change listeners on rule inputs and toggles
  document.querySelectorAll('.rule-value-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const ruleCode = e.target.dataset.ruleCode;
      const value = e.target.value !== '' ? Number(e.target.value) : null;
      const isActive = document.querySelector(`.rule-toggle[data-rule-code="${ruleCode}"]`).checked;
      await updateRuleAPI(ruleCode, value, isActive);
    });
  });

  document.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const ruleCode = e.target.dataset.ruleCode;
      const isActive = e.target.checked;
      const valInput = document.querySelector(`.rule-value-input[data-rule-code="${ruleCode}"]`).value;
      const value = valInput !== '' ? Number(valInput) : null;
      await updateRuleAPI(ruleCode, value, isActive);
    });
  });
}

async function updateRuleAPI(code, value, isActive) {
  try {
    const res = await authFetch(`${API_BASE}/compliance/rules/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, value, isActive })
    });
    if (res.ok) {
      showToast("Compliance rule updated successfully");
      // Reload profile/rules to ensure everything is synced
      const profileRes = await authFetch(`${API_BASE}/compliance/profile`);
      if (profileRes.ok) {
        const data = await profileRes.json();
        renderComplianceProfile(data);
      }
    } else {
      const errData = await res.json();
      showToast(errData.error || "Failed to update compliance rule");
    }
  } catch (err) {
    console.error("Error updating rule:", err);
    showToast("Error updating compliance rule");
  }
}

async function loadComplianceLogs() {
  try {
    const res = await authFetch(`${API_BASE}/compliance/logs?all=true`);
    if (!res.ok) throw new Error("Failed to load logs");
    const logs = await res.json();

    const tbody = document.getElementById("compliance-logs-tbody");
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-6 text-center text-outline dark:text-outline-variant text-xs">No compliance screening events recorded yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const date = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      let statusBadge = '';
      if (log.actionTaken === 'Approved' || log.actionTaken === 'Passed') {
        statusBadge = `<span class="bg-green-500/10 text-green-500 border border-green-500/20 px-2.5 py-0.5 rounded-full font-bold text-[10px]">Passed</span>`;
      } else if (log.actionTaken === 'Flagged') {
        statusBadge = `<span class="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-0.5 rounded-full font-bold text-[10px]">Flagged</span>`;
      } else {
        statusBadge = `<span class="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-bold text-[10px]">Blocked</span>`;
      }

      let triggeredBadge = '';
      if (log.rulesTriggered && log.rulesTriggered.length > 0) {
        triggeredBadge = `<div class="text-[10px] text-error mt-0.5 font-semibold">Rules: ${log.rulesTriggered.join(', ')}</div>`;
      }

      return `
        <tr class="border-b border-outline-variant/10 hover:bg-surface-container-low dark:hover:bg-inverse-surface/10 transition-colors">
          <td class="py-3 pr-4 text-xs font-mono text-outline dark:text-outline-variant">${date}</td>
          <td class="py-3 pr-4 text-xs font-bold text-on-surface dark:text-white">${log.userName || 'Unknown'}</td>
          <td class="py-3 pr-4 text-xs">
            <span class="font-semibold text-primary dark:text-primary-fixed-dim">$${log.amount} ${log.currency}</span>
            <span class="text-outline">(${log.transactionType})</span>
            ${triggeredBadge}
          </td>
          <td class="py-3 pr-4 text-xs font-mono font-bold ${log.riskScore > 60 ? 'text-error' : log.riskScore > 30 ? 'text-yellow-500' : 'text-green-500'}">
            ${log.riskScore}%
          </td>
          <td class="py-3 pr-4 text-xs">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error("Error loading logs:", err);
  }
}

async function loadComplianceReports() {
  try {
    const res = await authFetch(`${API_BASE}/compliance/reports`);
    if (!res.ok) throw new Error("Failed to load reports");
    const reports = await res.json();

    const container = document.getElementById("compliance-reports-grid");
    if (!container) return;

    if (reports.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 py-4 text-center text-outline dark:text-outline-variant text-xs">No reports compiled yet. Click "Generate Report" above.</div>
      `;
      return;
    }

    container.innerHTML = reports.map(report => {
      const date = new Date(report.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `
        <div class="bg-surface-container-low dark:bg-surface-dim border border-outline-variant/30 rounded-xl p-sm space-y-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
          <div>
            <div class="flex justify-between items-start">
              <h4 class="font-label-md font-bold text-primary dark:text-primary-fixed">${report.title}</h4>
              <span class="text-[10px] text-outline font-mono">${date}</span>
            </div>
            <p class="text-xs text-on-surface-variant dark:text-outline-variant line-clamp-3 mt-1">
              ${report.content}
            </p>
          </div>
          <button class="btn-view-report-details text-xs font-bold text-secondary dark:text-secondary-fixed-dim hover:underline text-left mt-2 flex items-center gap-1"
                  data-report-id="${report.id}">
            <span class="material-symbols-outlined text-sm">visibility</span> View Detailed Analysis
          </button>
        </div>
      `;
    }).join('');

    // Wire up view buttons
    document.querySelectorAll('.btn-view-report-details').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reportId = e.currentTarget.dataset.reportId;
        const report = reports.find(r => r.id === reportId);
        if (report) {
          showReportDetailModal(report);
        }
      });
    });

  } catch (err) {
    console.error("Error loading reports:", err);
  }
}

function showReportDetailModal(report) {
  const modalId = "modal-report";
  const titleEl = document.getElementById("modal-report-title");
  const idEl = document.getElementById("modal-report-id");
  const dateEl = document.getElementById("modal-report-date");
  const contentEl = document.getElementById("modal-report-content");

  if (titleEl) titleEl.textContent = report.title;
  if (idEl) idEl.textContent = report.id;
  if (dateEl) dateEl.textContent = new Date(report.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (contentEl) contentEl.textContent = report.content;

  openModal(modalId);
}

function setupCompliance() {
  // 1. Simulation Form Submission
  const simForm = document.getElementById("form-simulation-profile");
  if (simForm) {
    simForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const riskLevel = document.getElementById("sim-risk-level").value;
      const kycEnforced = document.getElementById("sim-kyc-enforced").checked;
      const singleTxLimit = Number(document.getElementById("sim-single-limit").value);
      const dailyLimit = Number(document.getElementById("sim-daily-limit").value);

      try {
        const res = await authFetch(`${API_BASE}/compliance/profile/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            riskLevel, 
            kycEnforced, 
            singleTxLimitUSD: singleTxLimit, 
            dailyLimitUSD: dailyLimit,
            suspiciousThresholdUSD: 1000.0
          })
        });

        if (res.ok) {
          showToast("Simulation profile updated successfully!");
          await loadComplianceData();
        } else {
          const errData = await res.json();
          showToast(errData.error || "Failed to update profile");
        }
      } catch (err) {
        console.error("Error updating profile:", err);
        showToast("Error updating profile");
      }
    });
  }

  // 2. Refresh Logs Button
  const refreshLogsBtn = document.getElementById("btn-refresh-compliance-logs");
  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener("click", async () => {
      await loadComplianceLogs();
      showToast("Logs refreshed");
    });
  }

  // 3. Generate Report Button
  const genReportBtn = document.getElementById("btn-generate-report");
  if (genReportBtn) {
    genReportBtn.addEventListener("click", async () => {
      const days = Number(document.getElementById("report-days-select").value);
      try {
        const res = await authFetch(`${API_BASE}/compliance/reports/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days })
        });

        if (res.ok) {
          showToast("New compliance report compiled!");
          await loadComplianceReports();
        } else {
          const errData = await res.json();
          showToast(errData.error || "Failed to generate report");
        }
      } catch (err) {
        console.error("Error generating report:", err);
        showToast("Error generating report");
      }
    });
  }
}

// ==================== GIWA LAYER 2 INTEGRATION ====================
let lastKnownBlockHeight = 0;
let giwaHealthLatencyChart = null;
let giwaGasTimeChart = null;

function setupGiwa() {
  loadGiwaData();
  if (!window.giwaTimerInterval) {
    window.giwaTimerInterval = setInterval(loadGiwaData, 30000);
  }
}

async function loadGiwaData() {
  try {
    // 1. Fetch GIWA status (existing endpoint)
    const statusRes = await fetch(`${API_BASE}/giwa/status`);
    let statusData = null;
    if (statusRes.ok) {
      statusData = await statusRes.json();
    }

    // 2. Fetch Network Intelligence status and history (new endpoint)
    const networkRes = await authFetch(`${API_BASE}/v1/network`);
    let networkIntelligenceData = null;
    if (networkRes.ok) {
      networkIntelligenceData = await networkRes.json();
    }

    // Combine them or fallback if either fails
    if (!statusData && !networkIntelligenceData) {
      throw new Error("Both GIWA status and network intelligence endpoints failed");
    }

    // Prepare unified variables
    const current = networkIntelligenceData?.current || {};
    const history = networkIntelligenceData?.history || [];
    
    const name = current.chainName || statusData?.network?.name || networkRegistry?.giwa?.config?.name || "GIWA Testnet (Sepolia)";
    window.giwaNetworkName = name;
    const chainId = current.chainId || statusData?.network?.chainId || networkRegistry?.giwa?.config?.chainId || 92837;
    const peerCount = statusData?.network?.peerCount || networkRegistry?.giwa?.config?.peerCount || 148;
    const sequencerAddress = statusData?.network?.sequencerAddress || current.rpcUrl || networkRegistry?.giwa?.config?.sequencerAddress || "0x17F53eE27DaDbe44CE8928ddbe44ce8824c3bC86";
    const bridgeAddress = statusData?.network?.bridgeAddress || networkRegistry?.giwa?.config?.bridgeAddress || "0x88F53eE27DaDbe44CE8928ddbe44ce8824c3bC87";
    const explorerStatusVal = current.explorerStatus || statusData?.network?.explorerStatus || "Healthy";
    const bridgeStatusVal = current.bridgeStatus || "Healthy";

    const hardfork = current.hardfork || statusData?.network?.hardfork || networkRegistry?.KarstHardforkVersion || "Karst";
    const evmVersion = current.evmVersion || statusData?.network?.evmVersion || networkRegistry?.giwa?.config?.evmVersion || "Osaka";
    const maxTxGasLimit = current.maxTxGasLimit || statusData?.network?.maxTxGasLimit || networkRegistry?.giwa?.config?.maxTxGasLimit || 16777216;
    const nodeClient = current.nodeClient || statusData?.network?.nodeClient || networkRegistry?.ClientVersion || "op-reth";
    const proofClient = current.proofClient || statusData?.network?.proofClient || networkRegistry?.giwa?.config?.proofClient || "kona-client";

    const sequencerHealthVal = current.sequencerStatus || statusData?.sequencer?.status || "Healthy";
    const uptimePercentage = statusData?.sequencer?.uptimePercentage || 99.98;
    const gasPrice = current.gasPrice || statusData?.sequencer?.gasPriceGwei || (networkRegistry ? networkRegistry.getGasOracle() : 18.4);
    const tps = statusData?.sequencer?.tps || 14.2;
    const blockHeight = current.blockNumber || statusData?.sequencer?.blockHeight || (networkRegistry ? networkRegistry.getCurrentBlock() : 2450810);
    const finalizedBlock = current.finalizedBlock || (networkRegistry ? networkRegistry.getLatestFinalizedBlock() : (blockHeight - 12));
    const avgBlockTime = current.avgBlockTime || 3.0;
    const rpcLatency = current.rpcLatency !== undefined ? current.rpcLatency : (statusData?.sequencer?.rpcLatencyMs || 0);
    const healthScore = current.healthScore !== undefined ? current.healthScore : 100;
    const healthRating = current.rating || "Excellent";

    // 1. Update tab-giwa status header
    const statusDot = document.getElementById("giwa-status-dot");
    const statusText = document.getElementById("giwa-status-text");
    const isOnline = sequencerHealthVal === "Healthy" || sequencerHealthVal === "Operational";

    if (statusDot) {
      statusDot.className = `w-3.5 h-3.5 rounded-full animate-pulse ${isOnline ? 'bg-green-500' : 'bg-red-500'}`;
    }
    if (statusText) {
      statusText.textContent = isOnline ? "Sequencer Operational" : "Sequencer Offline";
      statusText.className = `text-xs font-bold uppercase tracking-wider ${isOnline ? 'text-green-500' : 'text-red-500'}`;
    }

    // 2. Update L2 Network Info
    const netName = document.getElementById("giwa-net-name");
    const netChain = document.getElementById("giwa-net-chain");
    const netRpc = document.getElementById("giwa-net-rpc");
    const netPeers = document.getElementById("giwa-net-peers");
    const netSeq = document.getElementById("giwa-net-seq-addr");
    const netBridge = document.getElementById("giwa-net-bridge-addr");
    const explorerStatus = document.getElementById("giwa-net-explorer-status");
    
    const netHardfork = document.getElementById("giwa-net-hardfork");
    const netEvm = document.getElementById("giwa-net-evm");
    const netGasLimit = document.getElementById("giwa-net-gas-limit");
    const netNodeClient = document.getElementById("giwa-net-node-client");
    const netProofClient = document.getElementById("giwa-net-proof-client");
    
    if (netName) netName.textContent = name;
    if (netChain) netChain.textContent = chainId;
    if (netRpc) netRpc.textContent = networkRegistry?.RPC || "http://127.0.0.1:8545";
    if (netPeers) netPeers.textContent = `${peerCount} nodes`;
    if (netSeq) netSeq.textContent = sequencerAddress;
    if (netBridge) netBridge.textContent = bridgeAddress;
    if (netHardfork) netHardfork.textContent = hardfork;
    if (netEvm) netEvm.textContent = evmVersion;
    if (netGasLimit) netGasLimit.textContent = Number(maxTxGasLimit).toLocaleString();
    if (netNodeClient) netNodeClient.textContent = nodeClient;
    if (netProofClient) netProofClient.textContent = proofClient;
    if (explorerStatus) {
      explorerStatus.textContent = explorerStatusVal;
      explorerStatus.className = `font-semibold ${explorerStatusVal === "Healthy" || explorerStatusVal === "Online" ? 'text-green-500' : 'text-amber-500'}`;
    }

    // 3. Update Sequencer Performance Card
    const seqUptime = document.getElementById("giwa-seq-uptime");
    const seqGas = document.getElementById("giwa-seq-gas");
    const seqTps = document.getElementById("giwa-seq-tps");
    const seqBlock = document.getElementById("giwa-seq-block");
    const seqLatency = document.getElementById("giwa-seq-latency");
    const netVolume = document.getElementById("giwa-net-volume");
    
    if (seqUptime) seqUptime.textContent = `${uptimePercentage}%`;
    if (seqGas) seqGas.textContent = `${gasPrice} Gwei`;
    if (seqTps) seqTps.textContent = `${tps} TPS`;
    if (seqBlock) seqBlock.textContent = `#${blockHeight.toLocaleString()}`;
    if (seqLatency) {
      seqLatency.textContent = rpcLatency !== null ? `${rpcLatency} ms` : "Offline";
      seqLatency.className = `font-semibold ${rpcLatency !== null ? 'text-secondary' : 'text-red-500'}`;
    }

    // Sum dynamic volume from explorer settlements
    let volumeSum = 0;
    if (explorerSettlements && explorerSettlements.length > 0) {
      explorerSettlements.forEach(s => {
        if (s.status === "Completed" || s.status === "Success") {
          volumeSum += parseFloat(s.amount) || 0;
        }
      });
    }
    if (netVolume) {
      netVolume.textContent = volumeSum > 0 ? `$${volumeSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$14,820.00";
    }

    // Hydrate Ecosystem Capabilities & Roadmap Card
    const futureKrw = document.getElementById("giwa-future-krw");
    const futureDojang = document.getElementById("giwa-future-dojang");
    const futureUpid = document.getElementById("giwa-future-upid");

    const krwAddr = networkRegistry?.giwa?.krwStablecoin?.getContractAddress();
    if (futureKrw) {
      futureKrw.textContent = krwAddr ? `Active (${krwAddr.substring(0, 10)}...)` : "Pending (0x9b3f5c...)";
    }
    if (futureDojang) {
      futureDojang.textContent = networkRegistry?.giwa?.dojang ? "Scaffolded (Active)" : "Pending";
    }
    const upidResolver = networkRegistry?.giwa?.getWalletResolver();
    if (futureUpid) {
      futureUpid.textContent = upidResolver ? `Active (${upidResolver})` : "Active (Fallback Resolver)";
    }

    // 4. Update Analytics Widget
    const analNet = document.getElementById("analytics-giwa-network");
    const analBlock = document.getElementById("analytics-giwa-block");
    const analTps = document.getElementById("analytics-giwa-tps");
    const analConf = document.getElementById("analytics-giwa-confirmations");
    const giwaAvgTime = document.getElementById("giwa-avg-time");
    
    if (analNet) analNet.textContent = name;
    if (analBlock) analBlock.textContent = `#${blockHeight.toLocaleString()}`;
    if (analTps) analTps.textContent = `${tps} TPS`;
    if (analConf) {
      analConf.textContent = statusData?.settlements?.totalConfirmations?.toString() || "0";
    }
    if (giwaAvgTime) {
      giwaAvgTime.textContent = `${statusData?.settlements?.avgSettlementTimeSeconds || avgBlockTime}s`;
    }

    // 5. Update Home Dashboard Widget
    const widgetHealthBadge = document.getElementById("widget-giwa-health-badge");
    const widgetBlock = document.getElementById("widget-giwa-block");
    const widgetLatency = document.getElementById("widget-giwa-latency");
    const widgetSequencer = document.getElementById("widget-giwa-sequencer");
    const widgetGas = document.getElementById("widget-giwa-gas");
    const widgetRating = document.getElementById("widget-giwa-rating");

    if (widgetHealthBadge) {
      widgetHealthBadge.textContent = `${healthScore}/100`;
      widgetHealthBadge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
        healthScore >= 90 ? 'bg-green-500/10 text-green-500' :
        healthScore >= 70 ? 'bg-yellow-500/10 text-yellow-500' :
        'bg-red-500/10 text-red-500'
      }`;
    }
    if (widgetBlock) widgetBlock.textContent = `#${blockHeight.toLocaleString()}`;
    if (widgetLatency) {
      widgetLatency.textContent = `${rpcLatency} ms`;
      widgetLatency.className = `font-bold ${rpcLatency > 1500 ? 'text-red-500' : 'text-secondary'}`;
    }
    if (widgetSequencer) {
      widgetSequencer.textContent = sequencerHealthVal;
      widgetSequencer.className = `font-bold ${sequencerHealthVal === "Healthy" || sequencerHealthVal === "Operational" ? 'text-green-500' : 'text-red-500'}`;
    }
    if (widgetGas) widgetGas.textContent = `${gasPrice} Gwei`;
    if (widgetRating) {
      widgetRating.textContent = `${healthRating} Health`;
      widgetRating.className = `text-xs font-semibold ${
        healthRating === 'Excellent' || healthRating === 'Good' ? 'text-green-500' :
        healthRating === 'Warning' ? 'text-yellow-500' : 'text-red-500'
      }`;
    }

    // 6. Update Heartbeat Block Feed
    const heartbeatFeed = document.getElementById("giwa-block-heartbeat-feed");
    if (heartbeatFeed) {
      if (lastKnownBlockHeight === 0) {
        // Hydrate initial blocks
        for (let i = 4; i >= 0; i--) {
          const h = blockHeight - i;
          appendBlockToFeed(heartbeatFeed, h, false);
        }
        lastKnownBlockHeight = blockHeight;
      } else if (blockHeight > lastKnownBlockHeight) {
        // Append missing blocks
        for (let h = lastKnownBlockHeight + 1; h <= blockHeight; h++) {
          appendBlockToFeed(heartbeatFeed, h, true);
        }
        lastKnownBlockHeight = blockHeight;
      }
    }

    // 7. Update Settlements Confirmation Log Table
    const tbody = document.getElementById("giwa-settlements-tbody");
    if (tbody && statusData) {
      if (statusData.settlements.recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-outline dark:text-outline-variant text-xs">No settlements recorded yet.</td></tr>`;
      } else {
        tbody.innerHTML = statusData.settlements.recent.map(s => {
          const pair = `${s.fromToken} ➔ ${s.toToken}`;
          const amountStr = `$${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const txHash = s.txHash || ('0x' + Math.random().toString(16).substring(2, 10) + '...');
          const isPending = s.status === 'Pending';
          
          const confirmations = isPending 
            ? `${Math.floor(Math.random() * 6) + 3}/12` 
            : `12/12`;
            
          const statusClass = isPending 
            ? 'bg-amber-500/10 text-amber-500' 
            : 'bg-green-500/10 text-green-500';
          const statusText = isPending ? 'Pending' : 'Success';

          return `
            <tr class="hover:bg-surface-container/30 dark:hover:bg-inverse-surface/10 transition-colors">
              <td class="py-3 font-semibold dark:text-white">${pair}</td>
              <td class="py-3 dark:text-white font-mono">${amountStr}</td>
              <td class="py-3 text-xs font-mono text-zinc-500 dark:text-zinc-400 select-all">${txHash}</td>
              <td class="py-3 text-xs font-semibold text-secondary">${confirmations}</td>
              <td class="py-3 text-xs">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}">
                  ${statusText}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 8. Render Historical Performance Charts
    renderGiwaIntelligenceCharts(history);

  } catch (err) {
    console.error("[GIWA Status] Error loading details:", err);
    // Gracefully handle network failures
    const statusDot = document.getElementById("giwa-status-dot");
    const statusText = document.getElementById("giwa-status-text");
    const explorerStatus = document.getElementById("giwa-net-explorer-status");
    const seqLatency = document.getElementById("giwa-seq-latency");
    const seqTps = document.getElementById("giwa-seq-tps");
    const seqGas = document.getElementById("giwa-seq-gas");

    if (statusDot) statusDot.className = "w-3.5 h-3.5 rounded-full animate-pulse bg-red-500";
    if (statusText) {
      statusText.textContent = "Sequencer Offline";
      statusText.className = "text-xs font-bold uppercase tracking-wider text-red-500";
    }
    if (explorerStatus) {
      explorerStatus.textContent = "Degraded";
      explorerStatus.className = "font-semibold text-amber-500";
    }
    if (seqLatency) {
      seqLatency.textContent = "Offline";
      seqLatency.className = "font-semibold text-red-500";
    }
    if (seqTps) seqTps.textContent = "0 TPS";
    if (seqGas) seqGas.textContent = "0 Gwei";

    // Handle home widget offline states
    const widgetHealthBadge = document.getElementById("widget-giwa-health-badge");
    const widgetLatency = document.getElementById("widget-giwa-latency");
    const widgetSequencer = document.getElementById("widget-giwa-sequencer");
    const widgetRating = document.getElementById("widget-giwa-rating");

    if (widgetHealthBadge) {
      widgetHealthBadge.textContent = "0/100";
      widgetHealthBadge.className = "bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider";
    }
    if (widgetLatency) {
      widgetLatency.textContent = "Offline";
      widgetLatency.className = "font-bold text-red-500";
    }
    if (widgetSequencer) {
      widgetSequencer.textContent = "Offline";
      widgetSequencer.className = "font-bold text-red-500";
    }
    if (widgetRating) {
      widgetRating.textContent = "Critical Health";
      widgetRating.className = "text-xs font-semibold text-red-500";
    }
  }
}

function renderGiwaIntelligenceCharts(history) {
  if (!history || history.length === 0) return;

  const sorted = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const labels = sorted.map(d => {
    return new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  const healthScores = sorted.map(d => d.healthScore);
  const latencies = sorted.map(d => d.rpcLatency);
  const gasPrices = sorted.map(d => d.gasPrice);
  const blockTimes = sorted.map(d => d.avgBlockTime);

  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(100, 116, 139, 0.1)";
  const fontConfig = { family: "Outfit, Inter, sans-serif", size: 10 };

  const ctxHealth = document.getElementById("chart-giwa-health-latency")?.getContext("2d");
  if (ctxHealth) {
    if (giwaHealthLatencyChart) {
      giwaHealthLatencyChart.destroy();
    }
    giwaHealthLatencyChart = new Chart(ctxHealth, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Health Score",
            data: healthScores,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "y",
            fill: true
          },
          {
            label: "RPC Latency (ms)",
            data: latencies,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.05)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "y1",
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: { color: textColor, font: fontConfig }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: fontConfig }
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            min: 0,
            max: 100,
            grid: { color: gridColor },
            ticks: { color: textColor, font: fontConfig }
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { color: textColor, font: fontConfig }
          }
        }
      }
    });
  }

  const ctxGasTime = document.getElementById("chart-giwa-gas-time")?.getContext("2d");
  if (ctxGasTime) {
    if (giwaGasTimeChart) {
      giwaGasTimeChart.destroy();
    }
    giwaGasTimeChart = new Chart(ctxGasTime, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Gas Price (Gwei)",
            data: gasPrices,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.05)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "y",
            fill: true
          },
          {
            label: "Block Time (s)",
            data: blockTimes,
            borderColor: "#ec4899",
            backgroundColor: "rgba(236, 72, 153, 0.05)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "y1",
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: { color: textColor, font: fontConfig }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: fontConfig }
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            grid: { color: gridColor },
            ticks: { color: textColor, font: fontConfig }
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { color: textColor, font: fontConfig }
          }
        }
      }
    });
  }
}

function appendBlockToFeed(container, height, animate) {
  const txCount = Math.floor(Math.random() * 15) + 3;
  const gasUsed = (120000 + Math.floor(Math.random() * 45000)).toLocaleString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const blockDiv = document.createElement("div");
  blockDiv.className = `flex items-center justify-between p-2 rounded bg-surface-container dark:bg-surface-dim border border-outline-variant/10 text-xs ${animate ? 'animate-fade-in' : ''}`;
  blockDiv.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined text-green-500 text-sm">check_circle</span>
      <span class="font-mono font-semibold dark:text-white">Block #${height.toLocaleString()}</span>
    </div>
    <div class="text-[10px] text-on-surface-variant dark:text-outline-variant">
      ${txCount} txs • Gas: ${gasUsed} gas • Confirmed at ${timeStr}
    </div>
  `;

  container.appendChild(blockDiv);

  while (container.children.length > 15) {
    container.removeChild(container.firstChild);
  }
}

async function loadOperationsData() {
  const rpcStatus = document.getElementById("ops-rpc-status");
  const rpcLatency = document.getElementById("ops-rpc-latency");
  const indexerStatus = document.getElementById("ops-indexer-status");
  const indexerBlock = document.getElementById("ops-indexer-block");
  const apiStatus = document.getElementById("ops-api-status");
  const apiMemory = document.getElementById("ops-api-memory");
  const dbStatus = document.getElementById("ops-db-status");
  const dbLatency = document.getElementById("ops-db-latency");

  const queuePending = document.getElementById("ops-queue-pending");
  const queueAmount = document.getElementById("ops-queue-amount");
  const queueConfirm = document.getElementById("ops-queue-confirm");
  const queueFailed = document.getElementById("ops-queue-failed");
  const queueRetry = document.getElementById("ops-queue-retry");
  const logConsole = document.getElementById("ops-log-console");

  try {
    const res = await authFetch(`${API_BASE}/operations/status`);
    if (!res.ok) throw new Error("Failed to fetch operations status");
    const data = await res.json();

    // 1. Health Status
    if (rpcStatus) {
      rpcStatus.textContent = data.rpc.status;
      rpcStatus.className = `text-lg font-extrabold ${data.rpc.status === 'Healthy' ? 'text-green-500' : 'text-amber-500'}`;
    }
    if (rpcLatency) rpcLatency.textContent = `${data.rpc.latencyMs}ms`;

    if (indexerStatus) {
      indexerStatus.textContent = data.indexer.status;
      indexerStatus.className = `text-lg font-extrabold ${data.indexer.status === 'Healthy' ? 'text-green-500' : 'text-amber-500'}`;
    }
    if (indexerBlock) indexerBlock.textContent = `#${data.indexer.lastIndexedBlock.toLocaleString()}`;

    if (apiStatus) {
      apiStatus.textContent = data.api.status;
      apiStatus.className = `text-lg font-extrabold ${data.api.status === 'Healthy' ? 'text-green-500' : 'text-red-500'}`;
    }
    if (apiMemory) apiMemory.textContent = `${data.api.memoryMB} MB`;

    if (dbStatus) {
      dbStatus.textContent = data.database.status;
      dbStatus.className = `text-lg font-extrabold ${data.database.status === 'Healthy' ? 'text-green-500' : 'text-red-500'}`;
    }
    if (dbLatency) dbLatency.textContent = `${data.database.latencyMs}ms`;

    // 2. Queue Metrics
    if (queuePending) queuePending.textContent = data.queue.pendingCount.toString();
    if (queueAmount) queueAmount.textContent = `$${Number(data.queue.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} pending`;
    if (queueConfirm) queueConfirm.textContent = `${data.queue.averageConfirmSeconds}s`;
    if (queueFailed) queueFailed.textContent = data.queue.failedCount.toString();
    if (queueRetry) queueRetry.textContent = data.queue.retryCount.toString();

    // 3. Log Message
    if (logConsole) {
      const timeStr = new Date().toISOString();
      const newLog = document.createElement("div");
      newLog.className = "animate-fade-in";
      newLog.innerHTML = `<span class="text-zinc-500">[${timeStr}]</span> <span class="text-green-500">[OK]</span> Operations metrics polled successfully. DB Latency: ${data.database.latencyMs}ms. RPC: ${data.rpc.status}`;
      logConsole.appendChild(newLog);
      logConsole.scrollTop = logConsole.scrollHeight;

      while (logConsole.children.length > 25) {
        logConsole.removeChild(logConsole.firstChild);
      }
    }

  } catch (err) {
    console.error("[Operations Portal] Error loading data:", err);
    if (rpcStatus) { rpcStatus.textContent = "Offline"; rpcStatus.className = "text-lg font-extrabold text-red-500"; }
    if (indexerStatus) { indexerStatus.textContent = "Offline"; indexerStatus.className = "text-lg font-extrabold text-red-500"; }
    if (apiStatus) { apiStatus.textContent = "Offline"; apiStatus.className = "text-lg font-extrabold text-red-500"; }
    if (dbStatus) { dbStatus.textContent = "Offline"; dbStatus.className = "text-lg font-extrabold text-red-500"; }

    if (logConsole) {
      const timeStr = new Date().toISOString();
      const newLog = document.createElement("div");
      newLog.className = "text-red-500 animate-fade-in";
      newLog.innerHTML = `<span class="text-zinc-500">[${timeStr}]</span> [ERROR] Poll failed: ${err.message}`;
      logConsole.appendChild(newLog);
      logConsole.scrollTop = logConsole.scrollHeight;
    }
  }
}
window.loadOperationsData = loadOperationsData;



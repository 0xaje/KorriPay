// KorriPay Frontend Logic

const API_BASE = "http://localhost:5000/api";

async function authFetch(url, options = {}) {
  const token = localStorage.getItem("korripay_session_token");
  const headers = {
    ...options.headers
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    headers
  });
  if (res.status === 401) {
    localStorage.removeItem("korripay_session_token");
    window.location.href = "index.html";
  }
  return res;
}
let isBackendConnected = false;

// Mock Fallback Data (if backend is unreachable)
let localState = {
  balance: 1250.00,
  savings: 45.00,
  btcBalance: 14.82,
  ethBalance: 2.45,
  usdcBalance: 2450.00,
  mockkrwBalance: 500000.00, // default ₩500,000 mock
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

// Main State
let state = {
  balance: 0,
  savings: 0,
  btcBalance: 0,
  ethBalance: 0,
  usdcBalance: 0,
  mockkrwBalance: 0,
  transactions: []
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setupDarkMode();
  setupNavigation();
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
});

// Dark Mode Support
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
  } else if (hash === "#analytics") {
    switchTab("tab-analytics");
    if (typeof loadAnalyticsData === "function") {
      loadAnalyticsData();
    }
  } else {
    switchTab("tab-home");
  }
}

function switchTab(tabId) {
  const navItems = document.querySelectorAll(".nav-item");
  const sideNavItems = document.querySelectorAll(".side-nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  tabContents.forEach(tab => {
    if (tab.id === tabId) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  const navKey = tabId.replace("tab-", "");

  // Update Bottom Nav Items
  navItems.forEach(item => {
    const itemKey = item.id.replace("nav-", "");
    if (itemKey === navKey) {
      // Active styling
      item.className = "nav-item flex flex-col items-center justify-center bg-secondary-container dark:bg-on-secondary-fixed-variant text-on-secondary-container dark:text-secondary-fixed rounded-full px-4 py-1.5 active:scale-90 transition-all duration-300";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    } else {
      // Inactive styling
      item.className = "nav-item flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant px-4 py-1.5 hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 transition-transform";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 0";
    }
  });

  // Update Sidebar Nav Items
  sideNavItems.forEach(item => {
    const itemKey = item.id.replace("side-nav-", "");
    if (itemKey === navKey) {
      // Active styling
      item.className = "side-nav-item flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary-container dark:bg-on-secondary-fixed-variant text-on-secondary-container dark:text-secondary-fixed font-bold active:scale-95 transition-all duration-300";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    } else {
      // Inactive styling
      item.className = "side-nav-item flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-inverse-surface/30 hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-95 transition-transform";
      const icon = item.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 0";
    }
  });

  // Update Desktop Title
  const desktopTitle = document.getElementById("desktop-page-title");
  if (desktopTitle) {
    if (tabId === "tab-home") desktopTitle.textContent = "Dashboard";
    else if (tabId === "tab-send") desktopTitle.textContent = "Send Money";
    else if (tabId === "tab-history") desktopTitle.textContent = "Transactions";
    else if (tabId === "tab-portfolio") desktopTitle.textContent = "Portfolio";
    else if (tabId === "tab-swap") desktopTitle.textContent = "Swap Assets";
    else if (tabId === "tab-swap-success") desktopTitle.textContent = "Swap Success";
    else if (tabId === "tab-explorer") desktopTitle.textContent = "Explorer";
    else if (tabId === "tab-merchant") desktopTitle.textContent = "Merchant Pay";
    else if (tabId === "tab-analytics") desktopTitle.textContent = "Analytics Dashboard";
    else if (tabId === "tab-profile") desktopTitle.textContent = "My Profile";
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

  overlay.addEventListener("click", () => closeAllModals());
  
  // ESC key listener
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
}

function openModal(modalId) {
  const overlay = document.getElementById("modal-overlay");
  const targetModal = document.getElementById(modalId);
  
  overlay.classList.remove("hidden");
  targetModal.classList.remove("hidden");
  
  // Force reflow
  void overlay.offsetWidth;
  
  overlay.classList.add("opacity-100");
  targetModal.classList.add("opacity-100", "translate-y-0", "sm:translate-y-0");
  targetModal.classList.remove("translate-y-full", "sm:translate-y-4");
}

function closeAllModals() {
  const overlay = document.getElementById("modal-overlay");
  const modals = document.querySelectorAll("[id^='modal-']:not(#modal-overlay)");
  
  overlay.classList.remove("opacity-100");
  
  modals.forEach(modal => {
    modal.classList.remove("opacity-100", "translate-y-0", "sm:translate-y-0");
    modal.classList.add("translate-y-full", "sm:translate-y-4");
  });

  setTimeout(() => {
    overlay.classList.add("hidden");
    modals.forEach(modal => modal.classList.add("hidden"));
  }, 300);
}

// Toast System
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");
  const toastIcon = document.getElementById("toast-icon");
  
  toastMsg.textContent = message;
  
  if (type === "success") {
    toast.className = "fixed top-20 left-1/2 -translate-x-1/2 bg-on-secondary-container text-white py-3 px-6 rounded-full font-label-md text-label-md opacity-100 transition-all duration-300 z-[200] shadow-xl flex items-center gap-2 max-w-sm";
    toastIcon.textContent = "check_circle";
  } else {
    toast.className = "fixed top-20 left-1/2 -translate-x-1/2 bg-error text-white py-3 px-6 rounded-full font-label-md text-label-md opacity-100 transition-all duration-300 z-[200] shadow-xl flex items-center gap-2 max-w-sm";
    toastIcon.textContent = "error";
  }

  // Remove pointer events so it's not blocking clicks
  toast.classList.remove("pointer-events-none");
  
  setTimeout(() => {
    toast.classList.add("opacity-0", "pointer-events-none");
    toast.classList.remove("opacity-100");
  }, 3000);
}
window.showToast = showToast;

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
  // Update Balance
  const totalBalanceEl = document.getElementById("total-balance");
  if (totalBalanceEl) {
    totalBalanceEl.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Update Savings
  const savingsValEl = document.getElementById("savings-val");
  if (savingsValEl) {
    savingsValEl.textContent = state.savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Render recent transactions (Home Tab)
  const recentListEl = document.getElementById("recent-transactions-list");
  if (recentListEl) {
    recentListEl.innerHTML = "";
    if (state.transactions.length === 0) {
      recentListEl.innerHTML = `<div class="p-sm text-center text-on-surface-variant/70">No recent transactions</div>`;
    } else {
      const top3 = state.transactions.slice(0, 3);
      top3.forEach(tx => {
        recentListEl.appendChild(createTransactionRow(tx));
      });
    }
  }

  // Render full list in History Tab
  filterAndRenderHistory();

  // Update KYC Badge based on backend status
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

  // Render Portfolio Calculations
  updatePortfolioUI();
}

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
    portfolioMockkrwQtyEl.textContent = `${state.mockkrwBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MockKRW`;
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
  if (mockkrwPctEl) mockkrwPctEl.textContent = `MockKRW (${Math.round(mockkrwPct)}%)`;

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
}

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
    MockKRW: { name: "Mock KRW", icon: "payments", colorClass: "bg-[#5cfd80]/10 text-[#006e2a]" },
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
    if (selectMockkrwBal) selectMockkrwBal.textContent = `${state.mockkrwBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MockKRW`;
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
          successNetworkTo.textContent = toAsset === "USD" ? "Standard Settlement" : (toAsset === "BTC" ? "Bitcoin Network" : (toAsset === "MockKRW" ? "Sepolia Network" : "Polygon Network"));
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

        // Mock Hash generator
        const hex = "0123456789abcdef";
        let mockHash = "0x";
        for (let i = 0; i < 40; i++) mockHash += hex[Math.floor(Math.random() * 16)];
        if (successHash) successHash.textContent = `${mockHash.slice(0, 6)}...${mockHash.slice(-4)}`;
        
        // Copy Hash button listener
        const btnCopyHash = document.getElementById("btn-swap-success-copy");
        if (btnCopyHash) {
          btnCopyHash.onclick = () => {
            navigator.clipboard.writeText(mockHash).then(() => {
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

  // Row click event to show details in toast
  row.addEventListener("click", () => {
    showToast(`Tx ID: ${tx.id} - ${tx.title} - $${tx.amount}`);
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
            <p class="text-sm">No recent transfers.</p>
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
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      
      recipientCards.forEach(card => {
        const name = card.getAttribute("data-name").toLowerCase();
        const address = card.getAttribute("data-address").toLowerCase();
        const email = (card.getAttribute("data-email") || "").toLowerCase();
        if (name.includes(query) || address.includes(query) || email.includes(query)) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });

      recentItems.forEach(item => {
        const name = item.getAttribute("data-name").toLowerCase();
        const address = item.getAttribute("data-address").toLowerCase();
        const email = (item.getAttribute("data-email") || "").toLowerCase();
        if (name.includes(query) || address.includes(query) || email.includes(query)) {
          item.classList.remove("hidden");
        } else {
          item.classList.add("hidden");
        }
      });
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

    // Share Receipt Handler
    const shareBtn = document.getElementById("btn-send-share");
    if (shareBtn) {
      const newShareBtn = shareBtn.cloneNode(true);
      shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);

      newShareBtn.addEventListener("click", () => {
        let shareText = `Successfully transferred ${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString()} to ${recipient} via KorriPay!`;
        if (status === "Pending") {
          shareText = `Transfer of ${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString()} to ${recipient} is pending via KorriPay!`;
        } else if (status === "Failed") {
          shareText = `Transfer of ${exchangeSymbols[selectedCurrency] || "$"}${amountVal.toLocaleString()} to ${recipient} failed on KorriPay.`;
        }

        if (navigator.share) {
          navigator.share({
            title: 'KorriPay Receipt',
            text: shareText,
            url: window.location.href
          }).then(() => {
            showToast("Receipt shared!");
          }).catch(() => {
            showToast("Receipt sharing canceled");
          });
        } else {
          navigator.clipboard.writeText(shareText).then(() => {
            showToast("Receipt info copied! Ready to share.");
          }).catch(() => {
            showToast("Failed to copy receipt text", "error");
          });
        }
      });
    }

    if (statusTitle && statusDesc) {
      if (status === "Pending") {
        statusTitle.innerText = "Transaction Pending";
        statusTitle.className = "font-headline-lg-mobile text-headline-lg-mobile text-amber-600 dark:text-amber-400 mb-2 font-bold";
        statusDesc.innerText = "Your transfer is being processed on the blockchain. We are waiting for confirmation.";
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
        statusTitle.innerText = "Transaction Failed";
        statusTitle.className = "font-headline-lg-mobile text-headline-lg-mobile text-error dark:text-red-400 mb-2 font-bold";
        statusDesc.innerText = "Your transaction failed or was reverted on-chain. Please verify and try again.";
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
        statusTitle.innerText = "Transaction Successful";
        statusTitle.className = "font-headline-lg-mobile text-headline-lg-mobile text-primary dark:text-primary-fixed mb-2 font-bold";
        statusDesc.innerText = "Your money has been sent successfully. The recipient will receive it in minutes.";
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
        successDesc.innerText = `Your ${currentDocType} has been verified successfully. You now have full access to global transfers.`;
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
      description: "Scenario 1: Korean worker sends 100,000 KRW to family. Simulates fiat KYC validation, conversion to MockKRW stablecoin, and initiating a smart contract settlement transaction with active indexer sync.",
      steps: [
        { title: "KYC Verification", desc: "Checking sender identity, compliance logs, and liveness capture status" },
        { title: "Wrapper Deposit", desc: "Depositing ₩100,000 to custodian and wrapping into MockKRW stablecoin" },
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
      description: "Scenario 2: Freelancer receives consulting payment. Demonstrates SIWE session authentication, invoicing, checkout verification, and immediate wallet balance crediting.",
      steps: [
        { title: "SIWE Authentication", desc: "Verifying secure session token creation via Web3 wallet signatures" },
        { title: "Invoice Generation", desc: "Creating a unique invoice checkout link with specific payment amount" },
        { title: "USDC Checkout Payout", desc: "Customer scanning link and executing on-chain USDC contract transfer" },
        { title: "Prisma Ledger Log", desc: "Database capturing the payment and writing settlement log records" },
        { title: "Balance Updates", desc: "Updating general ledger history and refreshing current portfolio" }
      ],
      runner: async function(sleep) {
        setStepActive(1, "Signing SIWE...");
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
        <td class="p-4 text-xs font-medium text-outline">Hardhat Local</td>
        <td class="p-4">${statusBadge}</td>
        <td class="p-4 text-xs text-on-surface-variant dark:text-outline-variant">${formattedDate}</td>
        <td class="p-4 font-mono text-xs text-primary hover:underline cursor-pointer" onclick="copyTextToClipboard('${txHashToUse}')" title="Click to copy transaction hash">${shortTxHash}</td>
      </tr>
    `;
  }).join("");
}

// Utility function to copy to clipboard
function copyTextToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!");
  }).catch(err => {
    console.error("Could not copy text: ", err);
  });
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


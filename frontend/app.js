// KorriPay Frontend Logic

const API_BASE = "http://localhost:5000/api";
let isBackendConnected = false;

// Mock Fallback Data (if backend is unreachable)
let localState = {
  balance: 1250.00,
  savings: 45.00,
  btcBalance: 14.82,
  ethBalance: 2.45,
  usdcBalance: 2450.00,
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
  
  // Dev Reset
  const devResetBtn = document.getElementById("btn-dev-reset");
  if (devResetBtn) {
    devResetBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all data to default values?")) {
        resetState();
      }
    });
  }

  // Copy Wallet Address
  const copyWalletBtn = document.getElementById("btn-copy-wallet");
  if (copyWalletBtn) {
    copyWalletBtn.addEventListener("click", () => {
      const fullAddress = "0x71C8b44473E4F49A2d2f7823f990a424237149A2";
      navigator.clipboard.writeText(fullAddress).then(() => {
        showToast("Wallet address copied to clipboard!");
        
        // Show temporary checkmark feedback
        const originalHtml = copyWalletBtn.innerHTML;
        copyWalletBtn.innerHTML = '<span class="material-symbols-outlined text-sm text-secondary">check</span>';
        setTimeout(() => {
          copyWalletBtn.innerHTML = originalHtml;
        }, 2000);
      }).catch(() => {
        showToast("Failed to copy address", "error");
      });
    });
  }

  // Disconnect Wallet
  const disconnectWalletBtn = document.getElementById("btn-disconnect-wallet");
  const sideBtnDisconnect = document.getElementById("side-btn-disconnect");
  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your wallet?")) {
      showToast("Wallet disconnected successfully.");
      // Simulate disconnect by resetting dashboard state after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };
  if (disconnectWalletBtn) disconnectWalletBtn.addEventListener("click", handleDisconnect);
  if (sideBtnDisconnect) sideBtnDisconnect.addEventListener("click", handleDisconnect);

  // Initial Load
  loadData();

  // Hash Routing check
  checkHashRoute();
  window.addEventListener("hashchange", checkHashRoute);
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
    { btn: "btn-quick-pay", modal: "modal-pay" }
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

function saveLocalState() {
  localStorage.setItem("korripay_state", JSON.stringify(localState));
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
    const res = await fetch(`${API_BASE}/dashboard`);
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

  // Render Portfolio Calculations
  updatePortfolioUI();
}

function updatePortfolioUI() {
  const BTC_PRICE = 64281.40;
  const ETH_PRICE = 3450.00;
  const USDC_PRICE = 1.00;

  const fiat = state.balance;
  const btcVal = state.btcBalance * BTC_PRICE;
  const ethVal = state.ethBalance * ETH_PRICE;
  const usdcVal = state.usdcBalance * USDC_PRICE;
  const total = fiat + btcVal + ethVal + usdcVal;

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

  // 3. Percentages
  const fiatPct = total > 0 ? (fiat / total) * 100 : 0;
  const btcPct = total > 0 ? (btcVal / total) * 100 : 0;
  const ethPct = total > 0 ? (ethVal / total) * 100 : 0;
  const usdcPct = total > 0 ? (usdcVal / total) * 100 : 0;

  // 4. Update legend labels
  const fiatPctEl = document.getElementById("allocation-fiat-pct");
  if (fiatPctEl) fiatPctEl.textContent = `Fiat (${Math.round(fiatPct)}%)`;
  const btcPctEl = document.getElementById("allocation-btc-pct");
  if (btcPctEl) btcPctEl.textContent = `BTC (${Math.round(btcPct)}%)`;
  const ethPctEl = document.getElementById("allocation-eth-pct");
  if (ethPctEl) ethPctEl.textContent = `ETH (${Math.round(ethPct)}%)`;
  const usdcPctEl = document.getElementById("allocation-usdc-pct");
  if (usdcPctEl) usdcPctEl.textContent = `USDC (${Math.round(usdcPct)}%)`;

  // 5. Update Center digital assets percentage
  const digitalPctEl = document.getElementById("allocation-digital-center");
  if (digitalPctEl) {
    const digitalPct = btcPct + ethPct + usdcPct;
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
    USD: 1.00
  };

  // Live adjustments
  let priceFluctuation = {
    BTC: 0,
    ETH: 0,
    USDC: 0,
    USD: 0
  };

  const assetDetails = {
    BTC: { name: "Bitcoin", icon: "currency_bitcoin", colorClass: "bg-[#F7931A]/10 text-[#F7931A]" },
    ETH: { name: "Ethereum", icon: "diamond", colorClass: "bg-[#627EEA]/10 text-[#627EEA]" },
    USDC: { name: "USD Coin", icon: "monetization_on", colorClass: "bg-[#2775CA]/10 text-[#2775CA]" },
    USD: { name: "US Dollar", icon: "attach_money", colorClass: "bg-surface-container dark:bg-on-background/25 text-primary dark:text-primary-fixed" }
  };

  const getPrice = (symbol) => {
    return prices[symbol] * (1 + priceFluctuation[symbol]);
  };

  const getBalance = (symbol) => {
    if (symbol === "BTC") return state.btcBalance;
    if (symbol === "ETH") return state.ethBalance;
    if (symbol === "USDC") return state.usdcBalance;
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
          const response = await fetch(`${API_BASE}/transactions/swap`, {
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
          const resDash = await fetch(`${API_BASE}/dashboard`);
          if (resDash.ok) {
            state = await resDash.json();
          }
        } else {
          // Local Storage offline fallback
          if (fromAsset === "BTC") state.btcBalance -= totalCost;
          else if (fromAsset === "ETH") state.ethBalance -= totalCost;
          else if (fromAsset === "USDC") state.usdcBalance -= totalCost;
          else state.balance -= totalCost;

          if (toAsset === "BTC") state.btcBalance += outputVal;
          else if (toAsset === "ETH") state.ethBalance += outputVal;
          else if (toAsset === "USDC") state.usdcBalance += outputVal;
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
          successNetworkTo.textContent = toAsset === "USD" ? "Standard Settlement" : (toAsset === "BTC" ? "Bitcoin Network" : "Polygon Network");
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
      showToast("Opening block explorer...");
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
async function processTransaction(type, payload) {
  closeAllModals();
  
  if (isBackendConnected) {
    try {
      const response = await fetch(`${API_BASE}/transactions/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || "Transaction failed");
      
      showToast(resData.message || "Transaction processed successfully!");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
  } else {
    // Offline simulation mode
    const numAmount = Number(payload.amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Invalid amount", "error");
      return;
    }

    if (type === "send" || type === "pay") {
      if (numAmount > state.balance) {
        showToast("Insufficient balance", "error");
        return;
      }
      state.balance -= numAmount;
    } else if (type === "add") {
      state.balance += numAmount;
    }

    let title = "";
    let category = "";
    if (type === "send") {
      title = `Sent to ${payload.recipient}`;
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
      category
    };

    state.transactions.unshift(localTx);
    // save to state sync
    localState = { ...state };
    
    showToast(`Success: ${title} processed!`);
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

// Multi-step send setup with currency conversion rates
let selectedCurrency = "USD";
const exchangeRates = {
  USD: 1.00,
  KRW: 1400.00,
  NGN: 1500.00
};
const exchangeSymbols = {
  USD: "$",
  KRW: "₩",
  NGN: "₦"
};

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
        const icon = b.querySelector('.material-symbols-outlined');
        
        if (b.getAttribute("data-currency") === currency) {
          b.classList.add('border-primary', 'bg-primary-fixed-dim');
          b.classList.remove('border-transparent', 'bg-surface-container', 'dark:bg-surface-dim');
          if (label) {
            label.classList.add('text-primary');
            label.classList.remove('text-on-surface-variant', 'dark:text-outline-variant');
          }
          if (icon) {
            icon.classList.add('text-primary');
            icon.classList.remove('text-outline');
          }
        } else {
          b.classList.remove('border-primary', 'bg-primary-fixed-dim');
          b.classList.add('border-transparent', 'bg-surface-container', 'dark:bg-surface-dim');
          if (label) {
            label.classList.remove('text-primary');
            label.classList.add('text-on-surface-variant', 'dark:text-outline-variant');
          }
          if (icon) {
            icon.classList.remove('text-primary');
            icon.classList.add('text-outline');
          }
        }
      });

      // Update currency display & rate text
      if (activeCurrencySpan) activeCurrencySpan.innerText = currency;
      if (rateText) {
        const rate = exchangeRates[currency].toLocaleString();
        rateText.innerText = `1 USD = ${rate} ${currency}`;
      }
    });
  });

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

  // Click listeners for cards & items
  const recipientCards = document.querySelectorAll(".send-recipient-card");
  recipientCards.forEach(card => {
    card.addEventListener("click", () => {
      const name = card.getAttribute("data-name");
      const address = card.getAttribute("data-address");
      const initials = card.getAttribute("data-initials");
      const img = card.querySelector("img");
      const avatar = img ? img.src : null;
      
      selectRecipient(name, address, initials, avatar);
      showToast(`Selected: ${name}`);
    });
  });

  const recentItems = document.querySelectorAll(".send-recent-item");
  recentItems.forEach(item => {
    item.addEventListener("click", () => {
      const name = item.getAttribute("data-name");
      const address = item.getAttribute("data-address");
      const initials = item.getAttribute("data-initials");
      selectRecipient(name, address, initials, null);
      showToast(`Selected: ${name}`);
    });
  });

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

      // Calculate fee in currency (equivalent of $0.42 USD network fee)
      const feeInCurrency = 0.42 * exchangeRates[selectedCurrency];
      const receiveVal = Math.max(0, amountVal - feeInCurrency);

      // Populate review details
      const reviewRecipientName = document.getElementById("review-recipient-name");
      const reviewRecipientAddress = document.getElementById("review-recipient-address");
      const reviewDisplayAmount = document.getElementById("review-display-amount");
      const reviewCurrencyCode = document.getElementById("review-currency-code");
      const reviewReceiveAmount = document.getElementById("review-receive-amount");
      const reviewReceiveCurrency = document.getElementById("review-receive-currency");
      const reviewExchangeRate = document.getElementById("review-exchange-rate");
      const reviewNetworkFee = document.getElementById("review-network-fee");
      const reviewAvatar = document.getElementById("review-avatar");
      const confirmBtnText = document.getElementById("btn-send-confirm-text");

      if (reviewRecipientName) reviewRecipientName.innerText = selectedRecipient.name;
      if (reviewRecipientAddress) reviewRecipientAddress.innerText = selectedRecipient.address;
      
      if (reviewDisplayAmount) reviewDisplayAmount.innerText = amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
      if (reviewCurrencyCode) reviewCurrencyCode.innerText = selectedCurrency;
      
      if (reviewReceiveAmount) reviewReceiveAmount.innerText = receiveVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
      if (reviewReceiveCurrency) reviewReceiveCurrency.innerText = selectedCurrency;

      if (reviewExchangeRate) {
        const rateVal = exchangeRates[selectedCurrency].toLocaleString('en-US', { minimumFractionDigits: 4 });
        reviewExchangeRate.innerText = `1 USDC = ${rateVal} ${selectedCurrency}`;
      }

      if (reviewNetworkFee) {
        const symbol = exchangeSymbols[selectedCurrency] || "$";
        reviewNetworkFee.innerText = `${symbol}${feeInCurrency.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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

      try {
        await processTransaction("send", { recipient, amount: usdAmount });
        
        // Populate Success view fields
        const successDisplayAmount = document.getElementById("success-display-amount");
        const successRecipientName = document.getElementById("success-recipient-name");
        const successPaymentMethod = document.getElementById("success-payment-method");
        const successTxHash = document.getElementById("success-tx-hash");
        const copyHashBtn = document.getElementById("btn-copy-hash");

        if (successDisplayAmount) {
          successDisplayAmount.innerText = `${exchangeSymbols[selectedCurrency]}${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        }
        if (successRecipientName) {
          successRecipientName.innerText = recipient;
        }
        if (successPaymentMethod) {
          successPaymentMethod.innerText = "Visa ending in •••• 8829";
        }

        // Generate a random transaction hash
        const fullHash = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("");
        if (successTxHash) {
          successTxHash.innerText = fullHash.substring(0, 5) + "..." + fullHash.substring(37);
        }

        // Click to copy handler
        if (copyHashBtn) {
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
            if (navigator.share) {
              navigator.share({
                title: 'KorriPay Receipt',
                text: `Successfully transferred ${exchangeSymbols[selectedCurrency]}${amountVal.toLocaleString()} to ${recipient} via KorriPay!`,
                url: window.location.href
              }).then(() => {
                showToast("Receipt shared!");
              }).catch(() => {
                showToast("Receipt sharing canceled");
              });
            } else {
              showToast("Receipt info copied! Ready to share.");
            }
          });
        }

        // Transition to Step 4 (Success status screen)
        step2.classList.add("hidden");
        step3.classList.remove("hidden");
        setStepDotsActive(4); // All dots completed
      } catch (err) {
        showToast(err.message || "Failed to process transaction", "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-80', 'pointer-events-none');
        confirmBtn.innerHTML = `
          <div class="absolute inset-0 bg-white/10 dark:bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">lock</span>
          <span id="btn-send-confirm-text">Confirm &amp; Send</span>
        `;
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

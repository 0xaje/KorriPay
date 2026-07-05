/**
 * KorriPay Compliance Passport Component
 * Renders user KYC, Attestations, Risk Score, Settlement Limits, and Travel Rule Status.
 * Usage: <compliance-passport></compliance-passport>
 */
class CompliancePassport extends HTMLElement {
  constructor() {
    super();
    this.isLoading = false;
  }

  connectedCallback() {
    this.renderSkeleton();
    this.refresh();
  }

  /**
   * Render loading skeleton state
   */
  renderSkeleton() {
    this.innerHTML = `
      <div class="bg-surface-container-lowest dark:bg-inverse-surface rounded-xl p-md shadow-sm border border-outline-variant/20 space-y-4 animate-pulse">
        <div class="flex items-center justify-between pb-sm border-b border-outline-variant/20">
          <div class="h-4 bg-outline-variant/30 rounded w-1/3"></div>
          <div class="h-6 bg-outline-variant/30 rounded-full w-16"></div>
        </div>
        <div class="grid grid-cols-2 gap-sm">
          <div class="p-sm bg-surface-container-low dark:bg-surface-dim rounded-xl border border-outline-variant/10 h-16"></div>
          <div class="p-sm bg-surface-container-low dark:bg-surface-dim rounded-xl border border-outline-variant/10 h-16"></div>
        </div>
        <div class="space-y-sm">
          <div class="flex justify-between h-4 bg-outline-variant/20 rounded"></div>
          <div class="flex justify-between h-4 bg-outline-variant/20 rounded"></div>
          <div class="flex justify-between h-4 bg-outline-variant/20 rounded"></div>
          <div class="flex justify-between h-4 bg-outline-variant/20 rounded"></div>
        </div>
      </div>
    `;
  }

  /**
   * Fetch compliance passport details and update UI
   */
  async refresh() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const apiBase = window.API_BASE || 'http://localhost:5000/api';
      const fetchFunc = window.authFetch || fetch;

      const res = await fetchFunc(`${apiBase}/compliance/passport`);
      if (!res.ok) throw new Error("Failed to load compliance passport");

      const data = await res.json();
      if (data && data.success) {
        this.renderData(data);
      } else {
        this.renderError("Invalid data format returned");
      }
    } catch (err) {
      console.error("[CompliancePassport] Error fetching passport data:", err);
      this.renderError(err.message);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render the actual passport data using Tailwind styling
   */
  renderData(data) {
    const {
      identityStatus,
      merchantStatus,
      businessStatus,
      complianceLevel,
      riskScore,
      settlementLimit,
      travelRuleStatus,
      profile
    } = data;

    const formattedLimit = `$${Number(settlementLimit).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;

    // Get badge styles for status values
    const getBadgeStyle = (status) => {
      if (status === "Verified" || status === "Compliant" || status === "Approved") {
        return "font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full text-xs border border-green-500/20";
      } else if (status === "Pending" || status === "Pending Verification") {
        return "font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full text-xs border border-amber-500/20";
      } else {
        return "font-semibold text-outline dark:text-outline-variant bg-surface-container px-2 py-0.5 rounded-full text-xs border border-outline-variant/20";
      }
    };

    // Determine Risk color & level
    let riskColorClass = "bg-green-500";
    if (riskScore >= 60) {
      riskColorClass = "bg-red-500";
    } else if (riskScore >= 30) {
      riskColorClass = "bg-amber-500";
    }

    this.innerHTML = `
      <div class="bg-surface-container-lowest dark:bg-inverse-surface rounded-xl p-md shadow-sm border border-outline-variant/20 space-y-4 transition-all duration-300">
        <!-- Passport Header -->
        <div class="flex items-center justify-between pb-sm border-b border-outline-variant/20">
          <h3 class="font-label-sm text-outline dark:text-outline-variant uppercase tracking-wider flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">verified_user</span>
            Compliance Passport
          </h3>
          <span class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-label-sm text-xs font-bold uppercase">
            ${complianceLevel}
          </span>
        </div>

        <!-- Limits & Tiers Grid -->
        <div class="grid grid-cols-2 gap-sm">
          <div class="p-sm bg-surface-container-low dark:bg-surface-dim rounded-xl border border-outline-variant/10">
            <p class="text-[10px] text-outline dark:text-outline-variant uppercase tracking-wider font-semibold">Settlement Limit</p>
            <p class="font-bold text-headline-sm text-on-surface dark:text-white mt-1">${formattedLimit} / Daily</p>
          </div>
          <div class="p-sm bg-surface-container-low dark:bg-surface-dim rounded-xl border border-outline-variant/10">
            <p class="text-[10px] text-outline dark:text-outline-variant uppercase tracking-wider font-semibold">Compliance Level</p>
            <p class="font-bold text-headline-sm text-primary dark:text-primary-fixed-dim mt-1">${complianceLevel}</p>
          </div>
        </div>

        <!-- Status Details -->
        <div class="space-y-xs text-sm">
          <div class="flex justify-between py-1 items-center">
            <span class="text-on-surface-variant dark:text-outline-variant">Identity Status</span>
            <span class="${getBadgeStyle(identityStatus)}">${identityStatus}</span>
          </div>
          <div class="flex justify-between py-1 items-center">
            <span class="text-on-surface-variant dark:text-outline-variant">Merchant Status</span>
            <span class="${getBadgeStyle(merchantStatus)}">${merchantStatus}</span>
          </div>
          <div class="flex justify-between py-1 items-center">
            <span class="text-on-surface-variant dark:text-outline-variant">Business Status</span>
            <span class="${getBadgeStyle(businessStatus)}">${businessStatus}</span>
          </div>
          <div class="flex justify-between py-1 items-center">
            <span class="text-on-surface-variant dark:text-outline-variant">Travel Rule Status</span>
            <span class="${getBadgeStyle(travelRuleStatus)}">${travelRuleStatus}</span>
          </div>

          <!-- Risk Score Progress -->
          <div class="space-y-1 py-1 border-t border-outline-variant/20 pt-sm mt-sm">
            <div class="flex justify-between text-xs text-outline dark:text-outline-variant">
              <span>Risk Score Metrics</span>
              <span class="font-semibold text-on-surface dark:text-white">
                ${riskScore} / 100 (${profile.riskLevel} Risk)
              </span>
            </div>
            <div class="w-full bg-outline-variant/20 dark:bg-on-background/10 rounded-full h-2 overflow-hidden">
              <div class="h-full ${riskColorClass} transition-all duration-700 rounded-full" style="width: ${riskScore}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render error state with a retry option
   */
  renderError(message) {
    this.innerHTML = `
      <div class="bg-surface-container-lowest dark:bg-inverse-surface rounded-xl p-md shadow-sm border border-error/20 space-y-3 text-center">
        <span class="material-symbols-outlined text-error text-3xl">error</span>
        <p class="text-sm font-semibold text-error">Failed to load Compliance Passport</p>
        <p class="text-xs text-outline dark:text-outline-variant">${message}</p>
        <button id="btn-retry-passport" class="px-3 py-1 bg-outline-variant/30 text-xs font-bold rounded-lg hover:bg-outline-variant/50 transition-colors">
          Retry
        </button>
      </div>
    `;

    const retryBtn = this.querySelector("#btn-retry-passport");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => this.refresh());
    }
  }
}

customElements.define('compliance-passport', CompliancePassport);

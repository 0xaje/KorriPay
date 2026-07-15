import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Search, 
  Users, 
  FileCheck, 
  Settings as SettingsIcon, 
  Clock, 
  Coins, 
  UserCheck, 
  TrendingUp, 
  Check, 
  X, 
  Camera, 
  ShieldAlert, 
  Copy, 
  Globe 
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Wallet Balances
  const [balances, setBalances] = useState({
    usdAvailable: 0, usdLocked: 0, usdPending: 0,
    mockkrwAvailable: 0, mockkrwLocked: 0, mockkrwPending: 0,
    ngnAvailable: 0, ngnLocked: 0, ngnPending: 0
  });

  // Recent Transactions
  const [transactions, setTransactions] = useState([]);
  
  // Compliance Passport
  const [passport, setPassport] = useState(null);
  
  // FX Converter state
  const [fxFromAsset, setFxFromAsset] = useState('USD');
  const [fxToAsset, setFxToAsset] = useState('MockKRW');
  const [fxAmount, setFxAmount] = useState('');
  const [fxQuote, setFxQuote] = useState(null);
  const [fxError, setFxError] = useState('');

  // Settlement Explorer state
  const [explorerSearch, setExplorerSearch] = useState('');
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState('*');

  // Corporate Org state
  const [organization, setOrganization] = useState(null);
  const [memberRole, setMemberRole] = useState('FINANCE');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberLimit, setMemberLimit] = useState(5000);
  
  // Faucet state
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState('');

  // Camera verification state
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  // Toast status
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const fetchWalletSummary = async () => {
    try {
      const res = await fetch('/api/wallet/summary');
      const data = await res.json();
      if (res.ok) {
        setBalances(data);
      }
    } catch (e) {
      console.warn("Summary load failed");
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/v1/settlements');
      const data = await res.json();
      if (res.ok && data.settlements) {
        setTransactions(data.settlements);
        setSettlements(data.settlements);
      }
    } catch (e) {
      console.warn("Tx list failed");
    }
  };

  const fetchPassport = async () => {
    try {
      const res = await fetch('/api/compliance/passport');
      const data = await res.json();
      if (res.ok && data.success) {
        setPassport(data);
      }
    } catch (e) {
      console.warn("Passport load failed");
    }
  };

  const fetchOrganization = async () => {
    try {
      const res = await fetch('/api/v1/organizations/my-org');
      const data = await res.json();
      if (res.ok && data.success) {
        setOrganization(data.organization);
      }
    } catch (e) {}
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/v1/webhooks');
      const data = await res.json();
      if (res.ok && data.subscriptions) {
        setWebhooks(data.subscriptions);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchWalletSummary();
    fetchTransactions();
    fetchPassport();
    fetchOrganization();
    fetchWebhooks();
  }, []);

  const triggerFaucet = async () => {
    setFaucetLoading(true);
    setFaucetMsg('');
    try {
      const res = await fetch('/api/wallet/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, currency: 'USD' })
      });
      if (res.ok) {
        setFaucetMsg('Successfully funded wallet with $1,000 USD!');
        fetchWalletSummary();
      } else {
        setFaucetMsg('Failed to request testnet faucet funds.');
      }
    } catch (err) {
      setFaucetMsg('Error processing request.');
    } finally {
      setFaucetLoading(false);
    }
  };

  const calculateFXQuote = async () => {
    setFxError('');
    if (!fxAmount || Number(fxAmount) <= 0) return;
    try {
      const res = await fetch('/api/fx/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fxFromAsset, to: fxToAsset, amount: parseFloat(fxAmount) })
      });
      const data = await res.json();
      if (res.ok) {
        setFxQuote(data);
      } else {
        setFxError(data.error || 'Failed to fetch conversion quote');
      }
    } catch (e) {
      setFxError('Network conversion request error');
    }
  };

  const executeFXConvert = async () => {
    if (!fxQuote) return;
    try {
      const res = await fetch('/api/fx/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fromCurrency: fxFromAsset, 
          toAsset: fxToAsset, 
          inputAmount: parseFloat(fxAmount) 
        })
      });
      if (res.ok) {
        showToast("Currency swap executed successfully!");
        setFxQuote(null);
        setFxAmount('');
        fetchWalletSummary();
        fetchTransactions();
      } else {
        const data = await res.json();
        setFxError(data.error || "Swap failed");
      }
    } catch (e) {
      setFxError("Failed to convert");
    }
  };

  const createWebhook = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newWebhookUrl, events: newWebhookEvents.split(',') })
      });
      if (res.ok) {
        showToast("Webhook registered!");
        setNewWebhookUrl('');
        fetchWebhooks();
      }
    } catch (e) {}
  };

  const toggleWebhook = async (id, currentActive) => {
    try {
      await fetch(`/api/v1/webhooks/${id}/toggle`, { method: 'POST' });
      fetchWebhooks();
    } catch (e) {}
  };

  const addOrgMember = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/organizations/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: memberEmail, role: memberRole, dailyLimit: memberLimit })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Team member added!");
        setMemberEmail('');
        fetchOrganization();
      } else {
        showToast(data.error || "Error adding member");
      }
    } catch (e) {}
  };

  const runCameraLiveness = () => {
    setCameraActive(true);
    setScanStatus('Initializing scan...');
    setTimeout(() => setScanStatus('Verifying liveness...'), 1500);
    setTimeout(() => {
      setScanStatus('Liveness verified successfully!');
      setCameraActive(false);
      fetchPassport();
    }, 3500);
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-md py-sm bg-zinc-900 text-white rounded-xl shadow-lg border border-zinc-700/50 flex items-center gap-xs text-sm">
          <CheckCircle2 size={16} className="text-secondary-fixed-dim" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tab Navigation Menu */}
      <div className="flex border-b border-outline-variant/30 dark:border-zinc-800/60 pb-xs gap-md overflow-x-auto no-scrollbar">
        {['overview', 'wallet', 'explorer', 'organization', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`font-label-md capitalize pb-xs px-xs border-b-2 transition-all relative ${
              activeTab === tab 
                ? 'border-secondary text-primary dark:border-zinc-300 dark:text-white font-bold' 
                : 'border-transparent text-outline dark:text-zinc-500 hover:text-on-surface'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-md">
          {/* Top Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            {/* Balance Card */}
            <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm flex flex-col justify-between h-44 relative overflow-hidden">
              <div>
                <span className="text-[10px] uppercase font-bold text-outline dark:text-zinc-400">Available USD reserves</span>
                <h3 className="text-display-sm font-bold text-primary dark:text-white mt-1">
                  ${balances.usdAvailable?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="flex gap-sm">
                <button onClick={triggerFaucet} className="flex-1 bg-secondary text-white font-bold py-2 px-sm rounded-xl text-xs hover:bg-secondary/90 transition-all flex items-center justify-center gap-xs">
                  <ArrowUpRight size={14} /> Request Faucet
                </button>
              </div>
            </div>

            {/* Locked Reserves Card */}
            <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm flex flex-col justify-between h-44">
              <div>
                <span className="text-[10px] uppercase font-bold text-outline dark:text-zinc-400">Escrowed / Locked NGN</span>
                <h3 className="text-display-sm font-bold text-primary dark:text-white mt-1">
                  ₦{balances.ngnLocked?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="flex justify-between items-center text-xs text-outline">
                <span>Pending settlement cycles</span>
                <span className="font-bold text-primary dark:text-white">₦{balances.ngnPending?.toLocaleString('en-US')}</span>
              </div>
            </div>

            {/* Compliance Status Card */}
            <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm flex flex-col justify-between h-44">
              <div>
                <span className="text-[10px] uppercase font-bold text-outline dark:text-zinc-400">Identity compliance status</span>
                <div className="flex items-center gap-xs mt-2">
                  <span className="material-symbols-outlined text-secondary text-headline-md" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                  <span className="font-bold text-headline-sm text-primary dark:text-white">
                    {passport?.identityStatus === 'Verified' ? 'Compliant Verification' : 'Pending Verification'}
                  </span>
                </div>
              </div>
              <div className="flex gap-sm justify-between">
                <button 
                  onClick={runCameraLiveness}
                  className="w-full bg-primary dark:bg-zinc-800 text-white font-bold py-2 rounded-xl text-xs hover:bg-primary/95 transition-all flex items-center justify-center gap-xs"
                >
                  <Camera size={14} /> Run Liveness check
                </button>
              </div>
            </div>
          </div>

          {/* Liveness Scanner popup */}
          {cameraActive && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-md">
              <div className="bg-zinc-900 text-white rounded-2xl p-lg max-w-sm w-full text-center space-y-md border border-zinc-800 relative">
                <h3 className="font-bold text-headline-sm">Camera Biometric Scan</h3>
                <div className="w-56 h-56 mx-auto rounded-full border-4 border-secondary overflow-hidden relative bg-zinc-950 flex items-center justify-center">
                  <div className="scan-line" />
                  <span className="material-symbols-outlined text-headline-xl text-zinc-800">face</span>
                </div>
                <p className="text-xs text-outline">{scanStatus}</p>
              </div>
            </div>
          )}

          {faucetMsg && (
            <div className="p-sm bg-secondary-container/20 border border-secondary-container text-secondary rounded-xl text-xs flex justify-between items-center">
              <span>{faucetMsg}</span>
              <button onClick={() => setFaucetMsg('')} className="p-1 hover:bg-zinc-800/10 rounded"><X size={12}/></button>
            </div>
          )}

          {/* Recent Settlements Log */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-sm">
            <div className="flex justify-between items-center pb-sm border-b border-outline-variant/20 dark:border-zinc-800/30">
              <h3 className="font-bold text-headline-sm">Settlement History Logs</h3>
              <Clock size={16} className="text-outline" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-outline border-b border-outline-variant/10 text-xs">
                    <th className="pb-xs">Settlement ID</th>
                    <th className="pb-xs">Initiator</th>
                    <th className="pb-xs">Amount</th>
                    <th className="pb-xs">Stage</th>
                    <th className="pb-xs">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {transactions.slice(0, 5).map(tx => (
                    <tr key={tx.id} className="hover:bg-surface-container-lowest/40 dark:hover:bg-zinc-800/10">
                      <td className="py-sm font-mono text-xs text-primary dark:text-zinc-300">{tx.id}</td>
                      <td className="py-sm truncate max-w-[120px] font-mono text-xs text-outline">{tx.initiator}</td>
                      <td className="py-sm font-bold text-on-surface dark:text-white">${parseFloat(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="py-sm text-xs text-on-surface-variant dark:text-zinc-400">{tx.pipelineStage}</td>
                      <td className="py-sm">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === 'Completed' ? 'bg-secondary-container/20 text-secondary' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-lg text-center text-outline">No settlements registered</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wallet & FX */}
      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* FX Converter Card */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <Coins size={18} className="text-secondary" />
              Currency Swap Converter
            </h3>
            {fxError && (
              <div className="p-sm bg-red-500/10 text-red-500 text-xs rounded-xl">{fxError}</div>
            )}
            <div className="space-y-sm">
              <div className="grid grid-cols-2 gap-sm">
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-outline">From Currency</label>
                  <select value={fxFromAsset} onChange={(e) => setFxFromAsset(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800">
                    <option value="USD">USD</option>
                    <option value="NGN">NGN</option>
                    <option value="MockKRW">MockKRW</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-outline">To Currency</label>
                  <select value={fxToAsset} onChange={(e) => setFxToAsset(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800">
                    <option value="MockKRW">MockKRW</option>
                    <option value="USD">USD</option>
                    <option value="NGN">NGN</option>
                  </select>
                </div>
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-bold text-outline font-mono">Amount to Swap</label>
                <input 
                  type="number" 
                  value={fxAmount}
                  onChange={(e) => setFxAmount(e.target.value)}
                  placeholder="0.00" 
                  className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 text-sm"
                />
              </div>

              <div className="flex gap-sm pt-xs">
                <button onClick={calculateFXQuote} className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-on-surface dark:text-white font-bold py-3 rounded-xl hover:bg-zinc-300/40 transition-all text-xs uppercase tracking-wider">
                  Get Conversion Rate
                </button>
                {fxQuote && (
                  <button onClick={executeFXConvert} className="flex-1 bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary/95 transition-all text-xs uppercase tracking-wider">
                    Swap Instantly
                  </button>
                )}
              </div>
            </div>

            {fxQuote && (
              <div className="p-sm bg-surface-container dark:bg-zinc-950 rounded-xl space-y-xs text-xs">
                <div className="flex justify-between">
                  <span className="text-outline">Conversion rate</span>
                  <span className="font-bold">1 {fxFromAsset} = {fxQuote.exchangeRate} {fxToAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Estimated Output</span>
                  <span className="font-bold">{fxQuote.outputAmount} {fxToAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Precompiled sequencer fee</span>
                  <span className="font-bold">${fxQuote.feeUSD} USD</span>
                </div>
              </div>
            )}
          </div>

          {/* Balance Breakdown Card */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <Wallet size={18} className="text-primary-container dark:text-primary-fixed" />
              Multi-Currency Ledger Account
            </h3>
            <div className="divide-y divide-outline-variant/10">
              {[
                { name: 'US Dollar', code: 'USD', val: balances.usdAvailable, locked: balances.usdLocked, sym: '$' },
                { name: 'Korean Won Stable', code: 'MockKRW', val: balances.mockkrwAvailable, locked: balances.mockkrwLocked, sym: '₩' },
                { name: 'Nigerian Naira', code: 'NGN', val: balances.ngnAvailable, locked: balances.ngnLocked, sym: '₦' }
              ].map(ledger => (
                <div key={ledger.code} className="py-sm flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">{ledger.name}</p>
                    <p className="text-xs text-outline">{ledger.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{ledger.sym}{ledger.val?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    {ledger.locked > 0 && (
                      <p className="text-[10px] text-amber-500 font-bold">Locked: {ledger.sym}{ledger.locked?.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Explorer */}
      {activeTab === 'explorer' && (
        <div className="space-y-md">
          {/* Search bar */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-3.5 text-outline" />
            <input 
              type="text" 
              value={explorerSearch}
              onChange={(e) => setExplorerSearch(e.target.value)}
              placeholder="Search settlements by ID or destination address..."
              className="w-full pl-12 pr-sm py-3 bg-white dark:bg-zinc-900/40 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 text-sm"
            />
          </div>

          {/* Settlements Table */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-sm">
            <div className="flex justify-between items-center border-b border-outline-variant/20 dark:border-zinc-800/40 pb-xs">
              <h3 className="font-bold text-headline-sm">Indexed L2 Settlements</h3>
              <span className="text-xs text-outline">Verified on GIWA</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-outline border-b border-outline-variant/10 text-xs">
                    <th className="pb-xs">Settlement ID</th>
                    <th className="pb-xs">Initiator</th>
                    <th className="pb-xs">To Token</th>
                    <th className="pb-xs">Amount</th>
                    <th className="pb-xs">ZK Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 font-mono text-xs">
                  {settlements.filter(s => s.id.includes(explorerSearch) || s.toToken.includes(explorerSearch)).map(s => (
                    <tr 
                      key={s.id} 
                      onClick={() => setSelectedSettlement(s)}
                      className="cursor-pointer hover:bg-surface-container-lowest/40 dark:hover:bg-zinc-800/20"
                    >
                      <td className="py-sm font-bold text-primary dark:text-zinc-300">{s.id}</td>
                      <td className="py-sm truncate max-w-[120px]">{s.initiator}</td>
                      <td className="py-sm truncate max-w-[120px]">{s.toToken}</td>
                      <td className="py-sm font-bold text-on-surface dark:text-white font-sans">${parseFloat(s.amount).toLocaleString()}</td>
                      <td className="py-sm">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary-container/20 text-secondary font-bold">Valid (ZK)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details Modal */}
          {selectedSettlement && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-md">
              <div className="bg-white dark:bg-zinc-900 border border-outline-variant/30 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-lg space-y-md text-sm">
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-xs">
                  <h3 className="font-bold text-headline-sm">Settlement Details</h3>
                  <button onClick={() => setSelectedSettlement(null)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"><X size={16} /></button>
                </div>
                <div className="space-y-sm font-mono text-xs">
                  <div>
                    <span className="text-outline">Settlement ID</span>
                    <p className="font-bold text-on-surface dark:text-white text-sm">{selectedSettlement.id}</p>
                  </div>
                  <div>
                    <span className="text-outline">Initiating L2 Address</span>
                    <p className="truncate text-on-surface dark:text-white">{selectedSettlement.initiator}</p>
                  </div>
                  <div>
                    <span className="text-outline">Escrow Target Token Address</span>
                    <p className="truncate text-on-surface dark:text-white">{selectedSettlement.toToken}</p>
                  </div>
                  <div>
                    <span className="text-outline">Amount Settled</span>
                    <p className="font-bold text-sans text-sm text-secondary">${parseFloat(selectedSettlement.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-outline">Stage</span>
                    <p className="text-on-surface dark:text-white font-sans">{selectedSettlement.pipelineStage}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Organization Control */}
      {activeTab === 'organization' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* Add Team Member form */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <Users size={18} className="text-primary-container dark:text-primary-fixed" />
              Corporate Team Controller
            </h3>
            <form onSubmit={addOrgMember} className="space-y-sm">
              <div className="space-y-xs">
                <label className="text-xs font-bold text-outline">User Email Address</label>
                <input 
                  type="email" 
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="name@company.com" 
                  className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-outline">Authority Role</label>
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800">
                    <option value="FINANCE">FINANCE</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="AUDITOR">AUDITOR</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-outline">Daily Limit (USD)</label>
                  <input 
                    type="number" 
                    value={memberLimit}
                    onChange={(e) => setMemberLimit(e.target.value)}
                    className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 text-sm"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-primary dark:bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-primary/95 transition-all text-xs uppercase tracking-wider">
                Add Team Member
              </button>
            </form>
          </div>

          {/* Org details listing */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <Building size={18} className="text-secondary" />
              Corporate Members Registry
            </h3>
            {organization ? (
              <div className="space-y-sm">
                <div className="flex justify-between border-b border-outline-variant/10 pb-xs">
                  <span className="text-outline">Organization Name</span>
                  <span className="font-bold">{organization.name}</span>
                </div>
                <div className="flex justify-between border-b border-outline-variant/10 pb-xs">
                  <span className="text-outline">Tax Registry ID</span>
                  <span className="font-bold font-mono">{organization.taxId}</span>
                </div>
                <div className="space-y-xs pt-xs">
                  <p className="text-xs font-bold text-outline uppercase tracking-wider">Active Team Members</p>
                  <div className="divide-y divide-outline-variant/10">
                    {organization.members?.map(m => (
                      <div key={m.userId} className="py-sm flex justify-between text-xs">
                        <span>{m.user?.name || m.userId} ({m.role})</span>
                        <span className="font-bold">Limit: ${m.dailySettlementLimit?.toLocaleString()} / day</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-outline text-center py-lg">No active organization linked. Create one on the backend.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Settings / Webhooks */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* Create Webhook form */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <Globe size={18} className="text-secondary" />
              Webhook Event Subscription
            </h3>
            <form onSubmit={createWebhook} className="space-y-sm">
              <div className="space-y-xs">
                <label className="text-xs font-bold text-outline">Target URL</label>
                <input 
                  type="url" 
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com/callbacks" 
                  className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 text-sm"
                  required
                />
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-bold text-outline">Event Wildcard Filter</label>
                <input 
                  type="text" 
                  value={newWebhookEvents}
                  onChange={(e) => setNewWebhookEvents(e.target.value)}
                  placeholder="* or settlement.completed,wallet.credited" 
                  className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 text-sm"
                  required
                />
              </div>

              <button type="submit" className="w-full bg-primary dark:bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-primary/95 transition-all text-xs uppercase tracking-wider">
                Create Webhook Subscription
              </button>
            </form>
          </div>

          {/* Webhooks listing */}
          <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <SettingsIcon size={18} className="text-outline" />
              Webhooks Registry
            </h3>
            <div className="space-y-sm divide-y divide-outline-variant/10">
              {webhooks.map(wh => (
                <div key={wh.id} className="py-sm flex justify-between items-center text-xs">
                  <div className="min-w-0 pr-sm">
                    <p className="font-bold truncate text-primary dark:text-zinc-200">{wh.url}</p>
                    <p className="text-[10px] text-outline truncate font-mono">Secret: {wh.secret.substring(0, 12)}...</p>
                  </div>
                  <button 
                    onClick={() => toggleWebhook(wh.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      wh.active ? 'bg-secondary-container/20 text-secondary' : 'bg-zinc-200 text-outline'
                    }`}
                  >
                    {wh.active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
              {webhooks.length === 0 && (
                <p className="text-xs text-outline text-center py-lg">No active webhooks registered</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

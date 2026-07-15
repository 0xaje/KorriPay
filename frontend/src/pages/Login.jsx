import React, { useState } from 'react';
import { useApp } from '../App';
import { 
  Shield, 
  Mail, 
  Lock, 
  ArrowRight, 
  Terminal, 
  Activity, 
  Coins, 
  Layers, 
  Eye, 
  EyeOff,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';

export default function Login() {
  const { setUser } = useApp();
  
  // Auth state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/signin';
    const payload = isSignUp ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          walletAddress: data.user.walletAddress
        });
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection to auth server failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo.institution@korri.pay', password: 'demo' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          walletAddress: data.user.walletAddress
        });
      } else {
        setError(data.error || 'Demo login failed');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-zinc-950 text-on-surface dark:text-zinc-100 flex flex-col font-sans transition-colors relative overflow-x-hidden">
      
      {/* Decorative Orbs */}
      <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[400px] right-[-200px] w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/80 dark:bg-zinc-950/80 border-b border-outline-variant/30 dark:border-zinc-800/40 transition-all">
        <div className="max-w-7xl mx-auto px-md h-16 flex items-center justify-between">
          <div className="flex items-center gap-xs">
            <div className="w-9 h-9 bg-secondary-container/20 dark:bg-zinc-900 rounded-xl flex items-center justify-center text-secondary">
              <Shield size={20} className="fill-secondary/20" />
            </div>
            <span className="font-bold text-headline-sm tracking-tight text-primary dark:text-white">KorriPay</span>
          </div>

          {/* Desktop Nav links */}
          <nav className="hidden md:flex items-center gap-md text-xs font-semibold text-outline-variant dark:text-zinc-400">
            <a href="#features" className="hover:text-primary dark:hover:text-white transition-colors">Integrity Engine</a>
            <a href="#stats" className="hover:text-primary dark:hover:text-white transition-colors">Metrics</a>
            <a href="#developers" className="hover:text-primary dark:hover:text-white transition-colors">Developer Portal</a>
          </nav>

          <div className="flex items-center gap-sm">
            <button 
              onClick={() => {
                setError('');
                setIsSignUp(false);
                setShowAuthModal(true);
              }}
              className="bg-primary hover:bg-primary/95 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs py-2.5 px-md rounded-xl transition-all shadow-md active:scale-95"
            >
              Launch Portal
            </button>
            <button 
              className="md:hidden p-xs text-outline hover:text-primary dark:hover:text-white rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-outline-variant/20 dark:border-zinc-800 bg-background dark:bg-zinc-950 px-md py-sm space-y-sm absolute w-full left-0 z-30 shadow-lg">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-xs font-semibold text-xs text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white"
            >
              Integrity Engine
            </a>
            <a 
              href="#stats" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-xs font-semibold text-xs text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white"
            >
              Metrics
            </a>
            <a 
              href="#developers" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-xs font-semibold text-xs text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white"
            >
              Developer Portal
            </a>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 max-w-7xl mx-auto px-md py-xl space-y-xl z-10">
        <section className="text-center max-w-3xl mx-auto space-y-md py-lg">
          <div className="inline-flex items-center gap-xs px-3 py-1 bg-secondary-container/20 rounded-full text-secondary text-[11px] font-bold tracking-wide">
            <Activity size={12} /> GIWA L2 Attestation Channel Online
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight text-primary dark:text-white">
            Programmable Fiat Settlement <br />
            <span className="bg-gradient-to-r from-secondary to-green-500 bg-clip-text text-transparent">
              On Layer 2 Channels
            </span>
          </h1>
          <p className="text-body-md text-outline dark:text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base">
            Powering real-time corporate payments and settlement liquidity. Integrated with ZK-based EAS credentials on the GIWA network with double-spend protection.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-sm pt-xs">
            <button 
              onClick={() => {
                setError('');
                setIsSignUp(false);
                setShowAuthModal(true);
              }}
              className="w-full sm:w-auto bg-secondary hover:bg-secondary/95 text-white font-bold py-3 px-xl rounded-xl transition-all shadow-md flex items-center justify-center gap-xs active:scale-95"
            >
              Launch Dashboard <ArrowRight size={16} />
            </button>
            <button 
              onClick={handleDemoSignIn}
              className="w-full sm:w-auto bg-white/70 dark:bg-zinc-900 border border-outline-variant/30 dark:border-zinc-800/80 hover:bg-surface-container text-primary dark:text-white font-bold py-3 px-xl rounded-xl transition-all active:scale-95"
            >
              Demo Institution
            </button>
          </div>
        </section>

        {/* METRICS SECTION */}
        <section id="stats" className="grid grid-cols-1 md:grid-cols-3 gap-sm text-center pt-md">
          <div className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-xs">
            <p className="text-display-lg font-bold text-primary dark:text-white font-mono">2.4s</p>
            <p className="text-xs text-outline uppercase font-bold tracking-wider">Settlement Finality</p>
            <p className="text-[11px] text-outline/80">Real-time payment channel liquidity confirmation</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-xs">
            <p className="text-display-lg font-bold text-secondary font-mono">0.01%</p>
            <p className="text-xs text-outline uppercase font-bold tracking-wider">Average Transaction Cost</p>
            <p className="text-[11px] text-outline/80">Minimized execution overhead on L2 pools</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-xs">
            <p className="text-display-lg font-bold text-primary dark:text-white font-mono">$4.2M+</p>
            <p className="text-xs text-outline uppercase font-bold tracking-wider">Dynamic L2 Swap Volume</p>
            <p className="text-[11px] text-outline/80">Transacted across corporate settlement contracts</p>
          </div>
        </section>

        {/* BENTO GRID FEATURES */}
        <section id="features" className="space-y-md pt-lg">
          <div className="text-center space-y-xs">
            <h2 className="text-headline-lg font-bold text-primary dark:text-white">KorriPay Integrity Engine</h2>
            <p className="text-xs text-outline">Shielding corporate financial pipelines with modern L2 blockchain primitives</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            
            {/* Double Spend Lock Card */}
            <div className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm flex flex-col justify-between h-56 hover:shadow-md transition-all">
              <div className="space-y-xs">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary dark:text-primary-fixed-dim">
                  <Lock size={18} />
                </div>
                <h3 className="font-bold text-sm text-primary dark:text-white">Double-Spend Prevention</h3>
                <p className="text-xs text-outline">
                  Pessimistic database locking combined with Redis distributed synchronization shields ledger channels against race conditions.
                </p>
              </div>
            </div>

            {/* ZK Cryptographic Proofs Card */}
            <div className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm flex flex-col justify-between h-56 hover:shadow-md transition-all">
              <div className="space-y-xs">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                  <Shield size={18} />
                </div>
                <h3 className="font-bold text-sm text-primary dark:text-white">ZK Cryptographic Proofs</h3>
                <p className="text-xs text-outline">
                  Generate verifiable identity proof keys locally using EAS contract registries deployed directly on the GIWA network.
                </p>
              </div>
            </div>

            {/* Compliance Passport Card */}
            <div className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm flex flex-col justify-between h-56 hover:shadow-md transition-all md:col-span-2 lg:col-span-1">
              <div className="space-y-xs">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                  <Layers size={18} />
                </div>
                <h3 className="font-bold text-sm text-primary dark:text-white">Compliance Passports</h3>
                <p className="text-xs text-outline">
                  Real-time sanction screening logs and automated compliance audits linked directly to L2 addresses.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* DEVELOPERS SECTION */}
        <section id="developers" className="bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/40 p-md sm:p-lg rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-md">
          <div className="space-y-xs max-w-lg">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary dark:text-primary-fixed-dim">
              <Terminal size={18} />
            </div>
            <h3 className="font-bold text-headline-sm text-primary dark:text-white">RESTful Developer APIs</h3>
            <p className="text-xs text-outline">
              Automate payment sweeps, query attestation events, and trigger webhooks using standard REST interfaces. Integrate in minutes.
            </p>
          </div>
          <button 
            onClick={() => {
              setError('');
              setIsSignUp(false);
              setShowAuthModal(true);
            }}
            className="w-full md:w-auto bg-primary dark:bg-zinc-800 text-white font-bold py-3 px-xl rounded-xl hover:bg-primary/95 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-xs active:scale-95 shrink-0"
          >
            Open SDK Docs <ArrowRight size={14} />
          </button>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-outline-variant/20 dark:border-zinc-800/60 bg-white/30 dark:bg-zinc-950/20 py-sm">
        <div className="max-w-7xl mx-auto px-md flex flex-col sm:flex-row items-center justify-between gap-sm text-[10px] text-outline">
          <span>&copy; 2026 KorriPay Inc. All rights reserved.</span>
          <div className="flex gap-sm">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* SIGN SIGN SIGNATURE/AUTH MODAL DRAWER */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-sm">
          {/* Backdrop Overlay */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAuthModal(false)}
          />

          {/* Modal Container */}
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl shadow-2xl p-lg relative z-10 space-y-md animate-scale-up">
            
            {/* Close Button */}
            <button 
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-xs rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-xs">
              <div className="inline-flex w-14 h-14 bg-secondary-container/20 rounded-2xl items-center justify-center text-secondary mb-xs">
                <Shield size={24} className="fill-secondary/15" />
              </div>
              <h2 className="text-headline-sm font-extrabold text-zinc-900 dark:text-white">
                {isSignUp ? 'Create Corporate Portal' : 'Access Corporate Portal'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Provide corporate signature verification credentials to sync ledger.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-xs p-sm bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-sm">
              {isSignUp && (
                <div className="space-y-xs">
                  <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Institution Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Korri Institution Ltd" 
                    className="w-full px-sm py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all text-xs"
                    required
                  />
                </div>
              )}

              <div className="space-y-xs">
                <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Corporate Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-3.5 text-zinc-400 dark:text-zinc-500" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operations@korri.pay" 
                    className="w-full pl-10 pr-sm py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-xs">
                <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Security Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-3.5 text-zinc-400 dark:text-zinc-500" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all text-xs"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-secondary text-white font-bold py-2.5 px-md rounded-xl text-xs hover:bg-secondary/95 transition-all active:scale-95 shadow-md disabled:opacity-50 flex justify-center items-center gap-xs cursor-pointer"
              >
                {loading ? 'Requesting verify...' : (isSignUp ? 'Generate Credentials' : 'Verify Signature')}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-sm">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100 dark:border-zinc-800" />
              </div>
              <span className="relative px-2 bg-white dark:bg-zinc-900 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">OR</span>
            </div>

            <div className="space-y-xs">
              <button 
                onClick={handleDemoSignIn}
                disabled={loading}
                className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-2.5 px-md rounded-xl text-xs transition-all active:scale-95 flex justify-center items-center gap-xs cursor-pointer"
              >
                Sign In As Demo Institution
              </button>
              <button 
                type="button"
                onClick={() => {
                  setError('');
                  setIsSignUp(!isSignUp);
                }}
                className="w-full text-center text-[10px] text-secondary hover:underline font-bold cursor-pointer"
              >
                {isSignUp ? 'Already registered? Verify signature' : 'Request new corporate credentials'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

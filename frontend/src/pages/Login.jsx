import React, { useState } from 'react';
import { useApp } from '../App';
import { Shield, Mail, Lock, Key, Compass, AlertCircle } from 'lucide-react';

export default function Login() {
  const { setUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-zinc-950 p-sm relative overflow-hidden">
      {/* Decorative Background Orbs */}
      <div className="absolute top-12 left-12 w-96 h-96 bg-primary/10 rounded-full floating-orb animate-subtle-pulse" />
      <div className="absolute bottom-12 right-12 w-96 h-96 bg-secondary/10 rounded-full floating-orb animate-subtle-pulse" />

      <div className="w-full max-w-md bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/50 rounded-2xl shadow-xl p-lg relative z-10 space-y-md">
        <div className="text-center space-y-xs">
          <div className="inline-flex w-16 h-16 bg-secondary-container/20 rounded-2xl items-center justify-center text-secondary mb-xs">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          </div>
          <h2 className="text-display-sm font-bold tracking-tight text-primary dark:text-white">Welcome to KorriPay</h2>
          <p className="text-body-sm text-outline dark:text-zinc-400">
            Institutional Programmable L2 Settlement Infrastructure
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-xs p-sm bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-sm">
          {isSignUp && (
            <div className="space-y-xs">
              <label className="text-xs font-bold text-outline dark:text-zinc-400 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe" 
                className="w-full px-sm py-3 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white transition-all text-sm"
                required
              />
            </div>
          )}

          <div className="space-y-xs">
            <label className="text-xs font-bold text-outline dark:text-zinc-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-3.5 text-outline dark:text-zinc-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="institution@domain.com" 
                className="w-full pl-12 pr-sm py-3 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white transition-all text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-xs">
            <label className="text-xs font-bold text-outline dark:text-zinc-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-3.5 text-outline dark:text-zinc-500" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full pl-12 pr-sm py-3 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white transition-all text-sm"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary dark:bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-primary/95 hover:shadow-md transition-all active:scale-98 disabled:opacity-50 text-sm"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Corporate Account' : 'Sign In'}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-outline-variant/20 dark:border-zinc-800/40"></div>
          <span className="flex-shrink mx-4 text-xs font-bold text-outline uppercase tracking-wider">Or</span>
          <div className="flex-grow border-t border-outline-variant/20 dark:border-zinc-800/40"></div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <button 
            onClick={handleDemoSignIn}
            className="flex items-center justify-center gap-xs px-sm py-3 rounded-xl border border-outline-variant/30 hover:bg-surface-container dark:hover:bg-zinc-800/25 transition-all text-xs font-bold uppercase tracking-wider"
          >
            <Compass size={16} className="text-secondary" />
            Demo Sandbox
          </button>

          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="flex items-center justify-center gap-xs px-sm py-3 rounded-xl border border-outline-variant/30 hover:bg-surface-container dark:hover:bg-zinc-800/25 transition-all text-xs font-bold uppercase tracking-wider"
          >
            <Key size={16} className="text-primary-container dark:text-primary-fixed" />
            {isSignUp ? 'Use Sign In' : 'Sign Up Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

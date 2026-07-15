import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Pay() {
  const { id } = useParams();
  const [amount, setAmount] = useState('50.00');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePayment = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSuccess(true);
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-zinc-950 p-sm relative">
      <div className="w-full max-w-md bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-outline-variant/30 dark:border-zinc-800/50 rounded-2xl shadow-xl p-lg space-y-md">
        <div className="text-center space-y-xs">
          <div className="inline-flex w-12 h-12 bg-secondary-container/20 rounded-xl items-center justify-center text-secondary mb-xs">
            <Shield size={24} />
          </div>
          <h2 className="text-headline-md font-bold text-primary dark:text-white">Secure checkout gateway</h2>
          <p className="text-xs text-outline">L2 Escrow payment channel ID: {id || 'demo-checkout'}</p>
        </div>

        {success ? (
          <div className="text-center space-y-md py-sm">
            <div className="inline-flex text-secondary success-pulse p-2 bg-secondary/15 rounded-full">
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-xs">
              <h3 className="font-bold text-headline-sm text-secondary">Settlement Commited!</h3>
              <p className="text-xs text-outline">The funds have been escrowed and a ZK proof is being compiled.</p>
            </div>
            <Link to="/" className="inline-flex items-center gap-xs text-xs font-bold text-primary dark:text-zinc-300 uppercase tracking-wider">
              Return Home <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handlePayment} className="space-y-sm">
            <div className="space-y-xs">
              <label className="text-xs font-bold text-outline">Checkout Amount (USD)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" 
                className="w-full p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 font-mono font-bold dark:text-white"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary/95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-xs"
            >
              {loading ? 'Processing Escrow...' : `Pay $${amount} USD`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

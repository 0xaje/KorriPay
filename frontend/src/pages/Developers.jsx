import React, { useState } from 'react';
import { Terminal, Key, ShieldCheck, RefreshCw, FileCode, Check } from 'lucide-react';

export default function Developers() {
  const [apiKey, setApiKey] = useState('kp_live_55ab83cd22194f4a3e81ff0092');
  const [copied, setCopied] = useState(false);

  const rotateApiKey = () => {
    // Generate new mock key
    const hex = Math.floor(Math.random() * 1e16).toString(16);
    setApiKey(`kp_live_${hex}`);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Developer Sandbox Portal</h2>
          <p className="text-xs text-outline">Manage institutional API integrations, keys, and webhook logs</p>
        </div>
        <Terminal size={24} className="text-secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Credentials manager */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
          <h3 className="font-bold text-headline-sm flex items-center gap-xs">
            <Key size={18} className="text-secondary" />
            API Authentication Credentials
          </h3>
          <p className="text-xs text-outline">
            Use these keys to authenticate server-to-server requests to the KorriPay API. Keep them secure.
          </p>

          <div className="space-y-sm">
            <div className="space-y-xs">
              <label className="text-xs font-bold text-outline">Active API Key</label>
              <div className="flex gap-sm">
                <input 
                  type="text" 
                  value={apiKey} 
                  readOnly
                  className="flex-1 p-3 rounded-xl border border-outline-variant/30 dark:bg-zinc-950 dark:border-zinc-800 font-mono text-xs dark:text-white"
                />
                <button 
                  onClick={handleCopy}
                  className="bg-primary dark:bg-zinc-800 text-white font-bold py-3 px-sm rounded-xl text-xs hover:bg-primary/95 transition-all flex items-center justify-center gap-xs"
                >
                  {copied ? <Check size={14} className="text-secondary-fixed-dim" /> : 'Copy Key'}
                </button>
              </div>
            </div>

            <button 
              onClick={rotateApiKey}
              className="flex items-center gap-xs text-xs text-outline hover:text-primary transition-all font-bold uppercase tracking-wider font-mono"
            >
              <RefreshCw size={12} /> Rotate Security Token
            </button>
          </div>
        </div>

        {/* Quick Docs card */}
        <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
          <h3 className="font-bold text-headline-sm flex items-center gap-xs">
            <FileCode size={18} className="text-primary-container dark:text-primary-fixed" />
            Quick API Reference
          </h3>
          <div className="space-y-sm text-xs font-mono">
            <div className="bg-zinc-950 text-zinc-300 p-sm rounded-xl space-y-xs">
              <span className="text-[10px] text-green-400">POST /api/v1/settlements</span>
              <pre className="text-[10px] text-zinc-400">
{`{
  "amount": 1250.00,
  "currency": "USD",
  "recipientAddress": "0x55ab..."
}`}
              </pre>
            </div>
            <div className="bg-zinc-950 text-zinc-300 p-sm rounded-xl space-y-xs">
              <span className="text-[10px] text-green-400">GET /api/v1/proofs/:id</span>
              <pre className="text-[10px] text-zinc-400">
{`{
  "id": "settlement-10492",
  "status": "Verified",
  "zkProof": "0x4cc..."
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

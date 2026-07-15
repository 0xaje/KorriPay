import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Server, AlertTriangle, RefreshCw } from 'lucide-react';

export default function NetworkOperations() {
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/operations/status');
      const data = await res.json();
      if (res.ok && data.success) {
        setOperations(data);
      } else {
        setError(data.error || 'Failed to retrieve operations registry');
      }
    } catch (err) {
      setError('Network communication check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Network Operations Dashboard</h2>
          <p className="text-xs text-outline">Real-time node health monitoring and decentralized infrastructure checks on GIWA L2</p>
        </div>
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className="p-sm hover:bg-surface-container dark:hover:bg-zinc-800 rounded-xl text-outline hover:text-primary dark:hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-xs p-sm bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Status Banner */}
      <div className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-sm shadow-sm">
        <div className="flex items-center gap-sm">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              operations?.healthScore >= 80 ? 'bg-secondary' : 'bg-red-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              operations?.healthScore >= 80 ? 'bg-secondary' : 'bg-red-500'
            }`} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-primary dark:text-white">
              System Health Score: {operations?.healthScore ?? '--'}%
            </h3>
            <p className="text-xs text-outline">
              Status: {operations?.healthScore >= 80 ? 'Optimized Performance' : 'Degraded State / Offline Fallback active'}
            </p>
          </div>
        </div>
        <div className="flex gap-sm text-center">
          <div className="px-sm py-1 bg-surface-container dark:bg-zinc-800/40 rounded-lg text-xs font-bold text-outline dark:text-zinc-300">
            L2 Sequencer: {operations?.activeSequencerAddress ? 'Active' : 'Offline'}
          </div>
          <div className="px-sm py-1 bg-surface-container dark:bg-zinc-800/40 rounded-lg text-xs font-bold text-outline dark:text-zinc-300">
            EAS Attestation Registry: {operations?.attestationStatus ?? 'Offline'}
          </div>
        </div>
      </div>

      {/* Grid List of Infrastructure nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
        {operations?.providers?.map((node) => (
          <div key={node.id} className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-md flex flex-col justify-between hover:shadow-md transition-all">
            <div className="space-y-sm">
              <div className="flex justify-between items-start">
                <div className="p-xs bg-secondary-container/20 rounded-lg text-secondary">
                  <Server size={18} />
                </div>
                <div className="flex items-center gap-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${node.healthy ? 'bg-secondary' : 'bg-red-500'}`} />
                  <span className="text-[10px] uppercase font-bold text-outline tracking-wider">
                    {node.healthy ? 'Operational' : 'Unreachable'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-primary dark:text-white">{node.name}</h4>
                <p className="text-[10px] text-outline font-mono truncate max-w-[200px]">{node.url}</p>
                <p className="text-xs text-outline/80 mt-xs capitalize">Type: {node.type}</p>
              </div>
            </div>

            <div className="border-t border-outline-variant/10 dark:border-zinc-800 pt-sm flex justify-between items-center text-[10px] text-outline uppercase font-bold tracking-wider">
              <span>Latency</span>
              <span className="font-mono text-xs font-bold text-primary dark:text-white">{node.latency ?? '--'} ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

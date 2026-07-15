import React, { useState, useEffect } from 'react';
import { Layers, ArrowRight, ShieldCheck, Database, RefreshCw, ChevronRight } from 'lucide-react';

export default function SettlementEngine() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSettlement, setSelectedSettlement] = useState(null);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settlements');
      const data = await res.json();
      if (res.ok && data.success) {
        setSettlements(data.settlements);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const getStageColor = (stage) => {
    switch (stage) {
      case 'Archive':
      case 'Completed':
        return 'text-secondary bg-secondary-container/20 border-secondary/30';
      case 'Failed':
        return 'text-error bg-error-container/20 border-error/30';
      default:
        return 'text-primary bg-primary-container/20 border-primary/30';
    }
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Settlement Engine Subsystem</h2>
          <p className="text-xs text-outline">Inspect the state transitions, distributed double-spend locking locks, and verification proofs of GIWA channels</p>
        </div>
        <button 
          onClick={fetchSettlements}
          className="p-sm hover:bg-surface-container dark:hover:bg-zinc-800 rounded-xl text-outline hover:text-primary dark:hover:text-white transition-all"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Settlement ledger queue */}
        <div className="lg:col-span-2 space-y-md">
          <div className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-sm">
            <h3 className="font-bold text-sm text-primary dark:text-white flex items-center gap-xs">
              <Database size={16} className="text-secondary" /> Active State Machine Ledger
            </h3>

            {loading ? (
              <div className="py-xl text-center text-xs text-outline animate-pulse">Loading transaction registries...</div>
            ) : settlements.length === 0 ? (
              <div className="py-xl text-center text-xs text-outline italic">No active settlement pipelines detected. Use sandbox to generate logs.</div>
            ) : (
              <div className="divide-y divide-outline-variant/10 dark:divide-zinc-800/40">
                {settlements.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedSettlement(item)}
                    className="py-sm flex justify-between items-center cursor-pointer hover:bg-surface-container/50 dark:hover:bg-zinc-800/30 rounded-xl px-xs transition-colors"
                  >
                    <div className="space-y-xs min-w-0">
                      <div className="flex items-center gap-xs">
                        <span className="font-bold text-xs text-primary dark:text-white font-mono truncate max-w-[120px]">{item.id}</span>
                        <ChevronRight size={12} className="text-outline" />
                        <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${getStageColor(item.stage)}`}>
                          {item.stage}
                        </span>
                      </div>
                      <p className="text-[10px] text-outline">
                        Source: {item.sourceAsset} &rarr; Recipient: {item.destinationAsset} | Amount: ${item.amount}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs text-primary dark:text-white font-mono">${item.amount}</span>
                      <p className="text-[9px] text-outline uppercase tracking-wider">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Settlement Pipeline Visualizer */}
        <div className="space-y-md">
          {selectedSettlement ? (
            <div className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-md">
              <div className="border-b border-outline-variant/15 dark:border-zinc-800/50 pb-sm">
                <h3 className="font-bold text-sm text-primary dark:text-white">Pipeline Execution Details</h3>
                <span className="font-mono text-[10px] text-outline">{selectedSettlement.id}</span>
              </div>

              {/* State progression */}
              <div className="space-y-sm">
                <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider">L2 Locking Engine Progression</h4>
                
                <div className="relative border-l border-outline-variant/30 dark:border-zinc-800 pl-4 ml-1 space-y-sm py-1">
                  <div className="relative flex items-center gap-xs">
                    <span className="absolute -left-[21px] w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-[11px] font-bold text-primary dark:text-white">Compliance Screen Verified</span>
                  </div>
                  <div className="relative flex items-center gap-xs">
                    <span className="absolute -left-[21px] w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-[11px] font-bold text-primary dark:text-white">Distributed Lock Resolved</span>
                  </div>
                  <div className="relative flex items-center gap-xs">
                    <span className="absolute -left-[21px] w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-[11px] font-bold text-primary dark:text-white">L2 Ledger Transitioned</span>
                  </div>
                  <div className="relative flex items-center gap-xs">
                    <span className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                      selectedSettlement.stage === 'Archive' || selectedSettlement.stage === 'Completed' ? 'bg-secondary' : 'bg-outline-variant'
                    }`} />
                    <span className="text-[11px] font-bold text-primary dark:text-white">ZK Verification Proof Generated</span>
                  </div>
                </div>
              </div>

              {/* Proof details */}
              <div className="space-y-xs pt-xs">
                <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider">L2 Cryptographic Proof</h4>
                <div className="bg-zinc-950 p-xs rounded-xl font-mono text-[9px] text-green-400 overflow-x-auto h-32 no-scrollbar border border-zinc-800">
                  <pre>{JSON.stringify(selectedSettlement.proof || { error: "No ZK Proof compiled yet" }, null, 2)}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/30 dark:bg-zinc-900/10 border border-dashed border-outline-variant/30 dark:border-zinc-800 p-lg rounded-2xl text-center text-xs text-outline italic">
              Select an active settlement pipeline from the queue list to audit state transitions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

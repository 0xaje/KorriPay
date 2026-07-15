import React, { useState } from 'react';
import { FileText, Play, Clock, Database } from 'lucide-react';

export default function SettlementSandbox() {
  const [simulationLogs, setSimulationLogs] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const simulationSteps = [
    { title: 'Create Request', desc: 'Initialize L2 settlement parameter payloads' },
    { title: 'Compliance Screening', desc: 'Verify blacklists and EAS identity attestation' },
    { title: 'Route Selection', desc: 'Identify optimal pool route liquidity nodes' },
    { title: 'Execution & Lock', desc: 'Commit pessimistic lock transaction to database' },
    { title: 'ZK Proof Generation', desc: 'Compile cryptographic proofs & verify on-chain' },
    { title: 'Archive & Dispatch', desc: 'Commit receipt logs and dispatch webhooks' }
  ];

  const runSimulation = () => {
    setLoading(true);
    setSimulationLogs([]);
    setActiveStep(0);

    const logs = [
      'Creating settlement request payload... [Amount: $2,500 USD]',
      'Checking receiver address identity attestation details...',
      'Searching optimal routing pools for USD -> KRW liquidity...',
      'Initiating double-spend prevention database locks...',
      'Broadcasting lock transaction transaction receipt...',
      'Generating ZK SNARK verification proof...',
      'Archiving transaction details to indexed logs...',
      'Dispatching webhook payloads to subscribers...'
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setSimulationLogs(prev => [...prev, logs[i]]);
        setActiveStep(Math.min(Math.floor(i * 0.8), 5));
        i++;
      } else {
        clearInterval(interval);
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Settlement Sandbox</h2>
          <p className="text-xs text-outline">Simulate the 5-stage real-time settlement cycle with zero-knowledge verification</p>
        </div>
        <FileText size={24} className="text-secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Simulation timeline */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-headline-sm flex items-center gap-xs">
              <Database size={18} className="text-secondary" />
              Settlement Engine Timeline
            </h3>
            <button 
              onClick={runSimulation}
              disabled={loading}
              className="bg-secondary text-white font-bold py-2 px-md rounded-xl text-xs hover:bg-secondary/90 transition-all flex items-center justify-center gap-xs disabled:opacity-50"
            >
              <Play size={14} /> {loading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>

          <div className="relative border-l-2 border-outline-variant/30 dark:border-zinc-800/50 pl-md ml-xs space-y-md py-xs">
            {simulationSteps.map((step, idx) => (
              <div key={step.title} className="relative">
                <span className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-zinc-950 transition-all ${
                  idx <= activeStep ? 'border-secondary bg-secondary' : 'border-outline-variant/50'
                }`} />
                <h4 className={`font-bold text-sm ${idx <= activeStep ? 'text-secondary dark:text-secondary-fixed-dim font-bold' : 'text-outline'}`}>
                  {step.title}
                </h4>
                <p className="text-xs text-outline">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live logs console */}
        <div className="bg-zinc-950 text-zinc-300 p-md rounded-2xl border border-zinc-800/40 shadow-sm space-y-md font-mono text-xs h-[400px] flex flex-col justify-between">
          <div className="flex justify-between border-b border-zinc-800 pb-xs text-[10px] text-zinc-500">
            <span>SANDBOX CONSOLE LOGS</span>
            <Clock size={12} />
          </div>
          <div className="flex-1 overflow-y-auto space-y-xs py-sm pr-xs no-scrollbar">
            {simulationLogs.map((log, idx) => (
              <p key={idx} className="text-[11px] text-green-400">
                {`> ${log}`}
              </p>
            ))}
            {simulationLogs.length === 0 && (
              <p className="text-zinc-500 italic text-center py-lg">Console offline. Trigger simulation to start.</p>
            )}
          </div>
          <div className="border-t border-zinc-800 pt-xs text-[10px] text-zinc-500 flex justify-between">
            <span>Status: {loading ? 'Executing pipeline' : 'Ready'}</span>
            <span>Version L2.RC3</span>
          </div>
        </div>
      </div>
    </div>
  );
}

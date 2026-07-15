import React, { useState } from 'react';
import { Terminal, Send, HelpCircle, Code } from 'lucide-react';

export default function ApiPlayground() {
  const [selectedEndpoint, setSelectedEndpoint] = useState('convert');
  const [payloadJson, setPayloadJson] = useState('{\n  "fromAsset": "USD",\n  "toAsset": "EUR",\n  "amount": 100\n}');
  const [responseOutput, setResponseOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestHeaders, setRequestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');

  const handleEndpointChange = (val) => {
    setSelectedEndpoint(val);
    if (val === 'convert') {
      setPayloadJson('{\n  "fromAsset": "USD",\n  "toAsset": "EUR",\n  "amount": 100\n}');
    } else if (val === 'attest') {
      setPayloadJson('{\n  "subjectWallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",\n  "schema": "0x4700000000000000000000000000000000000000000000000000000000000000",\n  "attester": "0x3C44CdD362c370bc3615243BD402C93c2004B258"\n}');
    } else if (val === 'resolve') {
      setPayloadJson('{\n  "name": "corporate.up.id"\n}');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponseOutput('');

    let endpointUrl = '';
    let method = 'POST';

    if (selectedEndpoint === 'convert') {
      endpointUrl = '/api/fx/convert';
    } else if (selectedEndpoint === 'attest') {
      endpointUrl = '/api/attestations';
    } else if (selectedEndpoint === 'resolve') {
      endpointUrl = '/api/contacts/resolve';
      method = 'POST';
    }

    try {
      const parsedPayload = JSON.parse(payloadJson);
      const res = await fetch(endpointUrl, {
        method,
        headers: JSON.parse(requestHeaders),
        body: method === 'GET' ? undefined : JSON.stringify(parsedPayload)
      });
      const data = await res.json();
      setResponseOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponseOutput(JSON.stringify({ error: err.message || 'API sandbox communication failed' }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Interactive API Playground</h2>
          <p className="text-xs text-outline">Interact directly with the KorriPay sandbox ledger API endpoints and explore SDK models</p>
        </div>
        <Terminal size={24} className="text-secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Request Panel */}
        <form onSubmit={handleSend} className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-md">
          <div className="space-y-xs">
            <label className="text-[10px] font-bold text-outline uppercase tracking-wider">REST Sandbox Endpoint</label>
            <select
              value={selectedEndpoint}
              onChange={(e) => handleEndpointChange(e.target.value)}
              className="w-full px-sm py-2.5 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white text-xs font-semibold"
            >
              <option value="convert">POST /api/fx/convert (FX Conversion Quote)</option>
              <option value="attest">POST /api/attestations (Issue EAS Attestation)</option>
              <option value="resolve">POST /api/contacts/resolve (Resolve Name/Suffix)</option>
            </select>
          </div>

          <div className="space-y-xs">
            <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Request Headers</label>
            <textarea
              rows={2}
              value={requestHeaders}
              onChange={(e) => setRequestHeaders(e.target.value)}
              className="w-full px-sm py-2.5 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white font-mono text-xs"
            />
          </div>

          <div className="space-y-xs">
            <label className="text-[10px] font-bold text-outline uppercase tracking-wider">JSON Payload Input</label>
            <textarea
              rows={6}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full px-sm py-2.5 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary dark:bg-zinc-800 hover:bg-primary/95 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-xs"
          >
            <Send size={14} /> {loading ? 'Executing request...' : 'Send API Request'}
          </button>
        </form>

        {/* Response Panel */}
        <div className="bg-zinc-950 text-zinc-300 p-md rounded-2xl border border-zinc-800/40 shadow-sm space-y-md font-mono text-xs flex flex-col justify-between h-[450px]">
          <div className="flex justify-between border-b border-zinc-800 pb-xs text-[10px] text-zinc-500">
            <span>SANDBOX RESPONSE LOGS</span>
            <Code size={12} />
          </div>
          <div className="flex-1 overflow-y-auto space-y-xs py-sm pr-xs no-scrollbar">
            {responseOutput ? (
              <pre className="text-green-400 text-[11px] leading-relaxed">{responseOutput}</pre>
            ) : (
              <p className="text-zinc-500 italic text-center py-lg">No response received yet. Submit request console to query sandbox.</p>
            )}
          </div>
          <div className="border-t border-zinc-800 pt-xs text-[10px] text-zinc-500">
            <span>Response Header: application/json; charset=utf-8</span>
          </div>
        </div>
      </div>
    </div>
  );
}

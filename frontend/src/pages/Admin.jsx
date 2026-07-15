import React, { useState, useEffect } from 'react';
import { Shield, Check, X, FileCheck, Info, Users } from 'lucide-react';

export default function Admin() {
  const [attestations, setAttestations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchAttestations = async () => {
    try {
      const res = await fetch('/api/v1/attestations');
      const data = await res.json();
      if (res.ok && data.success) {
        setAttestations(data.attestations);
      }
    } catch (e) {
      console.warn("Failed to load attestations");
    }
  };

  const fetchUsersList = async () => {
    try {
      // Simulate/retrieve active users list
      const res = await fetch('/api/v1/organizations/my-org');
      const data = await res.json();
      if (res.ok && data.success && data.organization) {
        setUsers(data.organization.members || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchAttestations();
    fetchUsersList();
  }, []);

  const handleApproveAttestation = async (id) => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/v1/attestations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'Active',
          verificationState: 'Valid'
        })
      });
      if (res.ok) {
        setMsg('Attestation verified successfully!');
        fetchAttestations();
      } else {
        setMsg('Verification update failed.');
      }
    } catch (err) {
      setMsg('Request error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAttestation = async (id) => {
    setLoading(true);
    setMsg('');
    try {
      // Simulating revocation payload update
      const res = await fetch(`/api/v1/attestations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'Revoked',
          verificationState: 'Invalid'
        })
      });
      if (res.ok) {
        setMsg('Attestation revoked successfully!');
        fetchAttestations();
      } else {
        setMsg('Revocation failed.');
      }
    } catch (err) {
      setMsg('Request error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Compliance Admin Console</h2>
          <p className="text-xs text-outline">Manage on-chain attestation workflows, registry credentials, and audits</p>
        </div>
        <Shield size={24} className="text-secondary" />
      </div>

      {msg && (
        <div className="p-sm bg-secondary-container/20 border border-secondary-container text-secondary rounded-xl text-xs flex justify-between items-center">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="p-1 hover:bg-zinc-800/10 rounded"><X size={12}/></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Attestations Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
          <h3 className="font-bold text-headline-sm flex items-center gap-xs">
            <FileCheck size={18} className="text-secondary" />
            Compliance Attestation Registry
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-outline border-b border-outline-variant/10 text-xs">
                  <th className="pb-xs">Subject Wallet</th>
                  <th className="pb-xs">Schema</th>
                  <th className="pb-xs">Status</th>
                  <th className="pb-xs">Provider</th>
                  <th className="pb-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 font-mono text-xs">
                {attestations.map(att => (
                  <tr key={att.id} className="hover:bg-surface-container-lowest/40 dark:hover:bg-zinc-800/10">
                    <td className="py-sm truncate max-w-[120px] text-primary dark:text-zinc-300">{att.subjectWallet}</td>
                    <td className="py-sm truncate max-w-[100px] text-outline font-sans">{att.schema}</td>
                    <td className="py-sm">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                        att.status === 'Verified' || att.status === 'Active' ? 'bg-secondary-container/20 text-secondary' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {att.status}
                      </span>
                    </td>
                    <td className="py-sm font-sans text-[10px] text-outline">{att.provider}</td>
                    <td className="py-sm text-right space-x-xs">
                      {att.status !== 'Verified' && att.status !== 'Active' ? (
                        <button 
                          onClick={() => handleApproveAttestation(att.id)}
                          className="px-2 py-1 bg-secondary text-white rounded-lg font-sans text-[10px] font-bold hover:bg-secondary/90 transition-all inline-flex items-center gap-0.5"
                        >
                          <Check size={10} /> Verify
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleRejectAttestation(att.id)}
                          className="px-2 py-1 bg-red-500/10 text-red-500 rounded-lg font-sans text-[10px] font-bold hover:bg-red-500/20 transition-all inline-flex items-center gap-0.5"
                        >
                          <X size={10} /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {attestations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-lg text-center font-sans text-outline">No attestation records currently listed</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users Checklist */}
        <div className="bg-white dark:bg-zinc-900/50 p-md rounded-2xl border border-outline-variant/30 dark:border-zinc-800/40 shadow-sm space-y-md">
          <h3 className="font-bold text-headline-sm flex items-center gap-xs">
            <Users size={18} className="text-primary-container dark:text-primary-fixed" />
            Corporate Members
          </h3>
          <div className="space-y-sm divide-y divide-outline-variant/10">
            {users.map(u => (
              <div key={u.userId} className="py-sm flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold">{u.user?.name}</p>
                  <p className="text-[10px] text-outline font-mono truncate max-w-[150px]">{u.user?.walletAddress}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-outline text-[10px] uppercase font-bold">{u.role}</span>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-xs text-outline text-center py-lg">No active organization members registered</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

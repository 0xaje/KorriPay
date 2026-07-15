import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, Users, Key, ToggleLeft, ToggleRight, RotateCw, Plus, RefreshCw } from 'lucide-react';
import { useApp } from '../App';

export default function Organization() {
  const { user } = useApp();
  const [members, setMembers] = useState([]);
  const [kycLimit, setKycLimit] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('OPERATOR');

  const fetchOrgDetails = async () => {
    setLoading(true);
    try {
      // Fetch members
      const mRes = await fetch('/api/org/members');
      const mData = await mRes.json();
      if (mRes.ok && mData.success) {
        setMembers(mData.members);
      }

      // Fetch kyc limits
      const kRes = await fetch('/api/org/limit');
      const kData = await kRes.json();
      if (kRes.ok && kData.success) {
        setKycLimit(kData.limits);
      }

      // Fetch webhook configs
      const wRes = await fetch('/api/webhooks');
      const wData = await wRes.json();
      if (wRes.ok && wData.success) {
        setWebhooks(wData.subscriptions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgDetails();
  }, []);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail) return;
    try {
      const res = await fetch('/api/org/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole })
      });
      if (res.ok) {
        setNewMemberEmail('');
        fetchOrgDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleWebhook = async (id, currentStatus) => {
    try {
      await fetch(`/api/webhooks/${id}/toggle`, { method: 'POST' });
      fetchOrgDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRotateWebhookKey = async (id) => {
    try {
      await fetch(`/api/webhooks/${id}/rotate`, { method: 'POST' });
      fetchOrgDetails();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-lg animate-fade-in pb-lg">
      <div className="flex justify-between items-center pb-sm border-b border-outline-variant/30 dark:border-zinc-800/60">
        <div>
          <h2 className="text-headline-lg font-bold text-primary dark:text-white">Organization Settings</h2>
          <p className="text-xs text-outline">Manage institutional parameters, authorize roles, rotate keys, and inspect KYC limits</p>
        </div>
        <button 
          onClick={fetchOrgDetails}
          className="p-sm hover:bg-surface-container dark:hover:bg-zinc-800 rounded-xl text-outline hover:text-primary dark:hover:text-white transition-all"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Left column: Members and limits */}
        <div className="lg:col-span-2 space-y-md">
          {/* Members */}
          <div className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-md">
            <h3 className="font-bold text-sm text-primary dark:text-white flex items-center gap-xs">
              <Users size={16} className="text-secondary" /> Authorized Institution Members
            </h3>

            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-xs items-center">
              <input 
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="operator@institution.com"
                className="w-full sm:flex-1 px-sm py-2 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white text-xs"
                required
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="w-full sm:w-auto px-sm py-2 rounded-xl border border-outline-variant/30 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/30 focus:border-primary focus:outline-none dark:text-white text-xs font-semibold"
              >
                <option value="OPERATOR">OPERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button
                type="submit"
                className="w-full sm:w-auto bg-secondary text-white font-bold py-2 px-md rounded-xl text-xs hover:bg-secondary/90 transition-all flex items-center justify-center gap-xs active:scale-95 shrink-0"
              >
                <Plus size={14} /> Add Member
              </button>
            </form>

            <div className="divide-y divide-outline-variant/10 dark:divide-zinc-800/40">
              {members.map((m) => (
                <div key={m.id} className="py-xs flex justify-between items-center text-xs">
                  <div className="space-y-xs">
                    <span className="font-semibold text-primary dark:text-white">{m.email}</span>
                  </div>
                  <span className="px-sm py-0.5 bg-surface-container dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-outline">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Webhooks */}
          <div className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-md">
            <h3 className="font-bold text-sm text-primary dark:text-white flex items-center gap-xs">
              <Key size={16} className="text-secondary" /> Webhook Configurations
            </h3>

            <div className="divide-y divide-outline-variant/10 dark:divide-zinc-800/40 space-y-sm">
              {webhooks.map((sub) => (
                <div key={sub.id} className="py-sm flex flex-col sm:flex-row sm:items-center justify-between gap-sm text-xs">
                  <div className="space-y-xs min-w-0">
                    <p className="font-semibold text-primary dark:text-white truncate max-w-[250px]">{sub.url}</p>
                    <p className="text-[10px] text-outline font-mono truncate max-w-[200px]">Secret: {sub.secret}</p>
                  </div>
                  <div className="flex gap-xs items-center justify-end shrink-0">
                    <button
                      onClick={() => handleRotateWebhookKey(sub.id)}
                      className="p-xs hover:bg-surface-container dark:hover:bg-zinc-800 rounded-lg text-outline hover:text-primary dark:hover:text-white"
                      title="Rotate Webhook Signature Key"
                    >
                      <RotateCw size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleWebhook(sub.id, sub.isActive)}
                      className="p-xs text-outline hover:text-primary dark:hover:text-white"
                    >
                      {sub.isActive ? <ToggleRight size={22} className="text-secondary" /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                </div>
              ))}
              {webhooks.length === 0 && (
                <p className="text-zinc-500 italic text-center py-sm text-xs">No active webhooks configured.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: KYC status */}
        <div className="space-y-md">
          <div className="bg-white/50 dark:bg-zinc-900/40 border border-outline-variant/30 dark:border-zinc-800/40 p-md rounded-2xl shadow-sm space-y-md">
            <h3 className="font-bold text-sm text-primary dark:text-white flex items-center gap-xs">
              <ShieldCheck size={16} className="text-secondary" /> KYC Compliance limits
            </h3>

            <div className="space-y-sm border-t border-outline-variant/10 dark:border-zinc-800 pt-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="text-outline">KYC Status</span>
                <span className="font-bold text-secondary uppercase text-[10px] tracking-wide">VERIFIED</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-outline">KYC Tier Limit</span>
                <span className="font-bold text-primary dark:text-white font-mono">${kycLimit?.singleLimit ?? '10,000'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-outline">Daily Transaction Max</span>
                <span className="font-bold text-primary dark:text-white font-mono">${kycLimit?.dailyLimit ?? '50,000'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-outline">Institution Address</span>
                <span className="font-bold text-primary dark:text-white font-mono text-[10px] truncate max-w-[120px]">
                  {user?.walletAddress ?? '0x--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

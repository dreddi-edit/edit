import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface Org { id: number; name: string; owner_id: number; created_at: string; }
interface Member { id: number; invite_email: string; role: string; status: string; name?: string; email?: string; }

const ROLES = ['editor', 'viewer', 'admin'];

export const TeamSettings: React.FC = () => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/orgs');
      if (data.ok) {
        const all = [...(data.owned ?? []), ...(data.member ?? [])];
        setOrgs(all);
        if (all.length > 0 && !selectedOrg) setSelectedOrg(all[0]);
      }
    } catch {}
    setLoading(false);
  };

  const loadMembers = async (orgId: number) => {
    try {
      const data = await apiFetch(`/api/orgs/${orgId}/members`);
      if (data.ok) setMembers(data.members ?? []);
    } catch {}
  };

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { if (selectedOrg) loadMembers(selectedOrg.id); }, [selectedOrg]);

  const createOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreatingOrg(true); setError(''); setSuccess('');
    try {
      const data = await apiFetch('/api/orgs', { method: 'POST', body: JSON.stringify({ name: newOrgName.trim() }) });
      if (data.ok) { setSuccess('Organisation created.'); setNewOrgName(''); loadOrgs(); }
      else setError(data.error ?? 'Failed');
    } catch (e: any) { setError(e.message); }
    setCreatingOrg(false);
  };

  const invite = async () => {
    if (!inviteEmail.trim() || !selectedOrg) return;
    setInviting(true); setError(''); setSuccess('');
    try {
      const data = await apiFetch(`/api/orgs/${selectedOrg.id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (data.ok) { setSuccess(`Invitation sent to ${inviteEmail}.`); setInviteEmail(''); loadMembers(selectedOrg.id); }
      else setError(data.error ?? 'Invite failed');
    } catch (e: any) { setError(e.message); }
    setInviting(false);
  };

  const removeMember = async (memberId: number) => {
    if (!selectedOrg || !confirm('Remove member?')) return;
    try {
      const data = await apiFetch(`/api/orgs/${selectedOrg.id}/members/${memberId}`, { method: 'DELETE' });
      if (data.ok) setMembers(m => m.filter(x => x.id !== memberId));
    } catch {}
  };

  if (loading) return (
    <div className="p-4 text-gray-500 text-sm">Loading teams…</div>
  );

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6 space-y-6">
      <h3 className="text-xl font-bold text-white">Team & Organisation Settings</h3>

      {/* Create org */}
      <div className="p-4 bg-gray-800/60 rounded-lg">
        <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">New Organisation</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            placeholder="Organisation name"
            value={newOrgName}
            onChange={e => setNewOrgName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createOrg()}
          />
          <button onClick={createOrg} disabled={creatingOrg} className="bg-white text-black font-bold text-xs px-4 py-2 rounded disabled:opacity-50">
            Create
          </button>
        </div>
      </div>

      {/* Select org */}
      {orgs.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">Select Organisation</p>
          <div className="flex gap-2 flex-wrap">
            {orgs.map(o => (
              <button
                key={o.id}
                onClick={() => setSelectedOrg(o)}
                className={`text-sm px-4 py-2 rounded-lg font-semibold transition-all ${selectedOrg?.id === o.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Invite */}
      {selectedOrg && (
        <div className="p-4 bg-gray-800/60 rounded-lg">
          <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">Invite to {selectedOrg.name}</p>
          <div className="flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-[200px] bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Email address"
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && invite()}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={invite} disabled={inviting} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded disabled:opacity-50">
              {inviting ? 'Sending…' : 'Invite'}
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      {selectedOrg && members.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">Members</p>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-gray-800 px-4 py-2.5 rounded-lg">
                <div>
                  <p className="text-white text-sm font-medium">{m.name || m.invite_email}</p>
                  {m.name && <p className="text-gray-500 text-xs">{m.email || m.invite_email}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-900/60 text-green-400' : 'bg-yellow-900/60 text-yellow-400'}`}>
                    {m.role}
                  </span>
                  <span className="text-gray-600 text-xs">{m.status}</span>
                  <button onClick={() => removeMember(m.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedOrg && members.length === 0 && (
        <p className="text-gray-600 text-sm italic">No members yet. Invite someone above.</p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-green-400 text-xs">{success}</p>}
    </div>
  );
};
export default TeamSettings;


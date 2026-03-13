import { RoleManager } from './RoleManager';
import React, { useState, useEffect } from 'react';

export const TeamSettings: React.FC = () => {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [newOrgName, setNewOrgName] = useState('');

  const getHeaders = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  };

  const loadOrgs = () => {
    fetch('/api/orgs', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => { if (data.ok) setOrgs(data.orgs || []); })
      .catch(() => {});
  };

  useEffect(() => { loadOrgs(); }, []);

  const createOrg = async () => {
    if (!newOrgName) return;
    await fetch('/api/orgs', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name: newOrgName })
    });
    setNewOrgName('');
    loadOrgs();
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Organizations & Workspaces</h3>
      <p className="text-gray-400 mb-4">Create isolated workspaces to collaborate with your team and share projects.</p>
      
      <div className="flex gap-2 mb-6 max-w-md">
        <input 
          type="text" 
          placeholder="New Workspace Name" 
          className="flex-1 p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-blue-500 outline-none" 
          value={newOrgName} 
          onChange={e => setNewOrgName(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && createOrg()}
        />
        <button onClick={createOrg} className="bg-white hover:bg-gray-200 transition-colors text-black font-semibold px-4 py-2 rounded-lg">
          Create
        </button>
      </div>

      <div className="space-y-3 max-w-2xl">
        {orgs.map((org, i) => (
          <div key={i} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg flex justify-between items-center">
            <span className="text-white font-medium">{org.name}</span>
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider bg-blue-900/30 px-3 py-1 rounded-full border border-blue-800/50">
              {org.role || 'Owner'}
            </span>
          </div>
        ))}
        {orgs.length === 0 && <p className="text-sm text-gray-500 italic">You don't belong to any team workspaces yet.</p>}
        <RoleManager />
    </div>
    </div>
  );
};

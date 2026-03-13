import React, { useState } from 'react';

export const RoleManager: React.FC = () => {
  const [members, setMembers] = useState([
    { id: 1, email: 'owner@example.com', role: 'Owner' },
    { id: 2, email: 'editor@example.com', role: 'Editor' }
  ]);

  const updateRole = (id: number, role: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, role } : m));
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-800/50">
      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Member Access Control</h4>
      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
            <span className="text-sm text-white">{m.email}</span>
            <select 
              value={m.role} 
              onChange={e => updateRole(m.id, e.target.value)}
              className="bg-gray-900 text-xs text-blue-400 font-bold border border-gray-700 rounded px-2 py-1 outline-none"
            >
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import React, { SystemHealth } from './SystemHealth';
import { FraudMonitor } from './FraudMonitor';

export const AdminDashboardModal: React.FC = () => {
  const [isOwner, setIsOwner] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const getHeaders = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    fetch('/api/admin/me', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => { if (data.ok && data.owner) setIsOwner(true); })
      .catch(() => {});
  }, []);

  const loadUsers = async () => {
    const res = await fetch('/api/admin/users', { headers: getHeaders() }).then(r => r.json());
    if (res.ok) setUsers(res.users);
  };

  useEffect(() => { if (isOpen) loadUsers(); }, [isOpen]);

  const addCredits = async (id: number) => {
    const amount = prompt("Amount of credits in EUR (e.g., 10 for 10 EUR)?");
    if (!amount) return;
    const res = await fetch(`/api/admin/users/${id}/add-credits`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ credits: Number(amount) * 100 }) }).then(r => r.json());
    if (res.ok) { alert('Credits added'); loadUsers(); } else { alert('Failed'); }
  };

  const setPlan = async (id: number) => {
    const plan = prompt("Enter plan (basis, starter, pro, scale):");
    if (!plan) return;
    const res = await fetch(`/api/admin/users/${id}/set-plan`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ plan }) }).then(r => r.json());
    if (res.ok) { alert('Plan updated'); loadUsers(); } else { alert('Failed'); }
  };

  if (!isOwner) return null;

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-full shadow-2xl z-40 transition-transform hover:scale-105">Admin Panel</button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto p-8 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-white">Platform Administration</h1>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl px-4 py-2 border border-gray-700 rounded-lg">Close</button>
            </div>
            
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-white">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="p-4 font-medium text-gray-400">ID</th>
                    <th className="p-4 font-medium text-gray-400">Email</th>
                    <th className="p-4 font-medium text-gray-400">Plan</th>
                    <th className="p-4 font-medium text-gray-400">Credits (€)</th>
                    <th className="p-4 font-medium text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">{u.id}</td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4"><span className="bg-gray-800 px-2 py-1 rounded text-sm uppercase tracking-wider">{u.plan}</span></td>
                      <td className="p-4">{u.credits?.toFixed(2) || '0.00'}</td>
                      <td className="p-4 flex gap-3 justify-end">
                        <button onClick={() => addCredits(u.id)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Add Credits</button>
                        <button onClick={() => setPlan(u.id)} className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Set Plan</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            <FraudMonitor />
            <SystemHealth />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

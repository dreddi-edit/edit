import React, { useState, useEffect } from 'react';

export const LoginHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    fetch('/api/auth/login-history', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setHistory(data.history || []); });
  }, []);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Login History</h3>
      <div className="space-y-3">
        {history.map((h, i) => (
          <div key={i} className="flex justify-between items-center text-xs p-2 bg-gray-800/40 rounded border border-gray-700/50">
            <div>
              <p className="text-white font-medium">{h.ip_address}</p>
              <p className="text-gray-500">{h.user_agent.split(' ')[0]}</p>
            </div>
            <p className="text-gray-400">{new Date(h.created_at).toLocaleDateString()}</p>
          </div>
        ))}
        {history.length === 0 && <p className="text-gray-500 italic text-sm">No recent login history.</p>}
      </div>
    </div>
  );
};

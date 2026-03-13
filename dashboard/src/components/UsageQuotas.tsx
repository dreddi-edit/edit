import React, { useState, useEffect } from 'react';

export const UsageQuotas: React.FC = () => {
  const [stats, setStats] = useState({ used: 0, limit: 1, plan: 'basis' });

  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    fetch('/api/user/usage-stats', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setStats(data.stats); });
  }, []);

  const percent = Math.min((stats.used / stats.limit) * 100, 100);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Usage Quotas</h3>
      <p className="text-gray-400 text-sm mb-4">You are currently on the <span className="text-white font-bold uppercase">{stats.plan}</span> plan.</p>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 font-bold uppercase">Projects</span>
            <span className="text-white">{stats.used} / {stats.limit}</span>
          </div>
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';

export const ActivityAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<Array<{ id: number; action: string; timestamp: string; user?: string }>>([]);

  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    fetch('/api/user/audit-logs', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setLogs(data.logs || []); });
  }, []);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Security & Activity Log</h3>
      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-4 border-l-2 border-gray-800 pl-4 py-1">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">{log.action_description || log.event_type}</p>
              <p className="text-[10px] text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <div className="text-[10px] font-mono text-gray-600 bg-gray-800/50 px-2 py-1 rounded self-start">
              {log.ip_address || 'unknown'}
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="text-gray-500 italic text-sm">No activity recorded yet.</p>}
      </div>
    </div>
  );
};

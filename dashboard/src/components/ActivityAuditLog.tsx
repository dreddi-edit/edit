import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface AuditLog {
  id: number;
  action?: string;
  action_description?: string;
  event_type?: string;
  created_at: string;
  user?: string;
  ip_address?: string;
  user_agent?: string;
}

export const ActivityAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/user/audit-logs')
      .then(data => { if (data.ok) setLogs(data.logs || []); })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Security & Activity Log</h3>
      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {logs.map((log, i) => (
          <div key={log.id ?? i} className="flex gap-4 border-l-2 border-gray-800 pl-4 py-1">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{log.action_description || log.event_type || log.action}</p>
              <p className="text-[10px] text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
              {expanded === (log.id ?? i) && log.user_agent && (
                <p className="text-[9px] text-gray-600 mt-1 truncate" title={log.user_agent}>
                  {log.user_agent}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div
                className="text-[10px] font-mono text-gray-600 bg-gray-800/50 px-2 py-1 rounded cursor-pointer hover:text-gray-400 transition-colors"
                title={log.user_agent ?? ''}
                onClick={() => setExpanded(exp => exp === (log.id ?? i) ? null : (log.id ?? i))}
              >
                {log.ip_address || 'unknown'}
              </div>
              {log.user_agent && (
                <span className="text-[8px] text-gray-700">{browserHint(log.user_agent)}</span>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="text-gray-500 italic text-sm">No activity recorded yet.</p>}
      </div>
    </div>
  );
};

function browserHint(ua: string): string {
  if (/mobile/i.test(ua)) return 'Mobile';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  if (/edge/i.test(ua)) return 'Edge';
  return 'Desktop';
}


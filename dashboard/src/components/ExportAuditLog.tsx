import React from 'react';

export const ExportAuditLog: React.FC = () => {
  const logs = [
    { date: '2024-05-12 14:20', user: 'admin@site.com', type: 'Full Export', hash: 'sha256:7e4a...' },
    { date: '2024-05-10 09:15', user: 'admin@site.com', type: 'HTML Only', hash: 'sha256:b92c...' }
  ];

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Export History & Audit</h3>
      <div className="space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="p-2 bg-gray-950 rounded border border-gray-800 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-gray-400 font-mono">{log.date}</p>
              <p className="text-xs text-white">{log.type} by {log.user}</p>
            </div>
            <span className="text-[8px] font-mono text-blue-500">{log.hash}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';

export const SystemHealth: React.FC = () => {
  const stats = [
    { label: 'API Latency', value: '42ms', status: 'optimal' },
    { label: 'DB Connections', value: '18/100', status: 'optimal' },
    { label: 'Queue Depth', value: '0 items', status: 'optimal' }
  ];

  return (
    <div className="mt-6 pt-6 border-t border-gray-800">
      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Infrastructure Health</h4>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="p-3 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-[10px] text-gray-600 uppercase font-bold">{s.label}</p>
            <p className="text-sm text-white font-mono">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

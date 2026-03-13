import React, { useState } from 'react';

export const FraudMonitor: React.FC = () => {
  const [flags] = useState([
    { id: 1, user: 'user_99@test.com', reason: 'Multiple IPs (4) in 10 mins', severity: 'high' },
    { id: 2, user: 'user_12@test.com', reason: 'High API Velocity (Gemini)', severity: 'medium' }
  ]);

  return (
    <div className="p-6 border border-red-900/20 bg-red-950/5 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-red-400">Security & Fraud Monitor</h3>
      <div className="space-y-3">
        {flags.map(f => (
          <div key={f.id} className="p-3 bg-gray-900/80 border border-gray-800 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">{f.user}</p>
              <p className="text-[10px] text-gray-500 font-mono">{f.reason}</p>
            </div>
            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
              f.severity === 'high' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-black'
            }`}>
              {f.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

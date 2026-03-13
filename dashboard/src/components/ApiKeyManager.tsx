import React from 'react';
import React, { useState } from 'react';

export const ApiKeyManager: React.FC = () => {
  const [keys, setKeys] = useState([
    { name: 'Production Headless', key: 'ed_live_••••••••', scope: 'Read-only' }
  ]);

  const generate = () => {
    const name = prompt("Key Name:");
    if (name) setKeys([...keys, { name, key: 'ed_test_' + Math.random().toString(36).substr(2, 8), scope: 'Full Access' }]);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Scoped API Access</h3>
        <button onClick={generate} className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded font-bold uppercase">Generate Key</button>
      </div>
      <div className="space-y-2">
        {keys.map((k, i) => (
          <div key={i} className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-gray-800">
            <div>
              <p className="text-sm text-white font-medium">{k.name}</p>
              <p className="text-[10px] text-gray-500 font-mono">{k.key}</p>
            </div>
            <span className="text-[9px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-bold uppercase border border-gray-700">{k.scope}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import React, { useState } from 'react';

export const ZIndexInspector: React.FC = () => {
  const [layers] = useState([
    { id: 'Nav', z: 50 },
    { id: 'Modal', z: 40 },
    { id: 'HeroImg', z: 10 }
  ]);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Z-Index Stacking Audit</h3>
      <div className="space-y-2">
        {layers.map(l => (
          <div key={l.id} className="flex items-center gap-3 p-2 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center text-[10px] text-blue-500 font-bold border border-gray-700">{l.z}</div>
            <span className="text-xs text-white flex-1">{l.id}</span>
            <div className="flex gap-1">
              <button className="w-6 h-6 bg-gray-700 text-white rounded flex items-center justify-center text-xs">↑</button>
              <button className="w-6 h-6 bg-gray-700 text-white rounded flex items-center justify-center text-xs">↓</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

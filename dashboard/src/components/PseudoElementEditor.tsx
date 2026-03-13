import React, { useState } from 'react';

export const PseudoElementEditor: React.FC = () => {
  const [target, setTarget] = useState<'before' | 'after'>('before');

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Pseudo-Element Editor</h3>
      <div className="flex gap-2 mb-4">
        {['before', 'after'].map(p => (
          <button 
            key={p}
            onClick={() => setTarget(p as any)}
            className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all border ${
              target === p ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-500'
            }`}
          >
            ::{p}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Content Value</label>
          <input type="text" placeholder="''" className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-white font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Display</label>
            <select className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-white">
              <option>block</option>
              <option>inline-block</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Position</label>
            <select className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-white">
              <option>absolute</option>
              <option>relative</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

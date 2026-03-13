import React from 'react';
import React, { useState } from 'react';

export const DesignSystemSettings: React.FC = () => {
  const [config, setConfig] = useState({ primary: '#3b82f6', radius: '8px', font: 'Inter' });

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Global Design System</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Primary Color</label>
          <div className="flex gap-2">
            <input type="color" value={config.primary} onChange={e => setConfig({...config, primary: e.target.value})} className="w-10 h-10 rounded border border-gray-700 bg-transparent" />
            <input type="text" value={config.primary} readOnly className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 text-sm text-white" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Corner Radius</label>
          <select value={config.radius} onChange={e => setConfig({...config, radius: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white">
            <option value="0px">Sharp (0px)</option>
            <option value="4px">Soft (4px)</option>
            <option value="8px">Standard (8px)</option>
            <option value="16px">Round (16px)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Typography</label>
          <select value={config.font} onChange={e => setConfig({...config, font: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white">
            <option value="Inter">Inter (Sans)</option>
            <option value="Georgia">Georgia (Serif)</option>
            <option value="Monaco">Monaco (Mono)</option>
          </select>
        </div>
      </div>
      <button className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors">
        Apply Design Tokens
      </button>
    </div>
  );
};

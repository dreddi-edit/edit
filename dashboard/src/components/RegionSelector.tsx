import React from 'react';
import React, { useState } from 'react';

export const RegionSelector: React.FC = () => {
  const [region, setRegion] = useState('US-East');

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Deployment Region</h3>
      <select 
        value={region} 
        onChange={e => setRegion(e.target.value)}
        className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-blue-400 outline-none"
      >
        <option>US-East (Virginia)</option>
        <option>EU-West (Dublin)</option>
        <option>Asia-South (Mumbai)</option>
      </select>
    </div>
  );
};

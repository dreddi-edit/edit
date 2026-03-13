import React, { useState } from 'react';

export const CanonicalManager: React.FC = () => {
  const [canonical, setCanonical] = useState('https://yoursite.com/');

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Canonical URL Enforcement</h3>
      <p className="text-gray-400 text-sm mb-4">Set the preferred URL for this page to prevent search engines from indexing duplicate content versions.</p>
      
      <div className="flex gap-2">
        <input 
          type="text" 
          value={canonical}
          onChange={e => setCanonical(e.target.value)}
          className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-blue-400 font-mono outline-none focus:border-blue-500"
        />
        <button className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all">
          Lock URL
        </button>
      </div>
    </div>
  );
};

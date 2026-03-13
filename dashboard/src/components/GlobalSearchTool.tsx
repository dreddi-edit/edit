import React from 'react';
import React, { useState } from 'react';

export const GlobalSearchTool: React.FC = () => {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Global Search & Refactor</h3>
      <p className="text-gray-400 text-sm mb-4">Search and replace content or style classes across the entire project (all pages/blocks).</p>
      
      <div className="space-y-3">
        <input 
          type="text" 
          placeholder="Find: e.g. 'Shop Now'" 
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-white outline-none focus:border-blue-500"
        />
        <input 
          type="text" 
          placeholder="Replace with: e.g. 'Start Journey'" 
          value={replacement}
          onChange={e => setReplacement(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-blue-400 font-bold outline-none focus:border-blue-500"
        />
        <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase py-2 rounded-lg transition-all">
          Execute Project-Wide Replacement
        </button>
      </div>
    </div>
  );
};

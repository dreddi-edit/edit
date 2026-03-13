import React from 'react';
import React, { useState } from 'react';

export const NavSyncManager: React.FC = () => {
  const [syncing, setSyncing] = useState(true);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">Cross-Page Nav Sync</h3>
          <p className="text-gray-400 text-sm mt-1">Automatically synchronize header and footer modifications across all sub-pages.</p>
        </div>
        <button 
          onClick={() => setSyncing(!syncing)}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
            syncing ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'
          }`}
        >
          {syncing ? 'Sync Active' : 'Sync Paused'}
        </button>
      </div>
      {syncing && (
        <div className="flex items-center gap-3 text-[10px] text-blue-400 bg-blue-900/10 p-3 rounded-lg border border-blue-500/20">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="font-medium">Monitoring 8 navigation nodes across 4 pages in this project.</p>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import React, { useState } from 'react';

export const CloudSyncSettings: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('Never');

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date().toLocaleTimeString());
    }, 2000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Cloud Sync & Backups</h3>
      <p className="text-gray-400 text-sm mb-4">Last successful cloud backup: <span className="text-blue-400">{lastSync}</span></p>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={handleSync}
          disabled={syncing}
          className="bg-gray-100 hover:bg-white text-black font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 text-sm"
        >
          {syncing ? 'Backing up...' : 'Backup to Cloud Now'}
        </button>
        {syncing && (
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
        )}
      </div>
    </div>
  );
};

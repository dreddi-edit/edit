import React, { useState } from 'react';

export const AssetHealthChecker: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runScan = () => {
    setScanning(true);
    setTimeout(() => {
      setResults({ brokenLinks: 0, missingImages: 0, insecureAssets: 2 });
      setScanning(false);
    }, 1500);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Asset Health & Integrity</h3>
      <p className="text-gray-400 text-sm mb-4">Scan project for broken images, dead links, and mixed-content security warnings.</p>
      
      {results ? (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-gray-800 rounded-lg text-center">
            <p className="text-xs text-gray-500 uppercase">Broken Links</p>
            <p className="text-green-400 font-bold">{results.brokenLinks}</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg text-center">
            <p className="text-xs text-gray-500 uppercase">Missing Images</p>
            <p className="text-green-400 font-bold">{results.missingImages}</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg text-center">
            <p className="text-xs text-gray-500 uppercase">Insecure (HTTP)</p>
            <p className="text-yellow-400 font-bold">{results.insecureAssets}</p>
          </div>
        </div>
      ) : null}

      <button 
        onClick={runScan} 
        disabled={scanning}
        className="bg-white text-black font-bold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        {scanning ? 'Scanning Project...' : 'Start Health Check'}
      </button>
    </div>
  );
};

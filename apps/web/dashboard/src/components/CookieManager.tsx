import React, { useState } from 'react';

export const CookieManager: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<string[]>([]);

  const scan = () => {
    setScanning(true);
    setTimeout(() => {
      setDetected(['Google Analytics', 'Stripe', 'Facebook Pixel']);
      setScanning(false);
    }, 1500);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Smart Cookie Consent</h3>
      <p className="text-gray-400 text-sm mb-4">Scan for tracking scripts and generate a fully compliant consent banner automatically.</p>
      
      {detected.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {detected.map(d => (
            <span key={d} className="bg-blue-900/30 text-blue-400 text-[10px] px-2 py-1 rounded border border-blue-500/20 font-bold uppercase">{d}</span>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={scan} disabled={scanning} className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-200 transition-all">
          {scanning ? 'Scanning Assets...' : 'Scan & Generate Banner'}
        </button>
        <button className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest px-4 py-2 transition-all">
          Customize UI
        </button>
      </div>
    </div>
  );
};

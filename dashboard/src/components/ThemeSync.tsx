import React, { useState } from 'react';

export const ThemeSync: React.FC = () => {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      alert("Design System Theme exported as 'design-system-v1.json'");
    }, 1500);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Design System Portability</h3>
      <p className="text-gray-400 text-sm mb-4">Sync your design tokens, colors, and typography across multiple projects using standardized JSON themes.</p>
      <div className="flex gap-2">
        <button 
          onClick={handleExport}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded-lg border border-gray-700 transition-all"
        >
          {exporting ? 'Packing Theme...' : 'Export Theme JSON'}
        </button>
        <button className="flex-1 bg-gray-100 hover:bg-white text-black text-xs font-bold py-2 rounded-lg transition-all">
          Import Theme
        </button>
      </div>
    </div>
  );
};

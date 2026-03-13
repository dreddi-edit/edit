import React from 'react';
import React, { useState } from 'react';

export const IconManager: React.FC = () => {
  const [icon, setIcon] = useState<string | null>(null);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Favicon & Brand Icons</h3>
      <p className="text-gray-400 text-sm mb-4">Upload a high-res master icon. We will generate the 16x16 favicon, Apple Touch, and Android manifest icons automatically.</p>
      
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-gray-950 border-2 border-dashed border-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
          {icon ? <img src={icon} alt="Icon" /> : <span className="text-gray-700 text-xl font-black">?</span>}
        </div>
        <div className="flex-1">
          <button className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
            Upload Master Icon
          </button>
          <p className="text-[10px] text-gray-600 mt-2 font-mono">Recommended: 512x512px PNG/SVG</p>
        </div>
      </div>
    </div>
  );
};

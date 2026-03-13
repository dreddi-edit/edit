import React from 'react';
import React, { useState } from 'react';

export const SnapshotDiffViewer: React.FC = () => {
  const [comparing, setComparing] = useState(false);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Version Diff Engine</h3>
      <p className="text-gray-400 text-sm mb-4">Compare the current draft against a previous snapshot to identify structural and style changes.</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setComparing(true)} className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded-lg border border-gray-700 transition-all">
          Compare v1.0.4
        </button>
        <button className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded-lg border border-gray-700 transition-all">
          Compare v1.0.3
        </button>
      </div>
      {comparing && (
        <div className="mt-4 p-3 bg-gray-950 border border-blue-500/20 rounded-lg animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-white uppercase">Diff: Draft vs v1.0.4</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-green-400 font-mono">+ Added .glass-card styles</p>
            <p className="text-[10px] text-red-400 font-mono">- Removed inline padding from #hero</p>
            <p className="text-[10px] text-yellow-400 font-mono">~ Updated CTA text</p>
          </div>
        </div>
      )}
    </div>
  );
};

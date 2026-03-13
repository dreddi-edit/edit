import React from 'react';

export const ImportFidelityPanel: React.FC<{ score: number, details?: any }> = ({ score, details }) => {
  const getStatusColor = (val: number) => {
    if (val > 90) return 'text-green-400';
    if (val > 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-1 text-white">Import Fidelity Audit</h3>
      <div className="flex items-center gap-4 mt-4">
        <div className={`text-4xl font-black ${getStatusColor(score)}`}>{score}%</div>
        <div className="flex-1 bg-gray-800 h-3 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-1000 bg-current ${getStatusColor(score)}`} style={{ width: `${score}%` }}></div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-gray-800/30 rounded-lg">
          <p className="text-xs text-gray-500 uppercase font-bold">Structure</p>
          <p className="text-white font-medium mt-1">High</p>
        </div>
        <div className="p-3 bg-gray-800/30 rounded-lg">
          <p className="text-xs text-gray-500 uppercase font-bold">Styles</p>
          <p className="text-white font-medium mt-1">Retained</p>
        </div>
        <div className="p-3 bg-gray-800/30 rounded-lg">
          <p className="text-xs text-gray-500 uppercase font-bold">Assets</p>
          <p className="text-white font-medium mt-1">Proxied</p>
        </div>
      </div>
    </div>
  );
};

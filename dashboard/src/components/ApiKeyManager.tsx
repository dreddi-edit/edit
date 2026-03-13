import React from 'react';

export const ApiKeyManager: React.FC = () => {
  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold text-white">API Keys</h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
          Placeholder removed
        </span>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
        <p className="text-sm text-gray-300">
          API key management is handled by the main Settings panel.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          This placeholder component was showing fake generated keys and has been disabled.
        </p>
      </div>
    </div>
  );
};

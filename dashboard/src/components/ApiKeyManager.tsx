import React from 'react';

export const ApiKeyManager: React.FC = () => {
  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold text-white mb-2">API Keys</h3>
      <p className="text-sm text-gray-400">
        API key management is handled by the main Settings panel.
      </p>
    </div>
  );
};

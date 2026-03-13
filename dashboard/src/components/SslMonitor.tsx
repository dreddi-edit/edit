import React from 'react';

export const SslMonitor: React.FC = () => {
  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">SSL & Domain Health</h3>
        <span className="bg-green-600/20 text-green-400 text-[10px] px-2 py-0.5 rounded border border-green-500/30 font-bold">Secure</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Certificate Authority</span>
          <span className="text-white">Let's Encrypt</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Expires In</span>
          <span className="text-white">82 Days</span>
        </div>
      </div>
    </div>
  );
};

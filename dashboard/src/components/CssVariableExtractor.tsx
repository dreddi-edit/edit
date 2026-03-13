import React from 'react';
import React, { useState } from 'react';

export const CssVariableExtractor: React.FC = () => {
  const [extracting, setExtracting] = useState(false);
  const [variables, setVariables] = useState<{ name: string, value: string }[]>([]);

  const runExtraction = () => {
    setExtracting(true);
    setTimeout(() => {
      setVariables([
        { name: '--brand-primary', value: '#3b82f6' },
        { name: '--brand-surface', value: '#111827' },
        { name: '--base-radius', value: '8px' }
      ]);
      setExtracting(false);
    }, 2000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Style Tokenizer</h3>
      <p className="text-gray-400 text-sm mb-4">Extract hardcoded styles into CSS Variables.</p>
      {variables.length > 0 && (
        <div className="space-y-2 mb-4">
          {variables.map((v, i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-gray-950 rounded border border-gray-800">
              <span className="text-xs font-mono text-blue-400">{v.name}</span>
              <span className="text-xs font-mono text-gray-500">{v.value}</span>
            </div>
          ))}
        </div>
      )}
      <button 
        onClick={runExtraction}
        disabled={extracting}
        className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
      >
        {extracting ? 'Extracting...' : 'Scan & Extract Tokens'}
      </button>
    </div>
  );
};

import React from 'react';
import React, { useState } from 'react';

export const StyleGuideGenerator: React.FC = () => {
  const [generating, setGenerating] = useState(false);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Style Guide Generator</h3>
      <p className="text-gray-400 text-sm mb-4">Generate a living brand documentation page containing your colors, typography, and UI patterns.</p>
      <button 
        onClick={() => { setGenerating(true); setTimeout(() => setGenerating(false), 2000); }}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-all"
      >
        {generating ? 'Compiling Brand Assets...' : 'Generate Brand Docs'}
      </button>
    </div>
  );
};

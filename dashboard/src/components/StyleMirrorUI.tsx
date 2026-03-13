import React, { useState } from 'react';

export const StyleMirrorUI: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [persona, setPersona] = useState<any>(null);

  const analyzeTone = () => {
    setAnalyzing(true);
    // Simulating AI analyzing the page copy
    setTimeout(() => {
      setPersona({
        tone: 'Professional & Authoritative',
        vocabulary: 'Technical / Industry-specific',
        length: 'Concise'
      });
      setAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Style Mirroring</h3>
      <p className="text-gray-400 text-sm mb-6">Analyze your current page copy so the AI can mirror your unique brand voice in all future content generation.</p>
      
      {persona ? (
        <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-lg mb-4">
          <p className="text-xs font-bold text-blue-400 uppercase mb-2">Detected Brand Voice</p>
          <div className="flex flex-wrap gap-2">
            <span className="bg-blue-900/40 text-blue-100 text-[10px] px-2 py-1 rounded border border-blue-800/50">{persona.tone}</span>
            <span className="bg-blue-900/40 text-blue-100 text-[10px] px-2 py-1 rounded border border-blue-800/50">{persona.vocabulary}</span>
            <span className="bg-blue-900/40 text-blue-100 text-[10px] px-2 py-1 rounded border border-blue-800/50">{persona.length}</span>
          </div>
        </div>
      ) : null}

      <button 
        onClick={analyzeTone} 
        disabled={analyzing}
        className="bg-white text-black font-bold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
      >
        {analyzing ? 'Analyzing Page Copy...' : 'Mirror My Writing Style'}
      </button>
    </div>
  );
};

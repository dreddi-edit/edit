import React from 'react';
import React, { useState } from 'react';

export const SearchGroundingToggle: React.FC = () => {
  const [grounding, setGrounding] = useState(false);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex items-center justify-between">
        <div className="pr-8">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            AI Search Grounding
            <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-black uppercase">Gemini 2.5</span>
          </h3>
          <p className="text-gray-400 text-sm mt-1">Enable real-time Google Search access for the AI. This ensures factual accuracy for news, pricing, and current events.</p>
        </div>
        <button 
          onClick={() => setGrounding(!grounding)}
          className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${grounding ? 'bg-blue-600' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-lg ${grounding ? 'left-8' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
};

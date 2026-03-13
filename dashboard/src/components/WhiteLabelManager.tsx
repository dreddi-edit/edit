import React, { useState } from 'react';

export const WhiteLabelManager: React.FC = () => {
  const [active, setActive] = useState(false);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-white">White-label Mode</h3>
        <button 
          onClick={() => setActive(!active)}
          className={`w-10 h-5 rounded-full relative transition-all ${active ? 'bg-blue-600' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-5.5' : 'left-0.5'}`} />
        </button>
      </div>
      <p className="text-gray-500 text-xs">Remove all platform branding from the editor and published site for client handoff.</p>
    </div>
  );
};

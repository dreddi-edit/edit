import React from 'react';
import React, { useState } from 'react';

export const ProjectArchival: React.FC = () => {
  const [isArchived, setIsArchived] = useState(false);

  return (
    <div className="p-6 border border-yellow-900/20 bg-yellow-900/5 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-white">Project Lifecycle</h3>
        <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded border border-yellow-700/50 font-bold uppercase">Archive Ready</span>
      </div>
      <p className="text-gray-500 text-xs mb-4">Moving a project to the Archive Vault disables its public URL but preserves all data. Archived projects do not count toward your active plan limit.</p>
      
      <button 
        onClick={() => {
            if(confirm("Archive this project?")) setIsArchived(true);
        }}
        disabled={isArchived}
        className={`w-full py-2 rounded-lg text-xs font-bold transition-all border ${
          isArchived ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-yellow-600/10 border-yellow-500 text-yellow-500 hover:bg-yellow-600 hover:text-white'
        }`}
      >
        {isArchived ? 'Project is in Archive Vault' : 'Move Project to Archive'}
      </button>
    </div>
  );
};

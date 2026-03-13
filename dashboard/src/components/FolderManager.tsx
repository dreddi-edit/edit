import React from 'react';
import React, { useState } from 'react';

export const FolderManager: React.FC = () => {
  const [folders, setFolders] = useState(['Marketing', 'Landing Pages', 'E-Commerce']);

  const addFolder = () => {
    const name = prompt("New Folder Name:");
    if (name) setFolders([...folders, name]);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Project Folders</h3>
        <button onClick={addFolder} className="text-[10px] bg-white text-black px-2 py-1 rounded font-bold uppercase">New Folder</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {folders.map((f, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full group cursor-pointer hover:border-blue-500 transition-all">
            <svg className="w-3 h-3 text-gray-500 group-hover:text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
            <span className="text-xs text-white">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

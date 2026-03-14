import React, { useState } from 'react';

export const FontManager: React.FC = () => {
  const [fonts, setFonts] = useState([
    { name: 'Inter (Default)', type: 'System' }
  ]);

  const addFont = () => {
    const name = prompt("Enter Font Name:");
    const url = prompt("Enter Google Font URL or File Link:");
    if (name && url) {
      setFonts([...fonts, { name, type: 'Custom' }]);
    }
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Custom Typography</h3>
        <button onClick={addFont} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-2 py-1 rounded border border-gray-700">Upload Font</button>
      </div>
      <div className="space-y-2">
        {fonts.map((f, i) => (
          <div key={i} className="flex justify-between items-center p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
            <span className="text-sm text-white">{f.name}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold">{f.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

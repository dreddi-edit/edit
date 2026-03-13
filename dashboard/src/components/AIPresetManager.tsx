import React, { useState } from 'react';

export const AIPresetManager: React.FC = () => {
  const [presets, setPresets] = useState([
    { id: 1, name: 'Professional', prompt: 'Rewrite this for a corporate B2B audience.' },
    { id: 2, name: 'Creative', prompt: 'Use poetic language and vivid metaphors.' }
  ]);

  const addPreset = () => {
    const name = prompt("Preset Name:");
    const promptText = prompt("Instruction / Prompt:");
    if (name && promptText) {
      setPresets([...presets, { id: Date.now(), name, prompt: promptText }]);
    }
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">AI Rewriting Presets</h3>
        <button onClick={addPreset} className="text-xs bg-white text-black px-2 py-1 rounded font-bold">Add New</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {presets.map(p => (
          <div key={p.id} className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
            <p className="text-white font-bold text-sm">{p.name}</p>
            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{p.prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

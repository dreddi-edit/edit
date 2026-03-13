import React, { useState } from 'react';

export const DomLogicControl: React.FC<{ selectedBlockId?: string }> = ({ selectedBlockId }) => {
  const [attributes, setAttributes] = useState([{ key: 'data-wp-php', value: 'base64_encoded_logic...' }]);

  if (!selectedBlockId) return null;

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Direct Logic Control</h3>
      <p className="text-gray-400 text-sm mb-4">Editing semantic attributes for: <span className="text-blue-400 font-mono">{selectedBlockId}</span></p>
      
      <div className="space-y-3">
        {attributes.map((attr, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={attr.key} readOnly className="flex-1 p-2 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono text-xs" />
            <input type="text" value={attr.value} onChange={(e) => {
              const next = [...attributes];
              next[i].value = e.target.value;
              setAttributes(next);
            }} className="flex-[2] p-2 rounded bg-gray-900 text-white border border-gray-700 font-mono text-xs" />
          </div>
        ))}
      </div>
      <button className="mt-4 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-700 transition-colors">
        Update Node Attributes
      </button>
    </div>
  );
};

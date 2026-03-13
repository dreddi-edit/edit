import React, { useState } from 'react';

export const FormConfigEditor: React.FC<{ selectedBlockId?: string }> = ({ selectedBlockId }) => {
  const [fields, setFields] = useState([
    { label: 'Email Address', type: 'email', placeholder: 'your@email.com', required: true }
  ]);

  if (!selectedBlockId) return null;

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Form Configuration</h3>
      <div className="space-y-4">
        {fields.map((f, i) => (
          <div key={i} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
            <div className="flex justify-between items-center">
              <input 
                type="text" 
                value={f.label} 
                onChange={e => {
                  const n = [...fields]; n[i].label = e.target.value; setFields(n);
                }}
                className="bg-transparent text-sm font-bold text-white outline-none border-b border-gray-700 focus:border-blue-500 transition-colors"
              />
              <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded font-mono uppercase font-bold">{f.type}</span>
            </div>
            <input 
              type="text" 
              value={f.placeholder} 
              onChange={e => {
                const n = [...fields]; n[i].placeholder = e.target.value; setFields(n);
              }}
              placeholder="Placeholder text..."
              className="w-full bg-gray-900 p-2 rounded text-xs text-gray-300 border border-gray-700 outline-none focus:border-gray-500 transition-colors"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={f.required} 
                onChange={e => {
                  const n = [...fields]; n[i].required = e.target.checked; setFields(n);
                }}
                className="accent-blue-600"
              />
              <span className="text-xs text-gray-400">Mark as required</span>
            </label>
          </div>
        ))}
      </div>
      <button className="mt-4 text-xs text-blue-400 hover:text-white font-bold uppercase tracking-wider transition-colors">
        + Add Form Field
      </button>
    </div>
  );
};

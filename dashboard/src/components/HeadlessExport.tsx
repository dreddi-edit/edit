import React from 'react';
import React, { useState } from 'react';

export const HeadlessExport: React.FC = () => {
  const [copying, setCopying] = useState(false);
  const mockJson = JSON.stringify({
    project: "Dreddi Edit",
    schema: "v2",
    nodes: [{ id: "hero", type: "section", content: "..." }]
  }, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(mockJson);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Headless API Export</h3>
      <p className="text-gray-400 text-sm mb-4">Export your visual design as a structured JSON object to power headless frontend applications or custom mobile apps.</p>
      <div className="relative group">
        <pre className="bg-gray-950 p-4 rounded-lg border border-gray-800 text-[10px] text-blue-400 font-mono h-32 overflow-y-auto">
          {mockJson}
        </pre>
        <button 
          onClick={copy}
          className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copying ? 'Copied' : 'Copy JSON'}
        </button>
      </div>
    </div>
  );
};

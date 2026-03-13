import React, { useState } from 'react';

export const AbTestManager: React.FC = () => {
  const [variants, setVariants] = useState([
    { id: 'A', name: 'Original', traffic: 50 },
    { id: 'B', name: 'AI Variation (Focus: Urgency)', traffic: 50 }
  ]);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">AI Content A/B Testing</h3>
        <button className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase">New Variant</button>
      </div>
      <p className="text-gray-400 text-sm mb-4">Test different AI-generated copy and layouts against your original to find the highest converting version.</p>
      <div className="space-y-2">
        {variants.map(v => (
          <div key={v.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 flex items-center justify-center bg-blue-900/40 text-blue-400 rounded-full text-[10px] font-black">{v.id}</span>
              <span className="text-sm text-white">{v.name}</span>
            </div>
            <span className="text-xs text-gray-500 font-mono">{v.traffic}% traffic</span>
          </div>
        ))}
      </div>
    </div>
  );
};

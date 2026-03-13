import React from 'react';
import React, { useState } from 'react';

export const ResponsiveGridControls: React.FC<{ selectedBlockId?: string }> = ({ selectedBlockId }) => {
  const [columns, setColumns] = useState({ mobile: 1, tablet: 2, desktop: 3 });

  if (!selectedBlockId) return null;

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Responsive Grid Logic</h3>
      <div className="space-y-4">
        {(['mobile', 'tablet', 'desktop'] as const).map((device) => (
          <div key={device} className="flex items-center justify-between">
            <span className="text-xs text-gray-400 capitalize">{device} Columns</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setColumns({...columns, [device]: Math.max(1, columns[device] - 1)})}
                className="w-6 h-6 bg-gray-800 rounded border border-gray-700 text-white flex items-center justify-center hover:bg-gray-700 transition-colors"
              >-</button>
              <span className="text-sm font-mono text-white w-4 text-center">{columns[device]}</span>
              <button 
                onClick={() => setColumns({...columns, [device]: Math.min(12, columns[device] + 1)})}
                className="w-6 h-6 bg-gray-800 rounded border border-gray-700 text-white flex items-center justify-center hover:bg-gray-700 transition-colors"
              >+</button>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors text-sm">
        Update Layout Constraints
      </button>
    </div>
  );
};

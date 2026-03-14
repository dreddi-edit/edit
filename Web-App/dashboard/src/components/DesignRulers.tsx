import React from 'react';

export const DesignRulers: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Horizontal Ruler */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-gray-900/80 border-b border-blue-500/30 flex items-end">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="flex-1 border-l border-blue-500/20 h-2 text-[8px] text-blue-400 pl-1">{i * 100}</div>
        ))}
      </div>
      {/* Vertical Ruler */}
      <div className="absolute top-0 left-0 bottom-0 w-4 bg-gray-900/80 border-r border-blue-500/30 flex flex-col items-end">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="flex-1 border-t border-blue-500/20 w-2 text-[8px] text-blue-400 pr-1 leading-none">{i * 100}</div>
        ))}
      </div>
      {/* Grid Overlay */}
      <div className="absolute inset-4 opacity-10" style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
    </div>
  );
};

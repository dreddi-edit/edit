import React from 'react';
import React, { useState } from 'react';

export const HoverStateToggle: React.FC<{ onToggle: (active: boolean) => void }> = ({ onToggle }) => {
  const [isHoverMode, setIsHoverMode] = useState(false);

  const toggle = () => {
    const next = !isHoverMode;
    setIsHoverMode(next);
    onToggle(next);
  };

  return (
    <button 
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
        isHoverMode 
        ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
        : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-white'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${isHoverMode ? 'bg-orange-500 animate-pulse' : 'bg-gray-700'}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider">Hover Mode</span>
    </button>
  );
};

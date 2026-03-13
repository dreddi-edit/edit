import React, { useState } from 'react';

export const InteractionTimeline: React.FC = () => {
  const [duration, setDuration] = useState(0.3);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Motion Timeline</h3>
      <p className="text-gray-400 text-sm mb-4">Edit keyframe timings and easing for the selected element.</p>
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 relative h-24 overflow-hidden">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10" style={{ left: '40%' }} />
        <div className="flex items-center h-full gap-1 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="flex-1 h-8 bg-gray-800 border-l border-gray-700" />
          ))}
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 left-[10%] right-[30%] h-6 bg-blue-600/20 border border-blue-500/40 rounded flex items-center px-2">
          <span className="text-[9px] font-bold text-blue-400 uppercase">Fade In Up</span>
        </div>
      </div>
      <div className="mt-4 flex justify-between text-[10px] text-gray-500 font-mono">
        <span>0.0s</span>
        <span>Duration: {duration}s</span>
        <span>2.0s</span>
      </div>
    </div>
  );
};

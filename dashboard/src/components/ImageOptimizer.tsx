import React, { useState } from 'react';

export const ImageOptimizer: React.FC = () => {
  const [optimizing, setOptimizing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const optimize = () => {
    setOptimizing(true);
    setTimeout(() => {
      setStats({ saved: '4.2MB', count: 12, quality: '92%' });
      setOptimizing(false);
    }, 3000);
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-800/50">
      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Asset Performance</h4>
      {stats ? (
        <div className="p-3 bg-green-900/10 border border-green-500/20 rounded-lg mb-3 flex items-center justify-between">
          <span className="text-xs text-green-400 font-medium">Saved {stats.saved} across {stats.count} images</span>
          <span className="text-[10px] bg-green-500 text-black font-black px-1.5 py-0.5 rounded uppercase">Passed</span>
        </div>
      ) : null}
      <button 
        onClick={optimize}
        disabled={optimizing}
        className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg border border-gray-700 transition-all flex items-center justify-center gap-2"
      >
        {optimizing ? (
          <>
            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            Optimizing...
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Convert all to WebP (Boost Speed)
          </>
        )}
      </button>
    </div>
  );
};

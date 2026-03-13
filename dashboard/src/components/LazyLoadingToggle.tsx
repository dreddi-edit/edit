import React, { useState } from 'react';

export const LazyLoadingToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex items-center justify-between">
        <div className="pr-4">
          <h3 className="text-xl font-bold text-white">Native Lazy Loading</h3>
          <p className="text-gray-400 text-sm mt-1">Automatically inject 'loading="lazy"' to all images. This defers non-critical asset loading and boosts your SEO score.</p>
        </div>
        <button 
          onClick={() => setEnabled(!enabled)}
          className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-green-600' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-lg ${enabled ? 'left-8' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
};

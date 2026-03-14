import React from 'react';

export const HreflangManager: React.FC = () => {
  const alternates = [
    { lang: 'en-US', url: 'https://site.com/' },
    { lang: 'de-DE', url: 'https://site.com/de/' },
    { lang: 'x-default', url: 'https://site.com/' }
  ];

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Global Hreflang Mapping</h3>
      <p className="text-gray-400 text-sm mb-4">Correctly cross-link your language versions so search engines serve the right URL to the right user.</p>
      
      <div className="space-y-2">
        {alternates.map((alt, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/40 border border-gray-700/50 rounded-md">
            <span className="w-16 text-[10px] font-black text-blue-400 uppercase">{alt.lang}</span>
            <span className="text-[10px] font-mono text-gray-500 truncate flex-1">{alt.url}</span>
            <div className="w-2 h-2 rounded-full bg-green-500" title="Valid" />
          </div>
        ))}
      </div>
    </div>
  );
};

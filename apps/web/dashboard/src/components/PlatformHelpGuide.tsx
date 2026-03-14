import React, { useState } from 'react';

export const PlatformHelpGuide: React.FC = () => {
  const [platform, setPlatform] = useState('webflow');

  const guides: Record<string, string> = {
    webflow: "Publish your site to a .webflow.io domain first. Ensure all assets are public.",
    shopify: "Export your theme as a .zip or provide the URL of a published store preview.",
    wordpress: "Use our 'WP Export' plugin or provide the URL of a front-page.php based theme."
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Import Intelligence Guide</h3>
      <div className="flex gap-2 mb-4">
        {Object.keys(guides).map(p => (
          <button key={p} onClick={() => setPlatform(p)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${platform === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-lg">
        <div className="flex gap-3">
          <div className="text-blue-400 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-sm text-blue-100 leading-relaxed italic">"{guides[platform]}"</p>
        </div>
      </div>
    </div>
  );
};

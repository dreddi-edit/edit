import React, { useState } from 'react';

export const SeoFilesGenerator: React.FC = () => {
  const [view, setView] = useState<'robots' | 'sitemap'>('robots');

  const robotsTxt = `User-agent: *\nAllow: /\nSitemap: https://yoursite.com/sitemap.xml`;
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n</urlset>`;

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Crawler File Generator</h3>
      <p className="text-gray-400 text-sm mb-4">Automatically generate files to help search engines index your site correctly.</p>
      
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('robots')} className={`px-3 py-1 text-xs font-bold rounded ${view === 'robots' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>robots.txt</button>
        <button onClick={() => setView('sitemap')} className={`px-3 py-1 text-xs font-bold rounded ${view === 'sitemap' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>sitemap.xml</button>
      </div>

      <textarea 
        readOnly 
        value={view === 'robots' ? robotsTxt : sitemapXml}
        className="w-full h-32 p-3 bg-gray-950 text-gray-300 font-mono text-[10px] border border-gray-800 rounded-lg outline-none"
      />
      <button className="mt-4 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded transition-colors border border-gray-700">
        Download {view === 'robots' ? 'robots.txt' : 'sitemap.xml'}
      </button>
    </div>
  );
};

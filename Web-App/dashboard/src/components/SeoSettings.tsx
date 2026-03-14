import React, { useState } from 'react';

export const SeoSettings: React.FC = () => {
  const [seo, setSeo] = useState({
    title: 'My Awesome Website',
    description: 'The best website built with the AI editor.',
    ogImage: 'https://example.com/og-image.jpg'
  });

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">SEO & Social Meta</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Page Title</label>
          <input 
            type="text" 
            value={seo.title} 
            onChange={e => setSeo({...seo, title: e.target.value})}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meta Description</label>
          <textarea 
            rows={3}
            value={seo.description} 
            onChange={e => setSeo({...seo, description: e.target.value})}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 text-sm outline-none focus:border-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">OG Share Image URL</label>
          <input 
            type="text" 
            value={seo.ogImage} 
            onChange={e => setSeo({...seo, ogImage: e.target.value})}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <button className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-6 py-2 rounded-lg transition-colors">
        Save Metadata
      </button>
    </div>
  );
};

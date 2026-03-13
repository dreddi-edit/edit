import React, { useState } from 'react';
import React, { ImageEnhancer } from './ImageEnhancer';
import { ImageOptimizer } from './ImageOptimizer';

export const MediaLibrary: React.FC = () => {
  const [assets] = useState([
    { id: 1, url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=200', type: 'image' },
    { id: 2, url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=200', type: 'image' },
    { id: 3, url: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=200', type: 'image' },
    { id: 4, url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=200', type: 'image' }
  ]);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Project Media Library</h3>
        <button className="text-[10px] bg-white text-black px-3 py-1 rounded font-bold uppercase hover:bg-gray-200 transition-colors">Upload New</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {assets.map(asset => (
          <div key={asset.id} className="aspect-square bg-gray-800 rounded border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500 transition-all relative group">
            <img src={asset.url} alt="asset" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
               <span className="text-[8px] font-bold text-white uppercase bg-blue-600 px-1.5 py-0.5 rounded">Pick</span>
            </div>
          </div>
        ))}
        <ImageOptimizer />
          <ImageEnhancer />
    </div>
    </div>
  );
};

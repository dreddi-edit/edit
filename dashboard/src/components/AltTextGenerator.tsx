import React from 'react';
import React, { useState } from 'react';

export const AltTextGenerator: React.FC = () => {
  const [images, setImages] = useState([
    { id: 1, src: 'https://example.com/hero.jpg', currentAlt: '', suggested: 'A modern laptop on a wooden desk' },
    { id: 2, src: 'https://example.com/logo.png', currentAlt: 'Logo', suggested: 'Company Logo in blue and white' }
  ]);
  const [processing, setProcessing] = useState(false);

  const applyAlt = (id: number, text: string) => {
    setImages(images.map(img => img.id === id ? { ...img, currentAlt: text } : img));
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Accessibility Engine</h3>
      <p className="text-gray-400 text-sm mb-6">Automatically generate descriptive alt-text for your images to improve SEO and screen-reader accessibility.</p>
      
      <div className="space-y-4">
        {images.map(img => (
          <div key={img.id} className="flex gap-4 items-center bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
            <img src={img.src} alt="preview" className="w-12 h-12 rounded object-cover border border-gray-600" />
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-mono truncate">{img.src}</p>
              <input 
                type="text" 
                value={img.currentAlt} 
                placeholder="No alt text set..."
                onChange={(e) => applyAlt(img.id, e.target.value)}
                className="w-full mt-1 bg-transparent text-sm text-white outline-none focus:text-blue-400"
              />
            </div>
            <button 
              onClick={() => applyAlt(img.id, img.suggested)}
              className="text-[10px] bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded border border-blue-500/30 transition-all uppercase font-bold"
            >
              Apply AI Suggestion
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

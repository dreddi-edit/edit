import React from 'react';
import React, { useState } from 'react';

export const TranslationManager: React.FC = () => {
  const [targetLang, setTargetLang] = useState('de');
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);

  const startTranslation = () => {
    setTranslating(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTranslating(false);
          return 100;
        }
        return prev + 10;
      });
    }, 400);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Mass Content Translation</h3>
      <p className="text-gray-400 text-sm mb-6">Automatically translate your entire project content into different languages while preserving HTML structure and SEO metadata.</p>
      
      <div className="flex gap-3 mb-6">
        <select 
          value={targetLang} 
          onChange={e => setTargetLang(e.target.value)}
          className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="de">German (Deutsch)</option>
          <option value="fr">French (Français)</option>
          <option value="es">Spanish (Español)</option>
          <option value="it">Italian (Italiano)</option>
          <option value="ja">Japanese (日本語)</option>
        </select>
        <button 
          onClick={startTranslation}
          disabled={translating}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg transition-all disabled:opacity-50 text-sm"
        >
          {translating ? `Translating (${progress}%)` : 'Translate Site'}
        </button>
      </div>

      {translating && (
        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
          <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
};

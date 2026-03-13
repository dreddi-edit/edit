import React from 'react';
import React, { useState } from 'react';

export const AiImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt) return;
    setGenerating(true);
    // Simulating API call to Imagen/Gemini
    setTimeout(() => {
      setResult('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80');
      setGenerating(false);
    }, 3000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Image Laboratory</h3>
      <p className="text-gray-400 text-sm mb-4">Generate unique, royalty-free assets for your design using advanced latent diffusion models.</p>
      
      <div className="flex flex-col gap-3">
        <textarea 
          placeholder="Describe the image you want to create..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="w-full h-24 p-3 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors resize-none"
        />
        <button 
          onClick={generate}
          disabled={generating || !prompt}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition-all disabled:opacity-50 text-sm"
        >
          {generating ? 'Dreaming up your image...' : 'Generate Image'}
        </button>
      </div>

      {result && (
        <div className="mt-4 animate-in zoom-in-95 duration-500">
          <img src={result} alt="Generated" className="w-full rounded-lg border border-gray-700 shadow-2xl" />
          <button className="mt-2 w-full bg-gray-100 text-black text-xs font-bold py-1.5 rounded uppercase">Insert into Project</button>
        </div>
      )}
    </div>
  );
};

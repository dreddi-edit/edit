import React from 'react';
import React, { useState } from 'react';

export const CodeInjection: React.FC = () => {
  const [headCode, setHeadCode] = useState('/* Custom CSS */\nbody { filter: grayscale(0); }');
  const [footerCode, setFooterCode] = useState('// Analytics Snippet\nconsole.log("Site loaded");');

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Custom Code Injection</h3>
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Header Injection (&lt;head&gt;)</label>
          <textarea 
            value={headCode}
            onChange={e => setHeadCode(e.target.value)}
            className="w-full h-32 p-3 bg-gray-950 text-green-400 font-mono text-xs border border-gray-800 rounded-lg outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Footer Injection (Before &lt;/body&gt;)</label>
          <textarea 
            value={footerCode}
            onChange={e => setFooterCode(e.target.value)}
            className="w-full h-32 p-3 bg-gray-950 text-blue-400 font-mono text-xs border border-gray-800 rounded-lg outline-none focus:border-blue-500/50"
          />
        </div>
      </div>
      <button className="mt-4 bg-gray-100 hover:bg-white text-black font-bold px-6 py-2 rounded-lg transition-colors text-sm">
        Save & Deploy Scripts
      </button>
    </div>
  );
};

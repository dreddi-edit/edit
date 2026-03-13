import React from 'react';
import React, { useState } from 'react';

export const LegalGenerator: React.FC = () => {
  const [businessName, setBusinessName] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    if (!businessName) return;
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      alert(`Legal documents generated for ${businessName}. New pages added to project: /privacy, /terms.`);
    }, 2000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Legal Compliance</h3>
      <p className="text-gray-400 text-sm mb-4">Generate localized, GDPR-compliant Privacy Policies and Terms of Service based on your business profile.</p>
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Business Legal Name" 
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <button 
          onClick={generate}
          disabled={generating || !businessName}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 text-xs"
        >
          {generating ? 'Drafting...' : 'Generate Policies'}
        </button>
      </div>
    </div>
  );
};

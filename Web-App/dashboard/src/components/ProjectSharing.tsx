import React, { useState } from 'react';

export const ProjectSharing: React.FC<{ projectId: number }> = () => {
  const [token] = useState('example-share-token');
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/share/${token}`;

  const copyLink = () => {
    const el = document.createElement('textarea');
    el.value = shareUrl;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Public Sharing</h3>
      <p className="text-gray-400 text-sm mb-4">Generate a public link to share your design with clients or teammates without them needing an account.</p>
      
      <div className="flex gap-2">
        <input 
          type="text" 
          readOnly 
          value={shareUrl} 
          className="flex-1 p-2 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono text-xs truncate" 
        />
        <button 
          onClick={copyLink}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded transition-colors whitespace-nowrap"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
};

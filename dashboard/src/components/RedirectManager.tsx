import React, { useState } from 'react';

export const RedirectManager: React.FC = () => {
  const [redirects, setRedirects] = useState([
    { from: '/old-services', to: '/services', type: 301 }
  ]);

  const addRedirect = () => {
    const from = prompt("Source Path (e.g. /old-blog):");
    const to = prompt("Destination Path (e.g. /blog):");
    if (from && to) setRedirects([...redirects, { from, to, type: 301 }]);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Redirect Manager (301/302)</h3>
        <button onClick={addRedirect} className="text-[10px] bg-white text-black px-2 py-1 rounded font-bold uppercase hover:bg-gray-200 transition-colors">Add Mapping</button>
      </div>
      <div className="space-y-2">
        {redirects.map((r, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
            <span className="text-xs font-mono text-gray-500 flex-1 truncate">{r.from}</span>
            <div className="text-blue-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
            <span className="text-xs font-mono text-white flex-1 truncate">{r.to}</span>
            <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded text-gray-400 font-bold border border-gray-700">{r.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

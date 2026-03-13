import React, { useState } from 'react';

export const SsoConfig: React.FC = () => {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="p-6 border border-blue-900/20 bg-blue-950/5 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          Enterprise SSO
          <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Enterprise</span>
        </h3>
        <button 
          onClick={() => setEnabled(!enabled)}
          className={`w-12 h-6 rounded-full transition-all relative ${enabled ? 'bg-blue-600' : 'bg-gray-800'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      <p className="text-gray-400 text-xs mb-4">Integrate with Okta, Azure AD, or Google Workspace via SAML 2.0 or OIDC.</p>
      
      {enabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <input type="text" placeholder="Identity Provider Metadata URL" className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-xs text-blue-400 font-mono" />
          <div className="flex gap-2">
            <button className="flex-1 bg-gray-800 text-white text-[10px] font-bold py-2 rounded uppercase border border-gray-700">Test Connection</button>
            <button className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded uppercase">Save SAML Config</button>
          </div>
        </div>
      )}
    </div>
  );
};

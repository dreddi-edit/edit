import React, { useState } from 'react';

export const ReferralProgram: React.FC = () => {
  const [refCode] = useState('EDGAR' + Math.floor(Math.random() * 9000 + 1000));
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/signup?ref=${refCode}`;

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 border border-purple-900/30 bg-purple-900/10 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-purple-400">Refer & Earn Credits</h3>
      <p className="text-gray-400 text-sm mb-4">Invite your colleagues. When they upgrade to a paid plan, you both get <span className="text-white font-bold">€25.00 in AI credits</span>.</p>
      
      <div className="flex gap-2 p-2 bg-gray-950 rounded-lg border border-purple-500/20">
        <input type="text" readOnly value={inviteUrl} className="flex-1 bg-transparent text-xs text-gray-400 font-mono outline-none px-2" />
        <button onClick={copy} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase transition-all">
          {copied ? 'Copied' : 'Copy Invite'}
        </button>
      </div>
      
      <div className="mt-4 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-gray-500">
        <span>Total Earned: €0.00</span>
        <span>Pending: 0 Invites</span>
      </div>
    </div>
  );
};

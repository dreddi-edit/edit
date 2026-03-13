import React, { useState } from 'react';

export const CreditTopup: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const buyCredits = async (amount: number) => {
    setLoading(true);
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ type: 'one_time_credits', amount })
    }).then(r => r.json());
    
    if (res.ok && res.url) window.location.href = res.url;
    setLoading(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-800/50">
      <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">One-Time Refills</p>
      <div className="flex gap-2">
        <button 
          disabled={loading}
          onClick={() => buyCredits(10)}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-xs py-2 rounded-lg border border-gray-700 transition-colors"
        >
          Add €10 Credits
        </button>
        <button 
          disabled={loading}
          onClick={() => buyCredits(25)}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-xs py-2 rounded-lg border border-gray-700 transition-colors"
        >
          Add €25 Credits
        </button>
      </div>
    </div>
  );
};

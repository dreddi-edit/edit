import React, { useState, useEffect } from 'react';

export const ResetRateLimitUI: React.FC = () => {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const triggerReset = () => {
    if (cooldown > 0) return;
    setCooldown(60); // 60 second cooldown
    alert("Reset email sent. Check your inbox.");
  };

  return (
    <div className="mt-4 text-center">
      <button 
        onClick={triggerReset}
        disabled={cooldown > 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:bg-gray-800 disabled:text-gray-500"
      >
        {cooldown > 0 ? `Wait ${cooldown}s before retrying` : 'Send Reset Link'}
      </button>
      {cooldown > 0 && (
        <p className="mt-2 text-[10px] text-red-400 font-bold uppercase tracking-widest">Rate limit active: One request per minute</p>
      )}
    </div>
  );
};

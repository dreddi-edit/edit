import React from 'react';

export const CreditTopup: React.FC = () => {
  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
      <h2 className="text-xl font-bold text-white mb-4">Credits aufladen</h2>
      <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
        Credit top-ups are handled through the live billing surfaces in the dashboard and settings.
      </div>
    </div>
  );
};

export default CreditTopup;

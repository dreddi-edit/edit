import React, { useState } from 'react';

export const MaintenanceMode: React.FC = () => {
  const [active, setActive] = useState(false);

  return (
    <div className="p-6 border border-red-900/20 bg-red-950/5 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-red-400">Maintenance Mode</h3>
        <button 
          onClick={() => setActive(!active)}
          className={`w-10 h-5 rounded-full relative transition-all ${active ? 'bg-red-600' : 'bg-gray-800'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-5.5' : 'left-0.5'}`} />
        </button>
      </div>
      <p className="text-red-900/60 text-xs">Redirect all public traffic to a custom 'Site Under Maintenance' page.</p>
    </div>
  );
};

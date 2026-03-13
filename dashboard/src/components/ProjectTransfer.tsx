import React from 'react';
import React, { useState } from 'react';

export const ProjectTransfer: React.FC<{ projectId: number }> = ({ projectId }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!email.includes('@')) return;
    if (!confirm(`Are you sure? You will lose access to project #${projectId} immediately.`)) return;
    
    setLoading(true);
    // Simulating project transfer logic
    setTimeout(() => {
      setLoading(false);
      alert(`Transfer initiated to ${email}. Check your email for confirmation.`);
    }, 1500);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Transfer Ownership</h3>
      <p className="text-gray-400 text-sm mb-4">Transfer this project to another user. They will become the new owner and you will be removed from the project.</p>
      <div className="flex gap-2">
        <input 
          type="email" 
          placeholder="New Owner's Email" 
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <button 
          onClick={handleTransfer}
          disabled={loading || !email}
          className="bg-gray-100 hover:bg-white text-black font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 text-xs"
        >
          {loading ? 'Transferring...' : 'Transfer Project'}
        </button>
      </div>
    </div>
  );
};

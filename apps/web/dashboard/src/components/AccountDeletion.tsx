import React, { useState } from 'react';

export const AccountDeletion: React.FC = () => {
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    const doubleCheck = prompt("To confirm, type 'DELETE MY ACCOUNT' below:");
    if (doubleCheck !== 'DELETE MY ACCOUNT') return;
    
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    const res = await fetch('/api/auth/delete-account', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
    if (res.ok) {
      alert("Account deleted. You will be logged out.");
      window.location.href = '/';
    }
  };

  return (
    <div className="p-6 border border-red-900/30 bg-red-900/10 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-red-400">Danger Zone</h3>
      <p className="text-gray-400 text-sm mb-4">Once you delete your account, there is no going back. All projects, versions, and billing history will be permanently erased.</p>
      
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg text-sm font-bold border border-red-500/30 transition-all">
          Delete Account
        </button>
      ) : (
        <div className="flex gap-3">
          <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">I am sure, Delete Everything</button>
          <button onClick={() => setConfirming(false)} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Cancel</button>
        </div>
      )}
    </div>
  );
};

import React from 'react';

export const PrivacySettings: React.FC = () => {
  const handleExport = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    fetch('/api/auth/export', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gdpr-account-export.json';
      a.click();
    })
    .catch(err => console.error("Export failed", err));
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Privacy & Data Compliance</h3>
      <p className="text-gray-400 mb-4">Download a complete machine-readable copy of your personal data, projects, and billing history in compliance with GDPR regulations.</p>
      <button onClick={handleExport} className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-4 py-2 rounded-lg transition-colors border border-gray-700">
        Download Account Data
      </button>
    </div>
  );
};

import React from 'react';
import React, { useState } from 'react';

export const PdfExport: React.FC<{ projectId: number }> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    
    try {
      const res = await fetch(`/api/export/pdf?project_id=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'design-preview.pdf';
      a.click();
    } catch (err) {
      console.error("PDF Export failed", err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Document Export</h3>
      <p className="text-gray-400 text-sm mb-4">Download a high-fidelity PDF document of your current design for offline review or client sign-off.</p>
      <button 
        onClick={handleExport}
        disabled={loading}
        className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Generating PDF...' : 'Download PDF Preview'}
      </button>
    </div>
  );
};

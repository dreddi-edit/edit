import React, { useState, useEffect } from 'react';

export const VersionHistory: React.FC<{ projectId: number }> = ({ projectId }) => {
  const [versions, setVersions] = useState<Array<{ id: number; created_at: string; label?: string }>>([]);
  const [loading, setLoading] = useState(false);

  const getHeaders = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    return { 'Authorization': `Bearer ${token}` };
  };

  const loadVersions = () => {
    fetch(`/api/projects/${projectId}/versions`, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => { if (data.ok) setVersions(data.versions || []); });
  };

  useEffect(() => { if (projectId) loadVersions(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async (versionId: number) => {
    if (!confirm("Are you sure? This will overwrite the current draft.")) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/restore/${versionId}`, { method: 'POST', headers: getHeaders() }).then(r => r.json());
    if (res.ok) window.location.reload();
    setLoading(false);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Version History</h3>
      <div className="space-y-2">
        {versions.map((v) => (
          <div key={v.id} className="flex justify-between items-center p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
            <div>
              <p className="text-white font-medium">{new Date(v.created_at).toLocaleString()}</p>
              <p className="text-xs text-gray-500 uppercase tracking-tighter">ID: {v.id}</p>
            </div>
            <button 
              onClick={() => restore(v.id)}
              disabled={loading}
              className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1 rounded border border-blue-500/30 transition-all"
            >
              Restore
            </button>
          </div>
        ))}
        {versions.length === 0 && <p className="text-gray-500 italic text-sm">No versions saved yet.</p>}
      </div>
    </div>
  );
};

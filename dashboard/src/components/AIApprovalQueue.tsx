import React, { useState, useEffect } from 'react';

export const AIApprovalQueue: React.FC = () => {
  const [items, setItems] = useState<Array<{ id: number; action: string; status: string; created_at: string }>>([]);

  const getHeaders = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  };

  const loadQueue = () => {
    fetch('/api/admin/ai-queue', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => { if (data.ok) setItems(data.items || []); })
      .catch(() => {});
  };

  useEffect(() => { loadQueue(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (id: number, approved: boolean) => {
    await fetch(`/api/admin/ai-queue/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ approved })
    });
    loadQueue();
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">AI Approval Queue</h3>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="p-4 bg-gray-800/40 border border-gray-700 rounded-lg flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">{item.model}</p>
                <p className="text-white text-sm mt-1">{item.prompt_summary || 'Semantic Rewrite'}</p>
              </div>
              <span className="text-[10px] text-gray-500">{new Date(item.created_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAction(item.id, true)} className="flex-1 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white py-1.5 rounded text-xs font-bold transition-all border border-green-500/30">Approve</button>
              <button onClick={() => handleAction(item.id, false)} className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-1.5 rounded text-xs font-bold transition-all border border-red-500/30">Reject</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500 italic text-sm">Queue is empty. No pending AI changes.</p>}
      </div>
    </div>
  );
};

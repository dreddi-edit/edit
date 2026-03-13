import React, { useState, useEffect } from 'react';

export const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    fetch('/api/stripe/invoices', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setInvoices(data.invoices || []); });
  }, []);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Invoice History</h3>
      <div className="space-y-2">
        {invoices.map((inv, i) => (
          <div key={i} className="flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-lg">
            <div>
              <p className="text-white font-bold text-sm">€{(inv.amount / 100).toFixed(2)}</p>
              <p className="text-[10px] text-gray-500 uppercase">{new Date(inv.date * 1000).toLocaleDateString()}</p>
            </div>
            <a 
              href={inv.pdf} 
              target="_blank" 
              rel="noreferrer" 
              className="text-[10px] bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1 rounded border border-blue-500/30 transition-all font-bold uppercase"
            >
              Download PDF
            </a>
          </div>
        ))}
        {invoices.length === 0 && <p className="text-gray-500 italic text-sm">No invoices found.</p>}
      </div>
    </div>
  );
};

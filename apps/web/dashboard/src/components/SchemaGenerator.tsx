import React, { useState } from 'react';

export const SchemaGenerator: React.FC = () => {
  const [type, setType] = useState('Organization');
  const [data, setData] = useState({ name: 'My Brand', url: 'https://example.com' });

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": type,
    ...data
  }, null, 2);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Structured Data (JSON-LD)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Schema Type</label>
          <select 
            value={type} 
            onChange={e => setType(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white"
          >
            <option value="Organization">Organization</option>
            <option value="LocalBusiness">Local Business</option>
            <option value="Article">Article</option>
            <option value="Product">Product</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Entity Name</label>
          <input 
            type="text" 
            value={data.name} 
            onChange={e => setData({...data, name: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white"
          />
        </div>
      </div>
      <div className="relative">
        <div className="absolute top-2 right-2 text-[10px] text-gray-600 font-mono">JSON-LD</div>
        <pre className="bg-gray-950 p-4 rounded-lg border border-gray-800 text-[10px] text-green-500 font-mono overflow-x-auto">
          {jsonLd}
        </pre>
      </div>
    </div>
  );
};

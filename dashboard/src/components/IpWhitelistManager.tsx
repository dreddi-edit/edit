import React, { useState } from 'react';

export const IpWhitelistManager: React.FC = () => {
  const [ips, setIps] = useState(['192.168.1.1', '10.0.0.45']);
  const addIp = () => {
    const ip = prompt("Enter IP:");
    if (ip) setIps([...ips, ip]);
  };

  return (
    <div className="p-6 border border-red-900/20 bg-red-900/5 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">IP Whitelisting</h3>
        <button onClick={addIp} className="text-[10px] bg-red-600/20 text-red-400 px-2 py-1 rounded border border-red-500/30 font-bold uppercase">Add IP</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ips.map((ip, i) => (
          <div key={i} className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-gray-300">
            {ip}
          </div>
        ))}
      </div>
    </div>
  );
};

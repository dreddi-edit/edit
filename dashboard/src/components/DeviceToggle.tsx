import React, { useState } from 'react';

type Device = 'desktop' | 'tablet' | 'mobile';

export const DeviceToggle: React.FC<{ onDeviceChange: (d: Device) => void }> = ({ onDeviceChange }) => {
  const [active, setActive] = useState<Device>('desktop');

  const setDevice = (d: Device) => {
    setActive(d);
    onDeviceChange(d);
  };

  return (
    <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1">
      {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
        <button
          key={d}
          onClick={() => setDevice(d)}
          className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
            active === d ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
};

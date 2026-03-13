import React from 'react';

export const PerformanceMonitor: React.FC = () => {
  const metrics = [
    { label: 'LCP', name: 'Largest Contentful Paint', score: '0.8s', color: 'text-green-400' },
    { label: 'FID', name: 'First Input Delay', score: '12ms', color: 'text-green-400' },
    { label: 'CLS', name: 'Cumulative Layout Shift', score: '0.01', color: 'text-green-400' }
  ];

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Editor Core Web Vitals</h3>
      <div className="space-y-4">
        {metrics.map(m => (
          <div key={m.label} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{m.label}</p>
              <p className="text-[10px] text-gray-600">{m.name}</p>
            </div>
            <div className={`text-sm font-black font-mono ${m.color}`}>{m.score}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-gray-800">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
          <span>PageSpeed Prediction</span>
          <span className="text-green-400">98 / 100</span>
        </div>
      </div>
    </div>
  );
};

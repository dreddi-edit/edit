import React from 'react';

export const AccessibilityScorecard: React.FC = () => {
  const score = 82;
  const checks = [
    { label: 'Alt Text Coverage', status: 'pass' },
    { label: 'Color Contrast', status: 'fail' },
    { label: 'ARIA Landmark Roles', status: 'pass' },
    { label: 'Focus Indicators', status: 'warning' }
  ];

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Accessibility Scorecard</h3>
        <div className="text-2xl font-black text-green-400">{score}%</div>
      </div>
      <div className="space-y-3">
        {checks.map((check, i) => (
          <div key={i} className="flex justify-between items-center p-2 bg-gray-800/40 rounded border border-gray-700/50">
            <span className="text-xs text-gray-300">{check.label}</span>
            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
              check.status === 'pass' ? 'bg-green-600/20 text-green-400' : 
              check.status === 'fail' ? 'bg-red-600/20 text-red-400' : 'bg-yellow-600/20 text-yellow-400'
            }`}>
              {check.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

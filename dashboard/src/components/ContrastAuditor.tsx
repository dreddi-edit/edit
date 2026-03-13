import React, { useState } from 'react';

export const ContrastAuditor: React.FC = () => {
  const [issues, setIssues] = useState([
    { id: 1, element: 'Hero CTA', current: '#94a3b8 on #ffffff', ratio: '2.4:1', suggestion: '#475569' }
  ]);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Visual Accessibility Audit</h3>
      <p className="text-gray-400 text-sm mb-4">Automatically detect and fix contrast issues to ensure your site meets WCAG 2.1 AA accessibility standards.</p>
      
      <div className="space-y-3">
        {issues.map(issue => (
          <div key={issue.id} className="p-4 bg-red-900/10 border border-red-500/20 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-red-400 uppercase">{issue.element}</p>
              <p className="text-sm text-white mt-1">Contrast {issue.ratio} (Failed)</p>
              <p className="text-[10px] text-gray-500 font-mono mt-1">{issue.current}</p>
            </div>
            <button className="bg-white text-black text-[10px] font-black px-3 py-1.5 rounded uppercase hover:bg-gray-200 transition-all">
              Fix with AI: {issue.suggestion}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

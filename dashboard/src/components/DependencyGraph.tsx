import React from 'react';

export const DependencyGraph: React.FC = () => {
  const nodes = [
    { id: 'index.html', links: ['about.html', 'contact.html'] },
    { id: 'about.html', links: ['team.html'] },
    { id: 'contact.html', links: [] },
    { id: 'team.html', links: ['index.html'] }
  ];

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Project Dependency Graph</h3>
      <div className="space-y-4">
        {nodes.map(node => (
          <div key={node.id} className="flex items-start gap-4">
            <div className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 rounded text-xs font-mono text-blue-300">
              {node.id}
            </div>
            {node.links.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {node.links.map(link => (
                  <div key={link} className="flex items-center gap-2">
                    <span className="text-gray-600">→</span>
                    <span className="text-[10px] text-gray-500 font-mono">{link}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

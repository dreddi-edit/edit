import React, { useState } from 'react';

export const ShortcutsLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: '⌘ + S', desc: 'Save Project' },
    { key: '⌘ + Z', desc: 'Undo Change' },
    { key: '⌘ + ⇧ + Z', desc: 'Redo Change' },
    { key: '⌘ + K', desc: 'Command Palette' },
    { key: 'Esc', desc: 'Close Modal' }
  ];

  return (
    <div className="fixed bottom-6 left-6 z-40">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-full flex items-center justify-center shadow-xl transition-all"
      >
        <span className="font-bold">?</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 w-64 bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <h4 className="text-sm font-bold text-white mb-3">Keyboard Shortcuts</h4>
          <div className="space-y-2">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{s.desc}</span>
                <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono border border-gray-700">{s.key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

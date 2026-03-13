import React, { useState } from 'react';

export const AiCommandCenter: React.FC = () => {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'executing'>('idle');

  const executeCommand = () => {
    if (!command) return;
    setStatus('analyzing');
    // Simulating the AI analyzing the site structure and planning changes
    setTimeout(() => {
      setStatus('executing');
      setTimeout(() => {
        setStatus('idle');
        setCommand('');
        alert("Command executed: Site-wide styles updated.");
      }, 2000);
    }, 1500);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Command Center</h3>
      <p className="text-gray-400 text-sm mb-4">Issue high-level natural language instructions to perform complex site-wide modifications.</p>
      
      <div className="relative">
        <input 
          type="text" 
          placeholder="e.g., 'Make all cards have a subtle glassmorphism effect'..."
          value={command}
          onChange={e => setCommand(e.target.value)}
          className="w-full p-4 pr-12 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-all"
        />
        <button 
          onClick={executeCommand}
          disabled={status !== 'idle' || !command}
          className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all disabled:opacity-50"
        >
          {status === 'idle' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          ) : (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          )}
        </button>
      </div>
      
      <div className="mt-4 flex gap-2">
        {['Redesign Hero', 'Darken Footer', 'Boost Contrast'].map(hint => (
          <button key={hint} onClick={() => setCommand(hint)} className="text-[9px] bg-gray-800 text-gray-400 px-2 py-1 rounded-md hover:text-white border border-gray-700">
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
};

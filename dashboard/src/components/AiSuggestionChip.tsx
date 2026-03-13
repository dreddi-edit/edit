import React from 'react';

interface Props {
  visible: boolean;
  onAction: (action: string) => void;
}

export const AiSuggestionChip: React.FC<Props> = ({ visible, onAction }) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-950 border border-blue-500/30 p-1.5 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-blue-600 p-1.5 rounded-full">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM15.657 14.243a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" /></svg>
      </div>
      <button onClick={() => onAction('simplify')} className="text-[10px] font-bold text-white px-3 py-1 hover:bg-gray-800 rounded-full transition-colors">Simplify</button>
      <button onClick={() => onAction('professional')} className="text-[10px] font-bold text-white px-3 py-1 hover:bg-gray-800 rounded-full transition-colors">Make Professional</button>
      <button onClick={() => onAction('headlines')} className="text-[10px] font-bold text-white px-3 py-1 hover:bg-gray-800 rounded-full transition-colors">Catchy Headlines</button>
    </div>
  );
};

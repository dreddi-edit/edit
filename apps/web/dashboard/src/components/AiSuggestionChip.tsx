import React, { useState, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface Props {
  visible: boolean;
  selectedHtml?: string;
  onAction: (action: string, result?: string) => void;
}

const ACTIONS = [
  { key: 'simplify', label: 'Simplify' },
  { key: 'professional', label: 'Make Professional' },
  { key: 'headlines', label: 'Catchy Headlines' },
  { key: 'cro', label: 'Boost Conversion' },
  { key: 'cta', label: 'Sharpen CTA' },
];

export const AiSuggestionChip: React.FC<Props> = ({ visible, selectedHtml, onAction }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleAction = useCallback(async (key: string) => {
    const html = selectedHtml ?? (window as any).__editorSelectedHtml ?? '';
    if (!html) { onAction(key); return; }
    setLoading(key);
    setError('');
    try {
      const data = await apiFetch('/api/ai/inline-suggestions', {
        method: 'POST',
        body: JSON.stringify({ html, action: key }),
      });
      if (data.ok) {
        onAction(key, data.html);
      } else {
        setError(data.error ?? 'AI failed');
        onAction(key);
      }
    } catch {
      onAction(key);
    }
    setLoading(null);
  }, [selectedHtml, onAction]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-950 border border-blue-500/30 p-1.5 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-blue-600 p-1.5 rounded-full">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM15.657 14.243a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" />
        </svg>
      </div>
      {ACTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handleAction(key)}
          disabled={loading !== null}
          className="text-[10px] font-bold text-white px-3 py-1 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {loading === key && <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin inline-block" />}
          {label}
        </button>
      ))}
      {error && <span className="text-[9px] text-red-400 px-2">{error}</span>}
    </div>
  );
};

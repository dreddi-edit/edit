import React, { useState } from 'react';
import { apiFetch } from '../api/client';

const REFACTOR_TYPES = [
  { value: 'layout', label: 'Layout → Flex/Grid' },
  { value: 'css_cleanup', label: 'CSS Cleanup' },
  { value: 'semantics', label: 'Semantic HTML' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'performance', label: 'Performance' },
  { value: 'duplicate_removal', label: 'Remove Duplicates' },
  { value: 'simplification', label: 'Simplify Structure' },
  { value: 'full', label: 'Full Refactor' },
];

interface Props {
  html?: string;
  onResult?: (html: string, type: string) => void;
}

export const AutoLayoutRefactor: React.FC<Props> = ({ html: propHtml, onResult }) => {
  const [processing, setProcessing] = useState(false);
  const [refactorType, setRefactorType] = useState('layout');
  const [result, setResult] = useState<{ html: string; type: string; model: string } | null>(null);
  const [error, setError] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);

  const run = async (approved = false) => {
    const html = propHtml ?? (window as any).__editorSelectedHtml ?? '';
    if (!html) { setError('No HTML selected. Select a block in the editor first.'); return; }
    setProcessing(true);
    setError('');
    setResult(null);
    try {
      const data = await apiFetch(`/api/ai/html-refactor?approved=${approved ? 1 : 0}`, {
        method: 'POST',
        body: JSON.stringify({ html, type: refactorType }),
      });
      if (data.needsApproval) {
        setNeedsApproval(true);
      } else if (data.ok) {
        setResult({ html: data.html, type: data.type, model: data.model });
        setNeedsApproval(false);
        onResult?.(data.html, data.type);
      } else {
        setError(data.error ?? 'Refactor failed');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setProcessing(false);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">AI Layout Refactor</h3>
      <p className="text-gray-400 text-sm mb-4">Automatically refactor messy CSS structures into clean, responsive Flexbox and Grid layouts using AI.</p>

      <div className="flex gap-3 mb-4 flex-wrap">
        {REFACTOR_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setRefactorType(t.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${refactorType === t.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {needsApproval ? (
        <div className="mb-4 p-4 bg-yellow-900/40 border border-yellow-600/50 rounded-lg">
          <p className="text-yellow-300 text-sm font-semibold mb-2">AI will restructure your HTML ({refactorType}). Confirm?</p>
          <div className="flex gap-2">
            <button onClick={() => run(true)} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs px-4 py-2 rounded">Confirm & Run</button>
            <button onClick={() => setNeedsApproval(false)} className="bg-gray-700 text-white text-xs px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => run(false)}
          disabled={processing}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processing ? (
            <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Refactoring…</>
          ) : 'Refactor Current Selection'}
        </button>
      )}

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

      {result && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
          <p className="text-green-400 text-xs font-semibold">
            ✓ Refactored ({result.type}) via {result.model}
          </p>
          <p className="text-gray-400 text-xs mt-1">Result applied to selection. Use undo to revert.</p>
        </div>
      )}
    </div>
  );
};

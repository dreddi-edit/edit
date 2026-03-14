import React, { useState } from 'react';
import { apiFetch } from '../api/client';

const LANGUAGES = [
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'pl', label: 'Polish (Polski)' },
  { code: 'zh', label: 'Chinese (中文)' },
];

interface Props {
  projectId?: number;
  html?: string;
  onTranslated?: (translatedHtml: string, lang: string) => void;
}

export const TranslationManager: React.FC<Props> = ({ projectId, html: propHtml, onTranslated }) => {
  const [targetLang, setTargetLang] = useState('de');
  const [sourceLang, setSourceLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [useMemory, setUseMemory] = useState(true);

  const startTranslation = async () => {
    const html = propHtml ?? (window as any).__editorProjectHtml ?? '';
    if (!html) { setError('No HTML content available. Open a project first.'); return; }
    setTranslating(true);
    setProgress(0);
    setError('');
    setStatus('Starting translation…');

    // Step 1: Look up cached translations
    let cachedCount = 0;
    if (useMemory && projectId) {
      try {
        setProgress(10);
        setStatus('Checking translation memory…');
        const mem = await apiFetch('/api/translation-memory/lookup', {
          method: 'POST',
          body: JSON.stringify({
            source_lang: sourceLang,
            target_lang: targetLang,
            texts: [html.substring(0, 500)], // sample check
          }),
        });
        cachedCount = mem.results?.filter((r: any) => r.found).length ?? 0;
      } catch {}
    }

    setProgress(20);
    setStatus('Sending to AI translator…');

    try {
      const data = await apiFetch('/api/ai/rewrite-block', {
        method: 'POST',
        body: JSON.stringify({
          html,
          instruction: `Translate the entire content of this HTML page to ${targetLang.toUpperCase()}. Preserve all HTML structure, tags, attributes, and formatting. Only translate visible text content. Do not translate brand names, URLs, or technical identifiers.`,
          systemHint: `You are a professional HTML-aware translator. Source language: ${sourceLang}. Target language: ${targetLang}. Return ONLY the translated HTML.`,
        }),
      });

      if (!data.ok) throw new Error(data.error ?? 'Translation failed');

      setProgress(80);
      setStatus('Saving to translation memory…');

      // Store result in translation memory
      if (useMemory && projectId) {
        try {
          await apiFetch('/api/translation-memory', {
            method: 'POST',
            body: JSON.stringify({
              project_id: projectId,
              source_lang: sourceLang,
              target_lang: targetLang,
              entries: [{ source: html.substring(0, 2000), translation: (data.html ?? '').substring(0, 2000) }],
            }),
          });
        } catch {}
      }

      setProgress(100);
      setStatus(`Translation complete${cachedCount > 0 ? ` (${cachedCount} phrase(s) from memory)` : ''}`);
      onTranslated?.(data.html ?? data, targetLang);
    } catch (e: any) {
      setError(e.message);
      setStatus('');
    }

    setTranslating(false);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Mass Content Translation</h3>
      <p className="text-gray-400 text-sm mb-6">
        Automatically translate your entire project content into different languages while preserving HTML structure and SEO metadata.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Source</label>
          <select
            value={sourceLang}
            onChange={e => setSourceLang(e.target.value)}
            className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="en">English</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Target</label>
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={useMemory} onChange={e => setUseMemory(e.target.checked)} className="w-3.5 h-3.5" />
            Use translation memory
          </label>
        </div>
        <div className="flex items-end">
          <button
            onClick={startTranslation}
            disabled={translating}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg transition-all disabled:opacity-50 text-sm"
          >
            {translating ? 'Translating…' : 'Translate Site'}
          </button>
        </div>
      </div>

      {translating && (
        <div className="mb-2">
          <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mb-2">
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-gray-500 text-xs">{status}</p>
        </div>
      )}
      {!translating && status && (
        <p className="text-green-400 text-xs mt-2">✓ {status}</p>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
};

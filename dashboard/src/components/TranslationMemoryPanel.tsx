import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface MemoryEntry {
  id: number;
  source_lang: string;
  target_lang: string;
  source_text: string;
  translation: string;
  project_id?: number;
  created_at: string;
}

interface Props {
  projectId?: number;
}

const LANG_LABELS: Record<string, string> = {
  en: 'EN', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', ja: 'JA', nl: 'NL', pt: 'PT', pl: 'PL', zh: 'ZH',
};

export const TranslationMemoryPanel: React.FC<Props> = ({ projectId }) => {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSource) params.set('source_lang', filterSource);
      if (filterTarget) params.set('target_lang', filterTarget);
      if (projectId) params.set('project_id', String(projectId));
      const data = await apiFetch(`/api/translation-memory?${params.toString()}`);
      if (data.ok) setEntries(data.entries ?? []);
    } catch {}
    setLoading(false);
  }, [filterSource, filterTarget, projectId]);

  useEffect(() => { load(); setPage(1); }, [load]);

  const deleteEntry = async (id: number) => {
    if (!confirm('Delete this translation memory entry?')) return;
    setDeleting(id);
    try {
      const data = await apiFetch(`/api/translation-memory/${id}`, { method: 'DELETE' });
      if (data.ok) setEntries(e => e.filter(x => x.id !== id));
    } catch {}
    setDeleting(null);
  };

  const clearAll = async () => {
    if (!confirm('Delete ALL translation memory entries for this filter? This cannot be undone.')) return;
    try {
      const params: Record<string, string> = {};
      if (filterSource) params.source_lang = filterSource;
      if (filterTarget) params.target_lang = filterTarget;
      if (projectId) params.project_id = String(projectId);
      await apiFetch('/api/translation-memory', { method: 'DELETE', body: JSON.stringify(params) });
      setEntries([]);
    } catch {}
  };

  const filtered = entries.filter(e =>
    !search || e.source_text.toLowerCase().includes(search.toLowerCase()) || e.translation.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  const langs = [...new Set(entries.flatMap(e => [e.source_lang, e.target_lang]))].sort();

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Translation Memory</h3>
        <div className="flex gap-2 items-center">
          <span className="text-gray-500 text-xs">{filtered.length} entries</span>
          {entries.length > 0 && (
            <button onClick={clearAll} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/20 rounded transition-colors">
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[150px] bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-1.5 outline-none focus:border-blue-500"
          placeholder="Search source or translation…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="bg-gray-800 text-white text-xs border border-gray-700 rounded px-2 py-1.5 outline-none focus:border-blue-500"
        >
          <option value="">All sources</option>
          {langs.map(l => <option key={l} value={l}>{LANG_LABELS[l] ?? l.toUpperCase()}</option>)}
        </select>
        <select
          value={filterTarget}
          onChange={e => setFilterTarget(e.target.value)}
          className="bg-gray-800 text-white text-xs border border-gray-700 rounded px-2 py-1.5 outline-none focus:border-blue-500"
        >
          <option value="">All targets</option>
          {langs.map(l => <option key={l} value={l}>{LANG_LABELS[l] ?? l.toUpperCase()}</option>)}
        </select>
        <button onClick={load} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 bg-gray-800 rounded transition-colors">
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : paged.length === 0 ? (
        <p className="text-gray-600 text-sm italic">No translation memory entries found.</p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="text-left px-3 py-2 text-gray-400 font-semibold w-8">Langs</th>
                <th className="text-left px-3 py-2 text-gray-400 font-semibold">Source</th>
                <th className="text-left px-3 py-2 text-gray-400 font-semibold">Translation</th>
                <th className="text-left px-3 py-2 text-gray-400 font-semibold w-24">Date</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {paged.map((e, i) => (
                <tr key={e.id} className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-900/40' : 'bg-gray-900/20'}`}>
                  <td className="px-3 py-2">
                    <span className="font-mono text-blue-400">{(LANG_LABELS[e.source_lang] ?? e.source_lang).toUpperCase()}</span>
                    <span className="text-gray-600 mx-1">→</span>
                    <span className="font-mono text-green-400">{(LANG_LABELS[e.target_lang] ?? e.target_lang).toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-300 max-w-[200px] truncate" title={e.source_text}>
                    {e.source_text}
                  </td>
                  <td className="px-3 py-2 text-gray-300 max-w-[200px] truncate" title={e.translation}>
                    {e.translation}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => deleteEntry(e.id)}
                      disabled={deleting === e.id}
                      className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs px-3 py-1 bg-gray-800 rounded disabled:opacity-40">
            ←
          </button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs px-3 py-1 bg-gray-800 rounded disabled:opacity-40">
            →
          </button>
        </div>
      )}
    </div>
  );
};

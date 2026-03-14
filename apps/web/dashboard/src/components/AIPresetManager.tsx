import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface Preset {
  id: number;
  name: string;
  prompt: string;
  system_hint?: string;
  category?: string;
}

interface PresetsResponse {
  ok?: boolean;
  presets?: Preset[];
}

interface PresetWriteResponse {
  ok?: boolean;
  preset?: Preset;
}

export const AIPresetManager: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', prompt: '', system_hint: '', category: 'general' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PresetsResponse>('/api/presets');
      if (data.ok) setPresets(data.presets ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const resetForm = () => { setForm({ name: '', prompt: '', system_hint: '', category: 'general' }); setAdding(false); setEditId(null); setError(''); };

  const save = async () => {
    if (!form.name.trim() || !form.prompt.trim()) { setError('Name and prompt required.'); return; }
    try {
      if (editId !== null) {
        const data = await apiFetch<PresetWriteResponse>(`/api/presets/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
        if (data.ok) { setPresets(p => p.map(x => x.id === editId ? { ...x, ...form } : x)); resetForm(); }
      } else {
        const data = await apiFetch<PresetWriteResponse>('/api/presets', { method: 'POST', body: JSON.stringify(form) });
        if (data.ok) { setPresets(p => [...p, data.preset]); resetForm(); }
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this preset?')) return;
    try {
      const data = await apiFetch<{ ok?: boolean }>(`/api/presets/${id}`, { method: 'DELETE' });
      if (data.ok) setPresets(p => p.filter(x => x.id !== id));
    } catch {}
  };

  const startEdit = (p: Preset) => {
    setForm({ name: p.name, prompt: p.prompt, system_hint: p.system_hint ?? '', category: p.category ?? 'general' });
    setEditId(p.id);
    setAdding(true);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">AI Rewriting Presets</h3>
        <button onClick={() => { resetForm(); setAdding(a => !a); }} className="text-xs bg-white text-black px-2 py-1 rounded font-bold">
          {adding ? 'Cancel' : 'Add New'}
        </button>
      </div>

      {adding && (
        <div className="mb-5 p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
          <input
            className="w-full bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            placeholder="Preset name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <textarea
            className="w-full bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500 resize-none h-20"
            placeholder="Rewrite instruction / prompt"
            value={form.prompt}
            onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
          />
          <input
            className="w-full bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            placeholder="System hint (optional)"
            value={form.system_hint}
            onChange={e => setForm(f => ({ ...f, system_hint: e.target.value }))}
          />
          <select
            className="bg-gray-900 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          >
            {['general', 'tone', 'cro', 'seo', 'brand', 'product'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={save} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded">
            {editId !== null ? 'Update Preset' : 'Save Preset'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading presets…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map(p => (
            <div key={p.id} className="p-3 bg-gray-800 border border-gray-700 rounded-lg group relative">
              <p className="text-white font-bold text-sm">{p.name}</p>
              {p.category && <span className="text-[10px] text-blue-400 font-semibold uppercase">{p.category}</span>}
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{p.prompt}</p>
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <button onClick={() => startEdit(p)} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 bg-gray-700 rounded">Edit</button>
                <button onClick={() => remove(p.id)} className="text-[10px] text-gray-400 hover:text-red-400 px-2 py-1 bg-gray-700 rounded">Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

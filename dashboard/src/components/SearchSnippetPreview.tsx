import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface SnippetData {
  title: string;
  description: string;
  url: string;
  title_length: number;
  description_length: number;
  title_ok: boolean;
  description_ok: boolean;
  breadcrumbs: string[];
}

interface Props {
  url?: string;
  title?: string;
  description?: string;
  projectId?: number;
  onUpdate?: (meta: { title: string; description: string }) => void;
}

export const SearchSnippetPreview: React.FC<Props> = ({ url: propUrl, title: propTitle, description: propDesc, projectId, onUpdate }) => {
  const [snippet, setSnippet] = useState<SnippetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editTitle, setEditTitle] = useState(propTitle ?? '');
  const [editDesc, setEditDesc] = useState(propDesc ?? '');
  const [editUrl, setEditUrl] = useState(propUrl ?? '');

  const fetchSnippet = useCallback(async () => {
    const params = new URLSearchParams();
    if (editUrl) params.set('url', editUrl);
    if (editTitle) params.set('title', editTitle);
    if (editDesc) params.set('description', editDesc);
    if (projectId) params.set('project_id', String(projectId));
    setLoading(true);
    try {
      const data = await apiFetch(`/api/seo/snippet-preview?${params.toString()}`);
      if (data.ok) setSnippet(data.snippet ?? data);
    } catch {}
    setLoading(false);
  }, [editUrl, editTitle, editDesc, projectId]);

  useEffect(() => { fetchSnippet(); }, []);

  const displayTitle = editTitle || snippet?.title || 'Page Title';
  const displayDesc = editDesc || snippet?.description || 'Page description will appear here.';
  const displayUrl = editUrl || snippet?.url || 'https://example.com';

  const titleLen = displayTitle.length;
  const descLen = displayDesc.length;
  const titleOk = titleLen >= 30 && titleLen <= 60;
  const descOk = descLen >= 120 && descLen <= 160;

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6 space-y-5">
      <h3 className="text-xl font-bold text-white">Search Snippet Preview</h3>

      {/* Edit fields */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-400">Meta Title</label>
            <span className={`text-xs font-mono ${titleOk ? 'text-green-400' : titleLen > 60 ? 'text-red-400' : 'text-yellow-400'}`}>
              {titleLen}/60
            </span>
          </div>
          <input
            className="w-full bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Enter page title…"
            maxLength={80}
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-400">Meta Description</label>
            <span className={`text-xs font-mono ${descOk ? 'text-green-400' : descLen > 160 ? 'text-red-400' : 'text-yellow-400'}`}>
              {descLen}/160
            </span>
          </div>
          <textarea
            className="w-full bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500 resize-none h-16"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="Enter meta description…"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">URL</label>
          <input
            className="w-full bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500"
            value={editUrl}
            onChange={e => setEditUrl(e.target.value)}
            placeholder="https://your-site.com/page"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSnippet} disabled={loading} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-4 py-2 rounded disabled:opacity-50">
            {loading ? 'Loading…' : 'Update Preview'}
          </button>
          {onUpdate && (
            <button
              onClick={() => onUpdate({ title: editTitle, description: editDesc })}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded"
            >
              Save to Project
            </button>
          )}
        </div>
      </div>

      {/* Google-style preview */}
      <div className="p-5 bg-white rounded-xl shadow-sm">
        <div className="font-sans max-w-lg">
          <div className="text-[13px] text-gray-500 mb-0.5 truncate">{displayUrl}</div>
          <div className="text-blue-700 text-xl font-normal leading-tight hover:underline cursor-pointer truncate">
            {displayTitle.length > 60 ? displayTitle.slice(0, 60) + '…' : displayTitle}
          </div>
          <div className="text-gray-600 text-sm leading-snug mt-1">
            {displayDesc.length > 160 ? displayDesc.slice(0, 160) + '…' : displayDesc}
          </div>
        </div>
      </div>

      {/* Validation hints */}
      <div className="space-y-2">
        <SnippetHint ok={titleOk} label="Title" length={titleLen} min={30} max={60} />
        <SnippetHint ok={descOk} label="Description" length={descLen} min={120} max={160} />
      </div>
    </div>
  );
};

const SnippetHint: React.FC<{ ok: boolean; label: string; length: number; min: number; max: number }> = ({ ok, label, length, min, max }) => {
  const toolong = length > max;
  const tooshort = length > 0 && length < min;
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${ok ? 'bg-green-900/30 text-green-400' : toolong ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
      <span>{ok ? '✓' : toolong ? '↓' : '↑'}</span>
      <span>
        {label}: {length} chars
        {ok && ' — Good length'}
        {toolong && ` — Too long (max ${max})`}
        {tooshort && ` — Too short (min ${min})`}
        {length === 0 && ' — Empty'}
      </span>
    </div>
  );
};

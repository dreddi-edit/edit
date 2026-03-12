import React from 'react';

interface EditorOverlayProps {
  blockFilter: any;
  setBlockFilter: (val: any) => void;
  BLOCK_FILTER_OPTIONS: any[];
  handleAiRescan: (type: any) => void;
  aiScanLoading: boolean;
  versionPreview: any;
}

export const EditorOverlay: React.FC<EditorOverlayProps> = ({
  blockFilter,
  setBlockFilter,
  BLOCK_FILTER_OPTIONS,
  handleAiRescan,
  aiScanLoading,
  versionPreview
}) => {
  return (
    <section className="editor-panel__section">
      <h2 className="editor-panel__label">Overlay</h2>
      <select
        className="editor-select editor-select--full"
        value={blockFilter}
        onChange={e => setBlockFilter(e.target.value)}
        title="Visible blocks"
        aria-label="Visible block filter"
      >
        {BLOCK_FILTER_OPTIONS.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="editor-panel__two-up">
        <button
          type="button"
          className="editor-btn editor-btn--panel"
          onClick={() => handleAiRescan("block")}
          disabled={aiScanLoading || Boolean(versionPreview)}
        >
          {aiScanLoading ? "..." : "AI Block"}
        </button>
        <button
          type="button"
          className="editor-btn editor-btn--panel editor-btn--panel-muted"
          onClick={() => handleAiRescan("page")}
          disabled={aiScanLoading || Boolean(versionPreview)}
        >
          {aiScanLoading ? "..." : "AI Page"}
        </button>
      </div>
    </section>
  );
};

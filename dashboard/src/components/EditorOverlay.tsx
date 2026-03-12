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
      <div className="editor-panel__label">Overlay</div>
      <select
        className="editor-select editor-select--full"
        value={blockFilter}
        onChange={e => setBlockFilter(e.target.value)}
        title="Visible blocks"
      >
        {BLOCK_FILTER_OPTIONS.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="editor-panel__two-up">
        <button
          className="editor-btn editor-btn--panel"
          onClick={() => handleAiRescan("block")}
          disabled={aiScanLoading || Boolean(versionPreview)}
        >
          {aiScanLoading ? "..." : "AI Block"}
        </button>
        <button
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

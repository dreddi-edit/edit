import React from 'react';

interface EditorAuditsProps {
  runEditorAudit: (type: any) => void;
  runningAudit: string | null;
  editorAudit: any;
}

export const EditorAudits: React.FC<EditorAuditsProps> = ({ runEditorAudit, runningAudit, editorAudit }) => {
  return (
    <section className="editor-panel__section">
      <div className="editor-panel__label">Audits</div>
      <div className="editor-panel__two-up">
        <button
          className="editor-btn editor-btn--panel"
          onClick={() => void runEditorAudit("seo")}
          disabled={runningAudit !== null}
        >
          {runningAudit === "seo" ? "Running..." : "SEO"}
        </button>
        <button
          className="editor-btn editor-btn--panel editor-btn--panel-muted"
          onClick={() => void runEditorAudit("cro")}
          disabled={runningAudit !== null}
        >
          {runningAudit === "cro" ? "Running..." : "CRO"}
        </button>
      </div>
      <button
        className="editor-btn editor-btn--panel editor-btn--panel-muted"
        onClick={() => void runEditorAudit("accessibility")}
        disabled={runningAudit !== null}
      >
        {runningAudit === "accessibility" ? "Running..." : "Accessibility"}
      </button>
      {editorAudit ? (
        <div className="editor-panel__version-preview">
          <div className="editor-panel__version-preview-title">{editorAudit.headline}</div>
          <div className="editor-panel__version-preview-meta">{editorAudit.summary}</div>
          {editorAudit.scoreBadges?.length ? (
            <div className="editor-panel__chips">
              {editorAudit.scoreBadges.map((badge: string) => (
                <span key={badge} className="editor-chip is-active">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          <div className="editor-panel__warning-list">
            {editorAudit.items.map((item: string) => (
              <div key={item} className="editor-panel__warning-item">
                <span className="editor-panel__warning-item-code">•</span>
                <span className="editor-panel__warning-item-copy">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="editor-panel__note">Run an audit to surface page-level SEO, CRO, and accessibility issues here.</div>
      )}
    </section>
  );
};

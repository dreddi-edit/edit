import React from 'react';

interface EditorModalsProps {
  aiDiff: any;
  theme: string;
  acceptAiDiff: () => void;
  rejectAiDiff: () => void;
  buildDiffPreview: (html: string) => string;
  isLoading: boolean;
}

export const EditorModals: React.FC<EditorModalsProps> = ({
  aiDiff, theme, acceptAiDiff, rejectAiDiff, buildDiffPreview, isLoading
}) => (
  <>
    {aiDiff && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 18 }}>
        <div style={{ width: "min(1080px, 100%)", maxHeight: "calc(100vh - 48px)", overflow: "auto", borderRadius: 18, border: theme === "light" ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(148,163,184,0.18)", background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(8,12,24,0.98)", boxShadow: theme === "light" ? "0 24px 60px rgba(15,23,42,0.2)" : "0 24px 80px rgba(0,0,0,0.55)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: theme === "light" ? "#0f172a" : "white" }}>AI diff review</div>
              <div style={{ fontSize: 12, color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.86)" }}>{aiDiff.scope === "block" ? "Block-level change" : "Page-level change"} ready for accept or rollback.</div>
            </div>
            <button className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact" onClick={acceptAiDiff}>Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ borderRadius: 14, border: theme === "light" ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(148,163,184,0.16)", padding: 12, background: theme === "light" ? "rgba(248,250,252,0.96)" : "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: theme === "light" ? "#334155" : "#cbd5e1" }}>Before</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, lineHeight: 1.5, color: theme === "light" ? "#0f172a" : "#f8fafc" }}>{buildDiffPreview(aiDiff.beforeHtml || aiDiff.beforeDocumentHtml)}</pre>
            </div>
            <div style={{ borderRadius: 14, border: "1px solid rgba(34,197,94,0.24)", padding: 12, background: theme === "light" ? "rgba(240,253,244,0.96)" : "rgba(34,197,94,0.08)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: theme === "light" ? "#166534" : "#86efac" }}>After</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, lineHeight: 1.5, color: theme === "light" ? "#14532d" : "#dcfce7" }}>{buildDiffPreview(aiDiff.afterHtml)}</pre>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="editor-btn editor-btn--panel editor-btn--panel-muted" onClick={rejectAiDiff}>Reject and revert</button>
            <button className="editor-btn editor-btn--panel editor-btn--success" onClick={acceptAiDiff}>Accept change</button>
          </div>
        </div>
      </div>
    )}
    {isLoading && (
      <div style={{ position:"fixed", top:58, left:0, right:0, bottom:0, background: theme === "light" ? "rgba(240,244,248,0.97)" : "rgba(11,18,32,0.97)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:100 }}>
        <div style={{ width:64, height:64, border:"3px solid rgba(99,102,241,0.2)", borderTop:"3px solid #6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", marginBottom:20 }} />
        <div style={{ color: theme === "light" ? "#111827" : "white", fontSize:17, fontWeight:700, marginBottom:8 }}>Website wird geladen...</div>
        <div style={{ color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.7)", fontSize:13, textAlign:"center", maxWidth:280 }}>Seite wird ueber den Proxy geladen.</div>
      </div>
    )}
  </>
);

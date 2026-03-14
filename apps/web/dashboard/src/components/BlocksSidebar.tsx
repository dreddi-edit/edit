import React from 'react';

type BlockType =
  | "section"
  | "heading"
  | "paragraph"
  | "button"
  | "image"
  | "divider";

const ITEMS: { type: BlockType; label: string; hint: string }[] = [
  { type: "section", label: "Section", hint: "Container/Wrapper" },
  { type: "heading", label: "Heading", hint: "h2 headline" },
  { type: "paragraph", label: "Text", hint: "paragraph" },
  { type: "button", label: "Button", hint: "CTA link" },
  { type: "image", label: "Image", hint: "placeholder" },
  { type: "divider", label: "Divider", hint: "hr" },
];

export default function BlocksSidebar({
  enabled,
  onAdd,
}: {
  enabled?: boolean;
  onAdd?: (t: BlockType) => void;
}) {
  const isEnabled = !!enabled;

  return (
    <div style={{ padding: 12, width: 220, opacity: isEnabled ? 1 : 0.55 }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.92, marginBottom: 10 }}>Blocks</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ITEMS.map((it) => (
          <div
            key={it.type}
            draggable={isEnabled}
            onDragStart={(e) => {
              if (!isEnabled) return;
              e.dataTransfer.setData("application/x-site-editor-block", it.type);
              e.dataTransfer.setData("text/plain", it.type);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => {
              if (!isEnabled) return;
              onAdd?.(it.type);
            }}
            style={{
              userSelect: "none",
              cursor: isEnabled ? "grab" : "not-allowed",
              padding: "10px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(0,0,0,0.20)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            title={isEnabled ? "Drag into the page (or click to add)" : "Switch to Edit mode to add blocks"}
          >
            <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>{it.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{it.hint}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, opacity: 0.6, lineHeight: 1.3 }}>
        {isEnabled ? (
          <>
            Drag a block into the page. It will insert <b>before/after</b> the hovered block.
          </>
        ) : (
          <>Go to <b>Edit</b> mode to enable drag & drop.</>
        )}
      </div>
    </div>
  );
}

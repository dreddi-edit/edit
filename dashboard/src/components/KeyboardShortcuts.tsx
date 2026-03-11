import { useEffect } from "react"

type Props = {
  open: boolean
  onClose: () => void
  theme: "dark" | "light"
}

const SHORTCUTS = [
  { keys: "⌘K", desc: "Open command palette" },
  { keys: "?", desc: "Show keyboard shortcuts" },
  { keys: "⌘Z", desc: "Undo" },
  { keys: "⌘⇧Z", desc: "Redo" },
  { keys: "Esc", desc: "Close modal / deselect" },
]

export default function KeyboardShortcuts({ open, onClose, theme }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 360,
          maxWidth: "100%",
          padding: 28,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.98)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: theme === "light" ? "#0f172a" : "white" }}>
          Keyboard shortcuts
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SHORTCUTS.map(s => (
            <div
              key={s.keys}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
              }}
            >
              <span style={{ fontSize: 13, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.8)" }}>{s.desc}</span>
              <kbd style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                fontFamily: "var(--font-sans)",
              }}>
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.8)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

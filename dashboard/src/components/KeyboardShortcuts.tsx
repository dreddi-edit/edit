import React from 'react';
import { useEffect } from "react"

export type ShortcutHelpSection = {
  title: string
  items: Array<{ keys: string; desc: string }>
}

type Props = {
  open: boolean
  onClose: () => void
  theme: "dark" | "light"
  title?: string
  sections?: ShortcutHelpSection[]
}

const DEFAULT_SECTIONS: ShortcutHelpSection[] = [
  {
    title: "General",
    items: [
      { keys: "⌘K", desc: "Focus global search" },
      { keys: "⌘⇧P", desc: "Open command palette" },
      { keys: "?", desc: "Show keyboard shortcuts" },
      { keys: "Esc", desc: "Close modal or panel" },
    ],
  },
]

export default function KeyboardShortcuts({
  open,
  onClose,
  theme,
  title = "Keyboard shortcuts",
  sections = DEFAULT_SECTIONS,
}: Props) {
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
      aria-modal="true"
      aria-label={title}
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          maxHeight: "min(80vh, 680px)",
          overflowY: "auto",
          padding: 28,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.98)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: theme === "light" ? "#0f172a" : "white" }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {sections.map((section) => (
            <section key={section.title} aria-label={section.title}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.72)",
                  marginBottom: 8,
                }}
              >
                {section.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {section.items.map((item) => (
                  <div
                    key={`${section.title}-${item.keys}-${item.desc}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ fontSize: 13, color: theme === "light" ? "#334155" : "rgba(226,232,240,0.88)" }}>{item.desc}</span>
                    <kbd
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: theme === "light" ? "rgba(15,23,42,0.06)" : "rgba(0,0,0,0.2)",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: theme === "light" ? "#475569" : "rgba(148,163,184,0.8)",
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

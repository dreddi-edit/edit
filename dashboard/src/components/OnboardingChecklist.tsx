import React from 'react';

import { useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "se_onboarding_checklist"

export type CheckItem = { id: string; label: string; done: boolean }

const DEFAULT_ITEMS: CheckItem[] = [
  { id: "create", label: "Create your first project", done: false },
  { id: "load", label: "Load a URL or use a template", done: false },
  { id: "ai", label: "Try AI block rewrite in edit mode", done: false },
  { id: "export", label: "Export to ZIP", done: false },
]

function loadItems(): CheckItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_ITEMS.map(i => ({ ...i }))
}

function saveItems(items: CheckItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
}

type Props = {
  theme: "dark" | "light"
  projectCount: number
  onOpenEditor: () => void
  onShowCredits: () => void
  /** Called when user completes an item (id) */
  onStepComplete?: (id: string) => void
}

export default function OnboardingChecklist({
  theme,
  projectCount,
  onOpenEditor,
  onShowCredits,
  onStepComplete,
}: Props) {
  const [items, setItems] = useState<CheckItem[]>(loadItems)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("se_checklist_collapsed") === "1")

  const effectiveItems = useMemo(
    () => items.map((item) => {
      if (item.id === "create" && projectCount > 0 && !item.done) {
        return { ...item, done: true }
      }
      return item
    }),
    [items, projectCount],
  )

  useEffect(() => { saveItems(effectiveItems) }, [effectiveItems])

  const update = (id: string, done: boolean) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done } : i))
    if (done) onStepComplete?.(id)
  }

  const doneCount = effectiveItems.filter(i => i.done).length
  const allDone = doneCount === effectiveItems.length

  const markLoadDone = () => update("load", true)

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
      background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.7)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => { setCollapsed(!collapsed); localStorage.setItem("se_checklist_collapsed", collapsed ? "0" : "1") }}
        style={{
          width: "100%",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "none",
          background: "transparent",
          color: theme === "light" ? "#0f172a" : "rgba(255,255,255,0.9)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: allDone ? "rgba(34,197,94,0.2)" : "rgba(99,102,241,0.15)",
            color: allDone ? "#22c55e" : "rgba(129,140,248,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
          }}>
            {allDone ? "✓" : `${doneCount}/${items.length}`}
          </span>
          Get started
        </span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{collapsed ? "▼" : "▲"}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: "0 18px 18px" }}>
          {effectiveItems.map(i => (
            <div
              key={i.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"}`,
              }}
            >
              <button
                onClick={() => update(i.id, !i.done)}
                aria-label={i.done ? `Mark ${i.label} incomplete` : `Mark ${i.label} complete`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${i.done ? "rgba(34,197,94,0.6)" : "rgba(148,163,184,0.4)"}`,
                  background: i.done ? "rgba(34,197,94,0.2)" : "transparent",
                  color: i.done ? "#22c55e" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {i.done && "✓"}
              </button>
              <span style={{
                fontSize: 13,
                color: i.done ? (theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.6)") : (theme === "light" ? "#0f172a" : "rgba(255,255,255,0.85)"),
                textDecoration: i.done ? "line-through" : "none",
              }}>
                {i.label}
              </span>
            </div>
          ))}
          {!allDone && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                onClick={() => { markLoadDone(); onOpenEditor() }}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Open Editor
              </button>
              <button
                onClick={onShowCredits}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(99,102,241,0.3)",
                  background: "rgba(99,102,241,0.1)",
                  color: "rgba(129,140,248,0.9)",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Get credits
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

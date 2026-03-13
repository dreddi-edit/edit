import React from 'react';

import { useState, useEffect, useMemo, useRef } from "react"
import type { Project } from "../api/projects"

type Action = { id: string; label: string; shortcut?: string; icon: string }

type Props = {
  open: boolean
  onClose: () => void
  projects: Project[]
  onOpenProject: (p: Project) => void
  onNewProject: () => void
  onCredits: () => void
  onSettings: () => void
  onInvite: () => void
  onSignOut: () => void
  theme: "dark" | "light"
}

const ACTIONS: Action[] = [
  { id: "new", label: "New project", shortcut: "⌘N", icon: "+" },
  { id: "credits", label: "Add credits", icon: "€" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "invite", label: "Invite teammates", icon: "👤" },
  { id: "signout", label: "Sign out", icon: "→" },
]

export default function CommandPalette({
  open,
  onClose,
  projects,
  onOpenProject,
  onNewProject,
  onCredits,
  onSettings,
  onInvite,
  onSignOut,
  theme,
}: Props) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.url || "").toLowerCase().includes(q)
    )
  }, [projects, query])

  const items = useMemo(() => {
    const acts = ACTIONS.filter(a =>
      a.label.toLowerCase().includes(query.trim().toLowerCase())
    )
    return [
      ...acts.map(a => ({ type: "action" as const, data: a })),
      ...filteredProjects.map(p => ({ type: "project" as const, data: p })),
    ]
  }, [filteredProjects, query])

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelected(i => Math.min(Math.max(0, i), items.length - 1))
  }, [items.length])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      else if (e.key === "Enter") {
        e.preventDefault()
        const item = items[selected]
        if (!item) return
        if (item.type === "project") onOpenProject(item.data)
        else {
          if (item.data.id === "new") onNewProject()
          else if (item.data.id === "credits") onCredits()
          else if (item.data.id === "settings") onSettings()
          else if (item.data.id === "invite") onInvite()
          else if (item.data.id === "signout") onSignOut()
        }
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, selected, items, onClose, onOpenProject, onNewProject, onCredits, onSettings, onInvite, onSignOut])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const sel = el.querySelector(`[data-index="${selected}"]`)
    sel?.scrollIntoView({ block: "nearest" })
  }, [selected])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 560,
          maxWidth: "100%",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.98)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects or run a command…"
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(0,0,0,0.2)",
              color: theme === "light" ? "#0f172a" : "white",
              fontSize: 15,
              outline: "none",
            }}
          />
        </div>
        <div
          ref={listRef}
          role="listbox"
          aria-label="Command palette results"
          style={{
            maxHeight: 320,
            overflowY: "auto",
            padding: 8,
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.6)", fontSize: 13 }}>
              No results
            </div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.type === "project" ? `p-${item.data.id}` : item.data.id}
                data-index={i}
                role="option"
                aria-selected={i === selected}
                onClick={() => {
                  if (item.type === "project") onOpenProject(item.data)
                  else {
                    if (item.data.id === "new") onNewProject()
                    else if (item.data.id === "credits") onCredits()
                    else if (item.data.id === "settings") onSettings()
                    else if (item.data.id === "invite") onInvite()
                    else if (item.data.id === "signout") onSignOut()
                  }
                  onClose()
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: i === selected ? "rgba(99,102,241,0.15)" : "transparent",
                  color: theme === "light" ? "#0f172a" : "white",
                  fontSize: 14,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: i === selected ? "rgba(99,102,241,0.2)" : "rgba(148,163,184,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {item.type === "project" ? "◆" : (item.data as Action).icon}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {item.type === "project"
                    ? (item.data as Project).name
                    : (item.data as Action).label}
                </span>
                {item.type === "action" && (item.data as Action).shortcut && (
                  <span style={{ fontSize: 11, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.6)" }}>
                    {(item.data as Action).shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.5)",
        }}>
          ↑↓ navigate · Enter select · Esc close
        </div>
      </div>
    </div>
  )
}

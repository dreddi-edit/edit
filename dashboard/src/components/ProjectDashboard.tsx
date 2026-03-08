import { useEffect, useState } from "react"
import { apiGetProjects, apiCreateProject, apiDeleteProject, type Project } from "../api/projects"
import { apiSaveProject } from "../api/projects"
import CreditsPanel from "./CreditsPanel"
import SettingsPanel from "./SettingsPanel"
import { apiLogout, type User } from "../api/auth"
import { toast } from "./Toast"

const BASE = "http://localhost:8787"

// Screenshot via proxy
async function captureThumb(url: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&viewport_width=1280&viewport_height=800&format=jpg&image_quality=60&access_key=free`)
    // Fallback: einfach gradient mit initialen
    return null
  } catch { return null }
}

function ProjectCard({ p, onOpen, onDelete, theme }: { p: Project; onOpen: () => void; onDelete: () => void; theme: string }) {
  const initials = p.name.slice(0, 2).toUpperCase()
  const hue = (p.name.charCodeAt(0) * 37 + p.name.charCodeAt(1) * 13) % 360

  return (
    <div
      onClick={onOpen}
      style={{
        borderRadius: 14, cursor: "pointer", overflow: "hidden",
        border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
        background: theme === "light" ? "#ffffff" : "rgba(15,20,35,0.9)",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        position: "relative",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = "translateY(-3px)"
        el.style.borderColor = "rgba(99,102,241,0.4)"
        el.style.boxShadow = theme === "light" ? "0 12px 40px rgba(0,0,0,0.12)" : "0 12px 40px rgba(0,0,0,0.4)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = "translateY(0)"
        el.style.borderColor = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"
        el.style.boxShadow = "none"
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 160,
        background: p.thumbnail
          ? `url(${p.thumbnail}) center/cover`
          : `linear-gradient(135deg, hsl(${hue},55%,22%) 0%, hsl(${hue+40},45%,15%) 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {!p.thumbnail && (
          <div style={{
            fontSize: 36, fontWeight: 900, color: `hsla(${hue},80%,80%,0.9)`,
            fontFamily: "system-ui", letterSpacing: -1,
          }}>{initials}</div>
        )}
        {/* Delete */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 26, height: 26, borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)",
            cursor: "pointer", fontSize: 11, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >✕</button>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 4 }}>{p.name}</div>
        {p.url && (
          <div style={{ fontSize: 11, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.url.replace(/^https?:\/\//, "")}
          </div>
        )}
        <div style={{ fontSize: 11, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)" }}>
          {new Date(p.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </div>
    </div>
  )
}

export default function ProjectDashboard({ user, onOpen, onLogout }: {
  user: User
  onOpen: (p: Project) => void
  onLogout: () => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [theme, setTheme] = useState<"dark"|"light">(
    (localStorage.getItem("se_theme") as "dark"|"light") || "dark"
  )
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    localStorage.setItem("se_theme", theme)
  }, [theme])

  const takeScreenshot = async (projectId: number, url: string) => {
    if (!url) return
    try {
      const r = await fetch(`${BASE}/api/screenshot`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, project_id: projectId })
      })
      const d = await r.json()
      if (d.ok) {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, thumbnail: `${BASE}${d.thumbnail}` } : p))
      }
    } catch {}
  }

  const load = async () => {
    try {
      const [projects_data, b, o] = await Promise.all([
        apiGetProjects(),
        fetch(`${BASE}/api/credits/balance`, { credentials: "include" }).then(r => r.json()).catch(() => ({ ok: false })),
        fetch(`${BASE}/api/orgs`, { credentials: "include" }).then(r => r.json()).catch(() => ({ ok: false }))
      ])
      if (b.ok) setBalance(b.balance_eur)
      if (o?.ok && o.owned[0]) setOrgName(o.owned[0].name)
      else if (o?.ok && o.member[0]) setOrgName(o.member[0].name)
      setProjects(projects_data.map((p: any) => ({
        ...p,
        thumbnail: p.thumbnail ? (p.thumbnail.startsWith("http") ? p.thumbnail : `${BASE}${p.thumbnail}`) : null
      })))
      // Screenshots nachholen für Projekte ohne Thumbnail
      for (const p of projects_data) {
        if (!p.thumbnail && p.url) {
          setTimeout(() => takeScreenshot(p.id, p.url), 500)
        }
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    if (!newName.trim()) { toast.warning("Projektname erforderlich"); return }
    setCreating(true)
    try {
      const id = await apiCreateProject(newName.trim(), newUrl.trim(), "")
      toast.success("Projekt erstellt")
      setShowNew(false)
      setNewName(""); setNewUrl("")
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`"${name}" wirklich löschen?`)) return
    try {
      await apiDeleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success("Projekt gelöscht")
    } catch (e: any) { toast.error(e.message) }
  }

  const logout = async () => {
    await apiLogout()
    onLogout()
  }

  const QUICK_ACTIONS = [
    {
      icon: "+",
      title: "Neues Projekt",
      desc: "Projekt anlegen und URL laden",
      action: () => setShowNew(true),
    },
    {
      icon: "◎",
      title: "Ollama Status",
      desc: "Lokale KI prüfen",
      action: async () => {
        try {
          const r = await fetch(`${BASE}/api/ai/ollama-health`)
          const d = await r.json()
          if (d.ok) toast.success(`Ollama läuft · ${d.models?.join(", ") || "Modelle geladen"}`)
          else toast.warning("Ollama nicht erreichbar – Cloud-KI wird genutzt")
        } catch { toast.error("Server nicht erreichbar – läuft er auf Port 8787?") }
      },
    },
    {
      icon: "⚙",
      title: "API Keys",
      desc: "Eigene Keys hinzufügen",
      action: () => { setShowSettings(true) },
    },
    {
      icon: "€",
      title: "Guthaben",
      desc: "Aktuelles Guthaben & Aufladen",
      action: () => setShowCredits(true),
    },
  ]

  return (
    <div style={{ height: "100vh", background: theme === "light" ? "#e2e8f2" : "#080c18", fontFamily: "system-ui, sans-serif", color: theme === "light" ? "#0f172a" : "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        height: 58, padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
        background: 'var(--header-bg)',
        position: "sticky", top: 0, zIndex: 10,
        backdropFilter: "blur(12px)",
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 17, fontWeight: 900, letterSpacing: -0.5,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Site Editor</div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowCredits(true)} style={{
            height: 32, padding: "0 12px", borderRadius: 8,
            border: balance !== null && balance <= 0.01 ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: balance !== null && balance <= 0.01 ? "rgba(239,68,68,0.9)" : "rgba(148,163,184,0.9)",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>
            {balance === null ? "—" : `€ ${balance.toFixed(2)}`}
          </button>

          <button onClick={() => setShowSettings(true)} style={{
            height: 32, padding: "0 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(148,163,184,0.9)", cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>Einstellungen</button>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

          <div style={{ fontSize: 12, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
            {orgName && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                background: theme === "light" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.15)", color: theme === "light" ? "#4f46e5" : "rgba(99,102,241,0.9)",
                border: `1px solid ${theme === "light" ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.25)"}`, letterSpacing: 0.5,
              }}>{orgName}</span>
            )}
            {user.name || user.email}
          </div>

          <button onClick={logout} style={{
            height: 32, padding: "0 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "transparent",
            color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", cursor: "pointer", fontSize: 12,
          }}>Abmelden</button>
        </div>
      </div>

      {/* Body – 2 Spalten */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* Linke Spalte – Projekte */}
        <div style={{
          width: "25%", minWidth: 280, maxWidth: 420, flexShrink: 0,
          borderRight: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
          padding: "32px 28px", overflowY: "auto", height: "100%", boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>Projekte</div>
            <button onClick={() => setShowNew(true)} style={{
              height: 32, padding: "0 14px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>+ Neu</button>
          </div>

          {/* Neues Projekt Form */}
          {showNew && (
            <div style={{
              marginBottom: 20, padding: 16, borderRadius: 12,
              border: `1px solid ${theme === "light" ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.25)"}`,
              background: theme === "light" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.15)",
            }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Projektname"
                style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="https://... (optional)"
                style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={create} disabled={creating} style={{
                  flex: 1, height: 36, borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white", fontWeight: 700, cursor: creating ? "wait" : "pointer", fontSize: 13,
                }}>{creating ? "..." : "Erstellen"}</button>
                <button onClick={() => setShowNew(false)} style={{
                  height: 36, padding: "0 14px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: theme === "light" ? "#475569" : "rgba(148,163,184,0.7)", cursor: "pointer", fontSize: 13,
                }}>Abbrechen</button>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: 48, color: "rgba(148,163,184,0.3)", fontSize: 13 }}>Laden...</div>
          )}

          {!loading && projects.length === 0 && !showNew && (
            <div style={{
              textAlign: "center", padding: "48px 24px",
              border: "1px dashed var(--border)", borderRadius: 12,
              color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", fontSize: 13,
            }}>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>◻</div>
              Noch keine Projekte.<br />Erstelle dein erstes Projekt.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projects.map(p => (
              <ProjectCard key={p.id} p={p} onOpen={() => onOpen(p)} onDelete={() => del(p.id, p.name)} theme={theme} />
            ))}
          </div>
        </div>

        {/* Rechte Spalte – Actions + Info */}
        <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>

          {/* Quick Actions */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", marginBottom: 16, textTransform: "uppercase" }}>Schnellstart</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {QUICK_ACTIONS.map(a => (
                <div key={a.title} onClick={a.action} style={{
                  padding: "18px 20px", borderRadius: 12, cursor: "pointer",
                  border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
                  background: theme === "light" ? "#ffffff" : "rgba(15,20,35,0.9)",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                  className="action-card"
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, marginBottom: 12,
                    background: theme === "light" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.15)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 900, color: theme === "light" ? "#4f46e5" : "rgba(99,102,241,0.9)",
                  }}>{a.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", lineHeight: 1.4 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* KI Status */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", marginBottom: 16, textTransform: "uppercase" }}>KI-Modelle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { name: "Ollama (lokal)", detail: "qwen2.5-coder:7b · kostenlos", status: "local" },
                { name: "Gemini 2.5 Flash", detail: "Google · ab €0.09/1M tokens", status: "cloud" },
                { name: "Claude Sonnet 4.6", detail: "Anthropic · ab €3.60/1M tokens", status: "cloud" },
              ].map(m => (
                <div key={m.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
                  background: theme === "light" ? "#ffffff" : "rgba(15,20,35,0.9)",
                  fontSize: 12,
                }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{m.name}</span>
                    <span style={{ color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", marginLeft: 10 }}>{m.detail}</span>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                    background: m.status === "local" ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.12)",
                    color: m.status === "local" ? "rgba(34,197,94,0.8)" : "rgba(99,102,241,0.8)",
                    border: m.status === "local" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(99,102,241,0.2)",
                    letterSpacing: 0.5,
                  }}>{m.status === "local" ? "LOKAL" : "CLOUD"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", marginBottom: 16, textTransform: "uppercase" }}>Features</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { icon: "↺", label: "Undo / Redo" },
                { icon: "⬡", label: "Block Editor" },
                { icon: "↓", label: "ZIP Export" },
                { icon: "W", label: "WordPress" },
                { icon: "◈", label: "KI Rewrite" },
                { icon: "▣", label: "Drag & Drop" },
              ].map(f => (
                <div key={f.label} style={{
                  padding: "12px 14px", borderRadius: 10, textAlign: "center",
                  border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
                  background: theme === "light" ? "#ffffff" : "rgba(15,20,35,0.9)",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 6, color: "rgba(99,102,241,0.7)", fontWeight: 900 }}>{f.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(148,163,184,0.6)" }}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCredits && <CreditsPanel onClose={() => { setShowCredits(false); load() }} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onThemeChange={(t) => setTheme(t as "dark"|"light")} />}
      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  height: 38, borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.3)",
  color: "white", padding: "0 12px",
  outline: "none", fontSize: 13, boxSizing: "border-box",
}

import { useEffect, useState } from "react"
import { apiGetProjects, apiCreateProject, apiDeleteProject, type Project } from "../api/projects"
import { apiSaveProject } from "../api/projects"
import CreditsPanel from "./CreditsPanel"
import SettingsPanel from "./SettingsPanel"
import { apiLogout, type User } from "../api/auth"
import { toast } from "./Toast"


const spinnerStyle = `@keyframes se-spin { to { transform: rotate(360deg) } }`

const BASE = ""

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
  const [demoPlan, setDemoPlan] = useState<"basis"|"starter"|"pro"|"scale">("basis")



  const [theme, setTheme] = useState<"dark"|"light">(
    (localStorage.getItem("se_theme") as "dark"|"light") || "dark"
  )
  const [orgName, setOrgName] = useState<string | null>(null)
  const [showTemplateExtract, setShowTemplateExtract] = useState(false)
  const [templateUrl, setTemplateUrl] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [templateExtracting, setTemplateExtracting] = useState(false)

  const [showLandingGen, setShowLandingGen] = useState(false)
  const [landingName, setLandingName] = useState("")
  const [landingDesc, setLandingDesc] = useState("")
  const [landingAudience, setLandingAudience] = useState("")
  const [landingLang, setLandingLang] = useState<"english" | "german">("english")
  const [landingGenerating, setLandingGenerating] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<"checking"|"running"|"offline">("checking")
  const [ollamaOs, setOllamaOs] = useState<"mac"|"windows"|"linux">("mac")

  const [showOnboarding, setShowOnboarding] = useState(
    !localStorage.getItem("se_onboarding_done")
  )

  useEffect(() => {
    load()
    loadTemplates()
    checkOllama()
    fetch("/api/user/plan", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.ok && d.plan) setDemoPlan(d.plan as any) }).catch(() => {})

  }, [])

  useEffect(() => {
    localStorage.setItem("se_theme", theme)
  }, [theme])

  const planMeta: Record<"basis"|"starter"|"pro"|"scale", { label: string; price: string; border: string; bg: string; accent: string }> = {
    basis: {
      label: "Basis",
      price: "€9/mo",
      border: "rgba(99,102,241,0.35)",
      bg: "rgba(99,102,241,0.12)",
      accent: "rgba(99,102,241,0.95)",
    },
    starter: {
      label: "Starter",
      price: "€29/mo",
      border: "rgba(34,197,94,0.35)",
      bg: "rgba(34,197,94,0.12)",
      accent: "rgba(34,197,94,0.95)",
    },
    pro: {
      label: "Pro",
      price: "€79/mo",
      border: "rgba(168,85,247,0.35)",
      bg: "rgba(168,85,247,0.12)",
      accent: "rgba(168,85,247,0.95)",
    },
    scale: {
      label: "Scale",
      price: "€149/mo",
      border: "rgba(245,158,11,0.35)",
      bg: "rgba(245,158,11,0.12)",
      accent: "rgba(245,158,11,0.95)",
    },
  }

  const activePlanMeta = planMeta[demoPlan]

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
        html: p.html || localStorage.getItem(`se_project_html_${p.id}`) || "",
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

  const extractTemplate = async () => {
    if (!templateUrl.trim()) { toast.warning("URL erforderlich"); return }
    setTemplateExtracting(true)
    try {
      const r = await fetch("/api/templates/extract", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: templateUrl.trim(), name: templateName.trim() || new URL(templateUrl).hostname })
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || "Fehler beim Extrahieren")
      toast.success("Template gespeichert!")
      setShowTemplateExtract(false)
      setTemplateUrl("")
      setTemplateName("")
      loadTemplates()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTemplateExtracting(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const r = await fetch("/api/templates", { credentials: "include" })
      const d = await r.json()
      if (d.ok) setTemplates(d.templates)
    } catch {}
  }

  const applyTemplate = async (templateId: number) => {
    const name = prompt("Projektname für dieses Template:")
    if (!name) return
    try {
      const r = await fetch("/api/templates/apply", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template_id: templateId, name })
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || "Fehler")
      toast.success("Projekt aus Template erstellt!")
      await load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const checkOllama = async () => {
    setOllamaStatus("checking")
    
    // Try direct localhost first (browser → Ollama, no server needed)
    try {
      const r = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(3000),
      })
      if (r.ok) {
        const d = await r.json()
        const models = (d.models || []).map((m: any) => m.name) as string[]
        setOllamaStatus("running")
        if (models.length > 0) {
          toast.success(`Ollama läuft ✓ · ${models.slice(0,3).join(", ")}`)
        } else {
          toast.warning("Ollama läuft aber keine Modelle gefunden. Führe: ollama pull qwen2.5-coder:7b aus")
        }
        return
      }
    } catch {}

    // Fallback: server proxy (for cases where CORS is not configured)
    try {
      const r = await fetch("/api/ai/ollama-health", {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      })
      const d = await r.json()
      if (d?.ok) {
        setOllamaStatus("running")
        if (d.models?.length > 0) toast.success(`Ollama ✓ · ${d.models.slice(0,3).join(", ")}`)
      } else {
        setOllamaStatus("offline")
      }
    } catch {
      setOllamaStatus("offline")
    }
  }

  const logout = async () => {
    await apiLogout()
    onLogout()
  }

  const generateLandingPageTest = async () => {
    if (!landingName.trim()) { toast.warning("Produktname erforderlich"); return }
    setLandingGenerating(true)

    try {
      const name = landingName.trim()
      const rawDesc = landingDesc.trim() || "AI-powered workflow platform"
      const rawAudience = landingAudience.trim() || "modern teams"
      const lang = landingLang || "english"

      const resp = await fetch("/api/ai/demo-landing-copy", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: rawDesc,
          audience: rawAudience,
          language: lang,
        }),
      })

      const data = await resp.json()

      if (data?.usage || data?.cost_eur != null) {
        try {
          window.dispatchEvent(new CustomEvent("bo:ai-usage", {
            detail: {
              usage: data.usage || null,
              cost_eur: Number(data.cost_eur || 0),
              model: String(data.model || "claude-sonnet-4-6"),
            }
          }))
        } catch {}
      }

      if (!data?.ok || !data?.html) {
        throw new Error(data?.error || "Landing Page konnte nicht generiert werden")
      }

      const html = String(data.html || "")

      const id = await apiCreateProject(name, "", html)
      try { localStorage.setItem(`se_project_html_${id}`, html) } catch {}

      const project: Project = {
        id,
        name,
        url: "",
        html,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      setProjects(prev => [
        {
          ...project,
          thumbnail: null,
        } as any,
        ...prev.filter((p: any) => p.id !== id)
      ])

      toast.success("Landing Page erstellt")
      setShowLandingGen(false)
      setLandingName("")
      setLandingDesc("")
      setLandingAudience("")
      setLandingLang("english")
      onOpen(project)
      load()
    } catch (e: any) {
      toast.error(e.message || "Landing Page konnte nicht erstellt werden")
    } finally {
      setLandingGenerating(false)
    }
  }

  const deleteTemplate = async (id: number) => {
    if (!confirm("Template löschen?")) return
    await fetch(`/api/templates/${id}`, { method: "DELETE", credentials: "include" })
    loadTemplates()
  }

  const QUICK_ACTIONS = [
    {
      icon: "+",
      title: "Neues Projekt",
      desc: "Projekt anlegen und URL laden",
      action: () => setShowNew(true),
    },
    {
      icon: "✨",
      title: "Landing Page Generator",
      desc: "Neue AI Landing Page erzeugen",
      action: () => setShowLandingGen(true),
    },
    {
      icon: "SEO",
      title: "SEO Optimizing",
      desc: "Beta · SEO Analyse und Optimierung",
      action: () => toast.warning("SEO Optimizing ist aktuell noch Beta"),
    },
    {
      icon: "🌍",
      title: "Language Optimizing",
      desc: "Beta · Sprache und Lokalisierung optimieren",
      action: () => toast.warning("Language Optimizing ist aktuell noch Beta"),
    },
    {
      icon: "☁",
      title: "Hosting",
      desc: "Beta · Deployment und Hosting Flow",
      action: () => toast.warning("Hosting ist aktuell noch Beta"),
    },
    {
      icon: "⬚",
      title: "Template extrahieren",
      desc: "Website-Struktur als Template speichern",
      action: () => setShowTemplateExtract(true),
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
          <div style={{
            minHeight: 32,
            padding: "5px 10px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${activePlanMeta.border}`,
            background: activePlanMeta.bg,
            color: "white",
            lineHeight: 1.1,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: activePlanMeta.accent,
              boxShadow: `0 0 10px ${activePlanMeta.accent}`,
              flexShrink: 0,
            }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: activePlanMeta.accent }}>
                PLAN · {activePlanMeta.label}
              </span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>
              </span>
            </div>
          </div>

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

          {/* Templates Section */}
          {templates.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.4)", marginBottom: 16, textTransform: "uppercase" }}>Templates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {templates.map(t => (
                  <div key={t.id} style={{
                    borderRadius: 14, cursor: "pointer", overflow: "hidden",
                    border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
                    background: theme === "light" ? "#ffffff" : "rgba(15,20,35,0.9)",
                    transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = "translateY(-3px)"
                    el.style.borderColor = theme === "light" ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.3)"
                    el.style.boxShadow = theme === "light" ? "0 10px 30px rgba(0,0,0,0.1)" : "0 10px 30px rgba(0,0,0,0.3)"
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = "translateY(0)"
                    el.style.borderColor = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"
                    el.style.boxShadow = "none"
                  }}>
                    <div style={{ padding: "16px" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: theme === "light" ? "#0f172a" : "white" }}>{t.name}</div>
                      {t.url && (
                        <div style={{ fontSize: 12, color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.7)", marginBottom: 8 }}>
                          {t.url}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.5)", marginBottom: 12 }}>
                        {new Date(t.created_at).toLocaleDateString('de-DE')}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => applyTemplate(t.id)} style={{
                          flex: 1, height: 32, borderRadius: 8, border: "none",
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          color: "white", fontWeight: 600, cursor: "pointer", fontSize: 12,
                        }}>Apply</button>
                        <button onClick={() => deleteTemplate(t.id)} style={{
                          flex: 1, height: 32, borderRadius: 8,
                          border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
                          background: "transparent", color: theme === "light" ? "#ef4444" : "#f87171",
                          cursor: "pointer", fontSize: 12,
                        }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              {/* Ollama - dynamic status */}
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
                background: theme === "light" ? "#ffffff" : "rgba(15,20,35,0.9)",
                fontSize: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>Ollama (lokal)</span>
                    <span style={{ color: "rgba(148,163,184,0.4)", marginLeft: 10 }}>kostenlos · läuft auf deinem PC</span>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                    background: ollamaStatus === "running" ? "rgba(34,197,94,0.12)" : ollamaStatus === "offline" ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.08)",
                    color: ollamaStatus === "running" ? "rgba(34,197,94,0.8)" : ollamaStatus === "offline" ? "rgba(239,68,68,0.7)" : "rgba(148,163,184,0.5)",
                    border: ollamaStatus === "running" ? "1px solid rgba(34,197,94,0.2)" : ollamaStatus === "offline" ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(148,163,184,0.15)",
                  }}>
                    {ollamaStatus === "checking" ? "PRÜFE..." : ollamaStatus === "running" ? "✓ LÄUFT" : "✕ OFFLINE"}
                  </div>
                </div>
                {ollamaStatus === "offline" && (() => {
                  const os = ollamaOs;
                  const steps: Record<"mac"|"windows"|"linux", {title: string, cmd?: string, link?: string, linkLabel?: string}[]> = {
                    mac: [
                      { title: "Installieren", link: "https://ollama.com/download/mac", linkLabel: "↓ ollama.com/download" },
                      { title: "Terminal öffnen & starten", cmd: "OLLAMA_ORIGINS=\"*\" ollama serve" },
                      { title: "Modell laden", cmd: "ollama pull qwen2.5-coder:7b" },
                    ],
                    windows: [
                      { title: "Installieren", link: "https://ollama.com/download/windows", linkLabel: "↓ ollama.com/download" },
                      { title: "Nach Installation startet Ollama automatisch" },
                      { title: "Modell laden (CMD/PowerShell)", cmd: "ollama pull qwen2.5-coder:7b" },
                    ],
                    linux: [
                      { title: "Installieren (Terminal)", cmd: "curl -fsSL https://ollama.com/install.sh | sh" },
                      { title: "Starten", cmd: "ollama serve" },
                      { title: "Modell laden", cmd: "ollama pull qwen2.5-coder:7b" },
                    ],
                  };
                  return (
                    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                      <div style={{ fontSize: 11, color: "rgba(239,68,68,0.7)", marginBottom: 10 }}>
                        Ollama nicht erreichbar – folge der Checkliste:
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(239,68,68,0.5)", marginBottom: 8, fontFamily: "monospace" }}>
                        Wichtig: Starte Ollama mit CORS-Unterstützung:<br/>
                        <code style={{ background: "rgba(0,0,0,0.2)", padding: "2px 4px", borderRadius: 3 }}>OLLAMA_ORIGINS="*" ollama serve</code>
                      </div>
                      {/* OS Tabs */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                        {(["mac","windows","linux"] as const).map(o => (
                          <button key={o} onClick={() => setOllamaOs(o)} style={{
                            padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                            cursor: "pointer", border: "1px solid",
                            background: os === o ? "rgba(99,102,241,0.2)" : "transparent",
                            color: os === o ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.5)",
                            borderColor: os === o ? "rgba(99,102,241,0.3)" : "rgba(148,163,184,0.15)",
                          }}>{o === "mac" ? "macOS" : o === "windows" ? "Windows" : "Linux"}</button>
                        ))}
                      </div>
                      {/* Steps */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {steps[os].map((step, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <div style={{
                              minWidth: 18, height: 18, borderRadius: "50%", background: "rgba(99,102,241,0.15)",
                              border: "1px solid rgba(99,102,241,0.25)", color: "rgba(99,102,241,0.8)",
                              fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                            }}>{i+1}</div>
                            <div>
                              <div style={{ fontSize: 11, color: "rgba(200,200,210,0.8)", marginBottom: 2 }}>{step.title}</div>
                              {step.cmd && (
                                <code style={{
                                  display: "block", fontSize: 10, padding: "3px 8px", borderRadius: 4,
                                  background: "rgba(0,0,0,0.35)", color: "rgba(180,220,180,0.9)",
                                  fontFamily: "monospace", letterSpacing: 0.3,
                                }}>{step.cmd}</code>
                              )}
                              {step.link && (
                                <a href={step.link} target="_blank" rel="noopener noreferrer" style={{
                                  fontSize: 10, color: "rgba(99,102,241,0.8)", textDecoration: "none",
                                  padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(99,102,241,0.25)",
                                  background: "rgba(99,102,241,0.1)", display: "inline-block",
                                }}>{step.linkLabel}</a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={checkOllama} style={{
                        marginTop: 12, height: 28, padding: "0 12px", borderRadius: 6, width: "100%",
                        border: "1px solid rgba(148,163,184,0.2)", background: "rgba(148,163,184,0.06)",
                        color: "rgba(148,163,184,0.7)", fontSize: 11, cursor: "pointer", fontWeight: 600,
                      }}>↺ Erneut prüfen</button>
                    </div>
                  );
                })()}
                {ollamaStatus === "running" && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(34,197,94,0.6)" }}>
                    Ollama läuft lokal – KI-Anfragen sind kostenlos
                  </div>
                )}
              </div>

              {/* Cloud models */}
              {[
                { name: "Gemini 2.5 Flash", detail: "Google · ab €0.09/1M tokens" },
                { name: "Claude Sonnet 4.6", detail: "Anthropic · ab €3.60/1M tokens" },
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
                    <span style={{ color: "rgba(148,163,184,0.4)", marginLeft: 10 }}>{m.detail}</span>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                    background: "rgba(99,102,241,0.12)", color: "rgba(99,102,241,0.8)",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}>CLOUD</div>
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

      {showOnboarding && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: 620,
              maxWidth: "100%",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              background: theme === "light" ? "#ffffff" : "rgba(8,12,24,0.98)",
              boxShadow: "0 30px 100px rgba(0,0,0,0.45)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "26px 28px 18px",
                borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
                background: theme === "light"
                  ? "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))"
                  : "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.10))",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: theme === "light" ? "#6366f1" : "rgba(129,140,248,0.95)",
                  marginBottom: 10,
                }}
              >
                Welcome
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  lineHeight: 1.1,
                  color: theme === "light" ? "#0f172a" : "white",
                  marginBottom: 10,
                }}
              >
                Edit any website with AI
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: theme === "light" ? "#475569" : "rgba(148,163,184,0.88)",
                  maxWidth: 520,
                }}
              >
                Import a website, refine blocks with AI, and export the result in minutes.
              </div>
            </div>

            <div style={{ padding: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                <div style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(99,102,241,0.18)",
                  background: theme === "light" ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.10)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6, color: theme === "light" ? "#312e81" : "white" }}>
                    1. Import Website
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.82)" }}>
                    Paste a live URL and load the page into the editor.
                  </div>
                </div>

                <div style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(168,85,247,0.18)",
                  background: theme === "light" ? "rgba(168,85,247,0.05)" : "rgba(168,85,247,0.10)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6, color: theme === "light" ? "#581c87" : "white" }}>
                    2. Refine Blocks with AI
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.82)" }}>
                    Hover, select a block, and rewrite content or layout instantly.
                  </div>
                </div>

                <div style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(34,197,94,0.18)",
                  background: theme === "light" ? "rgba(34,197,94,0.05)" : "rgba(34,197,94,0.10)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6, color: theme === "light" ? "#166534" : "white" }}>
                    3. Export or Continue Editing
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.82)" }}>
                    Save projects, generate new pages, and export when you're ready.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button
                  onClick={() => {
                    localStorage.setItem("se_onboarding_done", "1")
                    setShowOnboarding(false)
                  }}
                  style={{
                    height: 40,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.18)",
                    background: "transparent",
                    color: theme === "light" ? "#475569" : "rgba(148,163,184,0.9)",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Skip
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem("se_onboarding_done", "1")
                    setShowOnboarding(false)
                  }}
                  style={{
                    height: 40,
                    padding: "0 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Start Tour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLandingGen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: 560,
              maxWidth: "100%",
              borderRadius: 18,
              padding: 26,
              background: theme === "light" ? "#ffffff" : "#0f1629",
              border: "1px solid rgba(99,102,241,0.25)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}>
              {landingGenerating && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(15,23,42,0.98)", borderRadius: 18,
                  gap: 16, color: "white",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    border: "3px solid rgba(99,102,241,0.3)",
                    borderTop: "3px solid #6366f1",
                    animation: "spin 1s linear infinite",
                  }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Generiere Landing Page...</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Das dauert ca. 4-8 Sekunden</div>
                </div>
              )}

            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: theme === "light" ? "#6366f1" : "rgba(129,140,248,0.9)", marginBottom: 8 }}>
              AI Generator
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, color: theme === "light" ? "#0f172a" : "white" }}>
              Generate Landing Page
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.78)", marginBottom: 20 }}>
              Create a complete landing page instantly and continue refining it inside the editor.
            </div>

            <label style={{ fontSize: 11, fontWeight: 800, display: "block", marginBottom: 6, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.72)" }}>
              PRODUCT NAME
            </label>
            <input
              value={landingName}
              onChange={e => setLandingName(e.target.value)}
              placeholder="e.g. Chout, Arcana, AlphaFlow"
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
            />

            <label style={{ fontSize: 11, fontWeight: 800, display: "block", marginBottom: 6, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.72)" }}>
              DESCRIPTION
            </label>
            <textarea
              value={landingDesc}
              onChange={e => setLandingDesc(e.target.value)}
              placeholder="What does the product do?"
              style={{
                ...inputStyle,
                width: "100%",
                minHeight: 92,
                padding: 12,
                resize: "vertical",
                marginBottom: 12,
              }}
            />

            <label style={{ fontSize: 11, fontWeight: 800, display: "block", marginBottom: 6, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.72)" }}>
              TARGET AUDIENCE
            </label>
            <input
              value={landingAudience}
              onChange={e => setLandingAudience(e.target.value)}
              placeholder="e.g. creators, startups, agencies, ecommerce brands"
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
            />

            <label style={{ fontSize: 11, fontWeight: 800, display: "block", marginBottom: 6, color: theme === "light" ? "#475569" : "rgba(148,163,184,0.72)" }}>
              LANGUAGE
            </label>
            <select
              value={landingLang}
              onChange={e => setLandingLang(e.target.value as "english" | "german")}
              style={{ ...inputStyle, width: "100%", marginBottom: 20 }}
            >
              <option value="english">English</option>
              <option value="german">German</option>
            </select>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowLandingGen(false)}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "transparent",
                  color: theme === "light" ? "#475569" : "rgba(148,163,184,0.9)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>

              <button
                onClick={generateLandingPageTest}
                disabled={landingGenerating}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  cursor: landingGenerating ? "wait" : "pointer",
                  fontWeight: 800,
                  opacity: landingGenerating ? 0.7 : 1,
                }}
              >
                {landingGenerating ? "⏳ Loading..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Extract Modal */}
      {showTemplateExtract && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 480, borderRadius: 16, padding: 28,
            background: "#0f1629", border: "1px solid rgba(99,102,241,0.3)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "white" }}>⬚ Template extrahieren</div>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", marginBottom: 20, lineHeight: 1.5 }}>
              Lädt die Website und speichert die Struktur ohne Inhalte als wiederverwendbares Template.
            </div>
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", fontWeight: 700, display: "block", marginBottom: 4 }}>WEBSITE URL</label>
            <input
              value={templateUrl}
              onChange={e => setTemplateUrl(e.target.value)}
              placeholder="https://example.com"
              style={{ ...inputStyle, width: "100%", marginBottom: 12, boxSizing: "border-box" }}
            />
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", fontWeight: 700, display: "block", marginBottom: 4 }}>TEMPLATE NAME (optional)</label>
            <input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="z.B. E-Commerce Header"
              style={{ ...inputStyle, width: "100%", marginBottom: 20, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={extractTemplate} disabled={templateExtracting} style={{
                flex: 1, height: 40, borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white", fontWeight: 700, cursor: templateExtracting ? "wait" : "pointer", fontSize: 13,
              }}>{templateExtracting ? "Extrahiere..." : "Template speichern"}</button>
              <button onClick={() => setShowTemplateExtract(false)} style={{
                height: 40, padding: "0 16px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "rgba(148,163,184,0.7)", cursor: "pointer", fontSize: 13,
              }}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
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
/* loader fix */

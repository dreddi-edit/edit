import { apiMe, apiLogout, type User } from "./api/auth"
import { apiSaveProject, apiCreateProject, type Project } from "./api/projects"
import AuthScreen from "./components/AuthScreen"
import ResetPasswordScreen from "./components/ResetPasswordScreen"
import ProjectDashboard from "./components/ProjectDashboard"
import { toast, ToastContainer } from "./components/Toast"
import CreditsPanel from "./components/CreditsPanel"
import SettingsPanel from "./components/SettingsPanel"
import { useRef, useState, useEffect } from 'react';
import BlockOverlay from "./components/BlockOverlay";
import { ENDPOINTS } from './config';
import { COMPONENT_LIBRARY, COMPONENT_CATEGORIES } from './components/ComponentLibrary';

export default function App() {
  const AI_MODELS = [
    { value: "auto", label: "Auto" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
    { value: "groq:llama-3.1-8b-instant", label: "Groq Llama 3.1 8B Instant" },
    { value: "groq:llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B Versatile" },
    { value: "ollama:qwen2.5-coder:7b", label: "Ollama Qwen 2.5 Coder 7B" },
  ]

  const WP_ELEMENTS = [
    "Paragraph","Heading","List","Quote","Code","Preformatted","Table","Pullquote","Separator","Spacer",
    "Buttons","Button","Columns","Column","Group","Row","Stack","Cover","Media & Text","Image","Gallery",
    "Audio","Video","File","Embed","Social Icons","Navigation","Search","Latest Posts","Categories",
    "Tag Cloud","Archives","Shortcode","Custom HTML","More","Page Break","Query Loop","Comments"
  ]
  const HTML_ELEMENTS = [
    "div","section","article","header","footer","main","aside","nav","h1","h2","h3","p","span","a",
    "button","ul","ol","li","img","figure","figcaption","video","audio","table","form","input",
    "textarea","select","label","iframe","hr"
  ]
  const LAYOUT_ELEMENTS = [
    "Section","Container","Wrapper","2 Columns","3 Columns","4 Columns","Hero","Feature Grid",
    "CTA Section","Testimonials","Pricing","FAQ","Contact Section","Footer Section"
  ]
  const MEDIA_ELEMENTS = [
    "Image","Gallery","Slider","Video","Audio","Icon","Logo Strip","Map","Background Image"
  ]
  const FORM_ELEMENTS = [
    "Contact Form","Name Field","Email Field","Phone Field","Textarea","Checkbox","Radio",
    "Select","Submit Button","Newsletter Form"
  ]
  const ADVANCED_ELEMENTS = [
    "Accordion","Tabs","Modal","Alert Box","Progress Bar","Countdown","Pricing Table",
    "Timeline","Stats Counter","FAQ Accordion","Testimonial Card","Team Card"
  ]
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [url, setUrl] = useState("")
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [layoutMode] = useState<"flow" | "canvas">("flow")

  const [status, setStatus] = useState<"idle" | "blocked" | "ok">("idle")
  const [currentHtml, setCurrentHtml] = useState<string>("")
  const [loadedUrl, setLoadedUrl] = useState<string>("")
  const [aiScanLoading, setAiScanLoading] = useState(false)
  const [sessionCost, setSessionCost] = useState(0)
  const [sessionTokens, setSessionTokens] = useState({input: 0, output: 0})
  const [aiApproval, setAiApproval] = useState<null | {
    id: string
    model: string
    scope: string
    estInputTokens: number
    estOutputTokens: number
    prompt: string
  }>(null)

  // Auth check beim Start
  useEffect(() => {
    fetch("/api/credits/balance", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.ok) setBalance(d.balance_eur) }).catch(() => {})
    fetch("/api/user/plan", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.ok && d.plan) setDemoPlan(d.plan as any) }).catch(() => {})
    apiMe().then(user => {
      if (user) { setAuthUser(user); setView("dashboard") }
      else { setAuthUser(null); setView("auth") }
    })
  }, [])










  const trackUsage = (payload: any) => {
    if (!payload) return;

    const usage = payload?.usage || payload || null
    const inp = Number(usage?.input_tokens || 0)
    const out = Number(usage?.output_tokens || 0)
    const explicitCost = Number(payload?.cost_eur || 0)

    let fallbackCost = 0
    const model = String(payload?.model || "")

    const pricing: Record<string, { input: number; output: number }> = {
      "claude-sonnet-4-6": { input: 3.6, output: 18 },
      "claude-sonnet-4-5-20250929": { input: 3.6, output: 18 },
      "claude-haiku-4-5-20251001": { input: 0.3, output: 1.5 },
      "gemini-2.5-flash": { input: 0.09, output: 0.36 },
      "gemini-2.5-flash-lite": { input: 0.06, output: 0.24 },
      "gemini-2.5-pro": { input: 1.44, output: 4.32 },
      "groq:llama-3.1-8b-instant": { input: 0.12, output: 0.24 },
      "groq:llama-3.3-70b-versatile": { input: 0.9, output: 1.8 },
      "ollama:qwen2.5-coder:7b": { input: 0, output: 0 },
    }

    const c = pricing[model] || pricing["claude-sonnet-4-6"]
    const raw = ((inp / 1_000_000) * c.input) + ((out / 1_000_000) * c.output)
    if (raw > 0) fallbackCost = Math.max(0.01, raw)

    const finalCost = explicitCost > 0 ? explicitCost : fallbackCost

    if (inp > 0 || out > 0) {
      setSessionTokens(prev => ({ input: prev.input + inp, output: prev.output + out }))
    }
    if (finalCost > 0) {
      setSessionCost(prev => prev + finalCost)
    }
  };


  const [isDraggingBlock, setIsDraggingBlock] = useState(false)
  const [authUser, setAuthUser] = useState<User | null | "loading">("loading")
  const [view, setView] = useState<"auth" | "dashboard" | "editor" | "admin">("auth")
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<string>("")
  
  // Simple undo history
  const [undoHistory, setUndoHistory] = useState<string[]>([])
  
  const undoPush = (html: string) => {
    setUndoHistory(prev => [...prev.slice(-9), html]) // Keep last 10
  }
  
  const undoPop = () => {
    setUndoHistory(prev => {
      if (prev.length <= 1) return prev
      const newList = prev.slice(0, -1)
      return newList
    })
    return undoHistory[undoHistory.length - 2] || null
  }
  
  // AI approval queue
  const [aiApprovalQueue, setAiApprovalQueue] = useState<any[]>([])
  
  const enqueue = (item: any) => {
    setAiApprovalQueue((prev: any[]) => [...prev, item])
  }
  
  const dequeue = () => {
    setAiApprovalQueue((prev: any[]) => prev.slice(1))
    return aiApprovalQueue[0] || null
  }

  const currentAiApproval = aiApprovalQueue.length ? aiApprovalQueue[0] : aiApproval

  async function sendResetPw(userId:number){
  await fetch("/api/admin/send-reset",{
    method:"POST",
    credentials:"include",
    headers:{ "content-type":"application/json"},
    body:JSON.stringify({userId})
  })
  alert("Reset email sent")
}


const [adminUsers, setAdminUsers] = useState<any[]>([])
const [adminUserPlans, setAdminUserPlans] = useState<Record<number, "basis" | "starter" | "pro" | "scale">>({})
const [adminLoading, setAdminLoading] = useState(false)
const [showCreateUser, setShowCreateUser] = useState(false)
const [newUser, setNewUser] = useState({ email: "", password: "", name: "", credits: 0 })
  const [approvalOn, setApprovalOn] = useState(true)
  const [showCredits, setShowCredits] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [demoPlan, setDemoPlan] = useState<"basis" | "starter" | "pro" | "scale">("basis")

  const demoPlanMeta: Record<"basis" | "starter" | "pro" | "scale", {
    label: string
    price: string
    users: string
    projects: string
    team: string
    accent: string
    bg: string
    border: string
  }> = {
    basis: {
      label: "Basis",
      price: "€9/mo",
      users: "1 user",
      projects: "3 projects",
      team: "No team",
      accent: "rgba(99,102,241,0.95)",
      bg: "rgba(99,102,241,0.12)",
      border: "rgba(99,102,241,0.35)",
    },
    starter: {
      label: "Starter",
      price: "€29/mo",
      users: "1 user",
      projects: "10 projects",
      team: "2 team members",
      accent: "rgba(34,197,94,0.95)",
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.35)",
    },
    pro: {
      label: "Pro",
      price: "€79/mo",
      users: "3 users",
      projects: "30 projects",
      team: "10 team members",
      accent: "rgba(168,85,247,0.95)",
      bg: "rgba(168,85,247,0.12)",
      border: "rgba(168,85,247,0.35)",
    },
    scale: {
      label: "Scale",
      price: "€149/mo",
      users: "10 users",
      projects: "100 projects",
      team: "50 team members",
      accent: "rgba(245,158,11,0.95)",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.35)",
    },
  }

  const activePlanMeta = demoPlanMeta[demoPlan]
  const [exportMode, setExportMode] = useState<"wp-placeholder" | "html-clean" | "html-raw">("wp-placeholder")
  const [selectedElementGroup, setSelectedElementGroup] = useState({
    wordpress: "",
    html: "",
    layout: "",
    media: "",
    form: "",
    advanced: "",
  })
  const [leftAiPrompt, setLeftAiPrompt] = useState("")
  const [leftAiModel, setLeftAiModel] = useState("auto")
  const [leftAiRunning, setLeftAiRunning] = useState(false)
  // Auto-save Projekt
  
const loadAdminUsers = async () => {
  setAdminLoading(true)
  try {
    const r = await fetch("/api/admin/users", { credentials: "include" })
    const d = await r.json()
    if (d.ok) {
      setAdminUsers(d.users || [])
      const plans: Record<number, any> = {}
      for (const u of d.users || []) { plans[u.id] = u.plan || "basis" }
      setAdminUserPlans(plans)
    } else alert(d.error || "Admin load failed")
  } catch { alert("Admin load failed") } finally { setAdminLoading(false) }
}
const deleteUser = async (userId: number, userEmail: string) => {
  if (!confirm(`Are you sure you want to delete user "${userEmail}"? This will also delete all their projects.`)) {
    return
  }
  
  try {
    const r = await fetch(`/api/admin/users/${userId}`, { 
      method: "DELETE", 
      credentials: "include" 
    })
    const d = await r.json()
    if (d.ok) {
      alert("User deleted successfully")
      loadAdminUsers()
    } else {
      alert(d.error || "Delete failed")
    }
  } catch {
    alert("Delete failed")
  }
}

const addCredits = async (userId: number, userEmail: string) => {
  const credits = prompt(`How many dollars in credits to add to "${userEmail}"?\n\nExample: 25 = $25.00 credits`)
  if (!credits || isNaN(Number(credits)) || Number(credits) <= 0) {
    if (credits !== null) alert("Please enter a valid positive number")
    return
  }
  
  try {
    const r = await fetch(`/api/admin/users/${userId}/add-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: Number(Number(credits) * 100) }), // Convert dollars to cents
      credentials: "include"
    })
    const d = await r.json()
    if (d.ok) {
      alert(`✅ Successfully added $${Number(credits).toFixed(2)} credits to ${userEmail}`)
      loadAdminUsers()
    } else {
      alert(`❌ Failed to add credits: ${d.error || "Unknown error"}`)
    }
  } catch {
    alert("❌ Failed to add credits - network error")
  }
}

const resetPassword = async (userId: number, userEmail: string) => {
  if (!confirm(`Send password reset link to "${userEmail}"?`)) {
    return
  }
  
  try {
    const r = await fetch("/api/admin/send-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
      credentials: "include"
    })
    const d = await r.json()
    if (d.ok) {
      alert(`Password reset link sent to ${userEmail}`)
    } else {
      alert(`Failed to send reset: ${d.error || "Unknown error"}`)
    }
  } catch {
    alert("Failed to send reset - network error")
  }
}
const assignPlan = async (userId: number, userEmail: string) => {
  const current = adminUserPlans[userId] || "basis"
  const next = prompt(`Assign plan to "${userEmail}"\n\nOptions: basis, starter, pro, scale`, current)
  if (!next) return
  const normalized = String(next).trim().toLowerCase()
  if (!["basis", "starter", "pro", "scale"].includes(normalized)) { alert("Invalid plan"); return }
  const plan = normalized as "basis" | "starter" | "pro" | "scale"
  setAdminUserPlans(prev => ({ ...prev, [userId]: plan }))
  fetch(`/api/admin/users/${userId}/set-plan`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan })
  }).then(r => r.json()).then(d => {
    if (d.ok) { if (authUser && (authUser as any).id === userId) setDemoPlan(plan); alert(`✅ Plan "${plan}" saved`) }
    else { alert("Failed: " + d.error) }
  }).catch(() => alert("Network error"))
}

const createUser = async () => {
  if (!newUser.email || !newUser.password) {
    alert("Email and password required")
    return
  }
  
  try {
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...newUser, credits: Number(newUser.credits * 100)}), // Convert dollars to cents
      credentials: "include"
    })
    const d = await r.json()
    if (d.ok) {
      alert("User created successfully")
      setShowCreateUser(false)
      setNewUser({ email: "", password: "", name: "", credits: 0 })
      loadAdminUsers()
    } else {
      alert(d.error || "Create user failed")
    }
  } catch {
    alert("Create user failed")
  }
}

const autoSave = async (html: string) => {
    if (!currentProject) return
    try { await apiSaveProject(currentProject.id, { html }) } catch {}
  }

  const renderToIframe = (html: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = html || "<!doctype html><html><head></head><body></body></html>";
  };

  useEffect(() => { if (view === "editor" && currentHtml) renderToIframe(currentHtml); }, [currentHtml, view]);

  const load = async (forceReload = false) => {
    const u = url.trim();
    if (!u) return;
    if (!forceReload && loadedUrl === u && currentHtml) return;
    try {
      setStatus("blocked");
      const r = await fetch(`${ENDPOINTS.proxy}?url=${encodeURIComponent(u)}`, { credentials: "include" });
      const html = await r.text();
      setLoadedUrl(u); setCurrentHtml(html); renderToIframe(html); setStatus("ok");
    } catch { setStatus("idle"); }
  };

  const handleOpenProject = async (p: Project) => {
    setCurrentProject(p)
    if (view !== "admin") setView("editor")

    const inlineHtml = String((p as any)?.html || "").trim()

    if (inlineHtml) {
      setUrl("")
      setLoadedUrl("")
      setCurrentHtml(inlineHtml)
      renderToIframe(inlineHtml)
      setStatus("ok")
      return
    }

    if (p.html && p.html.length > 0) {
      setUrl("")
      setLoadedUrl("")
      setCurrentHtml(p.html)
      renderToIframe(p.html)
      setStatus("ok")
      return
    }

    if (p.url) setUrl(p.url)
    if (!p.url && p.html) {
      setCurrentHtml(p.html)
      renderToIframe(p.html)
      setStatus("ok")
      return
    }
    if (p.html) {
      setCurrentHtml(p.html)
      renderToIframe(p.html)
      setLoadedUrl(p.url || "")
      setStatus("ok")
    } else if (p.url) {
      setTimeout(() => load(true), 100)
    }
  }

  const handleNewProject = async () => {
    if (!currentHtml) { toast.warning("Bitte zuerst eine Website laden"); return }
    const name = url ? new URL(url).hostname : "Neues Projekt"
    try {
      const id = await apiCreateProject(name, url, currentHtml)
      const p: Project = { id, name, url, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
      setCurrentProject(p)
      toast.success("Projekt gespeichert!")
    } catch (e: any) { toast.error(e.message) }
  }

  const handleModeSwitch = () => {
    if (mode === "view") { setMode("edit"); if (currentHtml) setStatus("ok"); }
    else {
      if (confirm("Änderungen speichern und zum View-Modus wechseln?")) {
        setMode("view"); if (currentHtml) setStatus("ok");
      }
    }
  };

  const handleExport = async () => {
    if (!currentHtml) { toast.warning("Bitte lade zuerst eine Website"); return; }
    try {
      const r = await fetch("/api/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: currentHtml, url: loadedUrl, mode: exportMode })
      });
      if (!r.ok) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await r.blob());
      a.download = exportMode === "wp-placeholder" ? "site_wp_placeholders.zip" : (exportMode === "html-clean" ? "site_html_clean.zip" : "site_html_raw.zip");
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error("Export fehlgeschlagen"); }
  };

const handleAiRescan = (mode: "block" | "page") => {
    setAiScanLoading(true);
    window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode } }));
    setTimeout(() => setAiScanLoading(false), 4000);
  };

  useEffect(() => {
    const handler = (e: any) => trackUsage(e?.detail || null)
    window.addEventListener("bo:ai-usage", handler as any)
    return () => window.removeEventListener("bo:ai-usage", handler as any)
  }, [])

  useEffect(() => {
    const onDone = () => setLeftAiRunning(false)
    window.addEventListener("bo:left-ai-done", onDone as any)
    return () => window.removeEventListener("bo:left-ai-done", onDone as any)
  }, [])

  useEffect(() => {
    const onReq = (e: any) => {
      const d = e?.detail || {}
      enqueue({
        id: String(d.id || ""),
        model: String(d.model || "unknown"),
        scope: String(d.scope || "unknown"),
        estInputTokens: Number(d.estInputTokens || 0),
        estOutputTokens: Number(d.estOutputTokens || 0),
        prompt: String(d.prompt || "")
      })
    }
    window.addEventListener("bo:ai-approval-request", onReq as any)
    return () => window.removeEventListener("bo:ai-approval-request", onReq as any)
  }, [])


  const isEdit = mode === "edit";
  const isLoading = status === "blocked";

  
  useEffect(() => {
    const onSignal = (e: any) => {
      try {
        const d = e?.detail || {};
        if (typeof d.dragging === "boolean") setIsDraggingBlock(d.dragging);
      } catch {}
    };
    const onDragEnd = () => setIsDraggingBlock(false);

    window.addEventListener("bo:dragging", onSignal as any);
    window.addEventListener("dragend", onDragEnd as any);
    window.addEventListener("drop", onDragEnd as any);
    return () => {
      window.removeEventListener("bo:dragging", onSignal as any);
      window.removeEventListener("dragend", onDragEnd as any);
      window.removeEventListener("drop", onDragEnd as any);
    };
  }, []);

useEffect(() => {
    if (isLoading) { const t = setTimeout(() => setStatus("idle"), 30000); return () => clearTimeout(t); }
  }, [isLoading]);

  // Auth loading
  const resetToken = new URLSearchParams(window.location.search).get("token")
  if (resetToken) return <ResetPasswordScreen token={resetToken} onDone={() => window.location.replace("/")} />

  if (authUser === "loading") return (
    <div style={{ height: "100vh", background: "#080c18", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 16 }}>⟳ Laden...</div>
    </div>
  )

  // Auth screen
  if (view === "auth") return (
    <>
      <AuthScreen onAuth={user => { setAuthUser(user); setView("dashboard") }} />

<ToastContainer />
    </>
  )

  // Dashboard
  if (view === "dashboard") return (
    <>
      <ProjectDashboard
        user={authUser as User}
        onOpen={handleOpenProject}
        onLogout={() => { setAuthUser(null); setView("auth") }}
      />

      {view === "dashboard" && authUser?.email === "edgar@mailbaumann.de" && (
        <button
          onClick={() => setView("admin")}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 999,
            padding: "12px 16px",
            borderRadius: 999,
            border: "1px solid #334155",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)"
          }}
        >
          Go to Admin
        </button>
      )}

      <ToastContainer />
    </>
  )

  if (view === "admin") {
    const planColors: Record<string, string> = { basis: "#6366f1", starter: "#22c55e", pro: "#a855f7", scale: "#f59e0b" }
    return (
      <div style={{ minHeight: "100vh", background: "#060b14", color: "white", fontFamily: "system-ui, sans-serif", padding: "32px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Admin Console</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{adminUsers.length} users · internal only</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCreateUser(true)} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f172a", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ New User</button>
              <button onClick={loadAdminUsers} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f172a", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>{adminLoading ? "Loading…" : "↻ Refresh"}</button>
              <button onClick={() => setView("dashboard")} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f172a", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>← Back</button>
            </div>
          </div>
          <div style={{ background: "#0d1525", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 100px 100px 160px", padding: "10px 20px", background: "#0f172a", borderBottom: "1px solid #1e293b", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>
              <div>ID</div><div>User</div><div>Plan</div><div>Credits</div><div>Joined</div><div style={{ textAlign: "right" }}>Actions</div>
            </div>
            {adminUsers.map((u: any) => {
              const plan = adminUserPlans[u.id] || "basis"
              const color = planColors[plan] || "#6366f1"
              return (
                <div key={u.id} style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 100px 100px 160px", padding: "14px 20px", borderBottom: "1px solid #0f172a", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>#{u.id}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.email}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{u.name || "—"}</div>
                  </div>
                  <div>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${color}18`, border: `1px solid ${color}40`, color }}>
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>€{Number(u.credits || 0).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{(u.created_at || "").slice(0, 10)}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => addCredits(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #10b98130", background: "#10b98115", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Credits</button>
                    <button onClick={() => assignPlan(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #6366f130", background: "#6366f115", color: "#818cf8", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Plan</button>
                    <button onClick={() => resetPassword(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #f59e0b30", background: "#f59e0b15", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>PW</button>
                    <button onClick={() => deleteUser(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ef444430", background: "#ef444415", color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Del</button>
                  </div>
                </div>
              )
            })}
            {!adminLoading && adminUsers.length === 0 && (
              <div style={{ padding: 32, color: "#334155", textAlign: "center", fontSize: 13 }}>No users yet. Click Refresh.</div>
            )}
          </div>
        </div>
        {showCreateUser && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#0d1525", padding: 28, borderRadius: 14, border: "1px solid #1e293b", width: 400 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Create User</div>
              {["email","password","name"].map(f => (<input key={f} placeholder={f} type={f==="password"?"password":"text"} value={(newUser as any)[f]} onChange={e => setNewUser((p:any) => ({...p,[f]:e.target.value}))} style={{ display:"block", width:"100%", marginBottom:10, padding:"9px 12px", borderRadius:8, border:"1px solid #1e293b", background:"#060b14", color:"white", fontSize:13, boxSizing:"border-box" }} />))}
              <input placeholder="credits (€)" type="number" value={newUser.credits} onChange={e => setNewUser((p:any) => ({...p,credits:Number(e.target.value)}))} style={{ display:"block", width:"100%", marginBottom:16, padding:"9px 12px", borderRadius:8, border:"1px solid #1e293b", background:"#060b14", color:"white", fontSize:13, boxSizing:"border-box" }} />
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={() => setShowCreateUser(false)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:13 }}>Cancel</button>
                <button onClick={createUser} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: "100vh", background: "#0b1220", fontFamily: "system-ui, sans-serif" }}>

        {/* Drag Grid Overlay */}
        {isEdit && isDraggingBlock && (
          <div
            data-bo-grid-overlay="1"
            style={{
              position: "fixed",
              left: 0,
              top: 58,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              pointerEvents: "none",
              backgroundImage:
                "linear-gradient(to right, rgba(99,102,241,0.20) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.20) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              boxShadow: "inset 0 0 0 2px rgba(99,102,241,0.25)",
            }}
          >
            <div style={{
              position: "absolute",
              left: 14,
              top: 10,
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.85)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "white",
              fontSize: 12,
              fontWeight: 800,
            }}>
              Drop-Grid aktiv
            </div>
          </div>
        )}

      {/* ── Toolbar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 58,
        display: "flex", alignItems: "center", gap: 8, padding: "0 16px",
        background: isEdit
          ? "linear-gradient(135deg, rgba(127,29,29,0.97) 0%, rgba(153,27,27,0.97) 100%)"
          : "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(23,33,60,0.98) 100%)",
        borderBottom: isEdit ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(99,102,241,0.2)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
        zIndex: 80,
        transition: "background 0.3s ease",
      }}>

        {/* Back to Dashboard */}
        <button onClick={() => setView("dashboard")} style={{
          height: 36, padding: "0 12px", borderRadius: 10, flexShrink: 0,
          border: "1px solid rgba(99,102,241,0.3)",
          background: "rgba(99,102,241,0.1)",
          color: "white", cursor: "pointer", fontSize: 18, fontWeight: 900,
        }}>⬡</button>

        {/* Logo */}
        <div style={{
          fontSize: 18, fontWeight: 900, color: "white", marginRight: 4,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          flexShrink: 0,
        }}>⬡ Editor</div>

          {/* Active Plan Badge */}
          <div
            style={{
              minHeight: 36,
              padding: "6px 12px",
              borderRadius: 10,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: `1px solid ${activePlanMeta.border}`,
              background: activePlanMeta.bg,
              color: "white",
              lineHeight: 1.15,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: activePlanMeta.accent,
                boxShadow: `0 0 10px ${activePlanMeta.accent}`,
                flexShrink: 0,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: activePlanMeta.accent }}>
                PLAN · {activePlanMeta.label}
              </span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>
                {activePlanMeta.projects}
              </span>
            </div>
          </div>


          {/* Cost Tracker */}
          {(sessionCost > 0 || sessionTokens.input > 0 || sessionTokens.output > 0) && (
            <div
              title={`Input: ${sessionTokens.input.toLocaleString()} / Output: ${sessionTokens.output.toLocaleString()} tokens\nKlicken zum Zurücksetzen`}
              onClick={() => { if(confirm("Session-Kosten zurücksetzen?")) { setSessionCost(0); setSessionTokens({input:0,output:0}); } }}
              style={{
                minHeight: 36, padding: "6px 12px", borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 8,
                border: "1px solid rgba(234,179,8,0.35)",
                background: "rgba(234,179,8,0.1)",
                fontSize: 12, fontWeight: 800, color: "rgba(234,179,8,0.95)",
                cursor: "pointer",
                lineHeight: 1.15,
              }}>
              <span>💰 ${sessionCost.toFixed(4)}</span>
              <span style={{ opacity: 0.8 }}>•</span>
              <span>{sessionTokens.input.toLocaleString()} in / {sessionTokens.output.toLocaleString()} out</span>
            </div>
          )}

        {/* URL Input */}
        <div style={{ flex: "0 1 360px", minWidth: 200, position: "relative" }}>
          <div style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 13, color: "rgba(148,163,184,0.5)",
          }}>🌐</div>
          <input
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(true)}
            placeholder="https://..."
            style={{
              width: "100%", height: 36, borderRadius: 10,
              border: isEdit ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(99,102,241,0.3)",
              background: "rgba(0,0,0,0.3)", color: "white",
              padding: "0 12px 0 30px", outline: "none", fontSize: 13,
              transition: "border 0.2s",
            }}
          />
        </div>

        {/* Load Button */}
        <button onClick={() => load(true)}
          onMouseDown={e => (e.currentTarget.style.transform="scale(0.93)")}
          onMouseUp={e => (e.currentTarget.style.transform="scale(1)")}
          onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
          style={{
            height: 36, padding: "0 16px", borderRadius: 10, flexShrink: 0,
            border: "1px solid rgba(99,102,241,0.4)",
            background: "rgba(0,0,0,0.35)",
            color: "white", cursor: "pointer", fontWeight: 700, fontSize: 13,
            transition: "transform 0.1s, background 0.2s",
          }}>{isLoading ? <span style={{display:"inline-block",animation:"spin 0.7s linear infinite"}}>⟳</span> : "↺"} Load</button>

        {/* Status Badge */}
        <div style={{
          height: 36, padding: "0 12px", borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          border: status === "ok" ? "1px solid rgba(34,197,94,0.4)" : status === "blocked" ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(148,163,184,0.2)",
          background: status === "ok" ? "rgba(34,197,94,0.12)" : status === "blocked" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.08)",
          fontSize: 12, fontWeight: 700, color: "white",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: status === "ok" ? "#22c55e" : status === "blocked" ? "#f59e0b" : "#64748b",
            boxShadow: status === "ok" ? "0 0 6px #22c55e" : status === "blocked" ? "0 0 6px #f59e0b" : "none",
            animation: status === "blocked" ? "pulse 1s infinite" : "none",
          }} />
          {status === "idle" ? "Bereit" : status === "blocked" ? "Lädt…" : "OK"}
        </div>

        <button
          onClick={() => { const prev = undoPop(); if (prev) setCurrentHtml(prev) }}
          onMouseDown={e => (e.currentTarget.style.transform="scale(0.93)")}
          onMouseUp={e => (e.currentTarget.style.transform="scale(1)")}
          onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
          title="Letzte Änderung rückgängig"
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 10,
            flexShrink: 0,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.32)",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            transition: "transform 0.1s"
          }}
        >
          Undo
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "rgba(148,163,184,0.15)", flexShrink: 0 }} />

        {/* Edit/View Toggle */}
        <button onClick={handleModeSwitch} style={{
          height: 36, padding: "0 16px", borderRadius: 10, flexShrink: 0,
          border: isEdit ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(34,197,94,0.4)",
          background: isEdit
            ? "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.25))"
            : "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2))",
          color: "white", cursor: "pointer", fontWeight: 700, fontSize: 13,
        }}>{isEdit ? "💾 Speichern" : "✏️ Bearbeiten"}</button>

          {/* AI Buttons – nur im Edit Mode */}
          {isEdit && (
            <button
              onClick={() => handleAiRescan("block")}
              disabled={aiScanLoading}
              onMouseDown={e => { if(!aiScanLoading) e.currentTarget.style.transform="scale(0.93)"; }}
              onMouseUp={e => (e.currentTarget.style.transform="scale(1)")}
              onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
              title="Ausgewählten Block mit KI verfeinern"
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.32)",
                color: "white",
                cursor: aiScanLoading ? "wait" : "pointer",
                fontWeight: 700,
                fontSize: 12,
                opacity: aiScanLoading ? 0.65 : 1,
                transition: "transform 0.1s"
              }}
            >
              {aiScanLoading ? <span style={{display:"inline-block",animation:"spin 0.7s linear infinite"}}>⟳</span> : "Refine Block"}
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <select
              value={exportMode}
              onChange={e => setExportMode(e.target.value as any)}
              title="Download-Format"
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.32)",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                outline: "none"
              }}
            >
              <option value="wp-placeholder">WP Placeholder</option>
              <option value="html-clean">HTML Clean</option>
              <option value="html-raw">HTML Raw</option>
            </select>

            <button
              onClick={handleExport}
              title="Download"
              onMouseDown={e => (e.currentTarget.style.transform="scale(0.93)")}
              onMouseUp={e => (e.currentTarget.style.transform="scale(1)")}
              onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.32)",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                transition: "transform 0.1s"
              }}
            >
              Download
            </button>
          </div>

      </div>

      <style>{`
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes loadingbar { 0%{transform:translateX(-120%)} 100%{transform:translateX(420%)} }
      `}</style>

      {/* Progress Bar */}
      <div style={{ position:"fixed", left:0, right:0, top:58, height:2, background:"rgba(148,163,184,0.1)", zIndex:90, overflow:"hidden", opacity:isLoading?1:0, transition:"opacity 120ms" }}>
        <div style={{ height:"100%", width:"40%", background:"linear-gradient(90deg, #6366f1, #8b5cf6)", transform:"translateX(-120%)", animation:isLoading?"loadingbar 800ms ease-in-out infinite":"none" }} />
      </div>

      {currentAiApproval && (
        <div style={{
          position:"fixed",
          right:16,
          bottom:16,
          width:360,
          maxWidth:"calc(100vw - 32px)",
          background:"rgba(8,12,24,0.98)",
          border:"1px solid rgba(245,158,11,0.35)",
          boxShadow:"0 16px 60px rgba(0,0,0,0.45)",
          borderRadius:16,
          padding:14,
          zIndex:140,
          display:"flex",
          flexDirection:"column",
          gap:10
        }}>
          <div style={{ fontSize:12, fontWeight:900, letterSpacing:0.3, color:"rgba(255,255,255,0.95)" }}>
            Cloud Request Approval
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"92px 1fr", gap:6, fontSize:12, color:"rgba(255,255,255,0.82)" }}>
            <div style={{ opacity:0.7 }}>Model</div><div style={{ fontWeight:700 }}>{currentAiApproval.model}</div>
            <div style={{ opacity:0.7 }}>Scope</div><div style={{ fontWeight:700 }}>{currentAiApproval.scope}</div>
            <div style={{ opacity:0.7 }}>Input est.</div><div style={{ fontWeight:700 }}>~{currentAiApproval.estInputTokens.toLocaleString()} tokens</div>
            <div style={{ opacity:0.7 }}>Output est.</div><div style={{ fontWeight:700 }}>~{currentAiApproval.estOutputTokens.toLocaleString()} tokens</div>
          </div>

          <div style={{
            fontSize:12,
            lineHeight:1.45,
            color:"rgba(255,255,255,0.72)",
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:10,
            padding:"10px 12px",
            maxHeight:88,
            overflow:"auto"
          }}>
            {currentAiApproval.prompt}
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("bo:ai-approval-response", { detail: { id: currentAiApproval.id, approved: false } }))
                dequeue(currentAiApproval?.id ?? "")
              }}
              style={{
                height:36,
                padding:"0 12px",
                borderRadius:10,
                border:"1px solid rgba(148,163,184,0.22)",
                background:"rgba(255,255,255,0.04)",
                color:"white",
                cursor:"pointer",
                fontWeight:700,
                fontSize:12
              }}
            >
              Cancel
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("bo:ai-approval-response", { detail: { id: currentAiApproval.id, approved: true } }))
                dequeue(currentAiApproval?.id ?? "")
              }}
              style={{
                height:36,
                padding:"0 12px",
                borderRadius:10,
                border:"1px solid rgba(245,158,11,0.35)",
                background:"rgba(245,158,11,0.16)",
                color:"white",
                cursor:"pointer",
                fontWeight:800,
                fontSize:12
              }}
            >
              Allow Cloud Request
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{ position:"fixed", top:58, left:0, right:0, bottom:0, background:"rgba(11,18,32,0.97)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ width:64, height:64, border:"3px solid rgba(99,102,241,0.2)", borderTop:"3px solid #6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", marginBottom:20 }} />
          <div style={{ color:"white", fontSize:17, fontWeight:700, marginBottom:8 }}>Website wird geladen…</div>
          <div style={{ color:"rgba(148,163,184,0.7)", fontSize:13, textAlign:"center", maxWidth:280 }}>Seite wird über den Proxy geladen.</div>
        </div>
      )}
        {isEdit && (
          <div style={{
            position: "fixed",
            left: 10,
            top: 70,
            width: 148,
            zIndex: 96,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <select value={selectedElementGroup.wordpress} onChange={e => setSelectedElementGroup(prev => ({ ...prev, wordpress: e.target.value }))} title="WordPress Elemente" style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(5,10,25,0.96)", color: "white", fontWeight: 700, fontSize: 12, outline: "none" }}>
              <option value="">WordPress</option>
              {WP_ELEMENTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={selectedElementGroup.html} onChange={e => setSelectedElementGroup(prev => ({ ...prev, html: e.target.value }))} title="HTML Elemente" style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(5,10,25,0.96)", color: "white", fontWeight: 700, fontSize: 12, outline: "none" }}>
              <option value="">HTML</option>
              {HTML_ELEMENTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={selectedElementGroup.layout} onChange={e => setSelectedElementGroup(prev => ({ ...prev, layout: e.target.value }))} title="Layout Elemente" style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(5,10,25,0.96)", color: "white", fontWeight: 700, fontSize: 12, outline: "none" }}>
              <option value="">Layout</option>
              {LAYOUT_ELEMENTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={selectedElementGroup.media} onChange={e => setSelectedElementGroup(prev => ({ ...prev, media: e.target.value }))} title="Media Elemente" style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(5,10,25,0.96)", color: "white", fontWeight: 700, fontSize: 12, outline: "none" }}>
              <option value="">Media</option>
              {MEDIA_ELEMENTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={selectedElementGroup.form} onChange={e => setSelectedElementGroup(prev => ({ ...prev, form: e.target.value }))} title="Form Elemente" style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(5,10,25,0.96)", color: "white", fontWeight: 700, fontSize: 12, outline: "none" }}>
              <option value="">Form</option>
              {FORM_ELEMENTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={selectedElementGroup.advanced} onChange={e => setSelectedElementGroup(prev => ({ ...prev, advanced: e.target.value }))} title="Advanced Elemente" style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(5,10,25,0.96)", color: "white", fontWeight: 700, fontSize: 12, outline: "none" }}>
              <option value="">Advanced</option>
              {ADVANCED_ELEMENTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            {/* Component Library */}
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(148,163,184,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.3,
                color: "rgba(255,255,255,0.92)"
              }}>
                📦 Components
              </div>
              
              <select
                value={selectedComponent || ""}
                onChange={e => setSelectedComponent(e.target.value)}
                title="Professional Components"
                style={{
                  height: 34,
                  padding: "0 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(5,10,25,0.96)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 12,
                  outline: "none"
                }}
              >
                <option value="">Choose Component</option>
                {Object.entries(COMPONENT_LIBRARY).map(([key, comp]) => (
                  <option key={key} value={key}>
                    {COMPONENT_CATEGORIES[comp.category]?.icon} {comp.name}
                  </option>
                ))}
              </select>
              
              {selectedComponent && (
                <button
                  onClick={() => {
                    const component = COMPONENT_LIBRARY[selectedComponent as keyof typeof COMPONENT_LIBRARY];
                    if (component && iframeRef.current?.contentDocument) {
                      const doc = iframeRef.current.contentDocument;
                      const tempDiv = doc.createElement('div');
                      tempDiv.innerHTML = component.template;
                      const element = tempDiv.firstElementChild;
                      if (element) {
                        doc.body.appendChild(element);
                        setCurrentHtml(doc.documentElement.outerHTML);
                        toast.success(`${component.name} added successfully!`);
                      }
                    }
                  }}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    border: "1px solid rgba(34,197,94,0.38)",
                    background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(16,185,129,0.18))",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  ➕ Add Component
                </button>
              )}
            </div>

            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(148,163,184,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.3,
                color: "rgba(255,255,255,0.92)"
              }}>
                KI Assistent
              </div>

            <select
              value={leftAiModel}
              onChange={e => setLeftAiModel(e.target.value)}
              title="KI Modell"
              style={{
                height: 34,
                padding: "0 8px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(5,10,25,0.96)",
                color: "white",
                fontWeight: 700,
                fontSize: 12,
                outline: "none"
              }}
            >
              {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            <textarea
              value={leftAiPrompt}
              onChange={e => setLeftAiPrompt(e.target.value)}
              placeholder={`KI Prompt an ${AI_MODELS.find(m => m.value === leftAiModel)?.label || leftAiModel}...`}
              style={{
                minHeight: 90,
                resize: "vertical",
                padding: "10px 8px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(5,10,25,0.96)",
                color: "white",
                fontSize: 12,
                outline: "none"
              }}
            />
            
            {/* AI Content Generation Templates */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Quick Templates:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  onClick={() => setLeftAiPrompt("Generate a compelling headline for this section")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 10,
                    cursor: "pointer"
                  }}
                >
                  📝 Headline
                </button>
                <button
                  onClick={() => setLeftAiPrompt("Write professional marketing copy for this product/service")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 10,
                    cursor: "pointer"
                  }}
                >
                  🚀 Marketing Copy
                </button>
                <button
                  onClick={() => setLeftAiPrompt("Create a clear call-to-action button text")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 10,
                    cursor: "pointer"
                  }}
                >
                  🎯 Call-to-Action
                </button>
              </div>
            </div>

            <button
              data-left-ai-run="1"
              onClick={() => {
                if (!leftAiPrompt.trim()) {
                  toast.warning("Bitte zuerst einen KI Prompt eingeben")
                  return
                }
                setLeftAiRunning(true)
                window.dispatchEvent(new CustomEvent("bo:left-ai-run", {
                  detail: {
                    model: leftAiModel === "auto" ? "claude-sonnet-4-6" : leftAiModel,
                    prompt: leftAiPrompt
                  }
                }))
              }}
              onMouseDown={e => { if(!leftAiRunning) e.currentTarget.style.transform = "scale(0.96)" }}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              style={{
                height: 36,
                borderRadius: 8,
                border: "1px solid rgba(59,130,246,0.38)",
                background: "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(99,102,241,0.18))",
                color: "white",
                fontWeight: 800,
                fontSize: 12,
                cursor: leftAiRunning ? "wait" : "pointer",
                opacity: leftAiRunning ? 0.7 : 1,
                transition: "transform 0.1s"
              }}
            >
              {leftAiRunning ? <span style={{display:"inline-block", animation:"spin 0.7s linear infinite"}}>⟳</span> : "✨"} Run
            </button>
            </div>
          </div>
        )}
{/* Main Content */}
      <div style={{ position:"fixed", left: isEdit ? 240 : 0, top:58, right:0, bottom:0, overflow:"hidden" }}>
        <iframe ref={iframeRef} title="preview" style={{
          position:"absolute", left:0, top:0, width:"100%", height:"100%",
          border:"none", background:"white", display:"block"
        }} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation" />
        <BlockOverlay iframeRef={iframeRef} enabled={isEdit} canvasMode={layoutMode === "canvas"} onStatus={setStatus} onHtmlChange={(html) => { undoPush(currentHtml); setCurrentHtml(html); autoSave(html); }} />
      </div>
    <ToastContainer />
    </div>
  );
}

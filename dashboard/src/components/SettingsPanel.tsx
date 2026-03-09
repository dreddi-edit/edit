import { useEffect, useState } from "react"
import { toast } from "./Toast"
import { getRequireApproval, setRequireApproval, getApprovalThreshold, setApprovalThreshold } from "../approval-settings"
import { useTranslation } from "../i18n/useTranslation"
import { 
  getCrUXMetrics, analyzePageSpeed, searchUrl, generateContent, analyzeEntities, translateText, recognizeSpeech,
  analyzeImage, analyzeVideo, searchVideos, getDeviceSpecs, processDocument, createSiteVersion, uploadFile, queryBigQuery,
  type CrUXData, type PageSpeedData, type SearchData, type GeminiData, type NLPData, type TranslationData, type SpeechData,
  type VisionData, type VideoData, type YouTubeData, type DeviceData, type DocumentData, type HostingData, type StorageData, type BigQueryData
} from "../utils/googleApis"

const BASE = ""

type ApiKey = { id: number; provider: string; label: string; detected_models: { value: string; label: string }[]; active: number }
type Org = { id: number; name: string; owner_id: number }
type OrgMember = { id: number; invite_email: string; role: string; status: string; name?: string; email?: string }
type Settings = { theme: string; disabled_models: string[] }
type SeoData = { performance: number; accessibility: number; seo: number; fcp: string }

const ALL_MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
  { value: "groq:llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B", provider: "groq" },
  { value: "ollama:qwen2.5-coder:7b", label: "Ollama (lokal)", provider: "ollama" },
]

export default function SettingsPanel({ onClose, onThemeChange }: { onClose: () => void; onThemeChange: (t: string) => void }) {
  const { t, lang, setLang } = useTranslation()
  const [tab, setTab] = useState<"general" | "apikeys" | "org" | "google">("general")
  const [settings, setSettings] = useState<Settings | null>(null)
  const [approvalOn, setApprovalOn] = useState(getRequireApproval())
  const [approvalThreshold, setApprovalThresholdState] = useState(getApprovalThreshold())
  const [onlyOwnKey, setOnlyOwnKey] = useState(false)
  const [seoData, setSeoData] = useState<PageSpeedData | null>(null)
  const [seoLoading, setSeoLoading] = useState(false)

  // Google AI Suite states
  const [googleLoading, setGoogleLoading] = useState<string | null>(null)
  const [googleResults, setGoogleResults] = useState<Record<string, any>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    seo: true,
    ai: false,
    media: false,
    export: false
  })

  // API Keys
  const [myKeys, setMyKeys] = useState<ApiKey[]>([])
  const [detectInput, setDetectInput] = useState("")
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<{ provider: string; providerLabel: string; models: { value: string; label: string }[] } | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [useAllModels, setUseAllModels] = useState(true)

  // Org
  const [ownedOrg, setOwnedOrg] = useState<Org | null>(null)
  const [memberOrgs, setMemberOrgs] = useState<Org[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [newOrgName, setNewOrgName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const [s, k, o] = await Promise.all([
        fetch(`${BASE}/api/settings`, { credentials: "include" }).then(r => r.json()),
        fetch(`${BASE}/api/keys`, { credentials: "include" }).then(r => r.json()),
        fetch(`${BASE}/api/orgs`, { credentials: "include" }).then(r => r.json()),
      ])
      if (s.ok) setSettings(s.settings)
      if (k.ok) setMyKeys(k.keys)
      if (o.ok) {
        setOwnedOrg(o.owned[0] || null)
        setMemberOrgs(o.member)
        if (o.owned[0]) loadOrgMembers(o.owned[0].id)
      }
    } catch (e: any) { toast.error(e.message) }
  }

  const loadOrgMembers = async (orgId: number) => {
    const r = await fetch(`${BASE}/api/orgs/${orgId}/members`, { credentials: "include" })
    const d = await r.json()
    if (d.ok) setOrgMembers(d.members)
  }

  const saveSettings = async (patch: Partial<Settings>) => {
    setSaving(true)
    try {
      await fetch(`${BASE}/api/settings`, {
        method: "PUT", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      })
      setSettings(prev => prev ? { ...prev, ...patch } : prev)
      if (patch.theme) {
        onThemeChange(patch.theme)
        localStorage.setItem("se_theme", patch.theme)
      }
      toast.success("Gespeichert")
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  const toggleModel = (model: string) => {
    if (!settings) return
    const disabled = settings.disabled_models.includes(model)
      ? settings.disabled_models.filter(m => m !== model)
      : [...settings.disabled_models, model]
    saveSettings({ disabled_models: disabled })
  }

  // Smart Key Detection
  const detectKey = async () => {
    if (!detectInput.trim()) { toast.warning("Key eingeben"); return }
    setDetecting(true)
    setDetected(null)
    try {
      const r = await fetch(`${BASE}/api/keys/detect`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: detectInput.trim() })
      })
      const d = await r.json()
      if (!d.ok) { toast.error(d.error); return }
      setDetected(d)
      setSelectedModels(d.models.map((m: any) => m.value))
      setUseAllModels(true)
      toast.success(`Key erkannt: ${d.providerLabel}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setDetecting(false) }
  }

  const saveKey = async () => {
    if (!detected) return
    setSaving(true)
    try {
      const r = await fetch(`${BASE}/api/keys`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: detectInput.trim(),
          provider: detected.provider,
          detected_models: useAllModels ? detected.models : detected.models.filter(m => selectedModels.includes(m.value)),
          use_all: useAllModels,
          label: detected.providerLabel,
        })
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      toast.success("Key gespeichert!")
      setDetectInput("")
      setDetected(null)
      await load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const deleteKey = async (id: number) => {
    await fetch(`${BASE}/api/keys/${id}`, { method: "DELETE", credentials: "include" })
    setMyKeys(prev => prev.filter(k => k.id !== id))
    toast.success("Key entfernt")
  }

  // Org
  const createOrg = async () => {
    if (!newOrgName.trim()) { toast.warning("Name erforderlich"); return }
    setSaving(true)
    try {
      const r = await fetch(`${BASE}/api/orgs`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() })
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      toast.success("Organisation erstellt!")
      setNewOrgName("")
      await load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const invite = async () => {
    if (!inviteEmail || !ownedOrg) return
    try {
      const r = await fetch(`${BASE}/api/orgs/${ownedOrg.id}/invite`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      toast.success("Einladung gesendet!")
      setInviteEmail("")
      await loadOrgMembers(ownedOrg.id)
    } catch (e: any) { toast.error(e.message) }
  }

  const removeMember = async (memberId: number) => {
    if (!ownedOrg) return
    await fetch(`${BASE}/api/orgs/${ownedOrg.id}/members/${memberId}`, { method: "DELETE", credentials: "include" })
    setOrgMembers(prev => prev.filter(m => m.id !== memberId))
    toast.success("Mitglied entfernt")
  }

  const TABS = [
    { id: "general", label: "Allgemein" },
    { id: "apikeys", label: "API Keys" },
    { id: "org", label: "Organisation" },
    { id: "google", label: "Google AI Suite" },
  ]

  const PROVIDER_COLORS: Record<string, string> = {
    anthropic: "rgba(200,120,60,0.8)",
    gemini: "rgba(66,133,244,0.8)",
    groq: "rgba(139,92,246,0.8)",
    openai: "rgba(16,163,127,0.8)",
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const analyzeSEO = async () => {
    setSeoLoading(true);
    try {
      const currentUrl = window.location.origin + "/preview/" + window.location.pathname.split('/').pop();
      const data = await analyzePageSpeed(currentUrl);
      setSeoData(data);
    } catch (error) {
      console.error("SEO analysis failed:", error);
      toast.error("SEO analysis failed");
    } finally {
      setSeoLoading(false);
    }
  };

  // Google AI Suite functions
  const getCurrentUrl = () => window.location.origin + "/preview/" + window.location.pathname.split('/').pop();

  const runGoogleApi = async (apiName: string, apiFunction: () => Promise<any>) => {
    setGoogleLoading(apiName);
    try {
      const result = await apiFunction();
      setGoogleResults(prev => ({ ...prev, [apiName]: result }));
      toast.success(`${apiName} completed successfully`);
    } catch (error: any) {
      console.error(`${apiName} failed:`, error);
      toast.error(`${apiName} failed: ${error.message}`);
    } finally {
      setGoogleLoading(null);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 600, maxHeight: "88vh", display: "flex", flexDirection: "column",
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        color: "var(--text-primary)", fontFamily: "system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px", borderBottom: "1px solid var(--divider)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Einstellungen</div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14,
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 2, padding: "10px 28px",
          borderBottom: "1px solid var(--divider)", flexShrink: 0,
          background: "var(--bg-input)",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{
              height: 32, padding: "0 16px", borderRadius: 8,
              border: "none",
              background: tab === t.id ? "rgba(99,102,241,0.25)" : "transparent",
              color: tab === t.id ? "white" : "rgba(148,163,184,0.5)",
              cursor: "pointer", fontWeight: tab === t.id ? 700 : 500, fontSize: 13,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>

          {/* GENERAL */}
          {tab === "general" && settings && (<>
            <Section title="Erscheinungsbild">
              <div style={{ display: "flex", gap: 10 }}>
                {[{ value: "dark", label: "Dark" }, { value: "light", label: "Hell" }].map(t => (
                  <div key={t.value} onClick={() => saveSettings({ theme: t.value })} style={{
                    flex: 1, padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: settings.theme === t.value ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.07)",
                    background: settings.theme === t.value ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {t.label}
                    {settings.theme === t.value && <div style={{ fontSize: 10, color: "rgba(99,102,241,0.8)", marginTop: 4 }}>Aktiv</div>}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Sprache">
              <div style={{ display: "flex", gap: 10 }}>
                {[{ value: "en", label: "EN" }, { value: "de", label: "DE" }, { value: "es", label: "ES" }].map(t => (
                  <div key={t.value} onClick={() => setLang(t.value as any)} style={{
                    flex: 1, padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: lang === t.value ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.07)",
                    background: lang === t.value ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {t.label}
                    {lang === t.value && <div style={{ fontSize: 10, color: "rgba(99,102,241,0.8)", marginTop: 4 }}>Aktiv</div>}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="KI Request Approval">
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Bestätigung vor Cloud-Requests</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {approvalOn ? "Kosten werden vor jedem API-Call angezeigt" : "Alle Requests gehen direkt durch"}
                  </div>
                </div>
                <Toggle on={approvalOn} onChange={v => { setApprovalOn(v); setRequireApproval(v) }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", marginTop: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Approval ab Betrag (€)</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Calls unter diesem Limit gehen direkt durch</div>
                </div>
                <input type="number" min="0" step="0.01" value={approvalThreshold} onChange={e => { const v = parseFloat(e.target.value) || 0; setApprovalThresholdState(v); setApprovalThreshold(v) }} style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "white", fontSize: 13, textAlign: "right" }} />
              </div>
            </Section>

            <Section title="KI Modelle">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Nur eigenen API Key nutzen</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{onlyOwnKey ? "Alle System-Modelle deaktiviert" : "Alle verfügbaren Modelle aktiv"}</div>
                </div>
                <Toggle on={onlyOwnKey} onChange={v => { setOnlyOwnKey(v); if (v) { saveSettings({ disabled_models: ALL_MODELS.map(m => m.value) }) } else { saveSettings({ disabled_models: [] }) } }} />
              </div>
                {ALL_MODELS.map(m => {
                  const disabled = settings.disabled_models.includes(m.value)
                  return (
                    <div key={m.value} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      opacity: disabled ? 0.5 : 1,
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.provider}</div>
                      </div>
                      <Toggle on={!disabled} onChange={() => toggleModel(m.value)} />
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="SEO Analysis">
              <button onClick={analyzeSEO} disabled={seoLoading} style={{
                height: 36, padding: "0 16px", borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)", cursor: "pointer", fontSize: 13,
                opacity: seoLoading ? 0.6 : 1,
              }}>
                {seoLoading ? "Analyzing..." : "🔍 Analyze SEO"}
              </button>
              {seoData && (
                <div style={{
                  marginTop: 16, padding: 16, borderRadius: 8,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Performance: {seoData.performance}/100 | SEO: {seoData.seo}/100
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    First Contentful Paint: {seoData.fcp}
                  </div>
                </div>
              )}
            </Section>
          </>)}

          {/* API KEYS */}
          {tab === "apikeys" && (<>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
              Füge eigene API Keys hinzu. Der Key wird automatisch erkannt und getestet. Deine Keys haben Vorrang vor den System-Keys.
            </div>

            {/* Smart Detect */}
            <Section title="Key hinzufügen">
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  value={detectInput}
                  onChange={e => { setDetectInput(e.target.value); setDetected(null) }}
                  placeholder="sk-ant-..., AIza..., gsk_... eingeben"
                  type="password"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={detectKey} disabled={detecting} style={{
                  height: 40, padding: "0 18px", borderRadius: 10, border: "none",
                  background: detecting ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "var(--text-primary)", fontWeight: 700, cursor: detecting ? "wait" : "pointer", fontSize: 13, flexShrink: 0,
                }}>{detecting ? "Prüfen..." : "Erkennen"}</button>
              </div>

              {/* Detection Result */}
              {detected && (
                <div style={{
                  padding: 16, borderRadius: 12,
                  border: "1px solid rgba(34,197,94,0.3)",
                  background: "rgba(34,197,94,0.06)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "rgba(34,197,94,0.9)",
                      boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                    }} />
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      Key erkannt: {detected.providerLabel}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
                    Verfügbare Modelle ({detected.models.length}):
                  </div>

                  {/* Use all toggle */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8, marginBottom: 8,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Alle Modelle nutzen</div>
                    <Toggle on={useAllModels} onChange={setUseAllModels} />
                  </div>

                  {!useAllModels && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                      {detected.models.map(m => (
                        <div key={m.value} onClick={() => setSelectedModels(prev =>
                          prev.includes(m.value) ? prev.filter(x => x !== m.value) : [...prev, m.value]
                        )} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                          borderRadius: 8, cursor: "pointer",
                          border: selectedModels.includes(m.value) ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.05)",
                          background: selectedModels.includes(m.value) ? "rgba(99,102,241,0.1)" : "rgba(0,0,0,0.15)",
                        }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                            border: "1px solid rgba(99,102,241,0.5)",
                            background: selectedModels.includes(m.value) ? "rgba(99,102,241,0.8)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, color: "var(--text-primary)",
                          }}>{selectedModels.includes(m.value) ? "✓" : ""}</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={saveKey} disabled={saving} style={{
                    width: "100%", height: 38, borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "var(--text-primary)", fontWeight: 800, cursor: saving ? "wait" : "pointer", fontSize: 13,
                  }}>Key speichern & aktivieren</button>
                </div>
              )}
            </Section>

            {/* Gespeicherte Keys */}
            {myKeys.length > 0 && (
              <Section title={`Meine Keys (${myKeys.length})`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {myKeys.map(k => (
                    <div key={k.id} style={{
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                            background: `${PROVIDER_COLORS[k.provider] || "rgba(148,163,184,0.2)"}22`,
                            color: PROVIDER_COLORS[k.provider] || "rgba(148,163,184,0.7)",
                            border: `1px solid ${PROVIDER_COLORS[k.provider] || "rgba(148,163,184,0.2)"}44`,
                            letterSpacing: 0.5, textTransform: "uppercase",
                          }}>{k.provider}</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{k.label}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {k.detected_models.length} Modelle · {new Date(k.created_at || "").toLocaleDateString("de-DE")}
                        </div>
                      </div>
                      <button onClick={() => deleteKey(k.id)} style={{
                        height: 28, padding: "0 10px", borderRadius: 7, marginLeft: 10,
                        border: "1px solid rgba(239,68,68,0.25)",
                        background: "rgba(239,68,68,0.08)",
                        color: "rgba(239,68,68,0.7)", cursor: "pointer", fontSize: 11, flexShrink: 0,
                      }}>Entfernen</button>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>)}

          {/* ORGANISATION */}
          {tab === "org" && (<>
            {/* Mitglied in Orgs */}
            {memberOrgs.length > 0 && (
              <Section title="Mitglied in">
                {memberOrgs.map(o => (
                  <div key={o.id} style={{
                    padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                    border: "1px solid rgba(99,102,241,0.2)",
                    background: "rgba(99,102,241,0.06)",
                    fontSize: 13, fontWeight: 700,
                  }}>{o.name}</div>
                ))}
              </Section>
            )}

            {/* Eigene Org */}
            {!ownedOrg ? (
              <Section title="Organisation erstellen">
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
                  Erstelle eine Organisation und lade Teammitglieder ein. Alle Mitglieder teilen dein Guthaben und deine Projekte.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    placeholder="z.B. Edgar GmbH"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={createOrg} disabled={saving} style={{
                    height: 40, padding: "0 18px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", fontSize: 13, flexShrink: 0,
                  }}>Erstellen</button>
                </div>
              </Section>
            ) : (
              <>
                <Section title="Deine Organisation">
                  <div style={{
                    padding: "14px 16px", borderRadius: 10, marginBottom: 16,
                    border: "1px solid rgba(99,102,241,0.2)",
                    background: "rgba(99,102,241,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{ownedOrg.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Du bist Owner</div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
                      background: "rgba(34,197,94,0.12)", color: "rgba(34,197,94,0.8)",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}>AKTIV</div>
                  </div>
                </Section>

                <Section title="Mitglied einladen">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="email@beispiel.de"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{
                      height: 40, borderRadius: 10, padding: "0 10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-input)", color: "var(--text-primary)",
                      outline: "none", fontSize: 13, flexShrink: 0,
                    }}>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={invite} style={{
                      height: 40, padding: "0 16px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", fontSize: 13, flexShrink: 0,
                    }}>Einladen</button>
                  </div>
                </Section>

                {orgMembers.length > 0 && (
                  <Section title={`Mitglieder (${orgMembers.length})`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {orgMembers.map(m => (
                        <div key={m.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: "var(--bg-card)",
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name || m.invite_email}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {m.invite_email} · {m.role} · {m.status === "pending" ? "Einladung ausstehend" : "Aktiv"}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                              background: m.status === "accepted" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                              color: m.status === "accepted" ? "rgba(34,197,94,0.8)" : "rgba(245,158,11,0.8)",
                              border: m.status === "accepted" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(245,158,11,0.2)",
                            }}>{m.status === "accepted" ? "AKTIV" : "AUSSTEHEND"}</div>
                            <button onClick={() => removeMember(m.id)} style={{
                              height: 28, padding: "0 10px", borderRadius: 7,
                              border: "1px solid rgba(239,68,68,0.25)",
                              background: "rgba(239,68,68,0.08)",
                              color: "rgba(239,68,68,0.7)", cursor: "pointer", fontSize: 11,
                            }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </>)}

          {/* GOOGLE AI SUITE */}
          {tab === "google" && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                15 Google APIs für SEO, KI-Inhalte, Bilder/Videos und Export/Deployment.
              </div>

              {/* SEO/Performance Section */}
              <Section title="📊 SEO & Performance" collapsible expanded={expandedSections.seo} onToggle={() => toggleSection('seo')}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <button onClick={() => runGoogleApi("Chrome UX Report", () => getCrUXMetrics(getCurrentUrl()))} disabled={googleLoading === "Chrome UX Report"} style={inputStyle}>
                    {googleLoading === "Chrome UX Report" ? "..." : "🔍"} Chrome UX Report
                  </button>
                  <button onClick={() => runGoogleApi("PageSpeed Insights", () => analyzePageSpeed(getCurrentUrl()))} disabled={googleLoading === "PageSpeed Insights"} style={inputStyle}>
                    {googleLoading === "PageSpeed Insights" ? "..." : "⚡"} PageSpeed Insights
                  </button>
                  <button onClick={() => runGoogleApi("Custom Search", () => searchUrl(getCurrentUrl()))} disabled={googleLoading === "Custom Search"} style={inputStyle}>
                    {googleLoading === "Custom Search" ? "..." : "🔎"} Custom Search
                  </button>
                </div>
                {googleResults["Chrome UX Report"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Chrome UX:</strong> Mobile {googleResults["Chrome UX Report"].mobileP75}ms | Desktop {googleResults["Chrome UX Report"].desktopP75}ms
                  </div>
                )}
                {googleResults["PageSpeed Insights"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>PageSpeed:</strong> {googleResults["PageSpeed Insights"].performance}/100 | SEO: {googleResults["PageSpeed Insights"].seo}/100 | FCP: {googleResults["PageSpeed Insights"].fcp}
                  </div>
                )}
                {googleResults["Custom Search"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Search Results:</strong> {googleResults["Custom Search"].items?.length || 0} results found
                  </div>
                )}
              </Section>

              {/* AI Content Section */}
              <Section title="🤖 AI Content" collapsible expanded={expandedSections.ai} onToggle={() => toggleSection('ai')}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <button onClick={() => runGoogleApi("Gemini Generate", () => generateContent("Generate marketing copy for this website"))} disabled={googleLoading === "Gemini Generate"} style={inputStyle}>
                    {googleLoading === "Gemini Generate" ? "..." : "✨"} Gemini Generate
                  </button>
                  <button onClick={() => runGoogleApi("NLP Entities", () => analyzeEntities("This is a sample text for entity analysis"))} disabled={googleLoading === "NLP Entities"} style={inputStyle}>
                    {googleLoading === "NLP Entities" ? "..." : "📝"} NLP Entities
                  </button>
                  <button onClick={() => runGoogleApi("Translation", () => translateText("Hello world", "de"))} disabled={googleLoading === "Translation"} style={inputStyle}>
                    {googleLoading === "Translation" ? "..." : "🌐"} Translate Text
                  </button>
                  <button onClick={() => runGoogleApi("Speech to Text", () => recognizeSpeech(new Blob()))} disabled={googleLoading === "Speech to Text"} style={inputStyle}>
                    {googleLoading === "Speech to Text" ? "..." : "🎤"} Speech to Text
                  </button>
                </div>
                {googleResults["Gemini Generate"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Gemini Output:</strong> {googleResults["Gemini Generate"].text?.substring(0, 100)}...
                  </div>
                )}
                {googleResults["NLP Entities"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Entities:</strong> {googleResults["NLP Entities"].entities?.length || 0} found
                  </div>
                )}
                {googleResults["Translation"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Translation:</strong> {googleResults["Translation"].translatedText}
                  </div>
                )}
              </Section>

              {/* Images/Videos Section */}
              <Section title="🎬 Images & Videos" collapsible expanded={expandedSections.media} onToggle={() => toggleSection('media')}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <button onClick={() => runGoogleApi("Vision Analysis", () => analyzeImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="))} disabled={googleLoading === "Vision Analysis"} style={inputStyle}>
                    {googleLoading === "Vision Analysis" ? "..." : "👁️"} Vision Analysis
                  </button>
                  <button onClick={() => runGoogleApi("Video Intelligence", () => analyzeVideo(getCurrentUrl()))} disabled={googleLoading === "Video Intelligence"} style={inputStyle}>
                    {googleLoading === "Video Intelligence" ? "..." : "🎥"} Video Intelligence
                  </button>
                  <button onClick={() => runGoogleApi("YouTube Search", () => searchVideos("web development"))} disabled={googleLoading === "YouTube Search"} style={inputStyle}>
                    {googleLoading === "YouTube Search" ? "..." : "📺"} YouTube Search
                  </button>
                  <button onClick={() => runGoogleApi("Device Specs", () => getDeviceSpecs())} disabled={googleLoading === "Device Specs"} style={inputStyle}>
                    {googleLoading === "Device Specs" ? "..." : "📱"} Device Specs
                  </button>
                </div>
                {googleResults["Vision Analysis"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Vision:</strong> {googleResults["Vision Analysis"].labels?.length || 0} labels, {googleResults["Vision Analysis"].objects?.length || 0} objects
                  </div>
                )}
                {googleResults["YouTube Search"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>YouTube:</strong> {googleResults["YouTube Search"].items?.length || 0} videos found
                  </div>
                )}
                {googleResults["Device Specs"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Devices:</strong> {googleResults["Device Specs"].deviceSpecs?.length || 0} device types
                  </div>
                )}
              </Section>

              {/* Export/Deploy Section */}
              <Section title="🚀 Export & Deploy" collapsible expanded={expandedSections.export} onToggle={() => toggleSection('export')}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <button onClick={() => runGoogleApi("Document AI", () => processDocument("<html><body>Sample document</body></html>"))} disabled={googleLoading === "Document AI"} style={inputStyle}>
                    {googleLoading === "Document AI" ? "..." : "📄"} Document AI
                  </button>
                  <button onClick={() => runGoogleApi("Firebase Hosting", () => createSiteVersion("my-site"))} disabled={googleLoading === "Firebase Hosting"} style={inputStyle}>
                    {googleLoading === "Firebase Hosting" ? "..." : "🔥"} Firebase Hosting
                  </button>
                  <button onClick={() => runGoogleApi("Cloud Storage", () => uploadFile(new File(["test"], "test.txt"), "my-bucket"))} disabled={googleLoading === "Cloud Storage"} style={inputStyle}>
                    {googleLoading === "Cloud Storage" ? "..." : "☁️"} Cloud Storage
                  </button>
                  <button onClick={() => runGoogleApi("BigQuery", () => queryBigQuery("SELECT COUNT(*) as total FROM dataset.table"))} disabled={googleLoading === "BigQuery"} style={inputStyle}>
                    {googleLoading === "BigQuery" ? "..." : "📊"} BigQuery
                  </button>
                </div>
                {googleResults["Document AI"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Document AI:</strong> {googleResults["Document AI"].entities?.length || 0} entities extracted
                  </div>
                )}
                {googleResults["Firebase Hosting"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Hosting:</strong> {googleResults["Firebase Hosting"].siteUrl} (v{googleResults["Firebase Hosting"].version})
                  </div>
                )}
                {googleResults["Cloud Storage"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>Storage:</strong> {googleResults["Cloud Storage"].fileUrl} ({googleResults["Cloud Storage"].size} bytes)
                  </div>
                )}
                {googleResults["BigQuery"] && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-card)", borderRadius: 8 }}>
                    <strong>BigQuery:</strong> {googleResults["BigQuery"].totalRows} rows returned
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, collapsible = false, expanded = true, onToggle }: { 
  title: string; 
  children: React.ReactNode; 
  collapsible?: boolean; 
  expanded?: boolean; 
  onToggle?: () => void; 
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 1,
        color: "var(--text-muted)", marginBottom: 12,
        textTransform: "uppercase",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: collapsible ? "pointer" : "default",
      }} onClick={collapsible && onToggle ? onToggle : undefined}>
        <span>{title}</span>
        {collapsible && (
          <span style={{ fontSize: 12, marginLeft: 8 }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
      </div>
      {(!collapsible || expanded) && children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: 11, cursor: "pointer", flexShrink: 0,
      background: on ? "rgba(99,102,241,0.85)" : "rgba(100,116,139,0.35)",
      position: "relative", transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: on ? 21 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "white", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  height: 40, borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-input)",
  color: "var(--text-primary)", padding: "0 14px",
  outline: "none", fontSize: 13, boxSizing: "border-box",
}

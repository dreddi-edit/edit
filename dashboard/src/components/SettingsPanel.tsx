import { useEffect, useState, type ReactNode } from "react"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"
import { getRequireApproval, getApprovalThreshold, setRequireApproval, setApprovalThreshold } from "../approval-settings"
import { useTranslation, type Language } from "../i18n/useTranslation"
import {
  analyzeEntities,
  analyzeImage,
  analyzePageSpeed,
  analyzeVideo,
  createSiteVersion,
  generateContent,
  getCrUXMetrics,
  getDeviceSpecs,
  processDocument,
  queryBigQuery,
  recognizeSpeech,
  searchUrl,
  searchVideos,
  translateText,
  uploadFile,
  type PageSpeedData,
} from "../utils/googleApis"

const BASE = ""

type TabId = "general" | "apikeys" | "org" | "google"
type GoogleSectionId = "seo" | "ai" | "media" | "export"
type GoogleResult = Record<string, any>
type Settings = { theme: string; disabled_models: string[] }
type ApiKey = {
  id: number
  provider: string
  label: string
  detected_models: Array<{ value: string; label: string }>
  active: number
  created_at?: string
}
type Org = { id: number; name: string; owner_id: number }
type OrgMember = {
  id: number
  invite_email: string
  role: string
  status: string
  name?: string
  email?: string
}
type DetectedKey = {
  provider: string
  providerLabel: string
  models: Array<{ value: string; label: string }>
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "general", label: "Allgemein" },
  { id: "apikeys", label: "API Keys" },
  { id: "org", label: "Organisation" },
  { id: "google", label: "Google AI Suite" },
]

const ALL_MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
  { value: "groq:llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B", provider: "groq" },
  { value: "ollama:qwen2.5-coder:7b", label: "Ollama (lokal)", provider: "ollama" },
]

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "rgba(200,120,60,0.85)",
  gemini: "rgba(66,133,244,0.85)",
  groq: "rgba(139,92,246,0.85)",
  openai: "rgba(16,163,127,0.85)",
  ollama: "rgba(148,163,184,0.82)",
}

function formatThreshold(value: number) {
  return value.toFixed(2).replace(".", ",")
}

function parseThreshold(value: string) {
  const parsed = parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function previewText(value: string, max = 120) {
  if (!value) return ""
  return value.length > max ? `${value.slice(0, max).trim()}...` : value
}

async function parseJson(response: Response) {
  const payload = await response.json()
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `${response.status} ${response.statusText}`)
  }
  return payload
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${BASE}${path}`, { credentials: "include", ...init })
  return parseJson(response)
}

async function requestJson(path: string, method: string, body: unknown) {
  return request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export default function SettingsPanel({
  onClose,
  onThemeChange,
}: {
  onClose: () => void
  onThemeChange: (theme: string) => void
}) {
  const { lang, setLang } = useTranslation()
  const [tab, setTab] = useState<TabId>("general")
  const [settings, setSettings] = useState<Settings | null>(null)
  const [approvalOn, setApprovalOn] = useState(getRequireApproval())
  const [approvalThreshold, setApprovalThresholdState] = useState(getApprovalThreshold())
  const [approvalThresholdInput, setApprovalThresholdInput] = useState(formatThreshold(getApprovalThreshold()))
  const [onlyOwnKey, setOnlyOwnKey] = useState(false)
  const [seoData, setSeoData] = useState<PageSpeedData | null>(null)
  const [seoLoading, setSeoLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [myKeys, setMyKeys] = useState<ApiKey[]>([])
  const [detectInput, setDetectInput] = useState("")
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<DetectedKey | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [useAllModels, setUseAllModels] = useState(true)

  const [ownedOrg, setOwnedOrg] = useState<Org | null>(null)
  const [memberOrgs, setMemberOrgs] = useState<Org[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [newOrgName, setNewOrgName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")

  const [googleLoading, setGoogleLoading] = useState<string | null>(null)
  const [googleResults, setGoogleResults] = useState<Record<string, GoogleResult>>({})
  const [expandedSections, setExpandedSections] = useState<Record<GoogleSectionId, boolean>>({
    seo: true,
    ai: true,
    media: true,
    export: true,
  })

  const effectiveSettings =
    settings ??
    ({
      theme: (localStorage.getItem("se_theme") as "dark" | "light") || "dark",
      disabled_models: [],
    } satisfies Settings)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [settingsData, keysData, orgsData] = await Promise.all([
        request("/api/settings"),
        request("/api/keys"),
        request("/api/orgs"),
      ])

      setSettings(settingsData.settings as Settings)
      setMyKeys((keysData.keys || []) as ApiKey[])
      setOwnedOrg((orgsData.owned?.[0] || null) as Org | null)
      setMemberOrgs((orgsData.member || []) as Org[])

      const nextOwned = (orgsData.owned?.[0] || null) as Org | null
      if (nextOwned) {
        await loadOrgMembers(nextOwned.id)
      } else {
        setOrgMembers([])
      }
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setLoading(false)
    }
  }

  const loadOrgMembers = async (orgId: number) => {
    try {
      const membersData = await request(`/api/orgs/${orgId}/members`)
      setOrgMembers((membersData.members || []) as OrgMember[])
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const saveSettings = async (patch: Partial<Settings>) => {
    setSaving(true)
    try {
      await requestJson("/api/settings", "PUT", patch)
      setSettings(previous => ({ ...(previous || effectiveSettings), ...patch }))
      if (patch.theme) {
        onThemeChange(patch.theme)
        localStorage.setItem("se_theme", patch.theme)
      }
      toast.success("Gespeichert")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleModel = (model: string) => {
    const disabledModels = effectiveSettings.disabled_models.includes(model)
      ? effectiveSettings.disabled_models.filter(entry => entry !== model)
      : [...effectiveSettings.disabled_models, model]
    void saveSettings({ disabled_models: disabledModels })
  }

  const handleThresholdChange = (value: string) => {
    setApprovalThresholdInput(value)
    const parsed = parseThreshold(value)
    if (parsed == null) return
    setApprovalThresholdState(parsed)
    setApprovalThreshold(parsed)
  }

  const detectKey = async () => {
    if (!detectInput.trim()) {
      toast.warning("Key eingeben")
      return
    }
    setDetecting(true)
    setDetected(null)
    try {
      const data = await requestJson("/api/keys/detect", "POST", { key: detectInput.trim() })
      const payload = data as DetectedKey
      setDetected(payload)
      setSelectedModels((payload.models || []).map(model => model.value))
      setUseAllModels(true)
      toast.success(`Key erkannt: ${payload.providerLabel}`)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setDetecting(false)
    }
  }

  const saveKey = async () => {
    if (!detected) return
    setSaving(true)
    try {
      await requestJson("/api/keys", "POST", {
        key: detectInput.trim(),
        provider: detected.provider,
        detected_models: useAllModels
          ? detected.models
          : detected.models.filter(model => selectedModels.includes(model.value)),
        use_all: useAllModels,
        label: detected.providerLabel,
      })
      toast.success("Key gespeichert!")
      setDetectInput("")
      setDetected(null)
      await load()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setSaving(false)
    }
  }

  const deleteKey = async (id: number) => {
    try {
      await request(`/api/keys/${id}`, { method: "DELETE" })
      setMyKeys(previous => previous.filter(key => key.id !== id))
      toast.success("Key entfernt")
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const createOrg = async () => {
    if (!newOrgName.trim()) {
      toast.warning("Name erforderlich")
      return
    }
    setSaving(true)
    try {
      await requestJson("/api/orgs", "POST", { name: newOrgName.trim() })
      toast.success("Organisation erstellt!")
      setNewOrgName("")
      await load()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setSaving(false)
    }
  }

  const invite = async () => {
    if (!ownedOrg || !inviteEmail.trim()) {
      toast.warning("E-Mail erforderlich")
      return
    }
    try {
      await requestJson(`/api/orgs/${ownedOrg.id}/invite`, "POST", {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      toast.success("Einladung gesendet!")
      setInviteEmail("")
      await loadOrgMembers(ownedOrg.id)
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const removeMember = async (memberId: number) => {
    if (!ownedOrg) return
    try {
      await request(`/api/orgs/${ownedOrg.id}/members/${memberId}`, { method: "DELETE" })
      setOrgMembers(previous => previous.filter(member => member.id !== memberId))
      toast.success("Mitglied entfernt")
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const analyzeSeo = async () => {
    setSeoLoading(true)
    try {
      const data = await analyzePageSpeed(getCurrentUrl())
      setSeoData(data)
      toast.success("SEO Analyse fertig")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setSeoLoading(false)
    }
  }

  const toggleSection = (section: GoogleSectionId) => {
    setExpandedSections(previous => ({ ...previous, [section]: !previous[section] }))
  }

  const getCurrentUrl = () => {
    const cached = localStorage.getItem("se_last_loaded_url") || ""
    if (/^https?:\/\//i.test(cached)) return cached
    const fallback = window.location.origin + "/preview/" + window.location.pathname.split("/").pop()
    return fallback
  }

  const runGoogleApi = async (apiName: string, apiFunction: () => Promise<unknown>) => {
    setGoogleLoading(apiName)
    try {
      const result = (await apiFunction()) || {}
      setGoogleResults(previous => ({ ...previous, [apiName]: result as GoogleResult }))
      toast.success(`${apiName} abgeschlossen`)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setGoogleLoading(null)
    }
  }

  const renderGoogleResult = (apiName: string) => {
    const result = googleResults[apiName]
    if (!result) return null

    if (apiName === "Chrome UX Report") {
      return (
        <ResultCard>
          <strong>Chrome UX:</strong> Mobile {result.mobileP75 ?? 0}ms | Desktop {result.desktopP75 ?? 0}ms
        </ResultCard>
      )
    }
    if (apiName === "PageSpeed Insights") {
      return (
        <ResultCard>
          <strong>PageSpeed:</strong> {result.performance ?? 0}/100 | SEO {result.seo ?? 0}/100 | FCP {result.fcp || "N/A"}
        </ResultCard>
      )
    }
    if (apiName === "Custom Search") {
      return (
        <ResultCard>
          <strong>Search Results:</strong> {result.items?.length || 0} Treffer
        </ResultCard>
      )
    }
    if (apiName === "Gemini Generate") {
      return (
        <ResultCard>
          <strong>Gemini Output:</strong> {previewText(String(result.text || ""))}
        </ResultCard>
      )
    }
    if (apiName === "NLP Entities") {
      return (
        <ResultCard>
          <strong>Entities:</strong> {result.entities?.length || 0} erkannt
        </ResultCard>
      )
    }
    if (apiName === "Translation") {
      return (
        <ResultCard>
          <strong>Translation:</strong> {result.translatedText || "Keine Ausgabe"}
        </ResultCard>
      )
    }
    if (apiName === "Speech to Text") {
      return (
        <ResultCard>
          <strong>Speech:</strong> {result.transcript || "Keine Audiodatei"}
        </ResultCard>
      )
    }
    if (apiName === "Vision Analysis") {
      return (
        <ResultCard>
          <strong>Vision:</strong> {result.labels?.length || 0} Labels, {result.objects?.length || 0} Objekte
        </ResultCard>
      )
    }
    if (apiName === "Video Intelligence") {
      return (
        <ResultCard>
          <strong>Video:</strong> {result.shots?.length || 0} Shots, {result.labels?.length || 0} Labels
        </ResultCard>
      )
    }
    if (apiName === "YouTube Search") {
      return (
        <ResultCard>
          <strong>YouTube:</strong> {result.items?.length || 0} Videos gefunden
        </ResultCard>
      )
    }
    if (apiName === "Device Specs") {
      return (
        <ResultCard>
          <strong>Devices:</strong> {result.deviceSpecs?.length || 0} Gerätetypen
        </ResultCard>
      )
    }
    if (apiName === "Document AI") {
      return (
        <ResultCard>
          <strong>Document AI:</strong> {result.entities?.length || 0} Entities extrahiert
        </ResultCard>
      )
    }
    if (apiName === "Firebase Hosting") {
      return (
        <ResultCard>
          <strong>Hosting:</strong> {result.siteUrl || "Keine Site"} ({result.version || "n/a"})
        </ResultCard>
      )
    }
    if (apiName === "Cloud Storage") {
      return (
        <ResultCard>
          <strong>Storage:</strong> {result.bucket || "Kein Bucket"} · {result.size || 0} bytes
        </ResultCard>
      )
    }
    if (apiName === "BigQuery") {
      return (
        <ResultCard>
          <strong>BigQuery:</strong> {result.totalRows || 0} rows returned
        </ResultCard>
      )
    }
    return null
  }

  return (
    <div className="draft-settings-backdrop" onClick={onClose}>
      <div
        className="draft-settings-modal"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="draft-settings-header">
          <div className="draft-settings-title" id="settings-title">
            Einstellungen
          </div>
          <button type="button" className="draft-settings-close" onClick={onClose} aria-label="Close settings">
            X
          </button>
        </div>

        <div className="draft-settings-tabs">
          {TABS.map(entry => (
            <button
              key={entry.id}
              type="button"
              className={`draft-settings-tab ${tab === entry.id ? "active" : ""}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="draft-settings-divider" />

        <div className="draft-settings-content">
          {tab === "general" ? (
            <>
              <Section label="Erscheinungsbild">
                <div className="draft-settings-button-group">
                  {[
                    { value: "dark", label: "Dark" },
                    { value: "light", label: "Hell" },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`draft-settings-toggle-button ${effectiveSettings.theme === option.value ? "active" : ""}`}
                      onClick={() => void saveSettings({ theme: option.value })}
                      disabled={saving}
                    >
                      {option.label}
                      <span className="draft-settings-toggle-sub">
                        {effectiveSettings.theme === option.value ? "Aktiv" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section label="Sprache">
                <div className="draft-settings-button-group">
                  {[
                    { value: "en", label: "EN" },
                    { value: "de", label: "DE" },
                    { value: "es", label: "ES" },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`draft-settings-toggle-button ${lang === option.value ? "active" : ""}`}
                      onClick={() => setLang(option.value as Language)}
                    >
                      {option.label}
                      <span className="draft-settings-toggle-sub">{lang === option.value ? "Aktiv" : ""}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section label="KI Request Approval">
                <SettingRow
                  title="Bestätigung vor Cloud-Requests"
                  subtitle={approvalOn ? "Kosten werden vor jedem API-Call angezeigt" : "Alle Requests gehen direkt durch"}
                  control={
                    <Toggle
                      checked={approvalOn}
                      label="Bestätigung vor Cloud-Requests"
                      onChange={value => {
                        setApprovalOn(value)
                        setRequireApproval(value)
                      }}
                    />
                  }
                />
                <SettingRow
                  title="Approval ab Betrag (€)"
                  subtitle="Calls unter diesem Limit gehen direkt durch"
                  control={
                    <input
                      className="draft-settings-row-input"
                      type="text"
                      inputMode="decimal"
                      value={approvalThresholdInput}
                      onChange={event => handleThresholdChange(event.target.value)}
                      onBlur={() => setApprovalThresholdInput(formatThreshold(approvalThreshold))}
                      aria-label="Approval threshold in euros"
                    />
                  }
                />
              </Section>

              <Section label="KI Modelle">
                <SettingRow
                  title="Nur eigenen API Key nutzen"
                  subtitle={onlyOwnKey ? "Eigene Keys werden bevorzugt" : "System- und eigene Keys sind nutzbar"}
                  control={
                    <Toggle
                      checked={onlyOwnKey}
                      label="Nur eigenen API Key nutzen"
                      onChange={setOnlyOwnKey}
                    />
                  }
                />
                {ALL_MODELS.map(model => {
                  const enabled = !effectiveSettings.disabled_models.includes(model.value)
                  return (
                    <SettingRow
                      key={model.value}
                      title={model.label}
                      subtitle={model.provider}
                      control={<Toggle checked={enabled} label={model.label} onChange={() => toggleModel(model.value)} />}
                    />
                  )
                })}
              </Section>

              <Section label="SEO Analysis">
                <button
                  type="button"
                  className="draft-settings-seo-button"
                  onClick={() => void analyzeSeo()}
                  disabled={seoLoading || loading}
                >
                  {seoLoading ? "..." : "🔍"} Analyze SEO
                </button>
                {seoData ? (
                  <ResultCard>
                    <strong>Performance:</strong> {seoData.performance}/100 | SEO {seoData.seo}/100 | FCP {seoData.fcp}
                  </ResultCard>
                ) : null}
              </Section>
            </>
          ) : null}

          {tab === "apikeys" ? (
            <>
              <p className="draft-settings-description">
                Füge eigene API Keys hinzu. Der Key wird automatisch erkannt und getestet. Deine Keys haben Vorrang vor den
                System-Keys.
              </p>

              <Section label="Key hinzufügen">
                <div className="draft-settings-input-row">
                  <input
                    className="draft-settings-text-input draft-settings-text-input--mono"
                    type="password"
                    value={detectInput}
                    onChange={event => {
                      setDetectInput(event.target.value)
                      setDetected(null)
                    }}
                    placeholder="sk-ant-..., AIza..., gsk_... eingeben"
                  />
                  <button
                    type="button"
                    className="draft-settings-action-button"
                    onClick={() => void detectKey()}
                    disabled={detecting}
                  >
                    {detecting ? "Prüfen..." : "Erkennen"}
                  </button>
                </div>

                {detected ? (
                  <div className="draft-settings-detected-card">
                    <div className="draft-settings-detected-head">
                      <span className="draft-settings-status-dot" />
                      <strong>Key erkannt: {detected.providerLabel}</strong>
                    </div>
                    <div className="draft-settings-detected-sub">Verfügbare Modelle ({detected.models.length})</div>

                    <SettingRow
                      title="Alle Modelle nutzen"
                      subtitle={useAllModels ? "Jedes erkannte Modell wird aktiviert" : "Wähle nur die Modelle aus, die du brauchst"}
                      control={<Toggle checked={useAllModels} label="Alle Modelle nutzen" onChange={setUseAllModels} />}
                    />

                    {!useAllModels ? (
                      <div className="draft-settings-model-list">
                        {detected.models.map(model => {
                          const active = selectedModels.includes(model.value)
                          return (
                            <button
                              key={model.value}
                              type="button"
                              className={`draft-settings-model-chip ${active ? "active" : ""}`}
                              onClick={() =>
                                setSelectedModels(previous =>
                                  previous.includes(model.value)
                                    ? previous.filter(entry => entry !== model.value)
                                    : [...previous, model.value]
                                )
                              }
                            >
                              {model.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="draft-settings-action-button draft-settings-action-button--full"
                      onClick={() => void saveKey()}
                      disabled={saving}
                    >
                      Key speichern & aktivieren
                    </button>
                  </div>
                ) : null}
              </Section>

              {myKeys.length ? (
                <Section label={`Meine Keys (${myKeys.length})`}>
                  <div className="draft-settings-list">
                    {myKeys.map(key => {
                      const accent = PROVIDER_COLORS[key.provider] || "rgba(148,163,184,0.82)"
                      return (
                        <div key={key.id} className="draft-settings-list-card">
                          <div className="draft-settings-list-main">
                            <div className="draft-settings-inline">
                              <span
                                className="draft-settings-pill"
                                style={{
                                  background: `${accent}22`,
                                  color: accent,
                                  borderColor: `${accent}44`,
                                }}
                              >
                                {key.provider}
                              </span>
                              <strong>{key.label}</strong>
                            </div>
                            <div className="draft-settings-list-meta">
                              {key.detected_models.length} Modelle ·{" "}
                              {key.created_at ? new Date(key.created_at).toLocaleDateString("de-DE") : "Unbekannt"}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="draft-settings-delete-button"
                            onClick={() => void deleteKey(key.id)}
                          >
                            Entfernen
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              ) : null}

              {!myKeys.length && !loading ? <EmptyState message="Noch keine eigenen Keys gespeichert." /> : null}
            </>
          ) : null}

          {tab === "org" ? (
            <>
              {memberOrgs.length ? (
                <Section label="Mitglied in">
                  <div className="draft-settings-list">
                    {memberOrgs.map(org => (
                      <div key={org.id} className="draft-settings-list-card">
                        <div className="draft-settings-list-main">
                          <strong>{org.name}</strong>
                          <div className="draft-settings-list-meta">Mitgliedschaft aktiv</div>
                        </div>
                        <span className="draft-settings-pill">Member</span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              {!ownedOrg ? (
                <Section label="Organisation erstellen">
                  <p className="draft-settings-description">
                    Erstelle eine Organisation und lade Teammitglieder ein. Alle Mitglieder teilen dein Guthaben und deine
                    Projekte.
                  </p>
                  <div className="draft-settings-input-row">
                    <input
                      className="draft-settings-text-input"
                      value={newOrgName}
                      onChange={event => setNewOrgName(event.target.value)}
                      placeholder="z.B. Edgar GmbH"
                    />
                    <button
                      type="button"
                      className="draft-settings-action-button"
                      onClick={() => void createOrg()}
                      disabled={saving}
                    >
                      Erstellen
                    </button>
                  </div>
                </Section>
              ) : (
                <>
                  <Section label="Deine Organisation">
                    <div className="draft-settings-list-card draft-settings-list-card--highlight">
                      <div className="draft-settings-list-main">
                        <strong>{ownedOrg.name}</strong>
                        <div className="draft-settings-list-meta">Du bist Owner</div>
                      </div>
                      <span className="draft-settings-pill draft-settings-pill--success">Aktiv</span>
                    </div>
                  </Section>

                  <Section label="Mitglied einladen">
                    <div className="draft-settings-input-row draft-settings-input-row--stack-mobile">
                      <input
                        className="draft-settings-text-input"
                        value={inviteEmail}
                        onChange={event => setInviteEmail(event.target.value)}
                        placeholder="email@beispiel.de"
                      />
                      <select
                        className="draft-settings-select"
                        value={inviteRole}
                        onChange={event => setInviteRole(event.target.value)}
                        aria-label="Invite role"
                      >
                        <option value="strategist">Strategist</option>
                        <option value="designer">Designer</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="client_reviewer">Client Reviewer</option>
                      </select>
                      <button type="button" className="draft-settings-action-button" onClick={() => void invite()}>
                        Einladen
                      </button>
                    </div>
                  </Section>

                  {orgMembers.length ? (
                    <Section label={`Mitglieder (${orgMembers.length})`}>
                      <div className="draft-settings-list">
                        {orgMembers.map(member => (
                          <div key={member.id} className="draft-settings-list-card">
                            <div className="draft-settings-list-main">
                              <strong>{member.name || member.email || member.invite_email}</strong>
                              <div className="draft-settings-list-meta">
                                {member.invite_email} · {member.role} ·{" "}
                                {member.status === "accepted" ? "Aktiv" : "Einladung ausstehend"}
                              </div>
                            </div>
                            <div className="draft-settings-inline">
                              <span
                                className={`draft-settings-pill ${
                                  member.status === "accepted" ? "draft-settings-pill--success" : "draft-settings-pill--pending"
                                }`}
                              >
                                {member.status === "accepted" ? "Aktiv" : "Pending"}
                              </span>
                              <button
                                type="button"
                                className="draft-settings-delete-button"
                                onClick={() => void removeMember(member.id)}
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {tab === "google" ? (
            <>
              <p className="draft-settings-description">
                15 Google APIs für SEO, KI-Inhalte, Bilder/Videos und Export/Deployment.
              </p>

              <GoogleSection
                emoji="📊"
                title="SEO & Performance"
                open={expandedSections.seo}
                onToggle={() => toggleSection("seo")}
              >
                <div className="draft-settings-api-grid">
                  <GoogleActionButton
                    emoji="🔍"
                    label="Chrome UX Report"
                    loading={googleLoading === "Chrome UX Report"}
                    onClick={() => void runGoogleApi("Chrome UX Report", () => getCrUXMetrics(getCurrentUrl()))}
                  />
                  <GoogleActionButton
                    emoji="⚡"
                    label="PageSpeed Insights"
                    loading={googleLoading === "PageSpeed Insights"}
                    onClick={() => void runGoogleApi("PageSpeed Insights", () => analyzePageSpeed(getCurrentUrl()))}
                  />
                  <GoogleActionButton
                    emoji="🔎"
                    label="Custom Search"
                    loading={googleLoading === "Custom Search"}
                    onClick={() => void runGoogleApi("Custom Search", () => searchUrl(getCurrentUrl()))}
                  />
                </div>
                {renderGoogleResult("Chrome UX Report")}
                {renderGoogleResult("PageSpeed Insights")}
                {renderGoogleResult("Custom Search")}
              </GoogleSection>

              <GoogleSection emoji="🤖" title="AI Content" open={expandedSections.ai} onToggle={() => toggleSection("ai")}>
                <div className="draft-settings-api-grid">
                  <GoogleActionButton
                    emoji="✨"
                    label="Gemini Generate"
                    loading={googleLoading === "Gemini Generate"}
                    onClick={() =>
                      void runGoogleApi("Gemini Generate", () => generateContent("Generate marketing copy for this website"))
                    }
                  />
                  <GoogleActionButton
                    emoji="📝"
                    label="NLP Entities"
                    loading={googleLoading === "NLP Entities"}
                    onClick={() => void runGoogleApi("NLP Entities", () => analyzeEntities("This is a sample text for entity analysis"))}
                  />
                  <GoogleActionButton
                    emoji="🌐"
                    label="Translate Text"
                    loading={googleLoading === "Translation"}
                    onClick={() => void runGoogleApi("Translation", () => translateText("Hello world", "de"))}
                  />
                  <GoogleActionButton
                    emoji="🎙️"
                    label="Speech to Text"
                    loading={googleLoading === "Speech to Text"}
                    onClick={() => void runGoogleApi("Speech to Text", () => recognizeSpeech(new Blob()))}
                  />
                </div>
                {renderGoogleResult("Gemini Generate")}
                {renderGoogleResult("NLP Entities")}
                {renderGoogleResult("Translation")}
                {renderGoogleResult("Speech to Text")}
              </GoogleSection>

              <GoogleSection
                emoji="🎬"
                title="Images & Videos"
                open={expandedSections.media}
                onToggle={() => toggleSection("media")}
              >
                <div className="draft-settings-api-grid">
                  <GoogleActionButton
                    emoji="👁️"
                    label="Vision Analysis"
                    loading={googleLoading === "Vision Analysis"}
                    onClick={() =>
                      void runGoogleApi(
                        "Vision Analysis",
                        () =>
                          analyzeImage(
                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
                          )
                      )
                    }
                  />
                  <GoogleActionButton
                    emoji="🎥"
                    label="Video Intelligence"
                    loading={googleLoading === "Video Intelligence"}
                    onClick={() => void runGoogleApi("Video Intelligence", () => analyzeVideo(getCurrentUrl()))}
                  />
                  <GoogleActionButton
                    emoji="📺"
                    label="YouTube Search"
                    loading={googleLoading === "YouTube Search"}
                    onClick={() => void runGoogleApi("YouTube Search", () => searchVideos("web development"))}
                  />
                  <GoogleActionButton
                    emoji="📱"
                    label="Device Specs"
                    loading={googleLoading === "Device Specs"}
                    onClick={() => void runGoogleApi("Device Specs", () => getDeviceSpecs())}
                  />
                </div>
                {renderGoogleResult("Vision Analysis")}
                {renderGoogleResult("Video Intelligence")}
                {renderGoogleResult("YouTube Search")}
                {renderGoogleResult("Device Specs")}
              </GoogleSection>

              <GoogleSection
                emoji="🚀"
                title="Export & Deploy"
                open={expandedSections.export}
                onToggle={() => toggleSection("export")}
              >
                <div className="draft-settings-api-grid">
                  <GoogleActionButton
                    emoji="📄"
                    label="Document AI"
                    loading={googleLoading === "Document AI"}
                    onClick={() => void runGoogleApi("Document AI", () => processDocument("<html><body>Sample document</body></html>"))}
                  />
                  <GoogleActionButton
                    emoji="🔥"
                    label="Firebase Hosting"
                    loading={googleLoading === "Firebase Hosting"}
                    onClick={() => void runGoogleApi("Firebase Hosting", () => createSiteVersion("my-site"))}
                  />
                  <GoogleActionButton
                    emoji="☁️"
                    label="Cloud Storage"
                    loading={googleLoading === "Cloud Storage"}
                    onClick={() =>
                      void runGoogleApi("Cloud Storage", () => uploadFile(new File(["test"], "test.txt"), "my-bucket"))
                    }
                  />
                  <GoogleActionButton
                    emoji="📊"
                    label="BigQuery"
                    loading={googleLoading === "BigQuery"}
                    onClick={() => void runGoogleApi("BigQuery", () => queryBigQuery("SELECT COUNT(*) as total FROM dataset.table"))}
                  />
                </div>
                {renderGoogleResult("Document AI")}
                {renderGoogleResult("Firebase Hosting")}
                {renderGoogleResult("Cloud Storage")}
                {renderGoogleResult("BigQuery")}
              </GoogleSection>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="draft-settings-section">
      <div className="draft-settings-label">{label}</div>
      {children}
    </section>
  )
}

function SettingRow({
  title,
  subtitle,
  control,
}: {
  title: string
  subtitle: string
  control: ReactNode
}) {
  return (
    <div className="draft-settings-row">
      <div className="draft-settings-row-info">
        <div className="draft-settings-row-title">{title}</div>
        <div className="draft-settings-row-sub">{subtitle}</div>
      </div>
      {control}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="draft-settings-toggle" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="draft-settings-toggle-track" />
      <span className="draft-settings-toggle-thumb" />
    </label>
  )
}

function GoogleSection({
  emoji,
  title,
  open,
  onToggle,
  children,
}: {
  emoji: string
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`draft-settings-api-section ${open ? "open" : ""}`}>
      <button type="button" className="draft-settings-api-section-header" onClick={onToggle}>
        <span className="draft-settings-api-title">
          <span className="draft-settings-api-title-emoji">{emoji}</span>
          {title}
        </span>
        <span className="draft-settings-api-arrow">▼</span>
      </button>
      {open ? children : null}
    </section>
  )
}

function GoogleActionButton({
  emoji,
  label,
  loading,
  onClick,
}: {
  emoji: string
  label: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="draft-settings-api-button" onClick={onClick} disabled={loading}>
      <span className="draft-settings-api-button-emoji">{loading ? "..." : emoji}</span>
      <span>{label}</span>
    </button>
  )
}

function ResultCard({ children }: { children: ReactNode }) {
  return <div className="draft-settings-result-card">{children}</div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="draft-settings-empty">{message}</div>
}

import { useEffect, useState, type ReactNode } from "react"
import { useMemo } from "react"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"
import {
  apiGetBalance,
  apiGetCreditsTransactions,
  apiGetStripeInvoices,
  apiGetStripePackages,
  apiStripeSubscriptionCheckout,
} from "../api/credits"
import { fetchWithAuth } from "../api/client"
import type { CreditTransaction, StripeSubscriptionPlan, UserInvoice } from "../api/types"
import { getRequireApproval, getApprovalThreshold, setRequireApproval, setApprovalThreshold } from "../approval-settings"
import { AVAILABLE_UI_LANGUAGES, useTranslation, type Language } from "../i18n/useTranslation"
import {
  MODEL_CATEGORIES,
  buildAvailableModels,
  getActiveModelsByCategory,
  type ModelCategoryId,
} from "../utils/modelCatalog"
import { persistThemeChoice, resolveThemePreference } from "../utils/theme"
import {
  analyzePageSpeed,
  analyzeVideo,
  generateContent,
  getCrUXMetrics,
  getDeviceSpecs,
  searchUrl,
  type PageSpeedData,
} from "../utils/googleApis"
const BASE = ""

type TabId = "general" | "profile" | "apikeys" | "org"
type Settings = { theme: string; disabled_models: string[]; theme_explicit?: boolean }
type NotificationPrefs = { email_updates: boolean; team_mentions: boolean }
type ApiKey = {
  id: number
  provider: string
  label: string
  detected_models: Array<{ value: string; label: string }>
  active: number
  created_at?: string
}
type CreditViewMode = "detailed" | "model" | "application"
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
type CurrentUser = {
  id: number
  email: string
  name: string
  created_at?: string
  avatar_url?: string
  email_verified?: boolean
  totp_enabled?: boolean
  plan_id?: string
  plan_status?: string
  notification_prefs?: NotificationPrefs
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "general", label: "General" },
  { id: "profile", label: "Profile & Billing" },
  { id: "apikeys", label: "API Keys" },
  { id: "org", label: "Organisation" },
]

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "rgba(200,120,60,0.85)",
  gemini: "rgba(66,133,244,0.85)",
  groq: "rgba(139,92,246,0.85)",
  openai: "rgba(16,163,127,0.85)",
  ollama: "rgba(148,163,184,0.82)",
  google: "rgba(66,133,244,0.85)",
  vertex: "rgba(129,140,248,0.85)",
  "google cloud": "rgba(96,165,250,0.85)",
  openrouter: "rgba(236,72,153,0.85)",
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

function parseCreditTransactionModel(description: string) {
  const modelMatch = String(description || "").match(/\|\s*([^|(]+?)\s*\(/)
  return modelMatch ? modelMatch[1].trim() : "Other"
}

function parseCreditTransactionApplication(description: string) {
  const appMatch = String(description || "").match(/^AI:\s*(.+?)\s*\|/)
  if (appMatch) return appMatch[1].trim()
  if (/topup|auflad/i.test(description)) return "Top-up"
  if (/stripe/i.test(description)) return "Stripe"
  return "Other"
}

async function parseJson(response: Response) {
  const payload = await response.json()
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `${response.status} ${response.statusText}`)
  }
  return payload
}

async function request(path: string, init?: RequestInit) {
  const response = await fetchWithAuth(`${BASE}${path}`, init)
  return parseJson(response)
}

async function requestJson(path: string, method: string, body: unknown) {
  return request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error || new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

export default function SettingsPanel({
  onClose,
  onThemeChange,
}: {
  onClose: () => void
  onThemeChange: (theme: string) => void
}) {
  const { lang, setLang, t } = useTranslation()
  const [tab, setTab] = useState<TabId>("general")
  const [settings, setSettings] = useState<Settings | null>(null)
  const [approvalOn, setApprovalOn] = useState(getRequireApproval())
  const [approvalThreshold, setApprovalThresholdState] = useState(getApprovalThreshold())
  const [approvalThresholdInput, setApprovalThresholdInput] = useState(formatThreshold(getApprovalThreshold()))
  const [onlyOwnKey, setOnlyOwnKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({ email_updates: true, team_mentions: true })
  const [subscriptionPlans, setSubscriptionPlans] = useState<StripeSubscriptionPlan[]>([])
  const [invoiceRows, setInvoiceRows] = useState<UserInvoice[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([])
  const [creditViewMode, setCreditViewMode] = useState<CreditViewMode>("detailed")
  const [avatarDraft, setAvatarDraft] = useState("")
  const [currentPasswordInput, setCurrentPasswordInput] = useState("")
  const [newPasswordInput, setNewPasswordInput] = useState("")
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("")
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null)
  const [twoFaCode, setTwoFaCode] = useState("")
  const [twoFaDisablePassword, setTwoFaDisablePassword] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [accountBusy, setAccountBusy] = useState<string | null>(null)
  const [languageChoice, setLanguageChoice] = useState<Language>(lang)
  const [languageSaving, setLanguageSaving] = useState(false)
  const [modelBrowserOpen, setModelBrowserOpen] = useState(true)
  const [expandedModelCategories, setExpandedModelCategories] = useState<Record<ModelCategoryId, boolean>>({
    creative: true,
    coding: false,
    fast: false,
  })

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

  const effectiveSettings =
    settings ??
    ({
      theme: resolveThemePreference(),
      disabled_models: [],
    } satisfies Settings)

  const keyDetectedModels = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>()
    for (const key of myKeys) {
      for (const model of key.detected_models || []) {
        const value = String(model.value || "").trim()
        if (!value) continue
        if (!map.has(value)) {
          map.set(value, {
            value,
            label: String(model.label || value),
          })
        }
      }
    }
    return Array.from(map.values())
  }, [myKeys])

  const availableModels = useMemo(() => buildAvailableModels(keyDetectedModels), [keyDetectedModels])
  const availableModelGroups = useMemo(
    () => getActiveModelsByCategory(availableModels, effectiveSettings.disabled_models),
    [availableModels, effectiveSettings.disabled_models],
  )

  const creditTransactionSummary = useMemo(() => {
    const spendRows = creditTransactions.filter((row) => Number(row.amount_eur || 0) < 0)
    const totalSpent = spendRows.reduce((sum, row) => sum + Math.abs(Number(row.amount_eur || 0)), 0)
    const grouped = new Map<string, { label: string; amount: number; count: number }>()
    for (const row of creditTransactions) {
      const label =
        creditViewMode === "model"
          ? parseCreditTransactionModel(row.description || row.type)
          : creditViewMode === "application"
          ? parseCreditTransactionApplication(row.description || row.type)
          : `${row.id}`
      const key = creditViewMode === "detailed" ? `${row.id}` : label
      const current = grouped.get(key) || { label, amount: 0, count: 0 }
      current.amount += Number(row.amount_eur || 0)
      current.count += 1
      grouped.set(key, current)
    }
    return {
      totalSpent,
      rows:
        creditViewMode === "detailed"
          ? creditTransactions.map((row) => ({
              key: `${row.id}`,
              label:
                row.type === "topup"
                  ? "Top-up"
                  : row.type === "stripe"
                  ? "Stripe"
                  : row.type === "deduct"
                  ? parseCreditTransactionApplication(row.description || "AI usage")
                  : row.type,
              detail: row.description || row.type,
              amount: Number(row.amount_eur || 0),
              count: 1,
              createdAt: row.created_at,
            }))
          : Array.from(grouped.values())
              .map((row) => ({
                key: row.label,
                label: row.label,
                detail: `${row.count} transactions`,
                amount: row.amount,
                count: row.count,
                createdAt: "",
              }))
              .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)),
    }
  }, [creditTransactions, creditViewMode])

  useEffect(() => {
    setLanguageChoice(lang)
  }, [lang])

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

  const applyCurrentUser = (user: CurrentUser | null) => {
    setCurrentUser(user)
    setAvatarDraft(user?.avatar_url || "")
    setNotificationPrefs({
      email_updates: user?.notification_prefs?.email_updates !== false,
      team_mentions: user?.notification_prefs?.team_mentions !== false,
    })
  }

  const load = async () => {
    setLoading(true)
    try {
      const acceptInviteData = await request("/api/orgs/accept-invite", { method: "POST" }).catch(() => null)

      const [settingsDataResult, keysDataResult, orgsDataResult, meDataResult, billingDataResult, invoicesDataResult, balanceDataResult, transactionsDataResult] =
        await Promise.allSettled([
        request("/api/settings"),
        request("/api/keys"),
        request("/api/orgs"),
        request("/api/auth/me"),
        apiGetStripePackages(),
        apiGetStripeInvoices(),
        apiGetBalance(),
        apiGetCreditsTransactions(),
      ])

      if (settingsDataResult.status === "rejected") throw settingsDataResult.reason
      if (keysDataResult.status === "rejected") throw keysDataResult.reason
      if (orgsDataResult.status === "rejected") throw orgsDataResult.reason
      if (meDataResult.status === "rejected") throw meDataResult.reason

      const settingsData = settingsDataResult.value
      const keysData = keysDataResult.value
      const orgsData = orgsDataResult.value
      const meData = meDataResult.value

      if ((acceptInviteData as { accepted?: number } | null)?.accepted) {
        toast.success(`Organisation invites accepted: ${(acceptInviteData as { accepted: number }).accepted}`)
      }

      setSettings(settingsData.settings as Settings)
      setMyKeys((keysData.keys || []) as ApiKey[])
      setOwnedOrg((orgsData.owned?.[0] || null) as Org | null)
      setMemberOrgs((orgsData.member || []) as Org[])
      const me = (meData.user || null) as CurrentUser | null
      applyCurrentUser(me)

      if (billingDataResult.status === "fulfilled") {
        const billingData = billingDataResult.value
        setSubscriptionPlans(billingData.ok ? billingData.subscription_plans || [] : [])
      } else {
        setSubscriptionPlans([])
      }

      if (invoicesDataResult.status === "fulfilled") {
        const invoicesData = invoicesDataResult.value
        setInvoiceRows(invoicesData.ok ? invoicesData.invoices || [] : [])
      } else {
        setInvoiceRows([])
      }

      setCreditBalance(balanceDataResult.status === "fulfilled" ? balanceDataResult.value : null)

      if (transactionsDataResult.status === "fulfilled") {
        const txData = transactionsDataResult.value
        setCreditTransactions(txData.ok ? txData.transactions || [] : [])
      } else {
        setCreditTransactions([])
      }

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

  const saveProfile = async (
    patch: Partial<Pick<CurrentUser, "name" | "email" | "avatar_url">> & {
      notification_prefs?: NotificationPrefs
      current_password?: string
      new_password?: string
    },
    successMessage = "Gespeichert"
  ) => {
    try {
      const data = await requestJson("/api/auth/me", "PUT", patch)
      if (data?.user) {
        applyCurrentUser(data.user as CurrentUser)
      }
      toast.success(successMessage)
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const startSubscription = async (planKey: string) => {
    setAccountBusy(`subscribe-${planKey}`)
    try {
      const aliasMap: Record<string, string> = {
        starter: "starter",
        pro: "pro",
        scale: "scale",
        sub_starter: "starter",
        sub_pro: "pro",
        sub_scale: "scale",
      }

      const normalized = String(planKey || "").trim()
      const wantedAlias = aliasMap[normalized] || normalized

      const matchedPlan =
        subscriptionPlans.find((plan) => String(plan.id) === normalized) ||
        subscriptionPlans.find((plan) => {
          const planId = String(plan.id || "").toLowerCase()
          const planLabel = String(plan.label || "").toLowerCase()
          return (
            planId === wantedAlias ||
            planId.endsWith(`_${wantedAlias}`) ||
            planId.endsWith(`-${wantedAlias}`) ||
            planLabel.includes(wantedAlias)
          )
        })

      const checkoutPriceId = String(matchedPlan?.id || "").trim()
      if (!checkoutPriceId) {
        throw new Error("No valid subscription plan available for checkout")
      }

      const url = await apiStripeSubscriptionCheckout(checkoutPriceId)
      window.location.href = url
    } catch (error) {
      toast.error(errMsg(error))
      setAccountBusy(null)
    }
  }

  const openBillingPortal = async () => {
    setAccountBusy("portal")
    try {
      const res = await request("/api/stripe/portal", { method: "POST" })
      if (res?.url) window.open(res.url as string, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
    }
  }

  const saveAvatar = async () => {
    setAccountBusy("avatar")
    try {
      await saveProfile({ avatar_url: avatarDraft.trim() }, "Avatar updated")
    } finally {
      setAccountBusy(null)
    }
  }

  const uploadAvatarFile = async (file: File | null) => {
    if (!file) return
    if (!/^image\//i.test(file.type || "")) {
      toast.warning("Please choose an image file")
      return
    }
    setAccountBusy("avatar-upload")
    try {
      const dataUrl = await fileToDataUrl(file)
      const response = await requestJson("/api/auth/avatar", "POST", { data_url: dataUrl })
      const nextUser = (response?.user || null) as CurrentUser | null
      if (nextUser) applyCurrentUser(nextUser)
      if (response?.avatar_url) setAvatarDraft(String(response.avatar_url))
      toast.success("Avatar uploaded")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
    }
  }

  const changePassword = async () => {
    if (!currentPasswordInput || !newPasswordInput) {
      toast.warning("Current and new password are required")
      return
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast.warning("New passwords do not match")
      return
    }
    setAccountBusy("password")
    try {
      await saveProfile(
        {
          current_password: currentPasswordInput,
          new_password: newPasswordInput,
        },
        "Password updated"
      )
      setCurrentPasswordInput("")
      setNewPasswordInput("")
      setConfirmPasswordInput("")
    } finally {
      setAccountBusy(null)
    }
  }

  const setupTwoFactor = async () => {
    setAccountBusy("2fa-setup")
    try {
      const data = await request("/api/auth/2fa/setup", { method: "POST" })
      setTwoFaSetup({
        secret: String(data.secret || ""),
        otpauth_uri: String(data.otpauth_uri || ""),
      })
      setTwoFaCode("")
      toast.success("Authenticator setup started")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
    }
  }

  const verifyTwoFactorSetup = async () => {
    if (twoFaCode.length !== 6) {
      toast.warning("Enter the 6-digit authenticator code")
      return
    }
    setAccountBusy("2fa-verify")
    try {
      await requestJson("/api/auth/2fa/verify-setup", "POST", { code: twoFaCode })
      setTwoFaSetup(null)
      setTwoFaCode("")
      await load()
      toast.success("Two-factor authentication enabled")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
    }
  }

  const disableTwoFactor = async () => {
    if (!twoFaDisablePassword) {
      toast.warning("Enter your password to disable 2FA")
      return
    }
    setAccountBusy("2fa-disable")
    try {
      await requestJson("/api/auth/2fa", "DELETE", { password: twoFaDisablePassword })
      setTwoFaDisablePassword("")
      setTwoFaSetup(null)
      await load()
      toast.success("Two-factor authentication disabled")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
    }
  }

  const downloadGdprExport = async () => {
    setAccountBusy("export")
    try {
      const response = await fetchWithAuth(`${BASE}/api/auth/export`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || `Export failed (${response.status})`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "gdpr-export.json"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      toast.success("GDPR export downloaded")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
    }
  }

  const deleteAccount = async () => {
    if (!deletePassword) {
      toast.warning("Enter your password to delete the account")
      return
    }
    const confirmed = window.confirm("Delete this account permanently? This cannot be undone.")
    if (!confirmed) return

    setAccountBusy("delete")
    try {
      await requestJson("/api/auth/me", "DELETE", { password: deletePassword })
      toast.success("Account deleted")
      window.location.replace("/")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setAccountBusy(null)
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
        persistThemeChoice(patch.theme as "dark" | "light")
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

  const toggleModelCategory = (category: ModelCategoryId) => {
    setExpandedModelCategories(previous => ({ ...previous, [category]: !previous[category] }))
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
            {t("Settings")}
          </div>
          <button type="button" className="draft-settings-close" onClick={onClose} aria-label="Close settings">
            X
          </button>
        </div>

        <div
          className="draft-settings-tabs"
          role="tablist"
          aria-label={t("Settings Categories")}
          onKeyDown={(event) => {
            const tabs = TABS.map((entry) => entry.id)
            const index = tabs.indexOf(tab)
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault()
              setTab(tabs[(index + 1) % tabs.length])
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault()
              setTab(tabs[(index - 1 + tabs.length) % tabs.length])
            } else if (event.key === "Home") {
              event.preventDefault()
              setTab(tabs[0])
            } else if (event.key === "End") {
              event.preventDefault()
              setTab(tabs[tabs.length - 1])
            }
          }}
        >
          {TABS.map(entry => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`tabpanel-${entry.id}`}
              className={`draft-settings-tab ${tab === entry.id ? "active" : ""}`}
              onClick={() => setTab(entry.id)}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>
        <div className="draft-settings-divider" />

        <div className="draft-settings-content">
          {tab === "general" ? (
            <div className="draft-settings-pane" role="tabpanel" id="tabpanel-general" aria-labelledby="tab-general">
              <Section label={t("Appearance")}>
                <div className="draft-settings-button-group">
                  {[
                    { value: "dark", label: t("Dark") },
                    { value: "light", label: t("Light") },
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
                        {effectiveSettings.theme === option.value ? t("Active") : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section label={t("Language")}>
                <div className="draft-settings-input-row draft-settings-input-row--stack-mobile">
                  <select
                    className="draft-settings-select"
                    value={languageChoice}
                    onChange={event => setLanguageChoice(event.target.value)}
                    aria-label="UI language"
                  >
                    {AVAILABLE_UI_LANGUAGES.map(option => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="draft-settings-action-button"
                    disabled={languageSaving || languageChoice === lang}
                    onClick={() => {
                      setLanguageSaving(true)
                      void setLang(languageChoice)
                        .catch(error => toast.error(errMsg(error)))
                        .finally(() => setLanguageSaving(false))
                    }}
                  >
                    {languageSaving ? t("Translating...") : t("Apply language")}
                  </button>
                </div>
                <p className="draft-settings-description" style={{ marginTop: 10, marginBottom: 0 }}>
                  {t("Built-in for EN/DE/ES with Google-powered language packs for all supported languages.")}
                </p>
              </Section>

              <Section label={t("AI Request Approval")}>
                <SettingRow
                  title={t("Approval before cloud requests")}
                  subtitle={approvalOn ? t("Costs are shown before every API call") : t("All requests go through directly")}
                  control={
                    <Toggle
                      checked={approvalOn}
                      label={t("Approval before cloud requests")}
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

              <Section label={t("AI Models")}>
                <SettingRow
                  title={t("Only use your own API key")}
                  subtitle={onlyOwnKey ? t("Own keys are preferred") : t("System and own keys can be used")}
                  control={
                    <Toggle
                      checked={onlyOwnKey}
                      label={t("Only use your own API key")}
                      onChange={setOnlyOwnKey}
                    />
                  }
                />

                <div className="draft-settings-model-browser">
                  {keyDetectedModels.length ? (
                    <div className="draft-settings-model-availability">
                      <strong>{availableModels.length} executable models available right now</strong>
                      <span>
                        The list below merges working models from your saved keys with the app's executable model catalog.
                      </span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={`draft-settings-model-browser-toggle ${modelBrowserOpen ? "is-open" : ""}`}
                    onClick={() => setModelBrowserOpen(open => !open)}
                  >
                    <span>
                      <strong>{t("Browse model categories")}</strong>
                      <span className="draft-settings-model-browser-sub">
                        {t("Open one category, then drill into the top 15 models for that capability.")}
                      </span>
                    </span>
                    <span className="draft-settings-model-browser-arrow">{modelBrowserOpen ? "−" : "+"}</span>
                  </button>

                  {modelBrowserOpen ? (
                    <div className="draft-settings-model-browser-body">
                      {availableModelGroups.map(category => {
                        const categoryModels = availableModels.filter((model) => model.category === category.id)

                        return (
                          <div key={category.id} className="draft-settings-model-category">
                            <button
                              type="button"
                              className={`draft-settings-model-category-toggle ${expandedModelCategories[category.id] ? "is-open" : ""}`}
                              onClick={() => toggleModelCategory(category.id)}
                            >
                              <span className="draft-settings-model-category-main">
                                <span className="draft-settings-model-category-title">{t(category.label)}</span>
                                <span className="draft-settings-model-category-sub">{t(category.description)}</span>
                              </span>
                              <span className="draft-settings-model-category-meta">
                                {category.models.length}/{category.activeCount}
                              </span>
                            </button>

                            {expandedModelCategories[category.id] ? (
                              <div className="draft-settings-model-category-body">
                                {categoryModels.map(model => {
                                  const enabled = !effectiveSettings.disabled_models.includes(model.id)
                                  const providerKey = model.provider.toLowerCase()
                                  const accent = PROVIDER_COLORS[providerKey] || "rgba(148,163,184,0.82)"

                                  return (
                                    <div key={model.id} className="draft-settings-model-option">
                                      <div className="draft-settings-model-option-copy">
                                        <div className="draft-settings-model-option-title">{model.label}</div>
                                        <div className="draft-settings-model-option-meta">
                                          <span
                                            className="draft-settings-pill"
                                            style={{
                                              background: `${accent}20`,
                                              color: accent,
                                              borderColor: `${accent}3d`,
                                            }}
                                          >
                                            {model.provider}
                                          </span>
                                        </div>
                                      </div>
                                      <Toggle checked={enabled} label={model.label} onChange={() => toggleModel(model.id)} />
                                    </div>
                                  )
                                })}
                                {categoryModels.length === 0 ? (
                                  <div className="draft-settings-model-empty">
                                    No detected models in this category for your currently saved keys.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </Section>
            </div>
          ) : null}

          {tab === "profile" ? (
            <div className="draft-settings-pane draft-settings-pane--profile" role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile">
              <Section label={t("Profile Details")}>
                <div className="draft-settings-list-card draft-settings-list-card--highlight" style={{ marginBottom: 14 }}>
                  <div className="draft-settings-list-main">
                    <strong>{currentUser?.name || currentUser?.email || "Account"}</strong>
                    <div className="draft-settings-list-meta">
                      {currentUser?.created_at
                        ? `Member since ${new Date(currentUser.created_at).toLocaleDateString("de-DE")}`
                        : "Account details"}
                    </div>
                    {currentUser?.email ? (
                      <div className="draft-settings-list-meta" style={{ marginTop: 6 }}>
                        {currentUser.email}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="draft-settings-list-card">
                  <div className="draft-settings-list-main">
                    <strong>Avatar</strong>
                    <div className="draft-settings-list-meta">
                      Add an image URL if you want your account avatar to appear in account and activity surfaces.
                    </div>
                  </div>
                  <div className="draft-settings-input-row draft-settings-input-row--stack-mobile" style={{ marginTop: 12 }}>
                    <input
                      className="draft-settings-text-input"
                      type="url"
                      placeholder="https://..."
                      value={avatarDraft}
                      onChange={(event) => setAvatarDraft(event.target.value)}
                    />
                    <button
                      type="button"
                      className="draft-settings-action-button"
                      disabled={accountBusy === "avatar"}
                      onClick={() => void saveAvatar()}
                    >
                      {accountBusy === "avatar" ? "Saving..." : "Save avatar URL"}
                    </button>
                  </div>
                  <div className="draft-settings-input-row" style={{ marginTop: 10 }}>
                    <label className="draft-settings-action-button" style={{ display: "inline-flex", cursor: "pointer" }}>
                      {accountBusy === "avatar-upload" ? "Uploading..." : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null
                          void uploadAvatarFile(file)
                          event.target.value = ""
                        }}
                      />
                    </label>
                  </div>
                </div>
              </Section>

              <Section label={t("Security")}>
                <div className="draft-settings-list">
                  <div className="draft-settings-list-card">
                    <div className="draft-settings-list-main">
                      <strong>Password</strong>
                      <div className="draft-settings-list-meta">Change your password with your current credentials.</div>
                    </div>
                    <div className="draft-settings-input-row draft-settings-input-row--stack-mobile" style={{ marginTop: 12 }}>
                      <input
                        className="draft-settings-text-input"
                        type="password"
                        placeholder="Current password"
                        value={currentPasswordInput}
                        onChange={(event) => setCurrentPasswordInput(event.target.value)}
                      />
                      <input
                        className="draft-settings-text-input"
                        type="password"
                        placeholder="New password"
                        value={newPasswordInput}
                        onChange={(event) => setNewPasswordInput(event.target.value)}
                      />
                      <input
                        className="draft-settings-text-input"
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPasswordInput}
                        onChange={(event) => setConfirmPasswordInput(event.target.value)}
                      />
                      <button
                        type="button"
                        className="draft-settings-action-button"
                        disabled={accountBusy === "password"}
                        onClick={() => void changePassword()}
                      >
                        {accountBusy === "password" ? "Updating..." : "Update password"}
                      </button>
                    </div>
                  </div>

                  <div className="draft-settings-list-card">
                    <div className="draft-settings-list-main">
                      <strong>Two-factor authentication</strong>
                      <div className="draft-settings-list-meta">
                        {currentUser?.totp_enabled
                          ? "Authenticator protection is enabled for login."
                          : "Protect login with an authenticator app."}
                      </div>
                    </div>

                    {twoFaSetup ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="draft-settings-list-meta" style={{ marginBottom: 10 }}>
                          Save this secret in your authenticator app, then enter the first 6-digit code to confirm setup.
                        </div>
                        <div className="draft-settings-list-card" style={{ marginBottom: 10 }}>
                          <div className="draft-settings-list-main">
                            <strong>Secret</strong>
                            <div className="draft-settings-list-meta" style={{ wordBreak: "break-all" }}>{twoFaSetup.secret}</div>
                          </div>
                          <button
                            type="button"
                            className="draft-settings-action-button"
                            onClick={() => void copyValue(twoFaSetup.secret, "2FA secret")}
                          >
                            Copy
                          </button>
                        </div>
                        <div className="draft-settings-list-card" style={{ marginBottom: 10 }}>
                          <div className="draft-settings-list-main">
                            <strong>Authenticator URI</strong>
                            <div className="draft-settings-list-meta" style={{ wordBreak: "break-all" }}>{twoFaSetup.otpauth_uri}</div>
                          </div>
                          <button
                            type="button"
                            className="draft-settings-action-button"
                            onClick={() => void copyValue(twoFaSetup.otpauth_uri, "Authenticator URI")}
                          >
                            Copy
                          </button>
                        </div>
                        <div className="draft-settings-input-row draft-settings-input-row--stack-mobile">
                          <input
                            className="draft-settings-text-input"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="000000"
                            value={twoFaCode}
                            onChange={(event) => setTwoFaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          />
                          <button
                            type="button"
                            className="draft-settings-action-button"
                            disabled={accountBusy === "2fa-verify"}
                            onClick={() => void verifyTwoFactorSetup()}
                          >
                            {accountBusy === "2fa-verify" ? "Verifying..." : "Enable 2FA"}
                          </button>
                        </div>
                      </div>
                    ) : currentUser?.totp_enabled ? (
                      <div className="draft-settings-input-row draft-settings-input-row--stack-mobile" style={{ marginTop: 12 }}>
                        <input
                          className="draft-settings-text-input"
                          type="password"
                          placeholder="Password to disable 2FA"
                          value={twoFaDisablePassword}
                          onChange={(event) => setTwoFaDisablePassword(event.target.value)}
                        />
                        <button
                          type="button"
                          className="draft-settings-delete-button"
                          disabled={accountBusy === "2fa-disable"}
                          onClick={() => void disableTwoFactor()}
                        >
                          {accountBusy === "2fa-disable" ? "Disabling..." : "Disable 2FA"}
                        </button>
                      </div>
                    ) : (
                      <div className="draft-settings-input-row" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="draft-settings-action-button"
                          disabled={accountBusy === "2fa-setup"}
                          onClick={() => void setupTwoFactor()}
                        >
                          {accountBusy === "2fa-setup" ? "Preparing..." : "Set up 2FA"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section label={t("Billing & Subscription")}>
                <div className="draft-settings-list-card draft-settings-list-card--highlight">
                  <div className="draft-settings-list-main">
                    <strong>Current plan</strong>
                    <div className="draft-settings-list-meta">
                      {String(currentUser?.plan_id || "basis").toUpperCase()} · {String(currentUser?.plan_status || "active").replace(/_/g, " ")}
                    </div>
                    <div className="draft-settings-list-meta" style={{ marginTop: 6 }}>
                      {t("Available credit")}: €{Number(creditBalance || 0).toFixed(2)} · {t("Recorded AI spend")}: €{creditTransactionSummary.totalSpent.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="draft-settings-action-button"
                    disabled={accountBusy === "portal"}
                    onClick={() => void openBillingPortal()}
                  >
                    {accountBusy === "portal" ? "Opening..." : t("Open Billing Portal")}
                  </button>
                </div>

                {subscriptionPlans.length ? (
                  <div className="draft-settings-list" style={{ marginTop: 12 }}>
                    {subscriptionPlans.map((plan) => {
                      const currentPlanId = String(currentUser?.plan_id || "").toLowerCase()
                      const planId = String(plan.id || "").toLowerCase()
                      const planLabel = String(plan.label || "").toLowerCase()
                      const normalizedCurrent =
                        currentPlanId === "basis" ? "" : currentPlanId
                      const isCurrent =
                        currentUser?.plan_status !== "canceled" &&
                        Boolean(
                          normalizedCurrent &&
                          (
                            planId === normalizedCurrent ||
                            planId.endsWith(`_${normalizedCurrent}`) ||
                            planId.endsWith(`-${normalizedCurrent}`) ||
                            planLabel.includes(normalizedCurrent)
                          )
                        )
                      return (
                        <div key={plan.id} className="draft-settings-list-card">
                          <div className="draft-settings-list-main">
                            <div className="draft-settings-inline" style={{ marginBottom: 4 }}>
                              <strong>{plan.label}</strong>
                              <span className="draft-settings-pill">€{plan.amount_eur}/mo</span>
                              <span className="draft-settings-pill">{plan.project_limit} projects</span>
                            </div>
                            <div className="draft-settings-list-meta">
                              {plan.description} · Includes €{plan.credits_eur.toFixed(2)} monthly AI credit allowance.
                            </div>
                          </div>
                          <button
                            type="button"
                            className="draft-settings-action-button"
                            disabled={isCurrent || accountBusy === `subscribe-${plan.id}`}
                            onClick={() => void startSubscription(plan.id as "starter" | "pro" | "scale")}
                          >
                            {isCurrent ? "Current plan" : accountBusy === `subscribe-${plan.id}` ? "Redirecting..." : `Start ${plan.label}`}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="draft-settings-description" style={{ marginTop: 10, marginBottom: 0 }}>
                    Subscription plans load from the Stripe billing configuration.
                  </p>
                )}

                <div style={{ marginTop: 16 }}>
                  <div className="draft-settings-label">Recent invoices</div>
                  {invoiceRows.length ? (
                    <div className="draft-settings-list">
                      {invoiceRows.map((invoice) => (
                        <div key={invoice.id} className="draft-settings-list-card">
                          <div className="draft-settings-list-main">
                            <div className="draft-settings-inline" style={{ marginBottom: 4 }}>
                              <strong>{invoice.stripe_invoice_id || `Invoice #${invoice.id}`}</strong>
                              <span className="draft-settings-pill">€{Number(invoice.amount_eur || 0).toFixed(2)}</span>
                              <span
                                className={`draft-settings-pill ${
                                  invoice.refunded ? "draft-settings-pill--pending" : "draft-settings-pill--success"
                                }`}
                              >
                                {invoice.refunded ? "Refunded" : invoice.status || "paid"}
                              </span>
                            </div>
                            <div className="draft-settings-list-meta">
                              {new Date(invoice.created_at).toLocaleString("de-DE")}
                            </div>
                          </div>
                          {invoice.receipt_url ? (
                            <a
                              href={invoice.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="draft-settings-action-button"
                              style={{ textDecoration: "none" }}
                            >
                              Receipt
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="draft-settings-description" style={{ marginTop: 10, marginBottom: 0 }}>
                      Invoices will appear here after successful Stripe charges.
                    </p>
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="draft-settings-inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div className="draft-settings-label" style={{ marginBottom: 0 }}>Credit transactions</div>
                    <div className="draft-settings-inline" style={{ gap: 6, flexWrap: "wrap" }}>
                      <button type="button" className={`draft-settings-mini-toggle${creditViewMode === "detailed" ? " is-active" : ""}`} onClick={() => setCreditViewMode("detailed")}>Detailed</button>
                      <button type="button" className={`draft-settings-mini-toggle${creditViewMode === "model" ? " is-active" : ""}`} onClick={() => setCreditViewMode("model")}>By model</button>
                      <button type="button" className={`draft-settings-mini-toggle${creditViewMode === "application" ? " is-active" : ""}`} onClick={() => setCreditViewMode("application")}>By application</button>
                    </div>
                  </div>
                  <p className="draft-settings-description" style={{ marginTop: 0, marginBottom: 10 }}>
                    {t("This makes deductions transparent: detailed shows each charge, model groups by model name, and application groups by task or feature.")}
                  </p>
                  {creditTransactionSummary.rows.length ? (
                    <div className="draft-settings-list">
                      {creditTransactionSummary.rows.slice(0, 25).map((row) => (
                        <div key={row.key} className="draft-settings-list-card">
                          <div className="draft-settings-list-main">
                            <div className="draft-settings-inline" style={{ marginBottom: 4 }}>
                              <strong>{row.label}</strong>
                              <span className={`draft-settings-pill ${row.amount < 0 ? "draft-settings-pill--pending" : "draft-settings-pill--success"}`}>
                                {row.amount < 0 ? "Spend" : "Credit"}
                              </span>
                              {creditViewMode !== "detailed" ? <span className="draft-settings-pill">{row.count} tx</span> : null}
                            </div>
                            <div className="draft-settings-list-meta">{row.detail}</div>
                            {creditViewMode === "detailed" && row.createdAt ? (
                              <div className="draft-settings-list-meta" style={{ marginTop: 6 }}>
                                {new Date(row.createdAt).toLocaleString("de-DE")}
                              </div>
                            ) : null}
                          </div>
                          <div className="draft-settings-credit-amount" data-negative={row.amount < 0 ? "true" : "false"}>
                            {row.amount >= 0 ? "+" : "-"}€{Math.abs(row.amount).toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="draft-settings-description" style={{ marginTop: 10, marginBottom: 0 }}>
                      {t("No credit transactions recorded yet.")}
                    </p>
                  )}
                </div>
              </Section>

              <Section label={t("Notification Preferences")}>
                <SettingRow
                  title={t("Email Updates")}
                  subtitle={t("Receive product news, tips, and feature announcements")}
                  control={
                    <input
                      aria-label={t("Enable email updates")}
                      type="checkbox"
                      checked={notificationPrefs.email_updates}
                      onChange={(event) => {
                        const next = { ...notificationPrefs, email_updates: event.target.checked }
                        setNotificationPrefs(next)
                        void saveProfile({ notification_prefs: next })
                      }}
                    />
                  }
                />
                <SettingRow
                  title={t("Team Mentions")}
                  subtitle={t("Get notified when someone comments on your projects")}
                  control={
                    <input
                      aria-label={t("Enable team mention notifications")}
                      type="checkbox"
                      checked={notificationPrefs.team_mentions}
                      onChange={(event) => {
                        const next = { ...notificationPrefs, team_mentions: event.target.checked }
                        setNotificationPrefs(next)
                        void saveProfile({ notification_prefs: next })
                      }}
                    />
                  }
                />
              </Section>

              <Section label={t("Data & Privacy")}>
                <div className="draft-settings-list">
                  <div className="draft-settings-list-card">
                    <div className="draft-settings-list-main">
                      <strong>GDPR export</strong>
                      <div className="draft-settings-list-meta">
                        Download the account, project, billing, and audit data currently stored for this user.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="draft-settings-action-button"
                      disabled={accountBusy === "export"}
                      onClick={() => void downloadGdprExport()}
                    >
                      {accountBusy === "export" ? "Preparing..." : "Download export"}
                    </button>
                  </div>

                  <div className="draft-settings-list-card">
                    <div className="draft-settings-list-main">
                      <strong>Delete account</strong>
                      <div className="draft-settings-list-meta">
                        Permanently deletes this user and owned data. This action cannot be undone.
                      </div>
                    </div>
                    <div className="draft-settings-input-row draft-settings-input-row--stack-mobile" style={{ marginTop: 12 }}>
                      <input
                        className="draft-settings-text-input"
                        type="password"
                        placeholder="Password to confirm deletion"
                        value={deletePassword}
                        onChange={(event) => setDeletePassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="draft-settings-delete-button"
                        disabled={accountBusy === "delete"}
                        onClick={() => void deleteAccount()}
                      >
                        {accountBusy === "delete" ? "Deleting..." : "Delete account"}
                      </button>
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          ) : null}

          {tab === "apikeys" ? (
            <div className="draft-settings-pane" role="tabpanel" id="tabpanel-apikeys" aria-labelledby="tab-apikeys">
              <p className="draft-settings-description">
                Füge eigene API Keys hinzu. Der Key wird automatisch erkannt und getestet. Deine Keys haben Vorrang vor den
                System-Keys.
              </p>

              <Section label={t("Add key")}>
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
                    {detecting ? t("Check...") : t("Detect")}
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
            </div>
          ) : null}

          {tab === "org" ? (
            <div className="draft-settings-pane" role="tabpanel" id="tabpanel-org" aria-labelledby="tab-org">
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
            </div>
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

function ResultCard({ children }: { children: ReactNode }) {
  return <div className="draft-settings-result-card">{children}</div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="draft-settings-empty">{message}</div>
}

import { useEffect, useState } from "react"
import { apiGetProjects, apiCreateProject, apiDeleteProject, type Project } from "../api/projects"
import { apiSaveProject } from "../api/projects"
import CreditsPanel from "./CreditsPanel"
import SettingsPanel from "./SettingsPanel"
import { apiLogout, type User } from "../api/auth"
import { toast } from "./Toast"

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
  const [demoPlan, setDemoPlan] = useState<"basis"|"starter"|"pro"|"scale">(
    ((localStorage.getItem("se_demo_plan") as "basis"|"starter"|"pro"|"scale") || "basis")
  )
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

  useEffect(() => {
    const syncPlan = () => {
      const p = (localStorage.getItem("se_demo_plan") as "basis"|"starter"|"pro"|"scale") || "basis"
      setDemoPlan(p)
    }
    window.addEventListener("focus", syncPlan)
    return () => window.removeEventListener("focus", syncPlan)
  }, [])

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
    // Try browser-direct first (no-cors just to check if port is open)
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
    // Fallback: no-cors ping (cannot read response but can detect if port open)
    try {
      await fetch("http://localhost:11434", { 
        signal: AbortSignal.timeout(2000),
        mode: "no-cors"
      })
      // If we get here without throwing, port is open
      setOllamaStatus("running")
      toast.success("Ollama läuft ✓")
      return
    } catch {}
    setOllamaStatus("offline")
  }

  const logout = async () => {
    await apiLogout()
    onLogout()
  }

  const generateLandingPage = async () => {
    if (!landingName.trim()) { toast.warning("Produktname erforderlich"); return }
    setLandingGenerating(true)
    try {
      const name = landingName.trim()
      const rawDesc = landingDesc.trim() || "AI-powered workflow platform"
      const rawAudience = landingAudience.trim() || "modern teams"
      const lang = landingLang || "english"

      const titleCase = (v: string) =>
        String(v || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")

      const audienceLabel = titleCase(rawAudience)
      const productLabel = titleCase(name)

      let copy: any = null

      try {
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
        if (data?.ok && data?.copy) {
          copy = data.copy
        }
      } catch {}

      if (!copy) copy = lang === "german"
        ? {
            htmlLang: "de",
            badge: "KI-Workflow-Plattform",
            headline: `${productLabel} für ${audienceLabel}`,
            subheadline: `${productLabel} hilft ${rawAudience}, schneller zu arbeiten, Workflows zu automatisieren und mit weniger Aufwand bessere Ergebnisse zu erzielen.`,
            navFeatures: "Funktionen",
            navProduct: "Produkt",
            navUseCases: "Einsatzbereiche",
            navPricing: "Preise",
            startTrial: "Kostenlos starten",
            seeProduct: "Produkt ansehen",
            stat1: "10x schneller",
            stat1Label: "als klassische Workflows",
            stat2: "72%",
            stat2Label: "schnellere Launch-Zyklen",
            stat3: "24/7",
            stat3Label: "KI-unterstützte Umsetzung",
            featuresEyebrow: "Funktionen",
            featuresTitle: `Alles, was ${rawAudience} brauchen, um schneller voranzukommen`,
            featuresText: "Eine hochwertige Landing-Page-Struktur mit klarer Hierarchie, starkem Wording und moderner Produktpräsentation.",
            feature1Title: "KI-gestützte Workflows",
            feature1Text: `${productLabel} verwandelt wiederkehrende Arbeit in schnellere, hochwertigere Ergebnisse.`,
            feature2Title: "Für Umsetzung gebaut",
            feature2Text: "Klare Sections, modernes Layout und eine Struktur, die sofort launch-ready wirkt.",
            feature3Title: "Conversion-orientiert",
            feature3Text: "Die Seite ist so aufgebaut, dass sie Vertrauen schafft, Mehrwert kommuniziert und Nutzer zur Aktion führt.",
            productEyebrow: "Produkt",
            productTitle: "Eine Premium-Struktur, die vom ersten Tag an überzeugend wirkt",
            productText: "Nutze diese Seite als starken Startpunkt und passe später jede Section weiter an.",
            bullet1Title: "Klare Positionierung",
            bullet1Text: "Headline, Nutzenversprechen und CTA sind dort platziert, wo Nutzer sie erwarten.",
            bullet2Title: "Starke visuelle Hierarchie",
            bullet2Text: "Spacing, Cards und Section-Rhythmus sind auf moderne SaaS-Kommunikation optimiert.",
            bullet3Title: "Einfach anpassbar",
            bullet3Text: "Texte, Preise, Screenshots und Einsatzbereiche lassen sich später schnell austauschen.",
            useEyebrow: "Einsatzbereiche",
            useTitle: "Flexibel einsetzbar für verschiedene Geschäftsmodelle",
            use1Title: "Für SaaS",
            use1Text: "Erkläre Produktwert klar, stärke deine Positionierung und steigere Demo-Anfragen.",
            use2Title: "Für Agenturen",
            use2Text: "Präsentiere Leistungen, Case Studies und Angebote in einer deutlich hochwertigeren Form.",
            use3Title: "Für KI-Tools",
            use3Text: "Kombiniere Produkt-Erklärung, Vertrauen und Pricing in einer modernen Storyline.",
            pricingEyebrow: "Preise",
            pricingTitle: "Einfache Preisstruktur, die mit deinem Wachstum skaliert",
            pricingText: "Nutze diese Preisblöcke als Ausgangspunkt und passe sie später an dein Modell an.",
            getStartedEyebrow: "Loslegen",
            getStartedTitle: `Starte ${productLabel} mit einer Seite, die bereits premium aussieht`,
            getStartedText: "Diese Seite ist als hochwertiger Startpunkt gedacht. Ersetze Texte, passe Blöcke an und optimiere sie danach weiter.",
            footer: `Entwickelt für ${rawAudience} · ${productLabel}`,
            priceNote1: "Perfekt für erste Ergebnisse und schnelle Tests.",
            priceNote2: "Ideal für Teams, die mehr Geschwindigkeit und Qualität wollen.",
            priceNote3: "Für größere Teams mit mehr Launches und höherem Bedarf.",
          }
        : {
            htmlLang: "en",
            badge: "AI workflow platform",
            headline: `${productLabel} for ${audienceLabel}`,
            subheadline: `${productLabel} helps ${rawAudience} work faster, automate workflows and deliver better outcomes with less effort.`,
            navFeatures: "Features",
            navProduct: "Product",
            navUseCases: "Use Cases",
            navPricing: "Pricing",
            startTrial: "Start Free Trial",
            seeProduct: "See Product",
            stat1: "10x faster",
            stat1Label: "than traditional workflows",
            stat2: "72%",
            stat2Label: "faster launch cycles",
            stat3: "24/7",
            stat3Label: "AI-assisted execution",
            featuresEyebrow: "Features",
            featuresTitle: `Everything ${rawAudience} need to move faster`,
            featuresText: "A premium landing page structure with clearer messaging, stronger hierarchy and a more polished product story.",
            feature1Title: "AI-assisted workflows",
            feature1Text: `${productLabel} helps turn repetitive work into faster, higher quality execution.`,
            feature2Title: "Built for execution",
            feature2Text: "Structured sections, modern layout and a product presentation that already feels launch-ready.",
            feature3Title: "Conversion-first layout",
            feature3Text: "The page is designed to build trust, communicate value quickly and drive action.",
            productEyebrow: "Product",
            productTitle: "A premium structure that feels convincing from day one",
            productText: "Use this as your launch base and refine every section later without rebuilding the whole page.",
            bullet1Title: "Clear positioning",
            bullet1Text: "Headline, value proposition and CTA are placed where users expect them.",
            bullet2Title: "Strong visual hierarchy",
            bullet2Text: "Spacing, cards and section rhythm are tuned for a modern SaaS experience.",
            bullet3Title: "Easy to customize",
            bullet3Text: "Swap copy, pricing, screenshots and use cases later without changing the structure.",
            useEyebrow: "Use Cases",
            useTitle: "Designed to work across multiple go-to-market scenarios",
            use1Title: "For SaaS",
            use1Text: "Explain product value clearly, strengthen positioning and drive more demos.",
            use2Title: "For agencies",
            use2Text: "Present services, case studies and offers inside a much more premium-looking shell.",
            use3Title: "For AI tools",
            use3Text: "Combine product education, trust building and pricing in one modern narrative.",
            pricingEyebrow: "Pricing",
            pricingTitle: "Simple pricing that scales with your growth",
            pricingText: "Use these pricing cards as a starting point and adapt them later to your actual business model.",
            getStartedEyebrow: "Get Started",
            getStartedTitle: `Launch ${productLabel} with a page that already looks premium`,
            getStartedText: "This page is meant to be a strong starting point. Replace the copy, adjust the blocks and keep refining from there.",
            footer: `Built for ${rawAudience} · ${productLabel}`,
            priceNote1: "Best for getting started and validating early demand.",
            priceNote2: "Built for teams that want more speed and better execution.",
            priceNote3: "For bigger teams managing more launches and more scale.",
          }

      copy = {
        htmlLang: lang === "german" ? "de" : "en",
        badge: copy.badge || (lang === "german" ? "KI-Workflow-Plattform" : "AI workflow platform"),
        headline: copy.headline || (lang === "german" ? `${productLabel} für ${audienceLabel}` : `${productLabel} for ${audienceLabel}`),
        subheadline: copy.subheadline || copy.featuresText || rawDesc,
        navFeatures: copy.navFeatures || (lang === "german" ? "Funktionen" : "Features"),
        navProduct: copy.navProduct || (lang === "german" ? "Produkt" : "Product"),
        navUseCases: copy.navUseCases || (lang === "german" ? "Einsatzbereiche" : "Use Cases"),
        navPricing: copy.navPricing || (lang === "german" ? "Preise" : "Pricing"),
        startTrial: copy.startTrial || (lang === "german" ? "Kostenlos starten" : "Start Free Trial"),
        seeProduct: copy.seeProduct || (lang === "german" ? "Produkt ansehen" : "See Product"),
        stat1: copy.stat1 || (lang === "german" ? "10x schneller" : "10x faster"),
        stat1Label: copy.stat1Label || (lang === "german" ? "als klassische Workflows" : "than traditional workflows"),
        stat2: copy.stat2 || "72%",
        stat2Label: copy.stat2Label || (lang === "german" ? "schnellere Launch-Zyklen" : "faster launch cycles"),
        stat3: copy.stat3 || "24/7",
        stat3Label: copy.stat3Label || (lang === "german" ? "KI-unterstützte Umsetzung" : "AI-assisted execution"),
        featuresTitle: copy.featuresTitle || (lang === "german" ? `Alles, was ${rawAudience} brauchen, um schneller voranzukommen` : `Everything ${rawAudience} need to move faster`),
        featuresText: copy.featuresText || rawDesc,
        feature1Title: copy.feature1Title || (lang === "german" ? "KI-gestützte Workflows" : "AI-assisted workflows"),
        feature1Text: copy.feature1Text || rawDesc,
        feature2Title: copy.feature2Title || (lang === "german" ? "Für Umsetzung gebaut" : "Built for execution"),
        feature2Text: copy.feature2Text || rawDesc,
        feature3Title: copy.feature3Title || (lang === "german" ? "Conversion-orientiert" : "Conversion-first layout"),
        feature3Text: copy.feature3Text || rawDesc,
        productEyebrow: copy.productEyebrow || (lang === "german" ? "Produkt" : "Product"),
        productTitle: copy.productTitle || (lang === "german" ? "Eine Premium-Struktur, die vom ersten Tag an überzeugt" : "A premium structure that feels convincing from day one"),
        productText: copy.productText || rawDesc,
        bullet1Title: copy.bullet1Title || (lang === "german" ? "Klare Positionierung" : "Clear positioning"),
        bullet1Text: copy.bullet1Text || rawDesc,
        bullet2Title: copy.bullet2Title || (lang === "german" ? "Starke visuelle Hierarchie" : "Strong visual hierarchy"),
        bullet2Text: copy.bullet2Text || rawDesc,
        bullet3Title: copy.bullet3Title || (lang === "german" ? "Einfach anpassbar" : "Easy to customize"),
        bullet3Text: copy.bullet3Text || rawDesc,
        useEyebrow: copy.useEyebrow || (lang === "german" ? "Einsatzbereiche" : "Use Cases"),
        useTitle: copy.useTitle || (lang === "german" ? "Flexibel einsetzbar für verschiedene Geschäftsmodelle" : "Designed to work across multiple go-to-market scenarios"),
        use1Title: copy.use1Title || (lang === "german" ? "Für SaaS" : "For SaaS"),
        use1Text: copy.use1Text || rawDesc,
        use2Title: copy.use2Title || (lang === "german" ? "Für Agenturen" : "For agencies"),
        use2Text: copy.use2Text || rawDesc,
        use3Title: copy.use3Title || (lang === "german" ? "Für KI-Tools" : "For AI tools"),
        use3Text: copy.use3Text || rawDesc,
        pricingEyebrow: copy.pricingEyebrow || (lang === "german" ? "Preise" : "Pricing"),
        pricingTitle: copy.pricingTitle || (lang === "german" ? "Einfache Preisstruktur, die mit deinem Wachstum skaliert" : "Simple pricing that scales with your growth"),
        pricingText: copy.pricingText || rawDesc,
        getStartedEyebrow: copy.getStartedEyebrow || (lang === "german" ? "Loslegen" : "Get Started"),
        getStartedTitle: copy.ctaTitle || copy.getStartedTitle || (lang === "german" ? `Starte ${productLabel} mit einer Seite, die bereits premium aussieht` : `Launch ${productLabel} with a page that already looks premium`),
        getStartedText: copy.ctaText || copy.getStartedText || rawDesc,
        ctaPrimary: copy.ctaPrimary || copy.startTrial || (lang === "german" ? "Kostenlos starten" : "Start Free Trial"),
        ctaSecondary: copy.ctaSecondary || copy.seeProduct || (lang === "german" ? "Mehr erfahren" : "Learn more"),
        pricingStarter: copy.pricingStarter || "Starter",
        pricingPro: copy.pricingPro || "Pro",
        pricingScale: copy.pricingScale || "Scale",
        priceNote1: copy.priceNote1 || (lang === "german" ? "Perfekt für erste Ergebnisse und schnelle Tests." : "Best for getting started and validating early demand."),
        priceNote2: copy.priceNote2 || (lang === "german" ? "Ideal für Teams, die mehr Geschwindigkeit und Qualität wollen." : "Built for teams that want more speed and better execution."),
        priceNote3: copy.priceNote3 || (lang === "german" ? "Für größere Teams mit mehr Launches und mehr Skalierung." : "For bigger teams managing more launches and more scale."),
        footer: copy.footer || (lang === "german" ? `Entwickelt für ${rawAudience} · ${productLabel}` : `Built for ${rawAudience} · ${productLabel}`),
      }

      const safeName = productLabel.replace(/`/g, "")
      const safeDesc = copy.subheadline.replace(/`/g, "")
      const safeAudience = audienceLabel.replace(/`/g, "")

      const html = `<!doctype html>
<html lang="${copy.htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeName}</title>
  <style>
    :root{
      --bg:#0a0f1f;
      --bg-2:#0f172d;
      --panel:rgba(255,255,255,0.05);
      --panel-2:rgba(255,255,255,0.03);
      --line:rgba(255,255,255,0.08);
      --text:#ffffff;
      --muted:rgba(255,255,255,0.68);
      --muted-2:rgba(255,255,255,0.5);
      --brand:#7c3aed;
      --brand-2:#4f46e5;
      --brand-3:#22c55e;
      --shadow:0 30px 80px rgba(0,0,0,0.35);
      --radius:22px;
      --wrap:min(1180px, calc(100% - 40px));
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{
      margin:0;
      font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color:var(--text);
      background:
        radial-gradient(circle at top left, rgba(124,58,237,0.22), transparent 22%),
        radial-gradient(circle at top right, rgba(79,70,229,0.20), transparent 20%),
        linear-gradient(180deg, #0a0f1f 0%, #0c1324 100%);
      line-height:1.5;
    }
    a{text-decoration:none;color:inherit}
    .wrap{width:var(--wrap);margin:0 auto}
    .nav{
      position:sticky;top:0;z-index:30;
      backdrop-filter:blur(16px);
      background:rgba(10,15,31,0.72);
      border-bottom:1px solid rgba(255,255,255,0.06);
    }
    .nav-inner{
      width:var(--wrap);margin:0 auto;height:74px;
      display:flex;align-items:center;justify-content:space-between;gap:20px;
    }
    .brand{
      display:flex;align-items:center;gap:12px;font-weight:900;font-size:18px;letter-spacing:-0.03em;
    }
    .brand-mark{
      width:34px;height:34px;border-radius:11px;
      background:linear-gradient(135deg,var(--brand-2),var(--brand));
      box-shadow:0 12px 30px rgba(99,102,241,0.35);
    }
    .nav-links{
      display:flex;align-items:center;gap:18px;color:var(--muted);font-size:14px;font-weight:600;
    }
    .nav-cta{
      height:42px;padding:0 16px;border-radius:12px;border:none;
      background:linear-gradient(135deg,var(--brand-2),var(--brand));
      color:white;font-weight:800;cursor:pointer;
      box-shadow:0 14px 34px rgba(99,102,241,0.32);
    }
    .hero{
      padding:48px 0 40px;
    }
    .badge{
      display:inline-flex;align-items:center;gap:8px;
      padding:8px 12px;border-radius:999px;
      border:1px solid rgba(129,140,248,0.25);
      background:rgba(99,102,241,0.12);
      color:#c7d2fe;font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
    }
    .hero-grid{
      display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center;
      padding:42px 0 18px;
    }
    h1{
      margin:18px 0 16px;
      font-size:clamp(48px, 8vw, 82px);
      line-height:0.94;
      letter-spacing:-0.055em;
      max-width:820px;
    }
    .sub{
      font-size:18px;
      color:var(--muted);
      max-width:700px;
    }
    .hero-actions{
      display:flex;gap:12px;flex-wrap:wrap;margin-top:28px;
    }
    .btn{
      height:50px;padding:0 18px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:800;cursor:pointer;transition:transform .15s ease, opacity .15s ease;
    }
    .btn:hover{transform:translateY(-1px)}
    .btn-primary{
      border:none;color:white;background:linear-gradient(135deg,var(--brand-2),var(--brand));
      box-shadow:0 16px 40px rgba(99,102,241,0.35);
    }
    .btn-secondary{
      border:1px solid rgba(255,255,255,0.10);color:white;background:rgba(255,255,255,0.04);
    }
    .hero-stats{
      display:flex;gap:24px;flex-wrap:wrap;margin-top:26px;
    }
    .hero-stat .num{font-size:24px;font-weight:900;letter-spacing:-0.04em}
    .hero-stat .label{font-size:12px;color:var(--muted-2)}
    .hero-card{
      position:relative;
      border:1px solid var(--line);
      background:linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03));
      border-radius:26px;
      overflow:hidden;
      box-shadow:var(--shadow);
    }
    .window-top{
      display:flex;align-items:center;gap:8px;padding:16px 18px;border-bottom:1px solid var(--line);
      background:rgba(255,255,255,0.03);
    }
    .dot{width:10px;height:10px;border-radius:999px;background:rgba(255,255,255,0.18)}
    .hero-preview{
      padding:22px;
      display:grid;
      gap:18px;
      background:
        radial-gradient(circle at top right, rgba(124,58,237,0.16), transparent 28%),
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    }
    .mini-nav,.mini-panel,.mini-chart,.mini-cta{
      border:1px solid rgba(255,255,255,0.08);
      background:rgba(255,255,255,0.04);
      border-radius:16px;
    }
    .mini-nav{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
    .mini-logo{width:92px;height:12px;border-radius:999px;background:linear-gradient(90deg,#818cf8,#c084fc)}
    .mini-links{display:flex;gap:8px}
    .mini-links span{width:54px;height:10px;border-radius:999px;background:rgba(255,255,255,0.08);display:block}
    .mini-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}
    .mini-panel{padding:18px}
    .mini-kicker{width:120px;height:11px;border-radius:999px;background:rgba(129,140,248,0.65);margin-bottom:14px}
    .mini-head{width:100%;height:74px;border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,0.24),rgba(168,85,247,0.18));margin-bottom:12px}
    .mini-line{height:12px;border-radius:999px;background:rgba(255,255,255,0.08);margin-bottom:10px}
    .mini-line.short{width:72%}
    .mini-chart{padding:16px;height:100%}
    .bars{display:flex;align-items:flex-end;gap:10px;height:120px}
    .bar{flex:1;border-radius:12px 12px 6px 6px;background:linear-gradient(180deg,#8b5cf6,#4f46e5)}
    .bar:nth-child(1){height:45%}
    .bar:nth-child(2){height:64%}
    .bar:nth-child(3){height:78%}
    .bar:nth-child(4){height:58%}
    .bar:nth-child(5){height:88%}
    .mini-cta{padding:16px;display:flex;align-items:center;justify-content:space-between}
    .mini-pill{width:120px;height:12px;border-radius:999px;background:rgba(255,255,255,0.08)}
    .mini-btn{width:90px;height:34px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6)}
    .logo-strip{
      padding:18px 0 6px;
    }
    .logos{
      display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;
    }
    .logo{
      height:62px;border-radius:16px;border:1px solid var(--line);
      background:rgba(255,255,255,0.03);
      display:flex;align-items:center;justify-content:center;
      color:rgba(255,255,255,0.52);font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
    }
    .section{
      padding:88px 0;
      border-top:1px solid rgba(255,255,255,0.05);
    }
    .section-head{
      max-width:760px;margin-bottom:28px;
    }
    .eyebrow{
      font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc;margin-bottom:10px;
    }
    h2{
      margin:0 0 12px;
      font-size:clamp(32px,5vw,52px);
      line-height:1.02;
      letter-spacing:-0.05em;
    }
    .muted{color:var(--muted);font-size:16px}
    .feature-grid{
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;
    }
    .feature{
      padding:22px;border-radius:20px;border:1px solid var(--line);
      background:linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03));
      box-shadow:0 10px 30px rgba(0,0,0,0.15);
    }
    .feature-icon{
      width:44px;height:44px;border-radius:14px;margin-bottom:16px;
      display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg, rgba(99,102,241,0.22), rgba(168,85,247,0.18));
      border:1px solid rgba(129,140,248,0.22);
      font-size:18px;font-weight:900;color:#e9d5ff;
    }
    .feature h3,.use-card h3,.price-card h3{margin:0 0 8px;font-size:18px;letter-spacing:-0.03em}
    .demo{
      display:grid;grid-template-columns:.95fr 1.05fr;gap:22px;align-items:center;
    }
    .demo-copy{display:grid;gap:14px}
    .bullet{
      display:flex;gap:12px;align-items:flex-start;
      padding:14px 16px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,0.03);
    }
    .bullet-mark{
      width:28px;height:28px;border-radius:10px;background:rgba(34,197,94,0.16);
      color:#86efac;display:flex;align-items:center;justify-content:center;font-weight:900;flex-shrink:0;
    }
    .demo-shot{
      border-radius:24px;border:1px solid var(--line);overflow:hidden;
      background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.03));
      box-shadow:var(--shadow);
    }
    .shot-top{
      height:58px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 18px
    }
    .shot-sidebar{
      display:grid;grid-template-columns:180px 1fr;min-height:360px
    }
    .side{
      border-right:1px solid var(--line);padding:18px;background:rgba(255,255,255,0.02)
    }
    .side-row,.main-row{
      height:12px;border-radius:999px;background:rgba(255,255,255,0.08);margin-bottom:12px
    }
    .side-row:nth-child(1){width:75%}
    .side-row:nth-child(2){width:60%}
    .side-row:nth-child(3){width:82%}
    .main{padding:18px}
    .canvas{
      height:110px;border-radius:18px;background:linear-gradient(135deg, rgba(99,102,241,0.22), rgba(168,85,247,0.16));margin-bottom:16px
    }
    .main-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .mini-box{height:88px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid var(--line)}
    .use-grid,.pricing{
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;
    }
    .use-card,.price-card{
      padding:22px;border-radius:20px;border:1px solid var(--line);background:rgba(255,255,255,0.04);
    }
    .price-card.featured{
      background:linear-gradient(180deg, rgba(99,102,241,0.16), rgba(168,85,247,0.10));
      border-color:rgba(129,140,248,0.24);
      transform:translateY(-4px);
      box-shadow:0 20px 40px rgba(99,102,241,0.18);
    }
    .top-tag{
      display:inline-flex;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:900;
      background:rgba(99,102,241,0.16);color:#c7d2fe;border:1px solid rgba(129,140,248,0.25);margin-bottom:12px;
    }
    .price{
      font-size:48px;font-weight:900;letter-spacing:-0.05em;line-height:1;margin:12px 0 6px;
    }
    .price small{font-size:14px;color:var(--muted-2);font-weight:700;margin-left:6px}
    ul{padding-left:18px;margin:16px 0 0;color:var(--muted)}
    li+li{margin-top:8px}
    .cta{
      padding:92px 0 104px;
      text-align:center;
      background:
        radial-gradient(circle at top, rgba(99,102,241,0.18), transparent 30%),
        linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.00));
    }
    .cta-box{
      padding:36px;border-radius:28px;border:1px solid var(--line);
      background:linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03));
      box-shadow:var(--shadow);
    }
    .footer{
      padding:24px 0 48px;color:var(--muted-2);font-size:13px;text-align:center;
    }
    @media (max-width: 980px){
      .hero-grid,.demo,.shot-sidebar{grid-template-columns:1fr}
      .feature-grid,.use-grid,.pricing,.logos,.main-grid{grid-template-columns:1fr}
      .nav-links{display:none}
      h1{font-size:54px}
    }
  </style>
</head>
<body>
  <header class="nav">
    <div class="nav-inner">
      <div class="brand">
        <div class="brand-mark"></div>
        <span>${safeName}</span>
      </div>
      <nav class="nav-links">
        <a href="#features">${copy.navFeatures}</a>
        <a href="#product">${copy.navProduct}</a>
        <a href="#use-cases">${copy.navUseCases}</a>
        <a href="#pricing">${copy.navPricing}</a>
      </nav>
      <button class="nav-cta">${copy.startTrial}</button>
    </div>
  </header>

  <section class="hero">
    <div class="wrap">
      <span class="badge">${copy.badge}</span>

      <div class="hero-grid">
        <div>
          <h1>${copy.headline}</h1>
          <p class="sub">${copy.subheadline}</p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="#pricing">${copy.startTrial}</a>
            <a class="btn btn-secondary" href="#product">${copy.seeProduct}</a>
          </div>

          <div class="hero-stats">
            <div class="hero-stat">
              <div class="num">${copy.stat1}</div>
              <div class="label">${copy.stat1Label}</div>
            </div>
            <div class="hero-stat">
              <div class="num">72%</div>
              <div class="label">${copy.stat2Label}</div>
            </div>
            <div class="hero-stat">
              <div class="num">24/7</div>
              <div class="label">${copy.stat3Label}</div>
            </div>
          </div>
        </div>

        <div class="hero-card">
          <div class="window-top">
            <div class="dot"></div><div class="dot"></div><div class="dot"></div>
          </div>
          <div class="hero-preview">
            <div class="mini-nav">
              <div class="mini-logo"></div>
              <div class="mini-links"><span></span><span></span><span></span></div>
            </div>
            <div class="mini-grid">
              <div class="mini-panel">
                <div class="mini-kicker"></div>
                <div class="mini-head"></div>
                <div class="mini-line"></div>
                <div class="mini-line short"></div>
              </div>
              <div class="mini-chart">
                <div class="bars">
                  <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
                </div>
              </div>
            </div>
            <div class="mini-cta">
              <div class="mini-pill"></div>
              <div class="mini-btn"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="logo-strip">
        <div class="logos">
          <div class="logo">Notion</div>
          <div class="logo">Linear</div>
          <div class="logo">Stripe</div>
          <div class="logo">Figma</div>
          <div class="logo">Vercel</div>
        </div>
      </div>
    </div>
  </section>

  <section id="features" class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">${copy.featuresEyebrow}</div>
        <h2>${copy.featuresTitle}</h2>
        <div class="muted">${copy.featuresText}</div>
      </div>

      <div class="feature-grid">
        <div class="feature">
          <div class="feature-icon">✦</div>
          <h3>${copy.feature1Title}</h3>
          <div class="muted">${copy.feature1Text}</div>
        </div>
        <div class="feature">
          <div class="feature-icon">◎</div>
          <h3>${copy.feature2Title}</h3>
          <div class="muted">${copy.feature2Text}</div>
        </div>
        <div class="feature">
          <div class="feature-icon">↗</div>
          <h3>${copy.feature3Title}</h3>
          <div class="muted">${copy.feature3Text}</div>
        </div>
      </div>
    </div>
  </section>

  <section id="product" class="section">
    <div class="wrap">
      <div class="demo">
        <div class="demo-copy">
          <div class="eyebrow">${copy.productEyebrow}</div>
          <h2>${copy.productTitle}</h2>
          <div class="muted">${copy.productText}</div>

          <div class="bullet">
            <div class="bullet-mark">1</div>
            <div>
              <strong>${copy.bullet1Title}</strong>
              <div class="muted">${copy.bullet1Text}</div>
            </div>
          </div>

          <div class="bullet">
            <div class="bullet-mark">2</div>
            <div>
              <strong>${copy.bullet2Title}</strong>
              <div class="muted">${copy.bullet2Text}</div>
            </div>
          </div>

          <div class="bullet">
            <div class="bullet-mark">3</div>
            <div>
              <strong>${copy.bullet3Title}</strong>
              <div class="muted">${copy.bullet3Text}</div>
            </div>
          </div>
        </div>

        <div class="demo-shot">
          <div class="shot-top">
            <div class="mini-logo" style="width:110px"></div>
            <div class="mini-pill" style="width:88px"></div>
          </div>
          <div class="shot-sidebar">
            <div class="side">
              <div class="side-row"></div>
              <div class="side-row"></div>
              <div class="side-row"></div>
              <div class="side-row" style="width:64%"></div>
            </div>
            <div class="main">
              <div class="canvas"></div>
              <div class="main-row" style="width:82%"></div>
              <div class="main-row" style="width:62%"></div>
              <div class="main-grid">
                <div class="mini-box"></div>
                <div class="mini-box"></div>
                <div class="mini-box"></div>
                <div class="mini-box"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="use-cases" class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">${copy.useEyebrow}</div>
        <h2>${copy.useTitle}</h2>
      </div>

      <div class="use-grid">
        <div class="use-card">
          <h3>${copy.use1Title}</h3>
          <div class="muted">${copy.use1Text}</div>
        </div>
        <div class="use-card">
          <h3>${copy.use2Title}</h3>
          <div class="muted">${copy.use2Text}</div>
        </div>
        <div class="use-card">
          <h3>${copy.use3Title}</h3>
          <div class="muted">${copy.use3Text}</div>
        </div>
      </div>
    </div>
  </section>

  <section id="pricing" class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">${copy.pricingEyebrow}</div>
        <h2>${copy.pricingTitle}</h2>
        <div class="muted">${copy.pricingText}</div>
      </div>

      <div class="pricing">
        <div class="price-card">
          <h3>${copy.pricingStarter}</h3>
          <div class="price">€19<small>/mo</small></div>
          <div class="muted">${copy.priceNote1}</div>
          <ul>
            <li>Core workflow access</li>
            <li>Basic team collaboration</li>
            <li>Up to 3 active projects</li>
          </ul>
        </div>

        <div class="price-card featured">
          <div class="top-tag">Most Popular</div>
          <h3>${copy.pricingPro}</h3>
          <div class="price">€49<small>/mo</small></div>
          <div class="muted">${copy.priceNote2}</div>
          <ul>
            <li>Advanced workflow automation</li>
            <li>Full editing flexibility</li>
            <li>Priority support and scaling</li>
          </ul>
        </div>

        <div class="price-card">
          <h3>${copy.pricingScale}</h3>
          <div class="price">€99<small>/mo</small></div>
          <div class="muted">${copy.priceNote3}</div>
          <ul>
            <li>Higher usage limits</li>
            <li>Team-level collaboration</li>
            <li>Premium onboarding support</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <div class="cta-box">
        <div class="eyebrow">${copy.getStartedEyebrow}</div>
        <h2>${copy.getStartedTitle}</h2>
        <div class="muted" style="max-width:760px;margin:0 auto 26px;">${copy.getStartedText}</div>
        <div class="hero-actions" style="justify-content:center;">
          <a class="btn btn-primary" href="#">${copy.startTrial}</a>
          <a class="btn btn-secondary" href="#features">${copy.ctaSecondary}</a>
        </div>
      </div>
    </div>
  </section>

  <div class="footer">
    ${copy.footer}
  </div>
</body>
</html>`

      const id = await apiCreateProject(name, "", html)
      const project: Project = {
        id,
        name,
        url: "",
        html,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      toast.success("Landing Page erstellt")
      setShowLandingGen(false)
      setLandingName("")
      setLandingDesc("")
      setLandingAudience("")
      setLandingLang("english")
      await load()
      onOpen(project)
    } catch (e: any) {
      toast.error(e.message || "Landing Page konnte nicht erstellt werden")
    } finally {
      setLandingGenerating(false)
    }
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
                {activePlanMeta.price}
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
                      { title: "Terminal öffnen & starten", cmd: "ollama serve" },
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
            }}
          >
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
                onClick={generateLandingPage}
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
                {landingGenerating ? "Generating..." : "Generate"}
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

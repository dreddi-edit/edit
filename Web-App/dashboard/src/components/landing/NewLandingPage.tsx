import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { AVAILABLE_UI_LANGUAGES, useRuntimeTranslations, useTranslation } from "../../i18n/useTranslation"
import { applyThemeToDocument, persistThemeChoice } from "../../utils/theme"
import "./new-landing.css"

interface NewLandingPageProps {
  onEnter: () => void
  onDemoRequest?: () => void
  onLearn?: () => void
  theme?: "dark" | "light"
  onToggleTheme?: () => void
}

/* ── Intersection Observer hook ─────────────────────────── */
function useVisible(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ── Static data ─────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "⬇",
    tag: "Import",
    title: "Any site, in minutes",
    body: "Paste a URL. Upload a ZIP, HTML, PDF, or screenshot. Reframe parses every page, extracts assets, and reconstructs your project as an editable block tree automatically.",
    items: ["Live URL crawl + sitemap", "ZIP / HTML / PDF / screenshot", "WordPress-aware parsing", "Asset + font localisation"],
  },
  {
    icon: "✦",
    tag: "AI Editing",
    title: "Context-aware AI rewrites",
    body: "Unlike pasting into ChatGPT, Reframe's AI knows the exact page, block, brand voice, and workflow stage. Select a block. Write an instruction. Accept or reject with a diff view.",
    items: ["Claude · Gemini · Groq · Ollama", "6 tone presets", "Before/after diff view", "Auto-snapshot before every edit"],
  },
  {
    icon: "⤴",
    tag: "Export",
    title: "11 formats. One click.",
    body: "Stop reformatting work for every client's tech stack. Reframe compiles your project into the format they need, validated, with SEO preserved and a manifest included.",
    items: ["WordPress Theme + Gutenberg Blocks", "Shopify Liquid Sections", "React JSX · Webflow JSON", "Email HTML · Markdown · Web Component"],
  },
  {
    icon: "🌍",
    tag: "Translation",
    title: "All languages, layout intact",
    body: "Translate any page without touching the DOM structure. Language variants stay isolated so teams can switch markets instantly without rework.",
    items: ["DOM-preserving translation", "All languages", "Manual segment overrides", "Language-variant share links"],
  },
  {
    icon: "⚡",
    tag: "Deploy",
    title: "One-click delivery",
    body: "Push directly to Firebase, Netlify, Vercel, WordPress, or Shopify from inside Reframe. Every deployment is saved with full rollback support.",
    items: ["Firebase · Netlify · Vercel", "WordPress REST API", "Shopify Assets API", "Deploy history + one-click rollback"],
  },
  {
    icon: "👥",
    tag: "Teams",
    title: "Built for agency workflows",
    body: "RBAC roles, client share links, approval queues, audit logs, and version history. The ops layer agencies were building manually across Notion, email, and Dropbox.",
    items: ["Owner · Admin · Editor · Viewer", "Client share links (no account)", "Approval queue", "Full audit + version history"],
  },
]

const COMPETITOR_PROFILES = [
  {
    key: "wf",
    name: "Webflow",
    tagline: "Great for building from scratch. Helpless with existing sites.",
    points: [
      "Can't import a client's existing WordPress or Shopify site",
      "No context-aware AI — doesn't know your project, blocks, or brand",
      "Exports only to Webflow hosting. Reframe exports to 11 formats.",
      "No approval queue, audit log, or agency RBAC",
    ],
    verdict: "Reframe wins every task that starts with an existing site.",
  },
  {
    key: "fr",
    name: "Framer",
    tagline: "Beautiful for portfolios. Zero operations layer.",
    points: [
      "No import from live URLs, ZIPs, or existing HTML files",
      "AI generates template sections — not context-aware rewrites of your content",
      "Output: Framer hosting only. No WordPress, Shopify, React, or Email.",
      "No client workflows: no share links, no approvals, no audit log",
    ],
    verdict: "Reframe covers everything Framer offers, plus the full ops layer.",
  },
  {
    key: "wp",
    name: "WordPress + Elementor",
    tagline: "Most-used CMS. A maze for multi-format delivery.",
    points: [
      "Importing a non-WP site means manual rebuild or fragile plugins",
      "AI completions are generic template fills — no project context",
      "Export to Shopify, React, Email, Webflow requires custom dev work",
      "Version control is basic; no approval queue or structured audit trail",
    ],
    verdict: "Build in Reframe. Output to WordPress — it's one of 11 formats.",
  },
  {
    key: "ai",
    name: "ChatGPT / AI tools",
    tagline: "Powerful brain. No hands. No memory of your actual site.",
    points: [
      "Paste-based workflow: AI has zero knowledge of your real page structure",
      "No export, no deploy, no version control — copy-paste is the pipeline",
      "Brand context, block tree, project state: all missing",
      "Token cost is invisible; no approval gates, no rollback",
    ],
    verdict: "Reframe wraps the same AI models — with your actual site loaded.",
  },
]

type CellVal = boolean | "±"
const COMPARE_ROWS_EXT: Array<{ cat: string; label: string; rf: CellVal; wf: CellVal; fr: CellVal; wp: CellVal; ai: CellVal }> = [
  { cat: "Import", label: "Import site from live URL",                              rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "Import", label: "Import ZIP / HTML / PDF / screenshot",                   rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "Import", label: "Multi-page crawl + asset extraction",                    rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "Import", label: "WordPress-aware parsing",                                rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "AI",     label: "Visual block editor",                                    rf: true, wf: true,  fr: true,   wp: true,  ai: false },
  { cat: "AI",     label: "AI rewrites with full project context",                  rf: true, wf: false, fr: "±",    wp: "±",  ai: false },
  { cat: "AI",     label: "Multiple AI models (Claude · Gemini · Groq · Ollama)",   rf: true, wf: false, fr: false,  wp: false, ai: "±"  },
  { cat: "AI",     label: "Cost per AI action shown before commit",                 rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "AI",     label: "Approval gate + auto-snapshot before every edit",        rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "AI",     label: "Self-hosted AI (Ollama) — zero marginal AI cost",        rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "Export", label: "11 export formats",                                      rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "Export", label: "WordPress theme (.zip, installable)",                    rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "Export", label: "Shopify Liquid sections",                                rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "Export", label: "Webflow JSON export",                                    rf: true, wf: true,  fr: false,  wp: false, ai: false },
  { cat: "Export", label: "React / JSX export",                                     rf: true, wf: false, fr: "±",    wp: false, ai: false },
  { cat: "Export", label: "Email HTML export",                                      rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "Global", label: "Translation — all languages, DOM-preserving",            rf: true, wf: "±",   fr: "±",    wp: "±",  ai: "±"  },
  { cat: "Global", label: "One-click deploy (Firebase / Netlify / Vercel / WP / Shopify)", rf: true, wf: "±", fr: "±", wp: "±", ai: false },
  { cat: "Global", label: "Deploy history + one-click rollback",                    rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "Agency", label: "RBAC roles (Owner · Admin · Editor · Viewer)",           rf: true, wf: "±",   fr: false,  wp: "±",  ai: false },
  { cat: "Agency", label: "Client share links (no account needed)",                 rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "Agency", label: "Approval queue",                                         rf: true, wf: false, fr: false,  wp: false, ai: false },
  { cat: "Agency", label: "Full audit + version history",                           rf: true, wf: false, fr: false,  wp: "±",  ai: false },
  { cat: "Pricing", label: "Pay per AI usage, not per project or seat",             rf: true, wf: false, fr: false,  wp: "±",  ai: "±"  },
  { cat: "Pricing", label: "Self-hosted AI option (zero marginal AI cost)",         rf: true, wf: false, fr: false,  wp: false, ai: false },
]

const COMPARE_COLS = [
  { key: "rf" as const, label: "Reframe" },
  { key: "wf" as const, label: "Webflow" },
  { key: "fr" as const, label: "Framer" },
  { key: "wp" as const, label: "WP+Elementor" },
  { key: "ai" as const, label: "ChatGPT" },
]

type CompareKey = "rf" | "wf" | "fr" | "wp" | "ai"

function scoreCell(v: CellVal) {
  if (v === true) return 1
  if (v === "±") return 0.5
  return 0
}

const PLANS = [
  {
    name: "Basis",
    price: "Free",
    per: null,
    sub: "3 projects · basic AI",
    featured: false,
    items: ["URL import + ZIP upload", "Visual block editor", "HTML export", "Claude Haiku AI"],
    missing: ["Advanced exports", "Translation", "AI Studio"],
  },
  {
    name: "Starter",
    price: "€15",
    per: "/mo",
    sub: "5 projects · €16.50 credits",
    featured: false,
    items: ["All 11 export formats", "Translation · all languages", "Version history", "Claude Haiku AI"],
    missing: ["AI Studio tools", "Teams"],
  },
  {
    name: "Pro",
    price: "€30",
    per: "/mo",
    sub: "20 projects · €34.50 credits",
    featured: true,
    items: ["Claude Sonnet AI", "Full AI Studio", "One-click deploy", "Teams + approvals", "Client share links"],
    missing: [],
  },
  {
    name: "Scale",
    price: "€100",
    per: "/mo",
    sub: "Unlimited · €120 credits",
    featured: false,
    items: ["Claude Opus AI", "Unlimited projects", "Admin console + audit log", "API key management", "Dedicated onboarding"],
    missing: [],
  },
]

type CurrencyData = {
  sym: string; starter: string; pro: string; scale: string; starterCredits: string; proCredits: string; scaleCredits: string
  rateDefault: number; rateMin: number; rateMax: number; rateStep: number; proAnnualNum: number; roiProAnnualLabel: string
}
const CURRENCY_MAP: Record<string, CurrencyData> = {
  _default: { sym: "€",   starter: "€15",       pro: "€30",       scale: "€100",        starterCredits: "€16.50",    proCredits: "€34.50",    scaleCredits: "€120",       rateDefault: 95,     rateMin: 30,     rateMax: 250,     rateStep: 5,     proAnnualNum: 360,      roiProAnnualLabel: "€360/year" },
  en:       { sym: "$",   starter: "$17",       pro: "$34",       scale: "$109",        starterCredits: "$19",       proCredits: "$39",       scaleCredits: "$129",       rateDefault: 115,    rateMin: 40,     rateMax: 300,     rateStep: 5,     proAnnualNum: 408,      roiProAnnualLabel: "$408/year" },
}
function getCurrencyData(lang: string): CurrencyData {
  return CURRENCY_MAP[lang] ?? CURRENCY_MAP._default
}

const FAQS = [
  { q: "Is Reframe a website builder like Webflow?", a: "No. Reframe is a site operations platform for agencies that work with existing sites. Webflow assumes you start from scratch; Reframe assumes you start from a client's URL. We export to Webflow JSON, so they are complementary, not competing." },
  { q: "What kinds of sites can I import?", a: "Any live URL, ZIP archive, single HTML file, PDF brief, or screenshot. The import engine is WordPress-aware, handles multi-page crawls, and auto-localises assets and fonts." },
  { q: "How is the AI different from just using Claude or ChatGPT?", a: "Context. When you use a chat interface, the AI has no idea what site it is editing, what brand it belongs to, or what stage the project is at. Reframe injects real page structure, brand context, and workflow state into every AI call with cost tracking, approval gates, and version snapshots before every action." },
  { q: "Does the WordPress Theme export actually install?", a: "Yes. The export generates an installable .zip with the correct theme hierarchy, functions.php, style.css header, and asset references. The Block export produces native Gutenberg markup." },
  { q: "How much does API usage cost?", a: "Credits only deduct when you run AI, not for editing, storing, or exporting. Each plan includes a monthly credit balance. You can see exact cost per action before approving it." },
]

const LANDING_RUNTIME_STRINGS = [
  ...FEATURES.flatMap(f => [f.tag, f.title, f.body, ...f.items]),
  ...COMPARE_ROWS_EXT.map(r => r.label),
  ...COMPARE_ROWS_EXT.map(r => r.cat),
  ...COMPETITOR_PROFILES.flatMap(p => [p.tagline, ...p.points, p.verdict]),
  ...PLANS.flatMap(p => [p.name, p.sub, ...(p.per ? [p.per] : []), ...p.items, ...p.missing]),
  ...FAQS.flatMap(f => [f.q, f.a]),
  "Features", "Compare", "Pricing", "FAQ", "Early access", "Sign in", "Learn", "Start free",
  "Early access · Agency-first", "The website", "operations", "system.",
  "Import any existing website. Edit it visually with AI.",
  "Launch in whatever format and market your client needs.",
  "Start free - no card", "export formats", "all languages", "hours saved/project", "All",
  "How it works", "Four steps. One system.", "Import", "Understand", "Edit + AI", "Export + Deploy",
  "Everything agencies need.", "Nothing they don't.", "How Reframe fits in.", "Coverage matrix",
  "Capability category", "Coverage intensity", "High", "Medium", "Low",
  "Honest comparison for agencies that start with existing sites, not agencies building from scratch.",
  "site operations capabilities", "No other tool covers the full stack.", "capability coverage",
  "End-to-end delivery", "Import -> AI rewrite -> multi-format export -> one-click deploy in one workflow.",
  "Agency operations", "RBAC, approvals, share links and audit history are native, not patched together.",
  "Cost control", "Pay only for AI usage and optionally run self-hosted models with near-zero marginal cost.",
  "Capability", "Reframe", "Webflow", "Framer", "WP + Elementor", "ChatGPT",
  "ROI Calculator", "Calculate your margin recovery.", "Drag the sliders to match your workload.",
  "Pay for AI. Not for projects.", "Credits deduct only when you run AI, not for editing, exporting, or storing.",
  "Most popular", "Start free", "Get started", "Common questions.", "Get in early.",
  "We're onboarding the first wave of agencies manually, each with a live demo call and a direct line to the team.",
  "Leave your email and we'll reach out within 48 hours.",
  "We'll reach out within 48 hours with early-access details and a live demo offer.",
  "You're on the list.", "Already have an account?",
  "Contact", "Request early access ->", "Sending...",
  "Digital agency", "Freelancer", "In-house team", "Investor", "Other", "your@email.com",
  "Anything specific you want to see? (optional)",
  "Migrations / month", "Manual hours / project", "Hourly rate", "recovered annually", "Reframe Pro costs", "ROI",
  "Comparison", "60s demo", "Guided walkthrough", "Language", "Menu", "Light", "Dark", "Get started",
  "Import. Edit. Export.", "© 2025 Reframe · Early access",
  "vs", "Hover a competitor to compare", "Show detail table", "Hide table",
]

/* ── Sub-components ─────────────────────────────────────── */
function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const { ref, visible } = useVisible()
  return (
    <div
      ref={ref}
      className={`nlp-feat${visible ? " nlp-feat--visible" : ""}`}
      style={{ transitionDelay: `${(index % 3) * 60}ms` }}
    >
      <div className="nlp-feat__icon">{feature.icon}</div>
      <div className="nlp-feat__tag">{feature.tag}</div>
      <div className="nlp-feat__title">{feature.title}</div>
      <div className="nlp-feat__body">{feature.body}</div>
      <ul className="nlp-feat__list">
        {feature.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  )
}

function AnimStat({ n, label, suffix = "", display }: { n: number; label: string; suffix?: string; display?: string }) {
  const { ref, visible } = useVisible()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = Math.ceil(n / 40)
    const t = setInterval(() => {
      start = Math.min(start + step, n)
      setCount(start)
      if (start >= n) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [visible, n])
  return (
    <div ref={ref} className="nlp-hero__stat">
      <span className="nlp-stat-num">{display ?? `${count}${suffix}`}</span>
      <span className="nlp-stat-label">{label}</span>
    </div>
  )
}

function ROICalc({ c }: { c: CurrencyData }) {
  const [projects, setProjects] = useState(4)
  const [hours, setHours] = useState(35)
  const [rate, setRate] = useState(c.rateDefault)
  const { ref, visible } = useVisible()
  const { t, lang } = useTranslation()
  const rt = useRuntimeTranslations(lang, LANDING_RUNTIME_STRINGS, t)
  const saved = Math.round(projects * hours * rate * 0.85 * 12)
  const roiX = Math.max(1, Math.round(saved / c.proAnnualNum))
  return (
    <div ref={ref} className={`nlp-roi${visible ? " nlp-roi--visible" : ""}`}>
      <div className="nlp-roi__sliders">
        <div className="nlp-roi__slider">
          <label>
            <span>{rt("Migrations / month")}</span>
            <strong>{projects}</strong>
            <input type="range" min={1} max={20} value={projects} onChange={e => setProjects(Number(e.target.value))} />
          </label>
        </div>
        <div className="nlp-roi__slider">
          <label>
            <span>{rt("Manual hours / project")}</span>
            <strong>{hours}h</strong>
            <input type="range" min={5} max={80} value={hours} onChange={e => setHours(Number(e.target.value))} />
          </label>
        </div>
        <div className="nlp-roi__slider">
          <label>
            <span>{rt("Hourly rate")} ({c.sym})</span>
            <strong>{c.sym}{rate.toLocaleString()}</strong>
            <input type="range" min={c.rateMin} max={c.rateMax} step={c.rateStep} value={rate} onChange={e => setRate(Number(e.target.value))} />
          </label>
        </div>
      </div>
      <div className="nlp-roi__result">
        <div className="nlp-roi__num">{c.sym}{saved.toLocaleString()}</div>
        <div className="nlp-roi__num-label">{rt("recovered annually")}</div>
        <div className="nlp-roi__meta">
          {rt("Reframe Pro costs")} {c.roiProAnnualLabel}.<br />
          {rt("ROI")}: <strong>{roiX}x</strong>
        </div>
      </div>
    </div>
  )
}

function InquiryForm() {
  const [email, setEmail] = useState("")
  const [type, setType] = useState("agency")
  const [msg, setMsg] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t, lang } = useTranslation()
  const rt = useRuntimeTranslations(lang, LANDING_RUNTIME_STRINGS, t)

  const submit = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type, message: msg }),
      })
    } catch { /* ignore */ }
    finally { setSent(true); setLoading(false) }
  }

  if (sent) return (
    <div className="nlp-inquiry__sent">
      <div className="nlp-inquiry__sent-check">✓</div>
      <div className="nlp-inquiry__sent-text">
        <strong>{rt("You're on the list.")}</strong>
        <p>{rt("We'll reach out within 48 hours with early-access details and a live demo offer.")}</p>
      </div>
    </div>
  )

  return (
    <div className="nlp-inquiry">
      <select value={type} onChange={e => setType(e.target.value)} className="nlp-inquiry__select">
        <option value="agency">{rt("Digital agency")}</option>
        <option value="freelancer">{rt("Freelancer")}</option>
        <option value="inhouse">{rt("In-house team")}</option>
        <option value="investor">{rt("Investor")}</option>
        <option value="other">{rt("Other")}</option>
      </select>
      <input
        type="email"
        placeholder={rt("your@email.com")}
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        className="nlp-inquiry__input"
      />
      <textarea
        placeholder={rt("Anything specific you want to see? (optional)")}
        value={msg}
        onChange={e => setMsg(e.target.value)}
        className="nlp-inquiry__textarea"
        rows={2}
      />
      <button onClick={submit} disabled={loading || !email.trim()} className="nlp-inquiry__btn">
        {loading ? rt("Sending...") : rt("Request early access ->")}
      </button>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`nlp-faq__item${open ? " nlp-faq__item--open" : ""}`} onClick={() => setOpen(o => !o)}>
      <div className="nlp-faq__q">
        {q}
        <span className="nlp-faq__icon">{open ? "−" : "+"}</span>
      </div>
      {open && <div className="nlp-faq__a">{a}</div>}
    </div>
  )
}

/* ── Interactive Heatmap ─────────────────────────────────── */
function InteractiveHeatmap({ rt }: { rt: (s: string) => string }) {
  const [hoveredCol, setHoveredCol] = useState<CompareKey | null>(null)
  const [showTable, setShowTable] = useState(false)

  const categories = useMemo(() => Array.from(new Set(COMPARE_ROWS_EXT.map(r => r.cat))), [])

  const getColClass = useCallback((key: CompareKey) => {
    if (!hoveredCol) return ""
    if (key === hoveredCol) return "nlp-heatmap-colhead--active"
    return ""
  }, [hoveredCol])

  const getCellClass = useCallback((key: CompareKey, val: CellVal) => {
    const base = key === "rf" ? "nlp-heatmap-cell--reframe " : ""
    const valClass = val === true ? "nlp-heatmap-cell--yes" : val === "±" ? "nlp-heatmap-cell--partial" : "nlp-heatmap-cell--no"
    if (!hoveredCol) return base + valClass
    if (key === hoveredCol) return base + valClass + " nlp-heatmap-cell--col-active"
    if (key === "rf") return base + valClass
    return base + valClass + " nlp-heatmap-cell--col-inactive"
  }, [hoveredCol])

  return (
    <div>
      {/* Score cards */}
      <div className="nlp-score-cards">
        {COMPARE_COLS.map(col => {
          const covered = COMPARE_ROWS_EXT.reduce((acc, r) => acc + scoreCell(r[col.key] as CellVal), 0)
          const pct = Math.round((covered / COMPARE_ROWS_EXT.length) * 100)
          const isRf = col.key === "rf"
          const isHovered = hoveredCol === col.key
          return (
            <div
              key={col.key}
              className={`nlp-score-card${isRf ? " nlp-score-card--reframe" : ""}${isHovered ? " nlp-score-card--hovered" : ""}`}
              onMouseEnter={() => setHoveredCol(col.key)}
              onMouseLeave={() => setHoveredCol(null)}
            >
              <div className="nlp-score-card__name">{isRf ? rt("Reframe") : rt(col.label)}</div>
              <div className="nlp-score-card__num">{covered.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, opacity: 0.5 }}>/{COMPARE_ROWS_EXT.length}</span></div>
              <div className="nlp-score-card__bar">
                <div className="nlp-score-card__bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="nlp-score-card__label">{pct}% {rt("capability coverage")}</div>
            </div>
          )
        })}
      </div>

      {/* Heatmap by category */}
      <div className="nlp-heatmap-wrap">
        <div className="nlp-heatmap-legend">
          <span className="nlp-heatmap-legend__label">{rt("Coverage intensity")}:</span>
          <span className="nlp-legend-item"><span className="nlp-legend-dot nlp-legend-dot--yes" /> {rt("High")}</span>
          <span className="nlp-legend-item"><span className="nlp-legend-dot nlp-legend-dot--partial" /> {rt("Medium")}</span>
          <span className="nlp-legend-item"><span className="nlp-legend-dot nlp-legend-dot--no" /> {rt("Low")}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--nlp-text-3)" }}>
            {rt("Hover a competitor to compare")}
          </span>
        </div>
        <div className="nlp-heatmap-grid">
          {/* Column headers */}
          <div style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nlp-text-3)", background: "var(--nlp-surface-2)", borderBottom: "1px solid var(--nlp-border)" }}>
            {rt("Capability")}
          </div>
          {COMPARE_COLS.map(col => (
            <div
              key={col.key}
              className={`nlp-heatmap-colhead${col.key === "rf" ? " nlp-heatmap-colhead--reframe" : ""} ${getColClass(col.key)}`}
              onMouseEnter={() => setHoveredCol(col.key)}
              onMouseLeave={() => setHoveredCol(null)}
            >
              {col.key === "rf" ? rt("Reframe") : rt(col.label)}
            </div>
          ))}

          {/* Data rows grouped by category */}
          {categories.map(cat => {
            const rows = COMPARE_ROWS_EXT.filter(r => r.cat === cat)
            return (
              <React.Fragment key={cat}>
                {/* Category row */}
                <div className="nlp-heatmap-cat-row" style={{ display: "contents" }}>
                  <div className="nlp-heatmap-row-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nlp-text-3)", background: "var(--nlp-surface-2)", minHeight: 30 }}>
                    {rt(cat)}
                  </div>
                  {COMPARE_COLS.map(col => (
                    <div
                      key={col.key}
                      className={`nlp-heatmap-cell${col.key === "rf" ? " nlp-heatmap-cell--reframe" : ""}`}
                      style={{ background: "var(--nlp-surface-2)", minHeight: 30, borderLeft: "1px solid var(--nlp-border)", borderBottom: "1px solid var(--nlp-border)" }}
                      onMouseEnter={() => setHoveredCol(col.key)}
                      onMouseLeave={() => setHoveredCol(null)}
                    />
                  ))}
                </div>
                {/* Feature rows */}
                {rows.map(row => (
                  <React.Fragment key={row.label}>
                    <div className="nlp-heatmap-row-label">{rt(row.label)}</div>
                    {COMPARE_COLS.map(col => {
                      const val = row[col.key] as CellVal
                      return (
                        <div
                          key={col.key}
                          className={`nlp-heatmap-cell ${getCellClass(col.key, val)}`}
                          onMouseEnter={() => setHoveredCol(col.key)}
                          onMouseLeave={() => setHoveredCol(null)}
                          title={`${rt(col.label)} · ${rt(row.label)}: ${val === true ? "✓" : val === "±" ? "~" : "—"}`}
                        >
                          {val === true ? "✓" : val === "±" ? "~" : "—"}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Competitor cards */}
      <div className="nlp-compare__vs-grid">
        {COMPETITOR_PROFILES.map(p => (
          <div key={p.key} className="nlp-vs-card">
            <div className="nlp-vs-card__name">vs {p.name}</div>
            <div className="nlp-vs-card__tagline">{rt(p.tagline)}</div>
            <ul className="nlp-vs-card__points">
              {p.points.map((pt, i) => <li key={i}>{rt(pt)}</li>)}
            </ul>
            <div className="nlp-vs-card__verdict">{rt(p.verdict)}</div>
          </div>
        ))}
      </div>

      {/* Detail table toggle */}
      <div style={{ marginBottom: 16 }}>
        <button className="nlp-btn" onClick={() => setShowTable(t => !t)}>
          {showTable ? rt("Hide table") : rt("Show detail table")}
        </button>
      </div>
      {showTable && (
        <div className="nlp-compare__table-wrap">
          <table className="nlp-compare__table">
            <thead>
              <tr>
                <th>{rt("Capability")}</th>
                <th className="nlp-col-rf">{rt("Reframe")}</th>
                <th>{rt("Webflow")}</th>
                <th>{rt("Framer")}</th>
                <th>{rt("WP + Elementor")}</th>
                <th>{rt("ChatGPT")}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS_EXT.map((row, i) => {
                const prevCat = i > 0 ? COMPARE_ROWS_EXT[i - 1].cat : null
                return (
                  <React.Fragment key={i}>
                    {row.cat !== prevCat && (
                      <tr>
                        <td className="nlp-compare__cat-td" colSpan={6}>{rt(row.cat)}</td>
                      </tr>
                    )}
                    <tr>
                      <td>{rt(row.label)}</td>
                      <td className="nlp-col-rf"><Cell v={row.rf} /></td>
                      <td><Cell v={row.wf} /></td>
                      <td><Cell v={row.fr} /></td>
                      <td><Cell v={row.wp} /></td>
                      <td><Cell v={row.ai} /></td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Cell({ v }: { v: CellVal }) {
  if (v === true) return <span className="nlp-cell nlp-cell--yes">✓</span>
  if (v === "±") return <span className="nlp-cell nlp-cell--partial">~</span>
  return <span className="nlp-cell nlp-cell--no">—</span>
}

/* ── Main component ─────────────────────────────────────── */
export default function NewLandingPage({ onEnter, onLearn, theme = "dark", onToggleTheme }: NewLandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, lang, setLang } = useTranslation()
  const rt = useRuntimeTranslations(lang, LANDING_RUNTIME_STRINGS, t)
  const currencyData = useMemo(() => getCurrencyData(lang), [lang])
  const languageOptions = useMemo(() => AVAILABLE_UI_LANGUAGES, [])

  const handleLangChange = (next: string) => {
    if (!next || next === lang) return
    void setLang(next)
  }

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    persistThemeChoice(next)
    applyThemeToDocument(next)
    onToggleTheme?.()
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  const workflowSteps = useMemo(() => [
    { n: "01", title: rt("Import"), desc: rt("Any URL, ZIP, HTML file, PDF brief, or screenshot. Semantic parsing turns it into a structured project in minutes.") },
    { n: "02", title: rt("Understand"), desc: rt("Pages, blocks, SEO, forms, navigation: all parsed before AI touches anything. Real context, not clipboard paste.") },
    { n: "03", title: rt("Edit + AI"), desc: rt("Visual block editor. AI rewrites with full project context. Translation. Approval queues. Version history.") },
    { n: "04", title: rt("Export + Deploy"), desc: rt("11 formats. One-click deploy to Firebase, Netlify, Vercel, WordPress, or Shopify.") },
  ], [rt])

  const advantages = useMemo(() => [
    { title: rt("End-to-end delivery"), detail: rt("Import -> AI rewrite -> multi-format export -> one-click deploy in one workflow.") },
    { title: rt("Agency operations"), detail: rt("RBAC, approvals, share links and audit history are native, not patched together.") },
    { title: rt("Cost control"), detail: rt("Pay only for AI usage and optionally run self-hosted models with near-zero marginal cost.") },
  ], [rt])

  return (
    <div className={`nlp nlp--${theme}`}>
      {/* ── Navigation ── */}
      <nav className="nlp-nav">
        <div className="nlp-nav__inner">
          <div className="nlp-nav__logo">
            <div className="nlp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className={`nlp-nav__links${menuOpen ? " nlp-nav__links--open" : ""}`}>
            <button onClick={() => scrollTo("features")}>{rt("Features")}</button>
            <button onClick={() => scrollTo("compare")}>{rt("Compare")}</button>
            <button onClick={() => scrollTo("pricing")}>{rt("Pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{rt("FAQ")}</button>
            <button onClick={() => scrollTo("early-access")} className="nlp-nav__cta-link">{rt("Early access")}</button>
          </div>
          <div className="nlp-nav__actions">
            <label className="nlp-nav__lang" aria-label={rt("Language")}>
              <span>{rt("Language")}</span>
              <select value={lang} onChange={e => handleLangChange(e.target.value)}>
                {languageOptions.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            </label>
            <button className="nlp-btn" onClick={toggleTheme}>{theme === "dark" ? rt("Light") : rt("Dark")}</button>
            <button className="nlp-btn" onClick={onEnter}>{rt("Sign in")}</button>
            <button className="nlp-btn" onClick={() => onLearn?.()}>{rt("Learn")}</button>
            <button className="nlp-btn nlp-btn--primary" onClick={onEnter}>{rt("Start free")}</button>
            <button className="nlp-nav__burger" onClick={() => setMenuOpen(o => !o)} aria-label={rt("Menu")}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="nlp-hero">
        <div className="nlp-hero__bg">
          <div className="nlp-hero__grid" />
          <div className="nlp-hero__glow-a" />
          <div className="nlp-hero__glow-b" />
        </div>
        <div className="nlp-hero__inner">
          <div className="nlp-hero__copy">
            <div className="nlp-hero__badge">
              <span className="nlp-hero__badge-dot" />
              {rt("Early access · Agency-first")}
            </div>
            <h1 className="nlp-hero__h1">
              {rt("The website")}<br />
              <em>{rt("operations")}</em><br />
              {rt("system.")}
            </h1>
            <p className="nlp-hero__sub">
              {rt("Import any existing website. Edit it visually with AI.")}{" "}
              {rt("Launch in whatever format and market your client needs.")}
            </p>
            <div className="nlp-hero__actions">
              <button className="nlp-btn nlp-btn--primary nlp-btn--xl" onClick={onEnter}>
                {rt("Start free - no card")}
              </button>
              <button className="nlp-btn nlp-btn--lg" onClick={() => onLearn?.()}>
                {rt("Learn")}
              </button>
            </div>
            <div className="nlp-hero__stats">
              <AnimStat n={11} label={rt("export formats")} />
              <AnimStat n={0} label={rt("all languages")} display={rt("All")} />
              <AnimStat n={17} label={rt("hours saved/project")} suffix="h" />
            </div>
          </div>
          <div className="nlp-hero__visual">
            <div className="nlp-video-card">
              <div className="nlp-video-card__header">
                <div className="nlp-video-card__dots"><span /><span /><span /></div>
                <div className="nlp-video-card__badges">
                  <span className="nlp-chip nlp-chip--green">{rt("60s demo")}</span>
                  <span className="nlp-chip">{rt("Guided walkthrough")}</span>
                </div>
              </div>
              <div className="nlp-video-embed">
                <iframe
                  src="https://embed.app.guidde.com/playbooks/iyeGPeTVt9anr6vLen1CC5?mode=videoOnly"
                  title="Reframe demo"
                  loading="lazy"
                  allow="fullscreen"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <div className="nlp-workflow">
        <div className="nlp-workflow__inner">
          <div className="nlp-workflow__head">
            <div className="nlp-workflow__title">{rt("How it works")} — {rt("Four steps. One system.")}</div>
          </div>
          <div className="nlp-workflow__steps">
            {workflowSteps.map((step, i) => (
              <div key={i} className="nlp-workflow__step">
                <div className="nlp-workflow__step-num">{step.n}</div>
                <div className="nlp-workflow__step-title">{step.title}</div>
                <div className="nlp-workflow__step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="nlp-section">
        <div className="nlp-inner">
          <div className="nlp-eyebrow"><span className="nlp-eyebrow-dot" />{rt("Features")}</div>
          <h2 className="nlp-heading">
            {rt("Everything agencies need.")}<br />
            <em>{rt("Nothing they don't.")}</em>
          </h2>
          <div className="nlp-features__grid">
            {FEATURES.map((f, i) => (
              <FeatureCard
                key={i}
                feature={{ ...f, tag: rt(f.tag), title: rt(f.title), body: rt(f.body), items: f.items.map(item => rt(item)) }}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section id="compare" className="nlp-section" style={{ background: "var(--nlp-surface)" }}>
        <div className="nlp-inner">
          <div className="nlp-eyebrow"><span className="nlp-eyebrow-dot" />{rt("Comparison")}</div>
          <h2 className="nlp-heading">{rt("How Reframe fits in.")}</h2>
          <p className="nlp-subheading">
            {rt("Honest comparison for agencies that start with existing sites, not agencies building from scratch.")}
          </p>

          {/* Score banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px 20px", padding: "16px 24px", marginBottom: 28,
            borderRadius: "var(--nlp-radius-lg)", border: "1px solid var(--nlp-green-border)",
            background: "var(--nlp-green-dim)", flexWrap: "wrap"
          }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--nlp-green)" }}>25 / 25</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--nlp-text)" }}>{rt("site operations capabilities")}</span>
            <span style={{ color: "var(--nlp-text-3)" }}>·</span>
            <span style={{ fontSize: 13, color: "var(--nlp-green)" }}>{rt("No other tool covers the full stack.")}</span>
          </div>

          {/* Advantage cards */}
          <div className="nlp-adv-grid">
            {advantages.map((adv, i) => (
              <div key={i} className="nlp-adv-card">
                <div className="nlp-adv-card__title">{adv.title}</div>
                <p>{adv.detail}</p>
              </div>
            ))}
          </div>

          <InteractiveHeatmap rt={rt} />
        </div>
      </section>

      {/* ── ROI ── */}
      <section className="nlp-section">
        <div className="nlp-inner">
          <div className="nlp-eyebrow"><span className="nlp-eyebrow-dot" />{rt("ROI Calculator")}</div>
          <h2 className="nlp-heading">{rt("Calculate your margin recovery.")}</h2>
          <p className="nlp-subheading">{rt("Drag the sliders to match your workload.")}</p>
          <ROICalc c={currencyData} />
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="nlp-section" style={{ background: "var(--nlp-surface)" }}>
        <div className="nlp-inner">
          <div className="nlp-eyebrow"><span className="nlp-eyebrow-dot" />{rt("Pricing")}</div>
          <h2 className="nlp-heading">{rt("Pay for AI. Not for projects.")}</h2>
          <p className="nlp-subheading">{rt("Credits deduct only when you run AI, not for editing, exporting, or storing.")}</p>
          <div className="nlp-pricing__grid">
            {PLANS.map((plan, i) => (
              <div key={i} className={`nlp-plan${plan.featured ? " nlp-plan--featured" : ""}`}>
                {plan.featured && <div className="nlp-plan__badge">{rt("Most popular")}</div>}
                <div className="nlp-plan__name">{rt(plan.name)}</div>
                <div className="nlp-plan__price">
                  {plan.price}
                  {plan.per && <span className="nlp-plan__price-per">{rt(plan.per)}</span>}
                </div>
                <div className="nlp-plan__sub">{rt(plan.sub)}</div>
                <ul className="nlp-plan__items">
                  {plan.items.map((item, j) => <li key={j}>{rt(item)}</li>)}
                  {plan.missing.map((item, j) => <li key={`m${j}`} className="is-missing">{rt(item)}</li>)}
                </ul>
                <button
                  className={`nlp-btn nlp-btn--full${plan.featured ? " nlp-btn--green" : ""}`}
                  style={plan.featured ? { marginTop: "auto" } : { marginTop: "auto" }}
                  onClick={onEnter}
                >
                  {plan.price === "Free" ? rt("Start free") : rt("Get started")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="nlp-section">
        <div className="nlp-inner nlp-inner--narrow">
          <div className="nlp-eyebrow"><span className="nlp-eyebrow-dot" />{rt("FAQ")}</div>
          <h2 className="nlp-heading">{rt("Common questions.")}</h2>
          <div className="nlp-faq__list">
            {FAQS.map((faq, i) => <FAQItem key={i} q={rt(faq.q)} a={rt(faq.a)} />)}
          </div>
        </div>
      </section>

      {/* ── Early Access ── */}
      <section id="early-access" className="nlp-section" style={{ background: "var(--nlp-surface)", borderBottom: "none" }}>
        <div className="nlp-inner nlp-inner--narrow">
          <div className="nlp-eyebrow"><span className="nlp-eyebrow-dot" />{rt("Early access")}</div>
          <h2 className="nlp-heading">{rt("Get in early.")}</h2>
          <p className="nlp-early__sub">
            {rt("We're onboarding the first wave of agencies manually, each with a live demo call and a direct line to the team.")}{" "}
            {rt("Leave your email and we'll reach out within 48 hours.")}
          </p>
          <InquiryForm />
          <div className="nlp-early__or">
            {rt("Already have an account?")}{" "}
            <button className="nlp-early__signin" onClick={onEnter}>{rt("Sign in")} →</button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="nlp-footer">
        <div className="nlp-footer__inner">
          <div className="nlp-footer__logo">
            <div className="nlp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className="nlp-footer__links">
            <button onClick={onEnter}>{rt("Sign in")}</button>
            <button onClick={() => scrollTo("pricing")}>{rt("Pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{rt("FAQ")}</button>
            <button onClick={() => scrollTo("early-access")}>{rt("Contact")}</button>
          </div>
          <div className="nlp-footer__copy">{rt("© 2025 Reframe · Early access")}</div>
        </div>
      </footer>
    </div>
  )
}

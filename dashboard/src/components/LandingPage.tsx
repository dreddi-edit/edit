import React from 'react';

import { useState, useEffect, useRef, useMemo } from "react"
import { AVAILABLE_UI_LANGUAGES, useRuntimeTranslations, useTranslation } from "../i18n/useTranslation"
import { applyThemeToDocument, persistThemeChoice } from "../utils/theme"
import "./landing.css"

interface LandingPageProps {
  onEnter: () => void
  onDemoRequest?: () => void
  onLearn?: () => void
  theme?: "dark" | "light"
  onToggleTheme?: () => void
}

function useVisible(threshold = 0.12) {
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

const TERMINAL_LINES = [
  { delay: 0, text: "$ reframe import --url https://oldclient.com", type: "cmd" },
  { delay: 600, text: "  -> Crawling 24 pages...", type: "info" },
  { delay: 1100, text: "  -> Extracting blocks, assets, SEO...", type: "info" },
  { delay: 1700, text: "  + Project ready  (24 pages, 312 blocks)", type: "ok" },
  { delay: 2200, text: "$ reframe ai --rewrite 'make it more professional'", type: "cmd" },
  { delay: 2900, text: "  -> Claude Sonnet - streaming...", type: "info" },
  { delay: 3600, text: "  + 38 blocks rewritten", type: "ok" },
  { delay: 4100, text: "$ reframe export --format wp-theme", type: "cmd" },
  { delay: 4700, text: "  -> Compiling WordPress theme...", type: "info" },
  { delay: 5200, text: "  + client-theme.zip ready  (4.2 MB)", type: "ok" },
  { delay: 5700, text: "$ reframe deploy --target netlify", type: "cmd" },
  { delay: 6300, text: "  + Live at  https://newclient.netlify.app", type: "ok" },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Terminal() {
  const [shown, setShown] = useState<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timers = TERMINAL_LINES.map((line, i) =>
      setTimeout(() => setShown((p) => [...p, i]), line.delay + 800),
    )
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [shown])

  return (
    <div className="lp-terminal">
      <div className="lp-terminal__bar">
        <span /><span /><span />
        <div className="lp-terminal__title">reframe · autonomous web operations</div>
      </div>
      <div className="lp-terminal__body">
        {TERMINAL_LINES.map((line, i) =>
          shown.includes(i) ? (
            <div key={i} className={`lp-terminal__line lp-terminal__line--${line.type}`}>
              {line.text}
            </div>
          ) : null,
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

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

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number]
  index: number
}) {
  const { ref, visible } = useVisible()
  return (
    <div
      ref={ref}
      className={`lp-feat ${visible ? "lp-feat--visible" : ""}`}
      style={{ transitionDelay: `${(index % 3) * 80}ms` }}
    >
      <div className="lp-feat__icon">{feature.icon}</div>
      <div className="lp-feat__tag">{feature.tag}</div>
      <div className="lp-feat__title">{feature.title}</div>
      <div className="lp-feat__body">{feature.body}</div>
      <ul className="lp-feat__list">
        {feature.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
      </ul>
    </div>
  )
}

const COMPETITOR_PROFILES = [
  {
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

const COMPARE_ROWS_EXT = [
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

type CellVal = boolean | "±"

function Cell({ v }: { v: CellVal }) {
  if (v === true) return <span className="lp-cell lp-cell--yes">✓</span>
  if (v === "±") return <span className="lp-cell lp-cell--partial">~</span>
  return <span className="lp-cell lp-cell--no">-</span>
}

function CompetitorCard({ profile, rt }: { profile: typeof COMPETITOR_PROFILES[0]; rt: (s: string) => string }) {
  return (
    <div className="lp-compare__vs-card">
      <div className="lp-compare__vs-name">vs {profile.name}</div>
      <div className="lp-compare__vs-tagline">{rt(profile.tagline)}</div>
      <ul className="lp-compare__vs-points">
        {profile.points.map((p, i) => <li key={i}>{rt(p)}</li>)}
      </ul>
      <div className="lp-compare__vs-verdict">{rt(profile.verdict)}</div>
    </div>
  )
}

type CurrencyData = {
  sym: string
  starter: string
  pro: string
  scale: string
  starterCredits: string
  proCredits: string
  scaleCredits: string
  rateDefault: number
  rateMin: number
  rateMax: number
  rateStep: number
  proAnnualNum: number
  roiProAnnualLabel: string
}
const CURRENCY_MAP: Record<string, CurrencyData> = {
  _default: { sym: "€",   starter: "€15",       pro: "€30",       scale: "€100",        starterCredits: "€16.50",    proCredits: "€34.50",    scaleCredits: "€120",       rateDefault: 95,     rateMin: 30,     rateMax: 250,     rateStep: 5,     proAnnualNum: 360,      roiProAnnualLabel: "€360/year" },
  en:       { sym: "$",   starter: "$17",       pro: "$34",       scale: "$109",        starterCredits: "$19",       proCredits: "$39",       scaleCredits: "$129",       rateDefault: 115,    rateMin: 40,     rateMax: 300,     rateStep: 5,     proAnnualNum: 408,      roiProAnnualLabel: "$408/year" },
  ja:       { sym: "¥",   starter: "¥2,490",    pro: "¥4,980",    scale: "¥16,500",     starterCredits: "¥2,740",    proCredits: "¥5,480",    scaleCredits: "¥18,200",    rateDefault: 8000,   rateMin: 3000,   rateMax: 25000,   rateStep: 500,   proAnnualNum: 59760,    roiProAnnualLabel: "¥59,760/year" },
  "zh-CN":  { sym: "¥",   starter: "¥120",      pro: "¥240",      scale: "¥790",        starterCredits: "¥132",      proCredits: "¥264",      scaleCredits: "¥870",       rateDefault: 400,    rateMin: 150,    rateMax: 1500,    rateStep: 50,    proAnnualNum: 2880,     roiProAnnualLabel: "¥2,880/year" },
  "zh-TW":  { sym: "NT$", starter: "NT$550",    pro: "NT$1,090",  scale: "NT$3,590",    starterCredits: "NT$605",    proCredits: "NT$1,200",  scaleCredits: "NT$3,950",   rateDefault: 2500,   rateMin: 800,    rateMax: 8000,    rateStep: 200,   proAnnualNum: 13080,    roiProAnnualLabel: "NT$13,080/year" },
  ko:       { sym: "₩",   starter: "₩22,000",   pro: "₩44,000",   scale: "₩145,000",    starterCredits: "₩24,200",   proCredits: "₩48,800",   scaleCredits: "₩160,000",   rateDefault: 50000,  rateMin: 20000,  rateMax: 200000,  rateStep: 5000,  proAnnualNum: 528000,   roiProAnnualLabel: "₩528,000/year" },
  pt:       { sym: "R$",  starter: "R$89",      pro: "R$179",     scale: "R$599",       starterCredits: "R$98",      proCredits: "R$197",     scaleCredits: "R$659",      rateDefault: 180,    rateMin: 60,     rateMax: 500,     rateStep: 10,    proAnnualNum: 2148,     roiProAnnualLabel: "R$2.148/year" },
  hi:       { sym: "₹",   starter: "₹1,299",    pro: "₹2,599",    scale: "₹8,499",      starterCredits: "₹1,430",    proCredits: "₹2,860",    scaleCredits: "₹9,350",     rateDefault: 2000,   rateMin: 500,    rateMax: 8000,    rateStep: 500,   proAnnualNum: 31188,    roiProAnnualLabel: "₹31,188/year" },
  tr:       { sym: "₺",   starter: "₺499",      pro: "₺999",      scale: "₺3,299",      starterCredits: "₺549",      proCredits: "₺1,099",    scaleCredits: "₺3,630",     rateDefault: 500,    rateMin: 200,    rateMax: 2000,    rateStep: 50,    proAnnualNum: 11988,    roiProAnnualLabel: "₺11.988/year" },
  id:       { sym: "Rp",  starter: "Rp250.000", pro: "Rp499.000", scale: "Rp1.650.000", starterCredits: "Rp275.000", proCredits: "Rp549.000", scaleCredits: "Rp1.815.000", rateDefault: 250000, rateMin: 80000,  rateMax: 800000,  rateStep: 20000, proAnnualNum: 5988000,  roiProAnnualLabel: "Rp5.988.000/year" },
  vi:       { sym: "₫",   starter: "₫399.000",  pro: "₫799.000",  scale: "₫2.650.000",  starterCredits: "₫439.000",  proCredits: "₫879.000",  scaleCredits: "₫2.915.000", rateDefault: 200000, rateMin: 100000, rateMax: 1000000, rateStep: 50000, proAnnualNum: 9588000,  roiProAnnualLabel: "₫9.588.000/year" },
  th:       { sym: "฿",   starter: "฿590",      pro: "฿1,190",    scale: "฿3,890",      starterCredits: "฿649",      proCredits: "฿1,309",    scaleCredits: "฿4,279",     rateDefault: 600,    rateMin: 200,    rateMax: 2500,    rateStep: 50,    proAnnualNum: 14280,    roiProAnnualLabel: "฿14,280/year" },
  sv:       { sym: "kr",  starter: "179 kr",    pro: "359 kr",    scale: "1 190 kr",    starterCredits: "197 kr",    proCredits: "396 kr",    scaleCredits: "1 310 kr",   rateDefault: 950,    rateMin: 300,    rateMax: 2500,    rateStep: 50,    proAnnualNum: 4308,     roiProAnnualLabel: "4 308 kr/year" },
  no:       { sym: "kr",  starter: "189 kr",    pro: "379 kr",    scale: "1 250 kr",    starterCredits: "208 kr",    proCredits: "417 kr",    scaleCredits: "1 375 kr",   rateDefault: 1000,   rateMin: 300,    rateMax: 2500,    rateStep: 50,    proAnnualNum: 4548,     roiProAnnualLabel: "4 548 kr/year" },
  da:       { sym: "kr",  starter: "119 kr",    pro: "239 kr",    scale: "790 kr",      starterCredits: "131 kr",    proCredits: "263 kr",    scaleCredits: "869 kr",     rateDefault: 700,    rateMin: 200,    rateMax: 2000,    rateStep: 50,    proAnnualNum: 2868,     roiProAnnualLabel: "2 868 kr/year" },
}
function getCurrencyData(lang: string): CurrencyData {
  return CURRENCY_MAP[lang] ?? CURRENCY_MAP._default
}
function getPlansDisplay(lang: string) {
  const c = getCurrencyData(lang)
  return [
    { ...PLANS[0] },
    { ...PLANS[1], price: c.starter, sub: `5 projects · ${c.starterCredits} credits` },
    { ...PLANS[2], price: c.pro,     sub: `20 projects · ${c.proCredits} credits` },
    { ...PLANS[3], price: c.scale,   sub: `Unlimited · ${c.scaleCredits} credits` },
  ]
}

const PLANS = [
  {
    name: "Basis",
    price: "Free",
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
    <div ref={ref} className={`lp-roi ${visible ? "lp-roi--visible" : ""}`}>
      <div className="lp-roi__inputs">
        <label>
          <span>{rt("Migrations / month")}</span>
          <input type="range" min={1} max={20} value={projects} onChange={(e) => setProjects(Number(e.target.value))} />
          <strong>{projects}</strong>
        </label>
        <label>
          <span>{rt("Manual hours / project")}</span>
          <input type="range" min={5} max={80} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          <strong>{hours}h</strong>
        </label>
        <label>
          <span>{rt("Hourly rate")} ({c.sym})</span>
          <input type="range" min={c.rateMin} max={c.rateMax} step={c.rateStep} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <strong>{c.sym}{rate.toLocaleString()}</strong>
        </label>
      </div>
      <div className="lp-roi__result">
        <div className="lp-roi__num">{c.sym}{saved.toLocaleString()}</div>
        <div className="lp-roi__label">{rt("recovered annually")}</div>
        <div className="lp-roi__sub">
          {rt("Reframe Pro costs")} {c.roiProAnnualLabel}.
          <br />
          {rt("ROI")} : <strong>{roiX}x</strong>
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
    } catch {
      // No-op: we still complete flow client-side.
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="lp-inquiry lp-inquiry--sent">
        <div className="lp-inquiry__thanks">
          <span className="lp-inquiry__checkmark">✓</span>
          <strong>{rt("You're on the list.")}</strong>
          <p>{rt("We'll reach out within 48 hours with early-access details and a live demo offer.")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lp-inquiry">
      <select value={type} onChange={(e) => setType(e.target.value)} className="lp-inquiry__select">
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
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="lp-inquiry__input"
      />
      <textarea
        placeholder={rt("Anything specific you want to see? (optional)")}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="lp-inquiry__textarea"
        rows={2}
      />
      <button onClick={submit} disabled={loading || !email.trim()} className="lp-inquiry__btn">
        {loading ? rt("Sending...") : rt("Request early access ->")}
      </button>
    </div>
  )
}

function AnimStat({ n, label, prefix = "", suffix = "", display }: { n: number; label: string; prefix?: string; suffix?: string; display?: string }) {
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
    <div ref={ref} className="lp-stat">
      <div className="lp-stat__num">{display ?? `${prefix}${count.toLocaleString()}${suffix}`}</div>
      <div className="lp-stat__label">{label}</div>
    </div>
  )
}

const FAQS = [
  { q: "Is Reframe a website builder like Webflow?", a: "No. Reframe is a site operations platform for agencies that work with existing sites. Webflow assumes you start from scratch; Reframe assumes you start from a client's URL. We export to Webflow JSON, so they are complementary, not competing." },
  { q: "What kinds of sites can I import?", a: "Any live URL, ZIP archive, single HTML file, PDF brief, or screenshot. The import engine is WordPress-aware, handles multi-page crawls, and auto-localises assets and fonts." },
  { q: "How is the AI different from just using Claude or ChatGPT?", a: "Context. When you use a chat interface, the AI has no idea what site it is editing, what brand it belongs to, or what stage the project is at. Reframe injects real page structure, brand context, and workflow state into every AI call with cost tracking, approval gates, and version snapshots before every action." },
  { q: "Does the WordPress Theme export actually install?", a: "Yes. The export generates an installable .zip with the correct theme hierarchy, functions.php, style.css header, and asset references. The Block export produces native Gutenberg markup." },
  { q: "How much does API usage cost?", a: "Credits only deduct when you run AI, not for editing, storing, or exporting. Each plan includes a monthly credit balance. You can see exact cost per action before approving it." },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`lp-faq__item ${open ? "lp-faq__item--open" : ""}`} onClick={() => setOpen((o) => !o)}>
      <div className="lp-faq__q">{q}<span className="lp-faq__ic">{open ? "−" : "+"}</span></div>
      {open && <div className="lp-faq__a">{a}</div>}
    </div>
  )
}

const LANDING_RUNTIME_STRINGS = Array.from(new Set([
  ...FEATURES.flatMap((feature) => [feature.tag, feature.title, feature.body, ...feature.items]),
  ...COMPARE_ROWS_EXT.map((row) => row.label),
  ...COMPARE_ROWS_EXT.map((row) => row.cat),
  ...COMPETITOR_PROFILES.flatMap((p) => [p.tagline, ...p.points, p.verdict]),
  ...PLANS.flatMap((plan) => [plan.name, plan.sub, ...(plan.per ? [plan.per] : []), ...plan.items, ...plan.missing]),
  ...FAQS.flatMap((faq) => [faq.q, faq.a]),
  "Features",
  "Compare",
  "Pricing",
  "FAQ",
  "Early access",
  "Sign in",
  "Learn",
  "Start free",
  "Early access · Agency-first",
  "The website",
  "operations",
  "system.",
  "Import any existing website. Edit it visually with AI.",
  "Launch in whatever format and market your client needs.",
  "Start free - no card",
  "export formats",
  "all languages",
  "hours saved/project",
  "All",
  "How it works",
  "Four steps. One system.",
  "Import",
  "Understand",
  "Edit + AI",
  "Export + Deploy",
  "Everything agencies need.",
  "Nothing they don't.",
  "How Reframe fits in.",
  "Honest comparison for agencies that start with existing sites, not agencies building from scratch.",
  "site operations capabilities",
  "No other tool covers the full stack.",
  "Capability",
  "Reframe",
  "Webflow",
  "Framer",
  "WP + Elementor",
  "ChatGPT",
  "ROI Calculator",
  "Calculate your margin recovery.",
  "Drag the sliders to match your workload.",
  "Pay for AI. Not for projects.",
  "Credits deduct only when you run AI, not for editing, exporting, or storing.",
  "Most popular",
  "Start free",
  "Get started",
  "Common questions.",
  "Get in early.",
  "We're onboarding the first wave of agencies manually, each with a live demo call and a direct line to the team.",
  "Leave your email and we'll reach out within 48 hours.",
  "We'll reach out within 48 hours with early-access details and a live demo offer.",
  "You're on the list.",
  "Already have an account?",
  "Contact",
  "Request early access ->",
  "Sending...",
  "Digital agency",
  "Freelancer",
  "In-house team",
  "Investor",
  "Other",
  "your@email.com",
  "Anything specific you want to see? (optional)",
  "Migrations / month",
  "Manual hours / project",
  "Hourly rate",
  "recovered annually",
  "Reframe Pro costs",
  "ROI",
  "Comparison",
  "60s demo",
  "Guided walkthrough",
  "Language",
  "Menu",
  "Light",
  "Dark",
  "Get started",
  "Import. Edit. Export.",
  "© 2025 Reframe · Early access",
]))

export default function LandingPage({ onEnter, onLearn, theme = "dark", onToggleTheme }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, lang, setLang } = useTranslation()
  const rt = useRuntimeTranslations(lang, LANDING_RUNTIME_STRINGS, t)

  const currencyData = useMemo(() => getCurrencyData(lang), [lang])
  const languageOptions = useMemo(() => AVAILABLE_UI_LANGUAGES, [])

  const handleLanguageChange = (nextLang: string) => {
    if (!nextLang || nextLang === lang) return
    void setLang(nextLang)
  }

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    persistThemeChoice(next)
    applyThemeToDocument(next)
    onToggleTheme?.()
  }

  const workflowSteps = useMemo(() => [
    { letter: "A", title: rt("Import"), desc: rt("Any URL, ZIP, HTML file, PDF brief, or screenshot. Semantic parsing turns it into a structured project in minutes.") },
    { letter: "B", title: rt("Understand"), desc: rt("Pages, blocks, SEO, forms, navigation: all parsed before AI touches anything. Real context, not clipboard paste.") },
    { letter: "C", title: rt("Edit + AI"), desc: rt("Visual block editor. AI rewrites with full project context. Translation. Approval queues. Version history.") },
    { letter: "D", title: rt("Export + Deploy"), desc: rt("11 formats. One-click deploy to Firebase, Netlify, Vercel, WordPress, or Shopify.") },
  ], [rt])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  return (
    <div className={`lp lp--${theme}`}>
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <div className="lp-nav__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className={`lp-nav__links ${menuOpen ? "lp-nav__links--open" : ""}`}>
            <button onClick={() => scrollTo("features")}>{rt("Features")}</button>
            <button onClick={() => scrollTo("compare")}>{rt("Compare")}</button>
            <button onClick={() => scrollTo("pricing")}>{rt("Pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{rt("FAQ")}</button>
            <button onClick={() => scrollTo("early-access")} className="lp-nav__cta-link">{rt("Early access")}</button>
          </div>
          <div className="lp-nav__actions">
            <label className="lp-lang" aria-label={rt("Language")}>
              <span>{rt("Language")}</span>
              <select value={lang} onChange={(e) => handleLanguageChange(e.target.value)}>
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
            <button className="lp-btn lp-btn--ghost" onClick={toggleTheme}>{theme === "dark" ? rt("Light") : rt("Dark")}</button>
            <button className="lp-btn lp-btn--ghost" onClick={onEnter}>{rt("Sign in")}</button>
            <button className="lp-btn lp-btn--ghost" onClick={() => onLearn?.()}>{rt("Learn")}</button>
            <button className="lp-btn lp-btn--primary" onClick={onEnter}>{rt("Start free")}</button>
            <button className="lp-nav__burger" onClick={() => setMenuOpen((o) => !o)} aria-label={rt("Menu")}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero__bg" aria-hidden="true">
          <div className="lp-hero__glow lp-hero__glow--a" />
          <div className="lp-hero__glow lp-hero__glow--b" />
          <div className="lp-hero__grid" />
        </div>
        <div className="lp-hero__inner">
          <div className="lp-hero__copy">
            <div className="lp-badge">
              <span className="lp-badge__dot" />
              {rt("Early access · Agency-first")}
            </div>
            <h1 className="lp-hero__h1">
              {rt("The website")}
              <br />
              {rt("operations")}
              <br />
              <em>{rt("system.")}</em>
            </h1>
            <p className="lp-hero__sub">
              {rt("Import any existing website. Edit it visually with AI.")}
              <br />
              {rt("Launch in whatever format and market your client needs.")}
            </p>
            <div className="lp-hero__btns">
              <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={onEnter}>
                {rt("Start free - no card")}
              </button>
              <button className="lp-btn lp-btn--ghost lp-btn--lg" onClick={() => onLearn?.()}>
                {rt("Learn")}
              </button>
            </div>
            <div className="lp-hero__stats">
              <AnimStat n={11} label={rt("export formats")} />
              <div className="lp-hero__stat-div" />
              <AnimStat n={0} label={rt("all languages")} display={rt("All")} />
              <div className="lp-hero__stat-div" />
              <AnimStat n={17} label={rt("hours saved/project")} suffix="h" />
            </div>
          </div>
          <div className="lp-hero__demo">
            <div className="lp-video-card">
              <div className="lp-video-card__top">
                <span className="lp-video-card__badge">{rt("60s demo")}</span>
                <span className="lp-video-card__meta">{rt("Guided walkthrough")}</span>
              </div>

              <div className="lp-video-embed">
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

      <section className="lp-workflow">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{rt("How it works")}</div>
          <h2 className="lp-h2">{rt("Four steps. One system.")}</h2>
          <div className="lp-workflow__steps">
            {workflowSteps.map((step, i) => (
              <div key={i} className="lp-workflow__step">
                <div className="lp-workflow__letter">{step.letter}</div>
                <div className="lp-workflow__title">{step.title}</div>
                <div className="lp-workflow__desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-features">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{rt("Features")}</div>
          <h2 className="lp-h2">
            {rt("Everything agencies need.")}
            <br />
            {rt("Nothing they don't.")}
          </h2>
          <div className="lp-features__grid">
            {FEATURES.map((feature, index) => (
              <FeatureCard
                key={index}
                feature={{
                  ...feature,
                  tag: rt(feature.tag),
                  title: rt(feature.title),
                  body: rt(feature.body),
                  items: feature.items.map((item) => rt(item)),
                }}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="lp-compare">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{rt("Comparison")}</div>
          <h2 className="lp-h2">{rt("How Reframe fits in.")}</h2>
          <p className="lp-compare__sub">{rt("Honest comparison for agencies that start with existing sites, not agencies building from scratch.")}</p>

          <div className="lp-compare__score-banner">
            <span className="lp-compare__score-num">25 / 25</span>
            <span className="lp-compare__score-label">{rt("site operations capabilities")}</span>
            <span className="lp-compare__score-sep">·</span>
            <span className="lp-compare__score-note">{rt("No other tool covers the full stack.")}</span>
          </div>

          <div className="lp-compare__vs-grid">
            {COMPETITOR_PROFILES.map((profile, i) => (
              <CompetitorCard key={i} profile={profile} rt={rt} />
            ))}
          </div>

          <div className="lp-compare__wrap">
            <table className="lp-compare__table">
              <thead>
                <tr>
                  <th>{rt("Capability")}</th>
                  <th className="lp-compare__th--rf">{rt("Reframe")}</th>
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
                        <tr className="lp-compare__cat-row">
                          <td colSpan={6}>{rt(row.cat)}</td>
                        </tr>
                      )}
                      <tr>
                        <td>{rt(row.label)}</td>
                        <td className="lp-compare__td--rf"><Cell v={row.rf as CellVal} /></td>
                        <td><Cell v={row.wf as CellVal} /></td>
                        <td><Cell v={row.fr as CellVal} /></td>
                        <td><Cell v={row.wp as CellVal} /></td>
                        <td><Cell v={row.ai as CellVal} /></td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="lp-roi-section">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{rt("ROI Calculator")}</div>
          <h2 className="lp-h2">{rt("Calculate your margin recovery.")}</h2>
          <p className="lp-compare__sub">{rt("Drag the sliders to match your workload.")}</p>
          <ROICalc c={currencyData} />
        </div>
      </section>

      <section id="pricing" className="lp-pricing">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{rt("Pricing")}</div>
          <h2 className="lp-h2">{rt("Pay for AI. Not for projects.")}</h2>
          <p className="lp-compare__sub">{rt("Credits deduct only when you run AI, not for editing, exporting, or storing.")}</p>
          <div className="lp-pricing__grid">
            {getPlansDisplay(lang).map((plan, i) => (
              <div key={i} className={`lp-plan ${plan.featured ? "lp-plan--featured" : ""}`}>
                {plan.featured && <div className="lp-plan__badge">{rt("Most popular")}</div>}
                <div className="lp-plan__name">{rt(plan.name)}</div>
                <div className="lp-plan__price">
                  {plan.price}
                  {plan.per && <span>{rt(plan.per)}</span>}
                </div>
                <div className="lp-plan__sub">{rt(plan.sub)}</div>
                <ul className="lp-plan__items">
                  {plan.items.map((item, j) => <li key={j}>{rt(item)}</li>)}
                  {plan.missing.map((item, j) => <li key={`m${j}`} className="lp-plan__item--off">{rt(item)}</li>)}
                </ul>
                <button
                  className={`lp-btn ${plan.featured ? "lp-btn--primary" : "lp-btn--ghost"} lp-btn--full`}
                  onClick={onEnter}
                >
                  {plan.price === "Free" ? rt("Start free") : rt("Get started")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="lp-faq">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">{rt("FAQ")}</div>
          <h2 className="lp-h2">{rt("Common questions.")}</h2>
          <div className="lp-faq__list">
            {FAQS.map((faq, i) => <FAQItem key={i} q={rt(faq.q)} a={rt(faq.a)} />)}
          </div>
        </div>
      </section>

      <section id="early-access" className="lp-early">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">{rt("Early access")}</div>
          <h2 className="lp-h2">{rt("Get in early.")}</h2>
          <p className="lp-early__sub">
            {rt("We're onboarding the first wave of agencies manually, each with a live demo call and a direct line to the team.")}
            {" "}
            {rt("Leave your email and we'll reach out within 48 hours.")}
          </p>
          <InquiryForm />
          <div className="lp-early__or">
            {rt("Already have an account?")} {" "}
            <button className="lp-early__link" onClick={onEnter}>{rt("Sign in")} {"->"}</button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className="lp-footer__tagline">"{rt("Import. Edit. Export.")}"</div>
          <div className="lp-footer__links">
            <button onClick={onEnter}>{rt("Sign in")}</button>
            <button onClick={() => scrollTo("pricing")}>{rt("Pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{rt("FAQ")}</button>
            <button onClick={() => scrollTo("early-access")}>{rt("Contact")}</button>
          </div>
          <div className="lp-footer__copy">{rt("© 2025 Reframe · Early access")}</div>
        </div>
      </footer>
    </div>
  )
}

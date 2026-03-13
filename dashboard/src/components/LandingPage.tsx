import React from 'react';

import { useState, useEffect, useRef } from "react"
import "./landing.css"
import { useTranslation, useRuntimeTranslations } from "../i18n/useTranslation"
import {
  resolveThemePreference,
  applyThemeToDocument,
  persistThemeChoice,
  type ThemeMode,
} from "../utils/theme"

interface LandingPageProps {
  onEnter: () => void
  onDemoRequest?: () => void
  onLearn?: () => void
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
        <div className="lp-terminal__title">reframe · agency workflow</div>
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
    body: "Translate any page without touching the DOM structure. Language variants stored separately. Switch between English, German, French and more with no re-translating needed.",
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

const COMPARE_ROWS = [
  { label: "Import existing site", rf: true, wf: false, ai: false, manual: false },
  { label: "AI with project context", rf: true, wf: false, ai: true, manual: false },
  { label: "11 export formats", rf: true, wf: false, ai: false, manual: true },
  { label: "Native translation", rf: true, wf: "±", ai: false, manual: false },
  { label: "One-click deploy", rf: true, wf: true, ai: false, manual: false },
  { label: "Approval + version history", rf: true, wf: false, ai: false, manual: false },
  { label: "Agency pricing", rf: true, wf: false, ai: "±", manual: true },
]

type CellVal = boolean | "±"

function Cell({ v }: { v: CellVal }) {
  if (v === true) return <span className="lp-cell lp-cell--yes">✓</span>
  if (v === "±") return <span className="lp-cell lp-cell--partial">~</span>
  return <span className="lp-cell lp-cell--no">-</span>
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

function ROICalc({ t }: { t: (k: string) => string }) {
  const [projects, setProjects] = useState(4)
  const [hours, setHours] = useState(35)
  const [rate, setRate] = useState(95)
  const saved = Math.round(projects * hours * rate * 0.85 * 12)
  const { ref, visible } = useVisible()

  return (
    <div ref={ref} className={`lp-roi ${visible ? "lp-roi--visible" : ""}`}>
      <div className="lp-roi__inputs">
        <label>
          <span>{t("lp.roi.label1")}</span>
          <input type="range" min={1} max={20} value={projects} onChange={(e) => setProjects(Number(e.target.value))} />
          <strong>{projects}</strong>
        </label>
        <label>
          <span>{t("lp.roi.label2")}</span>
          <input type="range" min={5} max={80} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          <strong>{hours}h</strong>
        </label>
        <label>
          <span>{t("lp.roi.label3")}</span>
          <input type="range" min={30} max={250} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <strong>€{rate}</strong>
        </label>
      </div>
      <div className="lp-roi__result">
        <div className="lp-roi__num">€{saved.toLocaleString()}</div>
        <div className="lp-roi__label">{t("lp.roi.recovered")}</div>
        <div className="lp-roi__sub">
          {t("lp.roi.cost")}
          <br />
          {t("lp.roi.roi")} <strong>{Math.round(saved / 360)}x</strong>
        </div>
      </div>
    </div>
  )
}

function InquiryForm({ t }: { t: (k: string) => string }) {
  const [email, setEmail] = useState("")
  const [type, setType] = useState("agency")
  const [msg, setMsg] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

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
          <strong>{t("lp.inquiry.thanks")}</strong>
          <p>{t("lp.inquiry.thanks_sub")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lp-inquiry">
      <select value={type} onChange={(e) => setType(e.target.value)} className="lp-inquiry__select">
        <option value="agency">{t("lp.inquiry.select_agency")}</option>
        <option value="freelancer">{t("lp.inquiry.select_freelancer")}</option>
        <option value="inhouse">{t("lp.inquiry.select_inhouse")}</option>
        <option value="investor">{t("lp.inquiry.select_investor")}</option>
        <option value="other">{t("lp.inquiry.select_other")}</option>
      </select>
      <input
        type="email"
        placeholder={t("lp.inquiry.placeholder_email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="lp-inquiry__input"
      />
      <textarea
        placeholder={t("lp.inquiry.placeholder_msg")}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="lp-inquiry__textarea"
        rows={2}
      />
      <button onClick={submit} disabled={loading || !email.trim()} className="lp-inquiry__btn">
        {loading ? t("lp.cta.sending") : t("lp.cta.request_access")}
      </button>
    </div>
  )
}

function AnimStat({ n, label, prefix = "", suffix = "" }: { n: number; label: string; prefix?: string; suffix?: string }) {
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
      <div className="lp-stat__num">{prefix}{count.toLocaleString()}{suffix}</div>
      <div className="lp-stat__label">{label}</div>
    </div>
  )
}

const FAQS_EN = [
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

export default function LandingPage({ onEnter, onLearn }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, lang, setLang } = useTranslation()
  const [theme, setTheme] = useState<ThemeMode>(() => resolveThemePreference())
  const [langMenuOpen, setLangMenuOpen] = useState(false)

  // Sync theme with body attribute
  useEffect(() => {
    applyThemeToDocument(theme)
    const observer = new MutationObserver(() => {
      const bodyTheme = document.body.getAttribute("data-theme") as ThemeMode | null
      if (bodyTheme && bodyTheme !== theme) setTheme(bodyTheme)
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [theme])

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark"
    persistThemeChoice(next)
    applyThemeToDocument(next)
    setTheme(next)
  }

  // Collect all runtime-translatable text for non-built-in languages
  const allTexts = [
    ...FEATURES.flatMap(f => [f.tag, f.title, f.body, ...f.items]),
    ...PLANS.flatMap(p => [p.name, p.sub, ...p.items, ...p.missing]),
    ...FAQS_EN.flatMap(f => [f.q, f.a]),
    ...COMPARE_ROWS.map(r => r.label),
    "Import", "Understand", "Edit + AI", "Export + Deploy",
    "Any URL, ZIP, HTML file, PDF brief, or screenshot. Semantic parsing turns it into a structured project in minutes.",
    "Pages, blocks, SEO, forms, navigation: all parsed before AI touches anything. Real context, not clipboard paste.",
    "Visual block editor. AI rewrites with full project context. Translation. Approval queues. Version history.",
    "11 formats. One-click deploy to Firebase, Netlify, Vercel, WordPress, or Shopify.",
  ]
  const rt = useRuntimeTranslations(lang, allTexts)

  // Build translated versions of content arrays
  const translatedFeatures = FEATURES.map(f => ({
    ...f,
    tag: rt(f.tag),
    title: rt(f.title),
    body: rt(f.body),
    items: f.items.map(rt),
  }))
  const translatedPlans = PLANS.map(p => ({
    ...p,
    sub: rt(p.sub),
    items: p.items.map(rt),
    missing: p.missing.map(rt),
  }))
  const translatedFaqs = FAQS_EN.map(f => ({ q: rt(f.q), a: rt(f.a) }))
  const translatedCompare = COMPARE_ROWS.map(r => ({ ...r, label: rt(r.label) }))

  const LANG_LABELS: Record<string, string> = {
    en: "EN", de: "DE", es: "ES", fr: "FR", pt: "PT", it: "IT",
    nl: "NL", pl: "PL", ru: "RU", zh: "ZH", ja: "JA", ko: "KO",
    ar: "AR", hi: "HI", tr: "TR",
  }

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
            <button onClick={() => scrollTo("features")}>{t("lp.nav.features")}</button>
            <button onClick={() => scrollTo("compare")}>{t("lp.nav.compare")}</button>
            <button onClick={() => scrollTo("pricing")}>{t("lp.nav.pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{t("lp.nav.faq")}</button>
            <button onClick={() => scrollTo("early-access")} className="lp-nav__cta-link">{t("lp.nav.early")}</button>
          </div>
          <div className="lp-nav__actions">
            <button className="lp-btn lp-btn--ghost" onClick={onEnter}>{t("lp.nav.signin")}</button>
            <button className="lp-btn lp-btn--ghost" onClick={() => onLearn?.()}>{t("lp.nav.learn")}</button>

            {/* Language picker */}
            <div className="lp-nav__lang-wrap">
              <button
                className="lp-btn lp-btn--ghost lp-btn--icon"
                onClick={() => setLangMenuOpen(o => !o)}
                aria-label="Change language"
                aria-expanded={langMenuOpen}
              >
                {LANG_LABELS[lang] || lang.toUpperCase()}
              </button>
              {langMenuOpen && (
                <div className="lp-lang-menu" role="listbox">
                  {Object.entries(LANG_LABELS).map(([code, label]) => (
                    <button
                      key={code}
                      role="option"
                      aria-selected={lang === code}
                      className={`lp-lang-menu__item ${lang === code ? "lp-lang-menu__item--active" : ""}`}
                      onClick={() => { setLangMenuOpen(false); void setLang(code) }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              className="lp-btn lp-btn--ghost lp-btn--icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("lp.theme.light") : t("lp.theme.dark")}
              title={theme === "dark" ? t("lp.theme.light") : t("lp.theme.dark")}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>

            <button className="lp-btn lp-btn--primary" onClick={onEnter}>{t("lp.cta.start")}</button>
            <button className="lp-nav__burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
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
              {t("lp.badge")}
            </div>
            <h1 className="lp-hero__h1">
              {t("lp.hero.h1")}
            </h1>
            <p className="lp-hero__sub">
              {t("lp.hero.sub")}
            </p>
            <div className="lp-hero__btns">
              <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={onEnter}>
                {t("lp.cta.start_noccard")}
              </button>
              <button className="lp-btn lp-btn--ghost lp-btn--lg" onClick={() => onLearn?.()}>
                {t("lp.nav.learn")}
              </button>
            </div>
            <div className="lp-hero__stats">
              <AnimStat n={11} label={t("lp.stat.formats")} />
              <div className="lp-hero__stat-div" />
              <div className="lp-stat">
                <div className="lp-stat__num">∞</div>
                <div className="lp-stat__label">{t("lp.stat.languages")}</div>
              </div>
              <div className="lp-hero__stat-div" />
              <AnimStat n={17} label={t("lp.stat.hours")} suffix="h" />
            </div>
          </div>
          <div className="lp-hero__demo">
            <div className="lp-video-card">
              <div className="lp-video-card__top">
                <span className="lp-video-card__badge">60s demo</span>
                <span className="lp-video-card__meta">Guided walkthrough</span>
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
          <div className="lp-eyebrow">{t("lp.how.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.how.h2")}</h2>
          <div className="lp-workflow__steps">
            {[
              { letter: "A", title: "Import", desc: "Any URL, ZIP, HTML file, PDF brief, or screenshot. Semantic parsing turns it into a structured project in minutes." },
              { letter: "B", title: "Understand", desc: "Pages, blocks, SEO, forms, navigation: all parsed before AI touches anything. Real context, not clipboard paste." },
              { letter: "C", title: "Edit + AI", desc: "Visual block editor. AI rewrites with full project context. Translation. Approval queues. Version history." },
              { letter: "D", title: "Export + Deploy", desc: "11 formats. One-click deploy to Firebase, Netlify, Vercel, WordPress, or Shopify." },
            ].map((step, i) => (
              <div key={i} className="lp-workflow__step">
                <div className="lp-workflow__letter">{step.letter}</div>
                <div className="lp-workflow__title">{rt(step.title)}</div>
                <div className="lp-workflow__desc">{rt(step.desc)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-features">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{t("lp.features.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.features.h2")}</h2>
          <div className="lp-features__grid">
            {translatedFeatures.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="lp-compare">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{t("lp.compare.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.compare.h2")}</h2>
          <p className="lp-compare__sub">{t("lp.compare.sub")}</p>
          <div className="lp-compare__wrap">
            <table className="lp-compare__table">
              <thead>
                <tr>
                  <th>{rt("Capability")}</th>
                  <th className="lp-compare__th--rf">Reframe</th>
                  <th>{rt("Webflow")}</th>
                  <th>{rt("AI generators")}</th>
                  <th>{rt("Manual")}</th>
                </tr>
              </thead>
              <tbody>
                {translatedCompare.map((row, i) => (
                  <tr key={i}>
                    <td>{row.label}</td>
                    <td className="lp-compare__td--rf"><Cell v={row.rf as CellVal} /></td>
                    <td><Cell v={row.wf as CellVal} /></td>
                    <td><Cell v={row.ai as CellVal} /></td>
                    <td><Cell v={row.manual as CellVal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="lp-roi-section">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{t("lp.roi.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.roi.h2")}</h2>
          <p className="lp-compare__sub">{t("lp.roi.sub")}</p>
          <ROICalc t={t} />
        </div>
      </section>

      <section id="pricing" className="lp-pricing">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{t("lp.pricing.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.pricing.h2")}</h2>
          <p className="lp-compare__sub">{t("lp.pricing.sub")}</p>
          <div className="lp-pricing__grid">
            {translatedPlans.map((plan, i) => (
              <div key={i} className={`lp-plan ${plan.featured ? "lp-plan--featured" : ""}`}>
                {plan.featured && <div className="lp-plan__badge">{t("lp.pricing.popular")}</div>}
                <div className="lp-plan__name">{plan.name}</div>
                <div className="lp-plan__price">
                  {plan.price}
                  {plan.per && <span>{plan.per}</span>}
                </div>
                <div className="lp-plan__sub">{plan.sub}</div>
                <ul className="lp-plan__items">
                  {plan.items.map((item, j) => <li key={j}>{item}</li>)}
                  {plan.missing.map((item, j) => <li key={`m${j}`} className="lp-plan__item--off">{item}</li>)}
                </ul>
                <button
                  className={`lp-btn ${plan.featured ? "lp-btn--primary" : "lp-btn--ghost"} lp-btn--full`}
                  onClick={onEnter}
                >
                  {plan.price === "Free" ? t("lp.cta.start") : t("lp.cta.get_started")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="lp-faq">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">{t("lp.faq.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.faq.h2")}</h2>
          <div className="lp-faq__list">
            {translatedFaqs.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      <section id="early-access" className="lp-early">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">{t("lp.early.eyebrow")}</div>
          <h2 className="lp-h2">{t("lp.early.h2")}</h2>
          <p className="lp-early__sub">
            {t("lp.early.sub")}
          </p>
          <InquiryForm t={t} />
          <div className="lp-early__or">
            {t("lp.early.already")}{" "}
            <button className="lp-early__link" onClick={onEnter}>{t("lp.early.signin")}</button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className="lp-footer__tagline">{t("lp.footer.tagline")}</div>
          <div className="lp-footer__links">
            <button onClick={onEnter}>{t("lp.footer.signin")}</button>
            <button onClick={() => scrollTo("pricing")}>{t("lp.footer.pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{t("lp.footer.faq")}</button>
            <button onClick={() => scrollTo("early-access")}>{t("lp.footer.contact")}</button>
          </div>
          <div className="lp-footer__copy">{t("lp.footer.copy")}</div>
        </div>
      </footer>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from "react"
import "./landing.css"
import { AVAILABLE_UI_LANGUAGES, useTranslation } from "../i18n/useTranslation"
import { applyThemeToDocument, persistThemeChoice, resolveThemePreference } from "../utils/theme"

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
  tr,
}: {
  feature: (typeof FEATURES)[number]
  index: number
  tr: (value: string) => string
}) {
  const { ref, visible } = useVisible()
  return (
    <div
      ref={ref}
      className={`lp-feat ${visible ? "lp-feat--visible" : ""}`}
      style={{ transitionDelay: `${(index % 3) * 80}ms` }}
    >
      <div className="lp-feat__icon">{feature.icon}</div>
      <div className="lp-feat__tag">{tr(feature.tag)}</div>
      <div className="lp-feat__title">{tr(feature.title)}</div>
      <div className="lp-feat__body">{tr(feature.body)}</div>
      <ul className="lp-feat__list">
        {feature.items.map((item, itemIndex) => <li key={itemIndex}>{tr(item)}</li>)}
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

function ROICalc({ tr }: { tr: (value: string) => string }) {
  const [projects, setProjects] = useState(4)
  const [hours, setHours] = useState(35)
  const [rate, setRate] = useState(95)
  const saved = Math.round(projects * hours * rate * 0.85 * 12)
  const { ref, visible } = useVisible()

  return (
    <div ref={ref} className={`lp-roi ${visible ? "lp-roi--visible" : ""}`}>
      <div className="lp-roi__inputs">
        <label>
          <span>{tr("Migrations / month")}</span>
          <input type="range" min={1} max={20} value={projects} onChange={(e) => setProjects(Number(e.target.value))} />
          <strong>{projects}</strong>
        </label>
        <label>
          <span>{tr("Manual hours / project")}</span>
          <input type="range" min={5} max={80} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          <strong>{hours}h</strong>
        </label>
        <label>
          <span>{tr("Hourly rate (€)")}</span>
          <input type="range" min={30} max={250} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <strong>€{rate}</strong>
        </label>
      </div>
      <div className="lp-roi__result">
        <div className="lp-roi__num">€{saved.toLocaleString()}</div>
        <div className="lp-roi__label">{tr("recovered annually")}</div>
        <div className="lp-roi__sub">
          {tr("Reframe Pro costs €360/year.")}
          <br />
          {tr("ROI:")} <strong>{Math.round(saved / 360)}x</strong>
        </div>
      </div>
    </div>
  )
}

function InquiryForm({ tr }: { tr: (value: string) => string }) {
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
          <strong>{tr("You're on the list.")}</strong>
          <p>{tr("We'll reach out within 48 hours with early-access details and a live demo offer.")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lp-inquiry">
      <select value={type} onChange={(e) => setType(e.target.value)} className="lp-inquiry__select">
        <option value="agency">{tr("Digital agency")}</option>
        <option value="freelancer">{tr("Freelancer")}</option>
        <option value="inhouse">{tr("In-house team")}</option>
        <option value="investor">{tr("Investor")}</option>
        <option value="other">{tr("Other")}</option>
      </select>
      <input
        type="email"
        placeholder={tr("your@email.com")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="lp-inquiry__input"
      />
      <textarea
        placeholder={tr("Anything specific you want to see? (optional)")}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="lp-inquiry__textarea"
        rows={2}
      />
      <button onClick={submit} disabled={loading || !email.trim()} className="lp-inquiry__btn">
        {loading ? tr("Sending...") : tr("Request early access →")}
      </button>
    </div>
  )
}

function AnimStat({
  n,
  label,
  prefix = "",
  suffix = "",
  display,
  tr,
}: {
  n: number
  label: string
  prefix?: string
  suffix?: string
  display?: string
  tr: (value: string) => string
}) {
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
      <div className="lp-stat__label">{tr(label)}</div>
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

function FAQItem({ q, a, tr }: { q: string; a: string; tr: (value: string) => string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`lp-faq__item ${open ? "lp-faq__item--open" : ""}`} onClick={() => setOpen((o) => !o)}>
      <div className="lp-faq__q">{tr(q)}<span className="lp-faq__ic">{open ? "−" : "+"}</span></div>
      {open && <div className="lp-faq__a">{tr(a)}</div>}
    </div>
  )
}

export default function LandingPage({ onEnter, onLearn }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<"dark" | "light">(resolveThemePreference)
  const { t, lang, setLang } = useTranslation()
  const languageOptions = useMemo(() => AVAILABLE_UI_LANGUAGES.slice(0, 12), [])
  const tr = (value: string) => t(value)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  useEffect(() => {
    applyThemeToDocument(theme)
    persistThemeChoice(theme)
  }, [theme])

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <div className="lp-nav__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className={`lp-nav__links ${menuOpen ? "lp-nav__links--open" : ""}`}>
            <button onClick={() => scrollTo("features")}>{tr("Features")}</button>
            <button onClick={() => scrollTo("compare")}>{tr("Compare")}</button>
            <button onClick={() => scrollTo("pricing")}>{tr("Pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{tr("FAQ")}</button>
            <button onClick={() => scrollTo("early-access")} className="lp-nav__cta-link">{tr("Early access")}</button>
          </div>
          <div className="lp-nav__actions">
            <select
              className="lp-nav__select"
              value={lang}
              onChange={(event) => { void setLang(event.target.value) }}
              aria-label={tr("Language")}
            >
              {languageOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
            <button
              className="lp-btn lp-btn--ghost lp-btn--compact"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? tr("Light") : tr("Dark")}
            </button>
            <button className="lp-btn lp-btn--ghost lp-btn--compact" onClick={onEnter}>{tr("Sign in")}</button>
            <button className="lp-btn lp-btn--ghost lp-btn--compact" onClick={() => onLearn?.()}>{tr("Learn")}</button>
            <button className="lp-btn lp-btn--primary" onClick={onEnter}>{tr("Start free")}</button>
            <button className="lp-nav__burger" onClick={() => setMenuOpen((o) => !o)} aria-label={tr("Menu")}>
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
                {tr("Early access · Agency-first")}
              </div>
              <h1 className="lp-hero__h1">
                {tr("The site")}
                <br />
                {tr("migration")}
                <br />
                <em>{tr("engine.")}</em>
              </h1>
              <p className="lp-hero__sub">
                {tr("Import any existing website. Edit it visually with AI.")}
                <br />
                {tr("Export in whatever format your client needs.")}
              </p>
              <div className="lp-hero__btns">
                <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={onEnter}>
                  {tr("Start free - no card")}
                </button>
                <button className="lp-btn lp-btn--ghost lp-btn--lg" onClick={() => onLearn?.()}>
                  {tr("Learn")}
                </button>
              </div>
              <div className="lp-hero__stats">
                <AnimStat n={11} label="export formats" tr={tr} />
                <div className="lp-hero__stat-div" />
                <AnimStat n={0} label="languages" display={tr("all languages")} tr={tr} />
                <div className="lp-hero__stat-div" />
                <AnimStat n={17} label="hours saved/project" suffix="h" tr={tr} />
              </div>
            </div>
            <div className="lp-hero__demo">
              <div className="lp-video-card">
                <div className="lp-video-card__top">
                  <span className="lp-video-card__badge">{tr("60s demo")}</span>
                  <span className="lp-video-card__meta">{tr("Guided walkthrough")}</span>
                </div>

              <div className="lp-video-embed">
                <iframe
                  src="https://embed.app.guidde.com/playbooks/iyeGPeTVt9anr6vLen1CC5?mode=videoOnly"
                  title={tr("Reframe demo")}
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
          <div className="lp-eyebrow">{tr("How it works")}</div>
          <h2 className="lp-h2">{tr("Four steps. One system.")}</h2>
          <div className="lp-workflow__steps">
            {[
              { letter: "A", title: "Import", desc: "Any URL, ZIP, HTML file, PDF brief, or screenshot. Semantic parsing turns it into a structured project in minutes." },
              { letter: "B", title: "Understand", desc: "Pages, blocks, SEO, forms, navigation: all parsed before AI touches anything. Real context, not clipboard paste." },
              { letter: "C", title: "Edit + AI", desc: "Visual block editor. AI rewrites with full project context. Translation. Approval queues. Version history." },
              { letter: "D", title: "Export + Deploy", desc: "11 formats. One-click deploy to Firebase, Netlify, Vercel, WordPress, or Shopify." },
            ].map((step, i) => (
              <div key={i} className="lp-workflow__step">
                <div className="lp-workflow__letter">{step.letter}</div>
                <div className="lp-workflow__title">{tr(step.title)}</div>
                <div className="lp-workflow__desc">{tr(step.desc)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-features">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{tr("Features")}</div>
          <h2 className="lp-h2">
            {tr("Everything agencies need.")}
            <br />
            {tr("Nothing they don't.")}
          </h2>
          <div className="lp-features__grid">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} tr={tr} />
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="lp-compare">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{tr("Comparison")}</div>
          <h2 className="lp-h2">{tr("How Reframe fits in.")}</h2>
          <p className="lp-compare__sub">{tr("Honest comparison for agencies that start with existing sites, not agencies building from scratch.")}</p>
          <div className="lp-compare__wrap">
            <table className="lp-compare__table">
              <thead>
                <tr>
                  <th>{tr("Capability")}</th>
                  <th className="lp-compare__th--rf">Reframe</th>
                  <th>Webflow</th>
                  <th>{tr("AI generators")}</th>
                  <th>{tr("Manual")}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={i}>
                    <td>{tr(row.label)}</td>
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
          <div className="lp-eyebrow">{tr("ROI Calculator")}</div>
          <h2 className="lp-h2">{tr("Calculate your margin recovery.")}</h2>
          <p className="lp-compare__sub">{tr("Drag the sliders to match your workload.")}</p>
          <ROICalc tr={tr} />
        </div>
      </section>

      <section id="pricing" className="lp-pricing">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">{tr("Pricing")}</div>
          <h2 className="lp-h2">{tr("Pay for AI. Not for projects.")}</h2>
          <p className="lp-compare__sub">{tr("Credits deduct only when you run AI, not for editing, exporting, or storing.")}</p>
          <div className="lp-pricing__grid">
            {PLANS.map((plan, i) => (
              <div key={i} className={`lp-plan ${plan.featured ? "lp-plan--featured" : ""}`}>
                {plan.featured && <div className="lp-plan__badge">{tr("Most popular")}</div>}
                <div className="lp-plan__name">{tr(plan.name)}</div>
                <div className="lp-plan__price">
                  {plan.price}
                  {plan.per && <span>{plan.per}</span>}
                </div>
                <div className="lp-plan__sub">{tr(plan.sub)}</div>
                <ul className="lp-plan__items">
                  {plan.items.map((item, j) => <li key={j}>{tr(item)}</li>)}
                  {plan.missing.map((item, j) => <li key={`m${j}`} className="lp-plan__item--off">{tr(item)}</li>)}
                </ul>
                <button
                  className={`lp-btn ${plan.featured ? "lp-btn--primary" : "lp-btn--ghost"} lp-btn--full`}
                  onClick={onEnter}
                >
                  {plan.price === "Free" ? tr("Start free") : tr("Get started")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="lp-faq">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">{tr("FAQ")}</div>
          <h2 className="lp-h2">{tr("Common questions.")}</h2>
          <div className="lp-faq__list">
            {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} tr={tr} />)}
          </div>
        </div>
      </section>

      <section id="early-access" className="lp-early">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">{tr("Early access")}</div>
          <h2 className="lp-h2">{tr("Get in early.")}</h2>
          <p className="lp-early__sub">
            {tr("We're onboarding the first wave of agencies manually, each with a live demo call and a direct line to the team.")}
            {" "}
            {tr("Leave your email and we'll reach out within 48 hours.")}
          </p>
          <InquiryForm tr={tr} />
          <div className="lp-early__or">
            {tr("Already have an account?")}{" "}
            <button className="lp-early__link" onClick={onEnter}>{tr("Sign in")} {"→"}</button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className="lp-footer__tagline">"{tr("Import. Edit. Export.")}"</div>
          <div className="lp-footer__links">
            <button onClick={onEnter}>{tr("Sign in")}</button>
            <button onClick={() => scrollTo("pricing")}>{tr("Pricing")}</button>
            <button onClick={() => scrollTo("faq")}>{tr("FAQ")}</button>
            <button onClick={() => scrollTo("early-access")}>{tr("Contact")}</button>
          </div>
          <div className="lp-footer__copy">© 2026 Reframe · {tr("Early access")}</div>
        </div>
      </footer>
    </div>
  )
}

import React from 'react';

import { useState, useEffect, useRef } from "react"
import "./landing.css"

interface LandingPageProps {
  onEnter: () => void
  onDemoRequest?: () => void
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
    title: "50+ languages, layout intact",
    body: "Translate any page without touching the DOM structure. Language variants stored separately. Switch between English, German, French and more with no re-translating needed.",
    items: ["DOM-preserving translation", "50+ languages", "Manual segment overrides", "Language-variant share links"],
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
    items: ["All 11 export formats", "Translation · 50+ languages", "Version history", "Claude Haiku AI"],
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

function ROICalc() {
  const [projects, setProjects] = useState(4)
  const [hours, setHours] = useState(35)
  const [rate, setRate] = useState(95)
  const saved = Math.round(projects * hours * rate * 0.85 * 12)
  const { ref, visible } = useVisible()

  return (
    <div ref={ref} className={`lp-roi ${visible ? "lp-roi--visible" : ""}`}>
      <div className="lp-roi__inputs">
        <label>
          <span>Migrations / month</span>
          <input type="range" min={1} max={20} value={projects} onChange={(e) => setProjects(Number(e.target.value))} />
          <strong>{projects}</strong>
        </label>
        <label>
          <span>Manual hours / project</span>
          <input type="range" min={5} max={80} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          <strong>{hours}h</strong>
        </label>
        <label>
          <span>Hourly rate (€)</span>
          <input type="range" min={30} max={250} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <strong>€{rate}</strong>
        </label>
      </div>
      <div className="lp-roi__result">
        <div className="lp-roi__num">€{saved.toLocaleString()}</div>
        <div className="lp-roi__label">recovered annually</div>
        <div className="lp-roi__sub">
          Reframe Pro costs €360/year.
          <br />
          ROI: <strong>{Math.round(saved / 360)}x</strong>
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
          <strong>You're on the list.</strong>
          <p>We'll reach out within 48 hours with early-access details and a live demo offer.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lp-inquiry">
      <select value={type} onChange={(e) => setType(e.target.value)} className="lp-inquiry__select">
        <option value="agency">Digital agency</option>
        <option value="freelancer">Freelancer</option>
        <option value="inhouse">In-house team</option>
        <option value="investor">Investor</option>
        <option value="other">Other</option>
      </select>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="lp-inquiry__input"
      />
      <textarea
        placeholder="Anything specific you want to see? (optional)"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="lp-inquiry__textarea"
        rows={2}
      />
      <button onClick={submit} disabled={loading || !email.trim()} className="lp-inquiry__btn">
        {loading ? "Sending..." : "Request early access ->"}
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

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <div className="lp-nav__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className={`lp-nav__links ${menuOpen ? "lp-nav__links--open" : ""}`}>
            <button onClick={() => scrollTo("features")}>Features</button>
            <button onClick={() => scrollTo("compare")}>Compare</button>
            <button onClick={() => scrollTo("pricing")}>Pricing</button>
            <button onClick={() => scrollTo("faq")}>FAQ</button>
            <button onClick={() => scrollTo("early-access")} className="lp-nav__cta-link">Early access</button>
          </div>
          <div className="lp-nav__actions">
            <button className="lp-btn lp-btn--ghost" onClick={onEnter}>Sign in</button>
            <button className="lp-btn lp-btn--primary" onClick={onEnter}>Start free</button>
            <button className="lp-nav__burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
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
              Early access · Agency-first
            </div>
            <h1 className="lp-hero__h1">
              The site
              <br />
              migration
              <br />
              <em>engine.</em>
            </h1>
            <p className="lp-hero__sub">
              Import any existing website. Edit it visually with AI.
              <br />
              Export in whatever format your client needs.
            </p>
            <div className="lp-hero__btns">
              <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={onEnter}>
                Start free - no card
              </button>
              <button className="lp-btn lp-btn--ghost lp-btn--lg" onClick={() => scrollTo("features")}>
                See how it works ↓
              </button>
            </div>
            <div className="lp-hero__stats">
              <AnimStat n={11} label="export formats" />
              <div className="lp-hero__stat-div" />
              <AnimStat n={50} label="languages" suffix="+" />
              <div className="lp-hero__stat-div" />
              <AnimStat n={17} label="hours saved/project" suffix="h" />
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
          <div className="lp-eyebrow">How it works</div>
          <h2 className="lp-h2">Four steps. One system.</h2>
          <div className="lp-workflow__steps">
            {[
              { letter: "A", title: "Import", desc: "Any URL, ZIP, HTML file, PDF brief, or screenshot. Semantic parsing turns it into a structured project in minutes." },
              { letter: "B", title: "Understand", desc: "Pages, blocks, SEO, forms, navigation: all parsed before AI touches anything. Real context, not clipboard paste." },
              { letter: "C", title: "Edit + AI", desc: "Visual block editor. AI rewrites with full project context. Translation. Approval queues. Version history." },
              { letter: "D", title: "Export + Deploy", desc: "11 formats. One-click deploy to Firebase, Netlify, Vercel, WordPress, or Shopify." },
            ].map((step, i) => (
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
          <div className="lp-eyebrow">Features</div>
          <h2 className="lp-h2">
            Everything agencies need.
            <br />
            Nothing they don't.
          </h2>
          <div className="lp-features__grid">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="lp-compare">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">Comparison</div>
          <h2 className="lp-h2">How Reframe fits in.</h2>
          <p className="lp-compare__sub">Honest comparison for agencies that start with existing sites, not agencies building from scratch.</p>
          <div className="lp-compare__wrap">
            <table className="lp-compare__table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th className="lp-compare__th--rf">Reframe</th>
                  <th>Webflow</th>
                  <th>AI generators</th>
                  <th>Manual</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
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
          <div className="lp-eyebrow">ROI Calculator</div>
          <h2 className="lp-h2">Calculate your margin recovery.</h2>
          <p className="lp-compare__sub">Drag the sliders to match your workload.</p>
          <ROICalc />
        </div>
      </section>

      <section id="pricing" className="lp-pricing">
        <div className="lp-section__inner">
          <div className="lp-eyebrow">Pricing</div>
          <h2 className="lp-h2">Pay for AI. Not for projects.</h2>
          <p className="lp-compare__sub">Credits deduct only when you run AI, not for editing, exporting, or storing.</p>
          <div className="lp-pricing__grid">
            {PLANS.map((plan, i) => (
              <div key={i} className={`lp-plan ${plan.featured ? "lp-plan--featured" : ""}`}>
                {plan.featured && <div className="lp-plan__badge">Most popular</div>}
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
                  {plan.price === "Free" ? "Start free" : "Get started"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="lp-faq">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">FAQ</div>
          <h2 className="lp-h2">Common questions.</h2>
          <div className="lp-faq__list">
            {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      <section id="early-access" className="lp-early">
        <div className="lp-section__inner lp-section__inner--narrow">
          <div className="lp-eyebrow">Early access</div>
          <h2 className="lp-h2">Get in early.</h2>
          <p className="lp-early__sub">
            We're onboarding the first wave of agencies manually, each with a live demo call and a direct line to the team.
            Leave your email and we'll reach out within 48 hours.
          </p>
          <InquiryForm />
          <div className="lp-early__or">
            Already have an account?{" "}
            <button className="lp-early__link" onClick={onEnter}>Sign in {"->"}</button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__logo">
            <div className="lp-nav__mark" />
            <span>Reframe</span>
          </div>
          <div className="lp-footer__tagline">"Import. Edit. Export."</div>
          <div className="lp-footer__links">
            <button onClick={onEnter}>Sign in</button>
            <button onClick={() => scrollTo("pricing")}>Pricing</button>
            <button onClick={() => scrollTo("faq")}>FAQ</button>
            <button onClick={() => scrollTo("early-access")}>Contact</button>
          </div>
          <div className="lp-footer__copy">© 2025 Reframe · Early access</div>
        </div>
      </footer>
    </div>
  )
}

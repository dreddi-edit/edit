import { useEffect, useRef, useState, type CSSProperties } from "react"
import { apiGetProjects, apiCreateProject, apiDeleteProject, type Project, type ProjectAssignee } from "../api/projects"
import { apiGetPlan, apiGetBalance, apiGetCreditsTransactions } from "../api/credits"
import { apiFetch } from "../api/client"
import CreditsPanel from "./CreditsPanel"
import SettingsPanel from "./SettingsPanel"
import ReferralInvite from "./ReferralInvite"
import CommandPalette from "./CommandPalette"
import KeyboardShortcuts from "./KeyboardShortcuts"
import { apiLogout, type User } from "../api/auth"
import type { CreditTransaction, Plan } from "../api/types"
import { toast } from "./Toast"
import { useRuntimeTranslations, useTranslation } from "../i18n/useTranslation"
import { errMsg } from "../utils/errMsg"
import { getPlatformMeta, type SitePlatform } from "../utils/sitePlatform"
import AssistantWidget from "./AssistantWidget"
import {
  PLAN_META,
  getRequiredPlanForTool,
  hasStudioAccess,
  type StudioToolId,
} from "../utils/planAccess"
import "./project-dashboard-dark.css"

const BASE = ""
const CHECKLIST_KEY = "pd_dashboard_checklist_v1"
const NOTES_KEY = "pd_dashboard_notes_v1"

type DashboardStage = "all" | "draft" | "review" | "approved" | "shipped"
type WorkspaceView = "ai-studio" | "projects" | "templates" | "exports"
type TemplateFilter = "all" | "wordpress" | "shopify" | "webflow" | "other"
type ExportFilter = "all" | "wp-placeholder" | "html-clean" | "ready" | "guarded"
type AIStudioFilter = "all" | "creation" | "optimization" | "growth" | "autonomy"
type SpendRange = "1h" | "24h" | "7d" | "30d"
type UsageMode = "model" | "task"
type StudioTool = StudioToolId
type Template = { id: number; name: string; url?: string; platform?: SitePlatform; thumbnail?: string; created_at: string }
type ChecklistItem = { id: string; label: string; done: boolean }
type NoteItem = { id: string; text: string; done: boolean }
type SpendBreakdownItem = { label: string; amount: number; percent: number }
type AssignableMember = ProjectAssignee
type AIStudioService = {
  id: StudioToolId
  badge: string
  name: string
  tagline: string
  description: string
  category: Exclude<AIStudioFilter, "all">
  accent: string
  surface: string
  actionLabel: string
  status: string
}
type StudioAudit = {
  url: string
  scores: { performance: number; accessibility: number; seo: number; bestPractices: number }
  metrics: { fcp: string; lcp: string; cls: string; ttfb: string }
  opportunities: Array<{ id: string; title: string; value: string }>
}
type StudioSection = { label: string; items: string[] }
type StudioMarketPlan = { market: string; language: string; angle: string; offer: string }
type StudioResult = {
  headline: string
  summary: string
  sections: StudioSection[]
  markets?: StudioMarketPlan[]
  audit?: StudioAudit
}
type StudioToolMeta = {
  eyebrow: string
  title: string
  description: string
  actionLabel: string
  goalLabel: string
  audienceLabel: string
  notePlaceholder: string
  outcomes: string[]
  systems: string[]
  goalPresets: string[]
  audiencePresets: string[]
  extraFieldLabel?: string
  extraFieldPlaceholder?: string
  extraFieldPresets?: string[]
}

function titleCaseFallback(value: string): string {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "create", label: "Create first project", done: false },
  { id: "load", label: "Load a URL", done: false },
  { id: "ai", label: "Try AI block rewrite", done: false },
  { id: "export", label: "Export to ZIP", done: false },
  { id: "invite", label: "Invite a team member", done: false },
  { id: "domain", label: "Connect custom domain", done: false },
]

const MOCK_ACTIVITY = [
  { dot: "green", template: "{name} exported as ZIP", name: "Eastside Coffee", time: "12 min ago" },
  { dot: "blue", template: "AI rewrite on {name} hero section", name: "Marktplatz", time: "1h ago" },
  { dot: "amber", template: "{name} moved to approved", name: "Nordlicht Reisen", time: "3h ago" },
  { dot: "", template: "{name} project created", name: "Keramik Studio", time: "Yesterday" },
]

const DEFAULT_NOTES: NoteItem[] = [
  { id: "follow-up", text: "Follow up on guarded exports", done: false },
  { id: "review-copy", text: "Review AI spend before next export", done: false },
]

const DEFAULT_NOTE_TEXT_BY_ID = Object.fromEntries(DEFAULT_NOTES.map(item => [item.id, item.text]))

function renderActivityText(
  item: { template: string; name: string },
  rt: (text: string) => string,
) {
  const translated = rt(item.template)
  return translated.replace("{name}", `<strong>${item.name}</strong>`)
}

const AI_STUDIO_SERVICES: AIStudioService[] = [
  {
    id: "company-box",
    badge: "OS",
    name: "Company-in-a-Box",
    tagline: "From idea to operating business stack",
    description: "Generate site, offer, onboarding, CRM flows, docs, campaigns, and support assets from one brief.",
    category: "creation",
    accent: "#7dd3fc",
    surface: "linear-gradient(135deg, rgba(125, 211, 252, 0.18), rgba(14, 116, 144, 0.05))",
    actionLabel: "Assemble",
    status: "Flagship",
  },
  {
    id: "visual-product",
    badge: "VX",
    name: "Figma / Screenshot -> Product",
    tagline: "Turn references into editable software",
    description: "Convert screenshots, Figma frames, or demo videos into structured pages and production-ready frontends.",
    category: "creation",
    accent: "#93c5fd",
    surface: "linear-gradient(135deg, rgba(147, 197, 253, 0.18), rgba(30, 64, 175, 0.05))",
    actionLabel: "Convert",
    status: "Studio",
  },
  {
    id: "funnel-generator",
    badge: "FG",
    name: "Full Funnel Generator",
    tagline: "Pages, ads, emails, upsells, follow-up",
    description: "Spin up the entire acquisition and conversion machine around a product, not just a single landing page.",
    category: "creation",
    accent: "#f9a8d4",
    surface: "linear-gradient(135deg, rgba(249, 168, 212, 0.18), rgba(157, 23, 77, 0.05))",
    actionLabel: "Generate",
    status: "Growth",
  },
  {
    id: "cro-agent",
    badge: "CR",
    name: "Autonomous CRO Agent",
    tagline: "Continuous experimentation loop",
    description: "Monitor behavior, rewrite offers, test variants, and push the highest-converting version without waiting on a team.",
    category: "optimization",
    accent: "#f0abfc",
    surface: "linear-gradient(135deg, rgba(240, 171, 252, 0.18), rgba(126, 34, 206, 0.05))",
    actionLabel: "Optimize",
    status: "Always-on",
  },
  {
    id: "self-healing",
    badge: "SH",
    name: "Self-Healing Website",
    tagline: "Detect and repair breakage automatically",
    description: "Catch SEO regressions, accessibility issues, dead states, layout drift, and broken user flows before they cost revenue.",
    category: "optimization",
    accent: "#86efac",
    surface: "linear-gradient(135deg, rgba(134, 239, 172, 0.18), rgba(22, 101, 52, 0.05))",
    actionLabel: "Guard",
    status: "Reliability",
  },
  {
    id: "global-expansion",
    badge: "GL",
    name: "One-Click Global Expansion",
    tagline: "Launch for markets, not just languages",
    description: "Clone the business into new countries with localized copy, pricing, offers, SEO, and market-specific funnels.",
    category: "growth",
    accent: "#fcd34d",
    surface: "linear-gradient(135deg, rgba(252, 211, 77, 0.18), rgba(146, 64, 14, 0.05))",
    actionLabel: "Expand",
    status: "Scale",
  },
  {
    id: "sales-closer",
    badge: "SC",
    name: "AI Sales Closer",
    tagline: "Realtime voice and chat conversion agent",
    description: "Qualify, answer objections, route leads, and close lower-ticket deals directly on the site with human-like context.",
    category: "growth",
    accent: "#fb7185",
    surface: "linear-gradient(135deg, rgba(251, 113, 133, 0.18), rgba(159, 18, 57, 0.05))",
    actionLabel: "Deploy",
    status: "Revenue",
  },
  {
    id: "brand-brain",
    badge: "BB",
    name: "Brand Brain",
    tagline: "Persistent company memory and taste",
    description: "Centralize tone, messaging, product truth, objections, visual language, and decision history in one live model layer.",
    category: "autonomy",
    accent: "#a5b4fc",
    surface: "linear-gradient(135deg, rgba(165, 180, 252, 0.18), rgba(67, 56, 202, 0.05))",
    actionLabel: "Train",
    status: "Memory",
  },
  {
    id: "war-room",
    badge: "WR",
    name: "Competitor War Room",
    tagline: "Track the market in real time",
    description: "Watch launches, pricing, ad angles, SEO shifts, and messaging changes so the product can counter-move immediately.",
    category: "autonomy",
    accent: "#fdba74",
    surface: "linear-gradient(135deg, rgba(253, 186, 116, 0.18), rgba(154, 52, 18, 0.05))",
    actionLabel: "Track",
    status: "Intel",
  },
  {
    id: "personalization",
    badge: "1:1",
    name: "Personalized Site per Visitor",
    tagline: "Adaptive journeys at runtime",
    description: "Reshape copy, offers, proof, and flows per visitor intent, acquisition source, industry, and buying stage.",
    category: "autonomy",
    accent: "#67e8f9",
    surface: "linear-gradient(135deg, rgba(103, 232, 249, 0.18), rgba(8, 145, 178, 0.05))",
    actionLabel: "Personalize",
    status: "Realtime",
  },
]

const STUDIO_TOOL_META: Record<StudioTool, StudioToolMeta> = {
  "company-box": {
    eyebrow: "Flagship",
    title: "Company-in-a-Box",
    description: "Turn one business brief into a full operating stack: site, offer, onboarding, campaigns, and support assets.",
    actionLabel: "Assemble operating stack",
    goalLabel: "Business objective",
    audienceLabel: "Customer / market",
    notePlaceholder: "Mention your offer, pricing model, business constraints, or must-have operating assets.",
    outcomes: ["Core business stack blueprint", "Priority assets to generate first", "Automation and handoff plan"],
    systems: ["Project context", "Gemini planning", "Optional live URL context"],
    goalPresets: ["Launch a premium service business", "Package the offer into a clear funnel", "Build the operating system around one flagship offer"],
    audiencePresets: ["Local service buyers", "B2B decision makers", "Online-first consumers"],
    extraFieldLabel: "Core deliverables",
    extraFieldPlaceholder: "Website, onboarding, CRM flow, email sequence",
    extraFieldPresets: ["Website, onboarding, CRM flow, email sequence", "Landing page, proposal flow, nurture emails", "Site, support center, sales assets, automations"],
  },
  "visual-product": {
    eyebrow: "Studio",
    title: "Figma / Screenshot -> Product",
    description: "Translate a visual reference into a product build plan, component map, and implementation path.",
    actionLabel: "Generate product blueprint",
    goalLabel: "Build objective",
    audienceLabel: "End user",
    notePlaceholder: "Describe the reference, desired fidelity, screen set, or UX details you want preserved.",
    outcomes: ["Component and screen breakdown", "Build order for implementation", "Questions and gaps to resolve before coding"],
    systems: ["Project HTML", "Gemini product planner", "Optional live URL context"],
    goalPresets: ["Recreate a polished marketing page", "Turn a visual concept into an editable product UI", "Map the page into reusable components"],
    audiencePresets: ["Product team", "Marketing visitors", "Customer portal users"],
    extraFieldLabel: "Target output",
    extraFieldPlaceholder: "Landing page, dashboard, app shell",
    extraFieldPresets: ["Landing page, dashboard, app shell", "Marketing site, signup flow, settings", "Homepage, pricing, checkout"],
  },
  "funnel-generator": {
    eyebrow: "Growth",
    title: "Full Funnel Generator",
    description: "Design the acquisition system around the offer: landing pages, ads, emails, upsells, and follow-up.",
    actionLabel: "Generate funnel system",
    goalLabel: "Revenue goal",
    audienceLabel: "Buyer segment",
    notePlaceholder: "Mention the offer, pricing, channels, and whether the funnel should maximize leads, demos, or checkouts.",
    outcomes: ["Offer ladder and funnel map", "Assets needed for acquisition and nurture", "Channel-by-channel rollout plan"],
    systems: ["Project context", "Gemini funnel planner", "Optional live URL context"],
    goalPresets: ["Increase qualified leads", "Turn traffic into booked demos", "Build a higher-ticket funnel around the offer"],
    audiencePresets: ["Cold traffic", "Warm leads", "High-intent buyers"],
    extraFieldLabel: "Channel bundle",
    extraFieldPlaceholder: "Landing page, ads, email nurture, upsell",
    extraFieldPresets: ["Landing page, ads, email nurture, upsell", "SEO page, retargeting, sales email, checkout", "Lead magnet, booking page, proposal flow"],
  },
  "cro-agent": {
    eyebrow: "Optimization",
    title: "Autonomous CRO Agent",
    description: "Audit a live page, detect conversion friction, and return a queue of experiments and quick wins.",
    actionLabel: "Run CRO analysis",
    goalLabel: "Primary goal",
    audienceLabel: "Visitor segment / client",
    notePlaceholder: "Share known friction points, conversion goals, or current hypotheses.",
    outcomes: ["Conversion risks ranked by impact", "Experiment queue you can run next", "Immediate copy and UX wins"],
    systems: ["SEO audit", "PageSpeed signals", "Gemini strategy"],
    goalPresets: ["Lift demo bookings", "Increase quote requests", "Improve trial starts"],
    audiencePresets: ["Cold paid traffic", "High-intent search visitors", "Returning prospects"],
  },
  "self-healing": {
    eyebrow: "Reliability",
    title: "Self-Healing Website",
    description: "Scan the site for performance and SEO regressions, then generate a repair plan ranked by urgency.",
    actionLabel: "Run health scan",
    goalLabel: "Protection goal",
    audienceLabel: "Owner / team",
    notePlaceholder: "Mention recent issues, risky releases, or parts of the site that break often.",
    outcomes: ["Fragile areas to watch", "Low-risk fixes to make now", "Monitoring routine for future changes"],
    systems: ["SEO audit", "PageSpeed signals", "Gemini repair planner"],
    goalPresets: ["Stabilize page speed", "Reduce release risk", "Catch regressions earlier"],
    audiencePresets: ["Marketing team", "Growth team", "Ops owner"],
  },
  "global-expansion": {
    eyebrow: "Growth",
    title: "One-Click Global Expansion",
    description: "Generate a market entry plan with localized angles, offers, and rollout priorities for new regions.",
    actionLabel: "Build expansion plan",
    goalLabel: "Expansion goal",
    audienceLabel: "Base audience / client",
    notePlaceholder: "Mention current geography, pricing, positioning, or rollout constraints.",
    outcomes: ["Priority markets in launch order", "Localized angles and offers", "Rollout sequence by market"],
    systems: ["SEO audit", "Gemini strategy", "Localization planning"],
    goalPresets: ["Find the best next DACH markets", "Choose the fastest-win expansion path", "Adapt the offer for higher-value regions"],
    audiencePresets: ["SMB owners", "Consumers researching online", "Enterprise buyers"],
    extraFieldLabel: "Target markets",
    extraFieldPlaceholder: "Germany, Austria, Switzerland",
    extraFieldPresets: ["Germany, Austria, Switzerland", "UK, Ireland, Netherlands", "US, Canada, Australia"],
  },
  "sales-closer": {
    eyebrow: "Revenue",
    title: "AI Sales Closer",
    description: "Design the lead qualification, objection handling, routing, and closing flow for a future voice or chat agent.",
    actionLabel: "Design sales closer",
    goalLabel: "Closing objective",
    audienceLabel: "Lead type",
    notePlaceholder: "Mention common objections, qualification criteria, sales handoff needs, or deal value.",
    outcomes: ["Qualification and routing flow", "Objection handling playbook", "Lead handoff and success metrics"],
    systems: ["Project context", "Gemini conversation planner", "Optional live URL context"],
    goalPresets: ["Qualify leads before a human call", "Increase booked calls from site traffic", "Close lower-ticket deals with an AI assistant"],
    audiencePresets: ["Inbound leads", "Demo-ready prospects", "Support-to-sales opportunities"],
    extraFieldLabel: "Sales focus",
    extraFieldPlaceholder: "Qualification, objections, booking, handoff",
    extraFieldPresets: ["Qualification, objections, booking, handoff", "Discovery, routing, close signals", "Lead scoring, booking, follow-up"],
  },
  "brand-brain": {
    eyebrow: "Memory",
    title: "Brand Brain",
    description: "Extract the company voice, proof, positioning rules, and reusable messaging into one operating memory.",
    actionLabel: "Build brand brain",
    goalLabel: "Memory goal",
    audienceLabel: "Brand / client",
    notePlaceholder: "Mention must-keep phrases, taboo language, or positioning constraints.",
    outcomes: ["Brand pillars and claims", "Voice rules future agents should follow", "Reusable messaging and proof blocks"],
    systems: ["Project HTML", "Gemini extraction", "Optional live URL context"],
    goalPresets: ["Capture brand voice", "Define proof and claims", "Create reusable messaging rules"],
    audiencePresets: ["Premium B2B buyers", "Local service customers", "Founder-led brand"],
    extraFieldLabel: "Brand surfaces",
    extraFieldPlaceholder: "Homepage, pricing, offers, proof",
    extraFieldPresets: ["Homepage, pricing, offers, proof", "About, case studies, onboarding", "Ads, landing pages, emails"],
  },
  "war-room": {
    eyebrow: "Intel",
    title: "Competitor War Room",
    description: "Turn a live site into a market watchlist with competitive signals, threat patterns, and counter-moves.",
    actionLabel: "Build war room",
    goalLabel: "Intel goal",
    audienceLabel: "Category / business",
    notePlaceholder: "List known rivals, pricing pressure, or channels where competitors are beating you.",
    outcomes: ["Competitive watchlist", "Signals and threats to monitor", "Counter-moves and review cadence"],
    systems: ["SEO audit", "Gemini intel planner", "Market watch framing"],
    goalPresets: ["Track the most dangerous rivals", "Spot messaging gaps early", "Build a weekly competitor loop"],
    audiencePresets: ["Local service category", "SaaS buyers", "Ecommerce shoppers"],
    extraFieldLabel: "Competitor set",
    extraFieldPlaceholder: "Direct rivals, category leaders, local incumbents",
    extraFieldPresets: ["Direct rivals, category leaders, local incumbents", "Premium challengers, fast movers, low-cost players", "SEO leaders, paid leaders, local brands"],
  },
  personalization: {
    eyebrow: "Realtime",
    title: "Personalized Site per Visitor",
    description: "Map the best visitor segments, triggers, copy shifts, and offer variations for dynamic personalization.",
    actionLabel: "Design personalization",
    goalLabel: "Personalization goal",
    audienceLabel: "Primary audience",
    notePlaceholder: "Mention traffic sources, funnel stages, or offers that should change per visitor.",
    outcomes: ["Priority visitor segments", "Experience variants by segment", "Trigger rules and measurement plan"],
    systems: ["SEO audit", "Gemini segmentation", "On-page personalization design"],
    goalPresets: ["Match copy to visitor intent", "Lift conversion by traffic source", "Create clearer journeys by funnel stage"],
    audiencePresets: ["SMB buyers", "Consumers comparing options", "High-intent decision makers"],
    extraFieldLabel: "Visitor segments",
    extraFieldPlaceholder: "Cold paid traffic, branded search, returning visitors",
    extraFieldPresets: ["Cold paid traffic, branded search, returning visitors", "New visitors, demo-ready leads, existing customers", "Mobile traffic, desktop researchers, retargeted visitors"],
  },
}

const DASHBOARD_RUNTIME_STRINGS = Array.from(
  new Set(
    [
      ...DEFAULT_CHECKLIST.map(item => item.label),
      ...AI_STUDIO_SERVICES.flatMap(service => [
        service.tagline,
        service.description,
        service.actionLabel,
        service.status,
        titleCaseFallback(service.category),
      ]),
      ...Object.values(STUDIO_TOOL_META).flatMap(meta => [
        meta.eyebrow,
        meta.title,
        meta.description,
        meta.actionLabel,
        meta.goalLabel,
        meta.audienceLabel,
        meta.notePlaceholder,
        ...meta.outcomes,
        ...meta.systems,
        ...meta.goalPresets,
        ...meta.audiencePresets,
        meta.extraFieldLabel || "",
        meta.extraFieldPlaceholder || "",
        ...(meta.extraFieldPresets || []),
      ]),
      "Workspace",
      "Create",
      "AI models",
      "Get started",
      "Activity",
      "AI Studio",
      "Projects",
      "Exports",
      "Templates",
      "New project",
      "AI generator",
      "SEO optimizer",
      "SEO optimizer is currently in beta",
      "Hosting",
      "Hosting is currently in beta",
      "beta",
      "On",
      "Off",
      "All",
      "Creation",
      "Optimization",
      "Growth",
      "Autonomy",
      "Draft",
      "Review",
      "Approved",
      "Shipped",
      "Other",
      "Ready",
      "Guarded",
      "Filter...",
      "Launch flagship",
      "+ New project",
      "+ Extract template",
      "Spending",
      "Usage",
      "By model",
      "By task",
      "No AI spend yet in this range.",
      "Notes",
      "No notes yet.",
      "Add a note...",
      "No AI services match this view",
      "No projects yet",
      "No templates yet",
      "No exports yet",
      "Try another filter or clear the search to reveal the full AI Studio catalog.",
      "Create a new project or use the AI generator to get started.",
      "Extract a site into a reusable template to fill this workspace.",
      "Export a project from the editor and it will show up here.",
      "Show all",
      "Open projects",
      "Recent exports",
      "Download",
      "Download export for",
      "Local export",
      "items",
      "Private",
      "Exported",
      "Choose the source",
      "Pick an existing project or paste a live URL for the analysis run.",
      "Manual URL",
      "Selecting a project also pulls in its saved URL and client context.",
      "Define the outcome",
      "Tell the tool what “good” looks like so the output is specific instead of generic.",
      "Add context",
      "Use this to steer the output toward real constraints, hypotheses, or preferences.",
      "Latest run",
      "Performance",
      "Accessibility",
      "SEO",
      "Best practices",
      "Audit opportunities",
      "What you’ll get",
      "This run uses",
      "Source snapshot",
      "Selected project",
      "Live URL",
      "Project content",
      "Run status",
      "Close",
      "Running...",
      "Manual input",
      "Not set",
      "Available",
      "Missing",
      "Ready to run",
      "Needs URL",
      "Needs content",
      "Cancel",
      "Create",
      "Creating...",
      "Create project",
      "Generate landing page",
      "English",
      "German",
      "Generate",
      "Generating...",
      "Extract template",
      "Templates",
      "Project name",
      "Website URL",
      "Client name",
      "Due date",
      "Upload file",
      "Upload HTML/SVG",
      "Clear",
      "Current local upload support: `.html`, `.htm`, `.svg`.",
      "Assign team members",
      "Loading team members...",
      "No team members yet. Invite them in Settings first.",
      "Product name",
      "Target audience",
      "Description",
      "Language",
      "Template name",
      "Optional",
      "Save template",
      "Extracting...",
      "Source project",
      "A live URL is required because this workflow runs a real audit before generating the plan.",
      "Optional if the selected project already has enough content for analysis.",
      "Create first project",
      "Load a URL",
      "Try AI block rewrite",
      "Export to ZIP",
      "Invite a team member",
      "Connect custom domain",
      "{name} exported as ZIP",
      "AI rewrite on {name} hero section",
      "{name} moved to approved",
      "{name} project created",
      "12 min ago",
      "1h ago",
      "3h ago",
      "Yesterday",
      "Template",
      "Client",
      "Assigned",
      "Last export",
      "Updated",
      "Saved",
      "left",
      ...DEFAULT_NOTES.map(item => item.text),
      "A full website URL is required for this workflow.",
      "Brand Brain needs either a project with content or a full website URL.",
      "Upload currently supports .html, .htm, or .svg files.",
      "Uploaded file is empty.",
      "Loaded",
      "Template saved",
      "Template extraction failed",
      "Project name for this template:",
      "Delete template?",
      "Project created from template",
      "Export download failed",
      "Product name required",
      "Landing Page could not be generated",
      "Landing Page created",
      "URL required",
      "Loading website and preparing editor-safe HTML...",
      "Site Editor",
      "Team members",
      "Switch workspace",
      "Studio",
      "Credits remaining",
      "Sign out",
      "Settings",
      "Invite",
      "is visible and ready for wiring.",
      "Plan generated",
      "Project name required",
      "Project created",
      "Project deleted",
      "owner",
      "admin",
      "member",
      "pending",
    ].filter(Boolean),
  ),
)

function parseJsonCandidate(text: string) {
  const candidates = [text]
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) candidates.push(fenced[1])
  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(text.slice(firstBrace, lastBrace + 1))

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {}
  }
  return null
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 6)
}

function normalizeStudioResult(payload: unknown, fallbackSummary = ""): StudioResult {
  if (!payload || typeof payload !== "object") {
    return {
      headline: "Plan generated",
      summary: fallbackSummary.trim(),
      sections: [],
    }
  }

  const record = payload as Record<string, unknown>
  const sections = Array.isArray(record.sections)
    ? record.sections
        .map(section => {
          if (!section || typeof section !== "object") return null
          const value = section as Record<string, unknown>
          const label = typeof value.label === "string" ? value.label.trim() : ""
          const items = normalizeStringList(value.items)
          if (!label || !items.length) return null
          return { label, items }
        })
        .filter((section): section is StudioSection => Boolean(section))
        .slice(0, 4)
    : []

  const markets = Array.isArray(record.markets)
    ? record.markets
        .map(entry => {
          if (!entry || typeof entry !== "object") return null
          const value = entry as Record<string, unknown>
          const market = typeof value.market === "string" ? value.market.trim() : ""
          const language = typeof value.language === "string" ? value.language.trim() : ""
          const angle = typeof value.angle === "string" ? value.angle.trim() : ""
          const offer = typeof value.offer === "string" ? value.offer.trim() : ""
          if (!market || !language || !angle) return null
          return { market, language, angle, offer }
        })
        .filter((entry): entry is StudioMarketPlan => Boolean(entry))
        .slice(0, 4)
    : undefined

  return {
    headline:
      typeof record.headline === "string" && record.headline.trim() ? record.headline.trim() : "Plan generated",
    summary:
      typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : fallbackSummary.trim(),
    sections,
    markets: markets?.length ? markets : undefined,
  }
}

function loadChecklist(): ChecklistItem[] {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY)
    if (!raw) return DEFAULT_CHECKLIST.map(item => ({ ...item }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_CHECKLIST.map(item => ({ ...item }))
    return DEFAULT_CHECKLIST.map(item => {
      const saved = parsed.find((candidate: ChecklistItem) => candidate.id === item.id)
      return saved ? { ...item, done: Boolean(saved.done) } : { ...item }
    })
  } catch {
    return DEFAULT_CHECKLIST.map(item => ({ ...item }))
  }
}

function saveChecklist(items: ChecklistItem[]) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items))
  } catch {}
}

function loadNotes(): NoteItem[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return DEFAULT_NOTES.map(item => ({ ...item }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_NOTES.map(item => ({ ...item }))
    return parsed
      .filter((item): item is NoteItem => typeof item?.id === "string" && typeof item?.text === "string")
      .map(item => ({ id: item.id, text: item.text, done: Boolean(item.done) }))
      .slice(0, 8)
  } catch {
    return DEFAULT_NOTES.map(item => ({ ...item }))
  }
}

function saveNotes(items: NoteItem[]) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(items))
  } catch {}
}

function formatExportDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

function formatUpdatedDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function workflowLabel(stage?: string) {
  return String(stage || "draft").replace(/_/g, " ")
}

function workflowClass(stage?: string) {
  if (stage === "internal_review" || stage === "client_review") return "review"
  if (stage === "approved") return "approved"
  if (stage === "shipped") return "shipped"
  return "draft"
}

function displayMemberName(member?: Pick<ProjectAssignee, "name" | "email"> | null) {
  if (!member) return ""
  return member.name || member.email.split("@")[0] || member.email
}

function fileNameWithoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "")
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function plainTextFromHtml(html?: string | null) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function wrapLocalMarkup(filename: string, text: string) {
  const title = escapeHtml(fileNameWithoutExtension(filename) || "Imported file")
  if (/<svg[\s>]/i.test(text)) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html, body { margin: 0; min-height: 100%; background: #101010; }
      body { display: grid; place-items: center; padding: 24px; }
      svg { max-width: 100%; max-height: calc(100vh - 48px); height: auto; }
    </style>
  </head>
  <body>${text}</body>
</html>`
  }

  if (/<html[\s>]/i.test(text) || /<!doctype html/i.test(text)) return text

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>${text}</body>
</html>`
}

function normalizeThumbnailUrl(thumbnail?: string | null) {
  if (!thumbnail) return undefined
  const managedMatch = thumbnail.match(/^https:\/\/storage\.googleapis\.com\/[^/]+\/thumbnails\/([^/?#]+)$/)
  if (managedMatch?.[1]) return `${BASE}/thumbnails/${managedMatch[1]}`
  return thumbnail.startsWith("http") ? thumbnail : `${BASE}${thumbnail}`
}

function matchesStage(filter: DashboardStage, stage?: string) {
  if (filter === "all") return true
  if (filter === "review") return stage === "internal_review" || stage === "client_review"
  return (stage || "draft") === filter
}

function mockSeoScore(project: Project) {
  if (!project.url && !project.thumbnail) return null
  if ((project.id + (project.name?.length || 0)) % 4 === 0) return null
  return 34 + ((project.id * 17) % 62)
}

function gradientFromName(name: string) {
  const first = name.charCodeAt(0) || 77
  const second = name.charCodeAt(1) || 65
  const hue = (first * 11 + second * 7) % 360
  return `linear-gradient(135deg, hsl(${hue}, 26%, 12%) 0%, hsl(${(hue + 22) % 360}, 28%, 8%) 100%)`
}

function platformDistribution(projects: Project[]) {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const meta = getPlatformMeta(project.platform)
    counts.set(meta.shortLabel, (counts.get(meta.shortLabel) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
}

function templateDistribution(templates: Template[]) {
  const counts = new Map<string, number>()
  for (const template of templates) {
    const meta = getPlatformMeta(template.platform)
    counts.set(meta.shortLabel, (counts.get(meta.shortLabel) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
}

function exportDistribution(projects: Project[]) {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const label = exportModeLabel(project.lastExportMode)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
}

function aiStudioDistribution(services: AIStudioService[]) {
  const labels: Record<Exclude<AIStudioFilter, "all">, string> = {
    creation: "Creation",
    optimization: "Optimization",
    growth: "Growth",
    autonomy: "Autonomy",
  }
  const counts = new Map<string, number>()
  for (const service of services) {
    const label = labels[service.category]
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries())
}

function exportModeLabel(mode?: string) {
  if (mode === "wp-placeholder") return "WP"
  if (mode === "html-clean") return "HTML"
  if (mode === "html-raw") return "RAW"
  if (mode === "shopify-section") return "SHOP"
  if (mode === "wp-theme") return "THEME"
  if (mode === "wp-block") return "BLOCK"
  if (mode === "web-component") return "WC"
  if (mode === "email-newsletter") return "EMAIL"
  if (mode === "markdown-content") return "MD"
  if (mode === "pdf-print") return "PDF"
  return "ZIP"
}

function exportFilename(response: Response, mode?: string) {
  const disposition = response.headers.get("Content-Disposition") || ""
  const match = disposition.match(/filename="?([^"]+)"?/i)
  if (match?.[1]) return match[1]
  if (mode === "wp-placeholder") return "site_wp_placeholders.zip"
  if (mode === "html-clean") return "site_html_clean.zip"
  if (mode === "html-raw") return "site_html_raw.zip"
  if (mode === "shopify-section") return "shopify_section.zip"
  if (mode === "wp-theme") return "wordpress_theme.zip"
  if (mode === "wp-block") return "wordpress_block_plugin.zip"
  if (mode === "web-component") return "web_component_embed.zip"
  if (mode === "email-newsletter") return "email_newsletter.zip"
  if (mode === "markdown-content") return "content_markdown.zip"
  if (mode === "pdf-print") return "design_preview.pdf"
  return "site_export.zip"
}

function exportReadiness(project: Project) {
  return Number(project.lastExportWarningCount || 0) > 0 ? "guarded" : "ready"
}

function matchesTemplateFilter(filter: TemplateFilter, template: Template) {
  if (filter === "all") return true
  const platform = String(template.platform || "unknown")
  if (filter === "other") return !["wordpress", "shopify", "webflow"].includes(platform)
  return platform === filter
}

function matchesExportFilter(filter: ExportFilter, project: Project) {
  if (filter === "all") return true
  if (filter === "ready" || filter === "guarded") return exportReadiness(project) === filter
  return String(project.lastExportMode || "") === filter
}

function matchesAIStudioFilter(filter: AIStudioFilter, service: AIStudioService) {
  if (filter === "all") return true
  return service.category === filter
}

function rangeDuration(range: SpendRange) {
  if (range === "1h") return 60 * 60 * 1000
  if (range === "24h") return 24 * 60 * 60 * 1000
  if (range === "7d") return 7 * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

function isSpendInRange(transaction: CreditTransaction, range: SpendRange) {
  const createdAt = new Date(transaction.created_at).getTime()
  if (!Number.isFinite(createdAt)) return false
  return createdAt >= Date.now() - rangeDuration(range)
}

function normalizeModelLabel(raw: string) {
  const model = String(raw || "").trim()
  if (!model) return "Unknown"
  if (model === "claude-sonnet-4-6") return "Claude Sonnet 4.6"
  if (model === "claude-haiku-4-5-20251001") return "Claude Haiku 4.5"
  if (model === "gemini-2.5-flash") return "Gemini 2.5 Flash"
  if (model === "gemini-2.5-pro") return "Gemini 2.5 Pro"
  if (model === "ollama:qwen2.5-coder:7b") return "Ollama Qwen 2.5"
  if (model.startsWith("groq:")) return model.replace(/^groq:/, "")
  return model
}

function parseSpendTransaction(transaction: CreditTransaction) {
  const description = String(transaction.description || "")
  const taskModelMatch = description.match(/^AI:\s*([^|]+?)\s*\|\s*([^(]+?)\s*\(/i)
  if (taskModelMatch) {
    return {
      task: taskModelMatch[1].trim(),
      model: normalizeModelLabel(taskModelMatch[2].trim()),
    }
  }
  const legacyMatch = description.match(/^AI:\s*([^(]+?)\s*\(/i)
  if (legacyMatch) {
    return {
      task: "AI usage",
      model: normalizeModelLabel(legacyMatch[1].trim()),
    }
  }
  return {
    task: transaction.type === "topup" ? "Top up" : "Other",
    model: normalizeModelLabel(description || transaction.type || "unknown"),
  }
}

function buildSpendBreakdown(transactions: CreditTransaction[], mode: UsageMode): SpendBreakdownItem[] {
  const totals = new Map<string, number>()
  const spendTransactions = transactions.filter(transaction => Number(transaction.amount_eur || 0) < 0)
  for (const transaction of spendTransactions) {
    const amount = Math.abs(Number(transaction.amount_eur || 0))
    const parsed = parseSpendTransaction(transaction)
    const key = mode === "model" ? parsed.model : parsed.task
    totals.set(key, (totals.get(key) || 0) + amount)
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)
  if (!total) return []
  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      percent: Math.round((amount / total) * 100),
    }))
    .sort((left, right) => right.amount - left.amount)
}

function buildSpendBuckets(transactions: CreditTransaction[], range: SpendRange) {
  const bucketCount = 12
  const values = new Array(bucketCount).fill(0)
  const duration = rangeDuration(range)
  const bucketSize = duration / bucketCount
  const rangeStart = Date.now() - duration

  for (const transaction of transactions) {
    const amount = Math.abs(Number(transaction.amount_eur || 0))
    if (!amount) continue
    const createdAt = new Date(transaction.created_at).getTime()
    if (!Number.isFinite(createdAt) || createdAt < rangeStart) continue
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((createdAt - rangeStart) / bucketSize)))
    values[index] += amount
  }

  const peak = Math.max(...values, 0)
  if (peak <= 0) return values.map(() => 18)
  return values.map(value => Math.max(18, Math.round((value / peak) * 100)))
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
  rt,
}: {
  project: Project
  onOpen: () => void
  onDelete: () => void
  rt: (text: string) => string
}) {
  const platformMeta = getPlatformMeta(project.platform)
  const initials = project.name.slice(0, 2).toUpperCase()
  const seoScore = mockSeoScore(project)
  const seoClass = seoScore == null ? "" : seoScore > 85 ? "" : seoScore > 60 ? "mid" : "low"
  const assigneeSummary = project.assignees?.length
    ? `${displayMemberName(project.assignees[0])}${project.assignees.length > 1 ? ` +${project.assignees.length - 1}` : ""}`
    : ""

  return (
    <article
      className="pd-card"
      onClick={onOpen}
      onKeyDown={event => event.key === "Enter" && onOpen()}
      tabIndex={0}
      role="button"
      aria-label={`Open project ${project.name}`}
    >
      <div
        className="pd-card-thumb"
        style={{
          background: project.thumbnail
            ? `url(${project.thumbnail}) center/cover`
            : gradientFromName(project.name),
        }}
      >
        {!project.thumbnail ? (
          <span className="pd-card-initials" style={{ color: platformMeta.accent }}>
            {initials}
          </span>
        ) : null}
        <button
          className="pd-card-delete"
          onClick={event => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${project.name}`}
        >
          X
        </button>
        <span className="pd-card-platform">{platformMeta.label}</span>
        {seoScore != null ? (
          <div className="pd-card-seo">
            <div className={`pd-seo-ring ${seoClass}`}>{seoScore}</div>
          </div>
        ) : null}
      </div>
      <div className="pd-card-body">
        <div className="pd-card-name">{project.name}</div>
        <div className="pd-card-url">{(project.url || "local-project").replace(/^https?:\/\//, "")}</div>
        <div className="pd-card-tags">
          <span className={`pd-tag ${workflowClass(project.workflowStage)}`}>{rt(titleCaseFallback(workflowLabel(project.workflowStage)))}</span>
          {project.clientName ? <span className="pd-tag">{rt("Client")} · {project.clientName}</span> : null}
          {assigneeSummary ? <span className="pd-tag">{rt("Assigned")} · {assigneeSummary}</span> : null}
        </div>
        <div className="pd-card-date">
          {project.lastExportAt
            ? `${rt("Last export")} · ${formatExportDate(project.lastExportAt)}`
            : `${rt("Updated")} ${formatUpdatedDate(project.updated_at)}`}
        </div>
      </div>
    </article>
  )
}

function TemplateCard({
  template,
  onUse,
  onDelete,
  rt,
}: {
  template: Template
  onUse: () => void
  onDelete: () => void
  rt: (text: string) => string
}) {
  const platformMeta = getPlatformMeta(template.platform)
  const initials = template.name.slice(0, 2).toUpperCase()

  return (
    <article
      className="pd-card"
      onClick={onUse}
      onKeyDown={event => event.key === "Enter" && onUse()}
      tabIndex={0}
      role="button"
      aria-label={`Use template ${template.name}`}
    >
      <div
        className="pd-card-thumb"
        style={{
          background: template.thumbnail
            ? `url(${template.thumbnail}) center/cover`
            : gradientFromName(template.name),
        }}
      >
        {!template.thumbnail ? (
          <span className="pd-card-initials" style={{ color: platformMeta.accent }}>
            {initials}
          </span>
        ) : null}
        <button
          className="pd-card-delete"
          onClick={event => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete template ${template.name}`}
        >
          X
        </button>
        <span className="pd-card-platform">{platformMeta.label}</span>
      </div>
      <div className="pd-card-body">
        <div className="pd-card-name">{template.name}</div>
        <div className="pd-card-url">{(template.url || "saved-template").replace(/^https?:\/\//, "")}</div>
        <div className="pd-card-tags">
          <span className="pd-tag">{rt("Template")}</span>
          <span className="pd-tag">{platformMeta.shortLabel}</span>
        </div>
        <div className="pd-card-date">{rt("Saved")} {formatUpdatedDate(template.created_at)}</div>
      </div>
    </article>
  )
}

function ExportCard({
  project,
  downloading,
  onDownload,
  rt,
}: {
  project: Project
  downloading: boolean
  onDownload: () => void
  rt: (text: string) => string
}) {
  const platformMeta = getPlatformMeta(project.platform)
  const modeLabel = exportModeLabel(project.lastExportMode)
  const readiness = exportReadiness(project)
  const initials = project.name.slice(0, 2).toUpperCase()

  return (
    <article
      className="pd-card"
      onClick={onDownload}
      onKeyDown={event => event.key === "Enter" && onDownload()}
      tabIndex={0}
      role="button"
      aria-label={`${rt("Download export for")} ${project.name}`}
    >
      <div
        className="pd-card-thumb"
        style={{
          background: project.thumbnail
            ? `url(${project.thumbnail}) center/cover`
            : gradientFromName(project.name),
        }}
      >
        {!project.thumbnail ? (
          <span className="pd-card-initials" style={{ color: platformMeta.accent }}>
            {initials}
          </span>
        ) : null}
        <button
          className="pd-card-delete pd-card-action"
          onClick={event => {
            event.stopPropagation()
            onDownload()
          }}
          aria-label={`${rt("Download export for")} ${project.name}`}
        >
          {downloading ? "..." : "D"}
        </button>
        <span className="pd-card-platform">{platformMeta.label}</span>
      </div>
      <div className="pd-card-body">
        <div className="pd-card-name">{project.name}</div>
        <div className="pd-card-url">{project.url ? project.url.replace(/^https?:\/\//, "") : rt("Local export")}</div>
        <div className="pd-card-tags">
          <span className="pd-tag">{modeLabel}</span>
          <span className={`pd-tag ${readiness}`}>{rt(titleCaseFallback(readiness))}</span>
        </div>
        <div className="pd-card-date">
          {rt("Exported")} {project.lastExportAt ? formatExportDate(project.lastExportAt) : formatUpdatedDate(project.updated_at)}
        </div>
      </div>
    </article>
  )
}

function AIStudioCard({
  service,
  onOpen,
  rt,
  locked,
  requiredPlan,
}: {
  service: AIStudioService
  onOpen: () => void
  rt: (text: string) => string
  locked: boolean
  requiredPlan?: Plan
}) {
  return (
    <button
      type="button"
      className={`pd-ai-card ${locked ? "is-locked" : ""}`}
      onClick={onOpen}
      style={
        {
          "--pd-ai-accent": service.accent,
          "--pd-ai-surface": service.surface,
        } as CSSProperties
      }
    >
      <div className="pd-ai-card-top">
        <div className="pd-ai-card-mark">{service.badge}</div>
        <div className="pd-ai-card-status">
          {locked && requiredPlan ? `${rt("Unlocks on")} ${PLAN_META[requiredPlan].label}` : rt(service.status)}
        </div>
      </div>
      <div className="pd-ai-card-title">{service.name}</div>
      <div className="pd-ai-card-tagline">{rt(service.tagline)}</div>
      <div className="pd-ai-card-copy">{rt(service.description)}</div>
      <div className="pd-ai-card-bottom">
        <span className="pd-ai-card-category">{rt(titleCaseFallback(service.category))}</span>
        <span className="pd-ai-card-action">
          {locked && requiredPlan ? `${rt("Upgrade")} ->` : rt(service.actionLabel)}
        </span>
      </div>
    </button>
  )
}

export default function ProjectDashboard({ user, onOpen, onLogout }: { user: User; onOpen: (p: Project) => void; onLogout: () => void }) {
  const { t, lang } = useTranslation()
  const rt = useRuntimeTranslations(lang, DASHBOARD_RUNTIME_STRINGS, t)
  const exportSectionRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number | null>(null)
  const [plan, setPlan] = useState<Plan>("basis")
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("se_theme") as "dark" | "light") || "dark"
  )
  const [stageFilter, setStageFilter] = useState<DashboardStage>("all")
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>("all")
  const [exportFilter, setExportFilter] = useState<ExportFilter>("all")
  const [aiStudioFilter, setAIStudioFilter] = useState<AIStudioFilter>("all")
  const [spendRange, setSpendRange] = useState<SpendRange>("24h")
  const [usageMode, setUsageMode] = useState<UsageMode>("model")
  const [projectSearch, setProjectSearch] = useState("")
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>("projects")
  const [exportSectionOpen, setExportSectionOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showLandingGenerator, setShowLandingGenerator] = useState(false)
  const [showTemplateExtract, setShowTemplateExtract] = useState(false)
  const [activeStudioTool, setActiveStudioTool] = useState<StudioTool | null>(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const [landingGenerating, setLandingGenerating] = useState(false)
  const [templateExtracting, setTemplateExtracting] = useState(false)
  const [studioRunning, setStudioRunning] = useState(false)
  const [downloadingExportId, setDownloadingExportId] = useState<number | null>(null)
  const [templateExtractFeedback, setTemplateExtractFeedback] = useState("")
  const [studioProjectId, setStudioProjectId] = useState<number | "">("")
  const [studioUrl, setStudioUrl] = useState("")
  const [studioGoal, setStudioGoal] = useState("")
  const [studioAudience, setStudioAudience] = useState("")
  const [studioMarkets, setStudioMarkets] = useState("Germany, Austria, Switzerland")
  const [studioNotes, setStudioNotes] = useState("")
  const [studioResult, setStudioResult] = useState<StudioResult | null>(null)
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [newClientName, setNewClientName] = useState("")
  const [newDueAt, setNewDueAt] = useState("")
  const [newAssigneeEmails, setNewAssigneeEmails] = useState<string[]>([])
  const [newUploadHtml, setNewUploadHtml] = useState("")
  const [newUploadName, setNewUploadName] = useState("")
  const [landingName, setLandingName] = useState("")
  const [landingDesc, setLandingDesc] = useState("")
  const [landingAudience, setLandingAudience] = useState("")
  const [landingLang, setLandingLang] = useState<"english" | "german">("english")
  const [templateUrl, setTemplateUrl] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "running" | "offline">("checking")
  const [checklist, setChecklist] = useState<ChecklistItem[]>(loadChecklist)
  const [notes, setNotes] = useState<NoteItem[]>(loadNotes)
  const [newNote, setNewNote] = useState("")
  const [assignableMembers, setAssignableMembers] = useState<AssignableMember[]>([])
  const [loadingAssignableMembers, setLoadingAssignableMembers] = useState(false)
  const requestedThumbnailIds = useRef<Set<number>>(new Set())

  useEffect(() => {
    saveChecklist(checklist)
  }, [checklist])

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  useEffect(() => {
    setChecklist(prev =>
      prev.map(item => (item.id === "create" && projects.length > 0 ? { ...item, done: true } : item))
    )
  }, [projects.length])

  useEffect(() => {
    loadDashboard()
    checkOllama()
  }, [])

  useEffect(() => {
    if (!showNewProject || assignableMembers.length || loadingAssignableMembers) return
    void loadAssignableMembers()
  }, [showNewProject, assignableMembers.length, loadingAssignableMembers])

  useEffect(() => {
    const candidates = projects
      .filter(project => project.url && !project.thumbnail && !requestedThumbnailIds.current.has(project.id))
      .slice(0, 2)
    if (!candidates.length) return

    let cancelled = false
    const run = async () => {
      for (const project of candidates) {
        requestedThumbnailIds.current.add(project.id)
        try {
          const response = await apiFetch<{ ok: boolean; thumbnail?: string }>("/api/screenshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: project.url, project_id: project.id }),
          })
          if (!cancelled && response?.ok && response.thumbnail) {
            const normalizedThumbnail = normalizeThumbnailUrl(response.thumbnail)
            setProjects(previous =>
              previous.map(item => (item.id === project.id ? { ...item, thumbnail: normalizedThumbnail } : item))
            )
          }
        } catch {}
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [projects])

  useEffect(() => {
    localStorage.setItem("se_theme", theme)
    document.body.setAttribute("data-theme", theme)
  }, [theme])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandPaletteOpen(open => !open)
      }
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && target.tagName !== "SELECT") {
          event.preventDefault()
          setShortcutsOpen(open => !open)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const currentPlanMeta = PLAN_META[plan]
  const unlockedStudioServices = AI_STUDIO_SERVICES.filter(service => hasStudioAccess(plan, service.id))
  const featuredStudioService = unlockedStudioServices[0] || AI_STUDIO_SERVICES[0]
  const normalizedProjects = projects
  const selectedStudioProject =
    typeof studioProjectId === "number" ? normalizedProjects.find(project => project.id === studioProjectId) : undefined
  const studioToolMeta = activeStudioTool ? STUDIO_TOOL_META[activeStudioTool] : null
  const selectedStudioProjectText = plainTextFromHtml(selectedStudioProject?.html)
  const effectiveStudioUrl = (studioUrl.trim() || selectedStudioProject?.url || "").trim()
  const studioNeedsLiveUrl =
    activeStudioTool === "cro-agent" ||
    activeStudioTool === "self-healing" ||
    activeStudioTool === "global-expansion" ||
    activeStudioTool === "war-room" ||
    activeStudioTool === "personalization"
  const studioSourceReady = studioNeedsLiveUrl
    ? /^https?:\/\//i.test(effectiveStudioUrl)
    : Boolean(selectedStudioProjectText || /^https?:\/\//i.test(effectiveStudioUrl))
  const filteredProjects = normalizedProjects.filter(project => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      (project.url || "").toLowerCase().includes(query)
    return matchesQuery && matchesStage(stageFilter, project.workflowStage)
  })
  const filteredTemplates = templates.filter(template => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      template.name.toLowerCase().includes(query) ||
      (template.url || "").toLowerCase().includes(query)
    return matchesQuery && matchesTemplateFilter(templateFilter, template)
  })
  const exportedProjects = [...normalizedProjects]
    .filter(project => project.lastExportAt)
    .sort((left, right) => String(right.lastExportAt).localeCompare(String(left.lastExportAt)))
  const filteredExports = exportedProjects.filter(project => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      (project.url || "").toLowerCase().includes(query)
    return matchesQuery && matchesExportFilter(exportFilter, project)
  })
  const filteredAIStudioServices = AI_STUDIO_SERVICES.filter(service => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      service.name.toLowerCase().includes(query) ||
      service.tagline.toLowerCase().includes(query) ||
      service.description.toLowerCase().includes(query)
    return matchesQuery && matchesAIStudioFilter(aiStudioFilter, service)
  })

  const counts = {
    all: normalizedProjects.length,
    draft: normalizedProjects.filter(project => matchesStage("draft", project.workflowStage)).length,
    review: normalizedProjects.filter(project => matchesStage("review", project.workflowStage)).length,
    approved: normalizedProjects.filter(project => matchesStage("approved", project.workflowStage)).length,
    shipped: normalizedProjects.filter(project => matchesStage("shipped", project.workflowStage)).length,
  }

  const recentExports = exportedProjects.slice(0, 5)
  const templateCounts = {
    all: templates.length,
    wordpress: templates.filter(template => matchesTemplateFilter("wordpress", template)).length,
    shopify: templates.filter(template => matchesTemplateFilter("shopify", template)).length,
    webflow: templates.filter(template => matchesTemplateFilter("webflow", template)).length,
    other: templates.filter(template => matchesTemplateFilter("other", template)).length,
  }
  const exportCounts = {
    all: exportedProjects.length,
    "wp-placeholder": exportedProjects.filter(project => matchesExportFilter("wp-placeholder", project)).length,
    "html-clean": exportedProjects.filter(project => matchesExportFilter("html-clean", project)).length,
    ready: exportedProjects.filter(project => matchesExportFilter("ready", project)).length,
    guarded: exportedProjects.filter(project => matchesExportFilter("guarded", project)).length,
  }
  const aiStudioCounts = {
    all: AI_STUDIO_SERVICES.length,
    creation: AI_STUDIO_SERVICES.filter(service => service.category === "creation").length,
    optimization: AI_STUDIO_SERVICES.filter(service => service.category === "optimization").length,
    growth: AI_STUDIO_SERVICES.filter(service => service.category === "growth").length,
    autonomy: AI_STUDIO_SERVICES.filter(service => service.category === "autonomy").length,
  }
  const activeItemsCount =
    activeWorkspace === "ai-studio"
      ? filteredAIStudioServices.length
      : activeWorkspace === "projects"
      ? filteredProjects.length
      : activeWorkspace === "templates"
      ? filteredTemplates.length
      : filteredExports.length
  const workspaceTitle =
    activeWorkspace === "ai-studio"
      ? rt("AI Studio")
      : activeWorkspace === "projects"
      ? rt("Projects")
      : activeWorkspace === "templates"
      ? rt("Templates")
      : rt("Exports")
  const workspaceSummaryValue =
    activeWorkspace === "ai-studio"
      ? AI_STUDIO_SERVICES.length
      : activeWorkspace === "projects"
      ? normalizedProjects.length
      : activeWorkspace === "templates"
      ? templates.length
      : exportedProjects.length
  const workspaceSummaryChips =
    activeWorkspace === "ai-studio"
      ? aiStudioDistribution(AI_STUDIO_SERVICES)
      : activeWorkspace === "projects"
      ? platformDistribution(normalizedProjects)
      : activeWorkspace === "templates"
      ? templateDistribution(templates)
      : exportDistribution(exportedProjects)
  const spendTransactions = transactions.filter(
    transaction => Number(transaction.amount_eur || 0) < 0 && isSpendInRange(transaction, spendRange)
  )
  const totalSpend = spendTransactions.reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount_eur || 0)), 0)
  const spendBuckets = buildSpendBuckets(spendTransactions, spendRange)
  const usageBreakdown = buildSpendBreakdown(spendTransactions, usageMode).slice(0, 4)
  const workspacePipeline =
    activeWorkspace === "ai-studio"
      ? ([
          ["all", rt("All"), aiStudioCounts.all, "var(--pd-text-3)", () => setAIStudioFilter("all")],
          ["creation", rt("Creation"), aiStudioCounts.creation, "var(--pd-blue)", () => setAIStudioFilter("creation")],
          ["optimization", rt("Optimization"), aiStudioCounts.optimization, "var(--pd-amber)", () => setAIStudioFilter("optimization")],
          ["growth", rt("Growth"), aiStudioCounts.growth, "var(--pd-green)", () => setAIStudioFilter("growth")],
          ["autonomy", rt("Autonomy"), aiStudioCounts.autonomy, "#c084fc", () => setAIStudioFilter("autonomy")],
        ] as const)
      : activeWorkspace === "projects"
      ? ([
          ["all", rt("All"), counts.all, "var(--pd-text-3)", () => setStageFilter("all")],
          ["draft", rt("Draft"), counts.draft, "var(--pd-text-3)", () => setStageFilter("draft")],
          ["review", rt("Review"), counts.review, "var(--pd-amber)", () => setStageFilter("review")],
          ["approved", rt("Approved"), counts.approved, "var(--pd-blue)", () => setStageFilter("approved")],
          ["shipped", rt("Shipped"), counts.shipped, "var(--pd-green)", () => setStageFilter("shipped")],
        ] as const)
      : activeWorkspace === "templates"
      ? ([
          ["all", rt("All"), templateCounts.all, "var(--pd-text-3)", () => setTemplateFilter("all")],
          ["wordpress", "WordPress", templateCounts.wordpress, "var(--pd-blue)", () => setTemplateFilter("wordpress")],
          ["shopify", "Shopify", templateCounts.shopify, "var(--pd-green)", () => setTemplateFilter("shopify")],
          ["webflow", "Webflow", templateCounts.webflow, "var(--pd-amber)", () => setTemplateFilter("webflow")],
          ["other", rt("Other"), templateCounts.other, "var(--pd-text-2)", () => setTemplateFilter("other")],
        ] as const)
      : ([
          ["all", rt("All"), exportCounts.all, "var(--pd-text-3)", () => setExportFilter("all")],
          ["wp-placeholder", "WP", exportCounts["wp-placeholder"], "var(--pd-blue)", () => setExportFilter("wp-placeholder")],
          ["html-clean", "HTML", exportCounts["html-clean"], "var(--pd-green)", () => setExportFilter("html-clean")],
          ["ready", rt("Ready"), exportCounts.ready, "var(--pd-green)", () => setExportFilter("ready")],
          ["guarded", rt("Guarded"), exportCounts.guarded, "var(--pd-amber)", () => setExportFilter("guarded")],
        ] as const)

  const isPipelineFilterActive = (value: string) => {
    if (activeWorkspace === "ai-studio") return aiStudioFilter === value
    if (activeWorkspace === "projects") return stageFilter === value
    if (activeWorkspace === "templates") return templateFilter === value
    return exportFilter === value
  }

  const updateChecklist = (id: string, done = true) => {
    setChecklist(prev => prev.map(item => (item.id === id ? { ...item, done } : item)))
  }

  const resetNewProjectForm = () => {
    setShowNewProject(false)
    setNewName("")
    setNewUrl("")
    setNewClientName("")
    setNewDueAt("")
    setNewAssigneeEmails([])
    setNewUploadHtml("")
    setNewUploadName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const resetStudioTool = () => {
    setActiveStudioTool(null)
    setStudioRunning(false)
    setStudioProjectId("")
    setStudioUrl("")
    setStudioGoal("")
    setStudioAudience("")
    setStudioMarkets("Germany, Austria, Switzerland")
    setStudioNotes("")
    setStudioResult(null)
  }

  const openStudioTool = (tool: StudioTool) => {
    if (!hasStudioAccess(plan, tool)) {
      const requiredPlan = getRequiredPlanForTool(tool)
      const toolName = AI_STUDIO_SERVICES.find(service => service.id === tool)?.name || titleCaseFallback(tool)
      setShowCredits(true)
      toast.info(`${toolName} ${rt("unlocks on")} ${PLAN_META[requiredPlan].label}.`)
      return
    }
    const suggestedProject = normalizedProjects.find(project => project.url) ?? normalizedProjects[0]
    setActiveStudioTool(tool)
    setStudioProjectId(suggestedProject?.id ?? "")
    setStudioUrl(suggestedProject?.url || "")
    setStudioAudience(suggestedProject?.clientName || "")
    setStudioGoal(
      tool === "company-box"
        ? "Build the business operating stack around one flagship offer."
        : tool === "visual-product"
        ? "Turn the visual reference into a buildable product blueprint."
        : tool === "funnel-generator"
        ? "Design the full conversion funnel around the core offer."
        : tool === "cro-agent"
        ? "Increase qualified conversions on the main landing page."
        : tool === "self-healing"
        ? "Keep the site healthy, fast, and conversion-safe after every content change."
        : tool === "global-expansion"
        ? "Launch the site into high-value nearby markets with localized positioning."
        : tool === "sales-closer"
        ? "Design an AI-led qualification and booking flow."
        : tool === "brand-brain"
        ? "Codify the brand voice, messaging rules, and proof into reusable memory."
        : tool === "war-room"
        ? "Track the most dangerous competitors and define fast counter-moves."
        : "Adapt the site by visitor intent, traffic source, and funnel stage."
    )
    setStudioMarkets(
      tool === "company-box"
        ? "Website, onboarding, CRM flow, email sequence"
        : tool === "visual-product"
        ? "Landing page, dashboard, app shell"
        : tool === "funnel-generator"
        ? "Landing page, ads, email nurture, upsell"
        : tool === "global-expansion"
        ? "Germany, Austria, Switzerland"
        : tool === "sales-closer"
        ? "Qualification, objections, booking, handoff"
        : tool === "war-room"
        ? "Direct rivals, category leaders, local incumbents"
        : tool === "personalization"
        ? "Cold paid traffic, branded search, returning visitors"
        : "Homepage, pricing, offers, proof"
    )
    setStudioNotes("")
    setStudioResult(null)
  }

  const runStudioTool = async () => {
    if (!activeStudioTool) return
    const resolvedUrl = effectiveStudioUrl
    const projectText = selectedStudioProjectText.slice(0, 5000)
    const needsUrl = activeStudioTool !== "brand-brain"
    if (needsUrl && !/^https?:\/\//i.test(resolvedUrl)) {
      toast.warning(rt("A full website URL is required for this workflow."))
      return
    }
    if (activeStudioTool === "brand-brain" && !projectText && !/^https?:\/\//i.test(resolvedUrl)) {
      toast.warning(rt("Brand Brain needs either a project with content or a full website URL."))
      return
    }

    setStudioRunning(true)
    try {
      let audit: StudioAudit | undefined
      if (/^https?:\/\//i.test(resolvedUrl)) {
        const auditResponse = await apiFetch<StudioAudit & { ok: boolean; error?: string }>("/api/seo/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: resolvedUrl }),
        })
        if (!auditResponse.ok) throw new Error(auditResponse.error || "Audit failed")
        audit = {
          url: auditResponse.url,
          scores: auditResponse.scores,
          metrics: auditResponse.metrics,
          opportunities: auditResponse.opportunities,
        }
      }

      const prompt =
        activeStudioTool === "company-box"
          ? [
              "You are a business systems architect.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Core Stack","items":["..."]},{"label":"Assets to Build First","items":["..."]},{"label":"Automation Layer","items":["..."]},{"label":"Execution Sequence","items":["..."]}]}',
              `Site URL: ${resolvedUrl || "Not provided"}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Client / market: ${studioAudience.trim() || selectedStudioProject?.clientName || "Unknown"}`,
              `Business objective: ${studioGoal.trim() || "Build the operating stack around one flagship offer."}`,
              `Core deliverables: ${studioMarkets.trim() || "Website, onboarding, CRM flow, email sequence"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Visible page copy: ${projectText || "No local HTML content provided."}`,
              audit ? `Audit JSON: ${JSON.stringify(audit)}` : "Audit JSON: not available",
              "Design the essential business stack, the highest-value assets, and the fastest sequence to launch.",
            ].join("\n")
        : activeStudioTool === "visual-product"
          ? [
              "You are a product design-to-build translator.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Visual System","items":["..."]},{"label":"Component Map","items":["..."]},{"label":"Build Sequence","items":["..."]},{"label":"Open Questions","items":["..."]}]}',
              `Site URL: ${resolvedUrl || "Not provided"}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `End user: ${studioAudience.trim() || selectedStudioProject?.clientName || "Unknown"}`,
              `Build objective: ${studioGoal.trim() || "Turn the visual reference into a buildable product blueprint."}`,
              `Target output: ${studioMarkets.trim() || "Landing page, dashboard, app shell"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Visible page copy: ${projectText || "No local HTML content provided."}`,
              audit ? `Audit JSON: ${JSON.stringify(audit)}` : "Audit JSON: not available",
              "Translate the reference into a concrete component system and implementation order.",
            ].join("\n")
        : activeStudioTool === "funnel-generator"
          ? [
              "You are a full-funnel growth architect.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Offer Ladder","items":["..."]},{"label":"Acquisition Assets","items":["..."]},{"label":"Nurture Flow","items":["..."]},{"label":"Rollout Plan","items":["..."]}]}',
              `Site URL: ${resolvedUrl || "Not provided"}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Buyer segment: ${studioAudience.trim() || selectedStudioProject?.clientName || "Unknown"}`,
              `Revenue goal: ${studioGoal.trim() || "Design the full conversion funnel around the core offer."}`,
              `Channel bundle: ${studioMarkets.trim() || "Landing page, ads, email nurture, upsell"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Visible page copy: ${projectText || "No local HTML content provided."}`,
              audit ? `Audit JSON: ${JSON.stringify(audit)}` : "Audit JSON: not available",
              "Design the funnel assets, offer ladder, and rollout order around the current business.",
            ].join("\n")
        : activeStudioTool === "cro-agent"
          ? [
              "You are an elite conversion-rate strategist.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Conversion Risks","items":["..."]},{"label":"Experiment Queue","items":["..."]},{"label":"Immediate Wins","items":["..."]}]}',
              `Site URL: ${resolvedUrl}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Client: ${selectedStudioProject?.clientName || studioAudience || "Unknown"}`,
              `Primary goal: ${studioGoal.trim() || "Increase qualified conversions."}`,
              `Audience: ${studioAudience.trim() || "General website visitors"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Audit JSON: ${JSON.stringify(audit)}`,
              "Prioritize changes with the highest conversion upside and lowest implementation risk.",
            ].join("\n")
          : activeStudioTool === "self-healing"
          ? [
              "You are a website reliability and growth engineer.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Failures to Watch","items":["..."]},{"label":"Safe Fixes","items":["..."]},{"label":"Monitoring Routine","items":["..."]}]}',
              `Site URL: ${resolvedUrl}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Goal: ${studioGoal.trim() || "Keep the site healthy and resilient."}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Audit JSON: ${JSON.stringify(audit)}`,
              "Focus on regressions, fragile areas, and quick repairs that reduce future breakage.",
            ].join("\n")
          : activeStudioTool === "global-expansion"
          ? [
              "You are a global market expansion strategist.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Priority Markets","items":["..."]},{"label":"Localization Moves","items":["..."]},{"label":"Launch Sequence","items":["..."]}],"markets":[{"market":"string","language":"string","angle":"string","offer":"string"}]}',
              `Site URL: ${resolvedUrl}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Client: ${selectedStudioProject?.clientName || studioAudience || "Unknown"}`,
              `Expansion goal: ${studioGoal.trim() || "Choose the best nearby markets and localization angle."}`,
              `Target markets: ${studioMarkets.trim() || "Germany, Austria, Switzerland"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Audit JSON: ${JSON.stringify(audit)}`,
              "Propose the best launch order, language, positioning angle, and offer for each market.",
            ].join("\n")
          : activeStudioTool === "sales-closer"
          ? [
              "You are a conversational sales systems architect.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Qualification Flow","items":["..."]},{"label":"Objection Handling","items":["..."]},{"label":"Handoff Logic","items":["..."]},{"label":"Success Metrics","items":["..."]}]}',
              `Site URL: ${resolvedUrl || "Not provided"}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Lead type: ${studioAudience.trim() || selectedStudioProject?.clientName || "Unknown"}`,
              `Closing objective: ${studioGoal.trim() || "Design an AI-led qualification and booking flow."}`,
              `Sales focus: ${studioMarkets.trim() || "Qualification, objections, booking, handoff"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Visible page copy: ${projectText || "No local HTML content provided."}`,
              audit ? `Audit JSON: ${JSON.stringify(audit)}` : "Audit JSON: not available",
              "Design how an AI closer should qualify leads, handle objections, and hand off or book them.",
            ].join("\n")
          : activeStudioTool === "brand-brain"
          ? [
              "You are a brand strategist building a reusable company memory layer.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Brand Pillars","items":["..."]},{"label":"Voice Rules","items":["..."]},{"label":"Reusable Messaging","items":["..."]},{"label":"Proof and Trust Signals","items":["..."]}]}',
              `Site URL: ${resolvedUrl || "Not provided"}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Client: ${selectedStudioProject?.clientName || studioAudience || "Unknown"}`,
              `Brain goal: ${studioGoal.trim() || "Capture the brand voice and positioning system."}`,
              `Focus surfaces: ${studioMarkets.trim() || "Homepage, pricing, offers, proof"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Visible page copy: ${projectText || "No local HTML content provided."}`,
              "Extract the core voice, positioning, promises, proof, and reusable copy guidance for future agents.",
            ].join("\n")
          : activeStudioTool === "war-room"
          ? [
              "You are a competitor intelligence operator.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Watchlist","items":["..."]},{"label":"Signals to Track","items":["..."]},{"label":"Counter Moves","items":["..."]},{"label":"Weekly Ops Loop","items":["..."]}]}',
              `Site URL: ${resolvedUrl}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Business context: ${studioAudience.trim() || selectedStudioProject?.clientName || "Unknown"}`,
              `Intel goal: ${studioGoal.trim() || "Track market threats and move faster than competitors."}`,
              `Competitor set: ${studioMarkets.trim() || "Direct rivals, category leaders, local incumbents"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Audit JSON: ${JSON.stringify(audit)}`,
              "Define the competitive watchlist, the metrics/signals to monitor, and the best response plays.",
            ].join("\n")
          : [
              "You are a conversion personalization strategist.",
              "Return JSON only. No markdown, no prose outside JSON.",
              'Schema: {"headline":"string","summary":"string","sections":[{"label":"Priority Segments","items":["..."]},{"label":"Experience Variants","items":["..."]},{"label":"Trigger Rules","items":["..."]},{"label":"Measurement Plan","items":["..."]}]}',
              `Site URL: ${resolvedUrl}`,
              `Project: ${selectedStudioProject?.name || "Unknown"}`,
              `Audience: ${studioAudience.trim() || selectedStudioProject?.clientName || "Unknown"}`,
              `Personalization goal: ${studioGoal.trim() || "Adapt the site by visitor intent and funnel stage."}`,
              `Target segments: ${studioMarkets.trim() || "Cold paid traffic, branded search, returning visitors"}`,
              `Notes: ${studioNotes.trim() || "None"}`,
              `Audit JSON: ${JSON.stringify(audit)}`,
              `Visible page copy: ${projectText || "No local HTML content provided."}`,
              "Design dynamic segments, experiences, and measurement rules for per-visitor personalization.",
            ].join("\n")

      const geminiResponse = await apiFetch<{ ok: boolean; error?: string; data?: { text?: string } }>("/api/google/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: "gemini-2.5-pro" }),
      })
      if (!geminiResponse.ok) throw new Error(geminiResponse.error || "Strategy generation failed")

      const rawText = String(geminiResponse.data?.text || "").trim()
      const parsed = normalizeStudioResult(parseJsonCandidate(rawText), rawText)
      setStudioResult({ ...parsed, audit })
      updateChecklist("ai", true)
      toast.success(`${studioToolMeta?.title || "AI Studio"} ready`)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setStudioRunning(false)
    }
  }

  const loadAssignableMembers = async () => {
    setLoadingAssignableMembers(true)
    try {
      const response = await apiFetch<{ ok: boolean; members?: AssignableMember[] }>("/api/projects/assignee-options")
      if (response?.ok) setAssignableMembers(response.members ?? [])
    } catch {
      setAssignableMembers([{ email: user.email, name: user.name || user.email, role: "owner", source: "owner", status: "accepted" }])
    } finally {
      setLoadingAssignableMembers(false)
    }
  }

  const toggleAssignee = (email: string) => {
    setNewAssigneeEmails(previous =>
      previous.includes(email) ? previous.filter(value => value !== email) : [...previous, email]
    )
  }

  const handleUploadProjectFile = async (file?: File | null) => {
    if (!file) return
    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!["html", "htm", "svg"].includes(extension)) {
      toast.warning(rt("Upload currently supports .html, .htm, or .svg files."))
      return
    }

    try {
      const text = await file.text()
      if (!text.trim()) throw new Error(rt("Uploaded file is empty."))
      const html = wrapLocalMarkup(file.name, text)
      setNewUploadHtml(html)
      setNewUploadName(file.name)
      if (!newName.trim()) setNewName(fileNameWithoutExtension(file.name))
      toast.success(`${rt("Loaded")} ${file.name}`)
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await apiFetch<{ ok: boolean; templates?: Template[] }>("/api/templates")
      if (response.ok) {
        setTemplates(
          (response.templates ?? []).map(template => ({
            ...template,
            thumbnail: normalizeThumbnailUrl(template.thumbnail),
          }))
        )
      }
    } catch {
      setTemplates([])
    }
  }

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [projectData, currentBalance, currentPlan, creditTransactions] = await Promise.all([
        apiGetProjects(),
        apiGetBalance().catch(() => null),
        apiGetPlan().catch(() => null),
        apiGetCreditsTransactions().catch(() => ({ ok: false, transactions: [] as CreditTransaction[] })),
      ])
      setProjects(
        projectData.map(project => ({
          ...project,
          thumbnail: normalizeThumbnailUrl(project.thumbnail),
        }))
      )
      setBalance(currentBalance)
      if (currentPlan) setPlan(currentPlan)
      if (creditTransactions.ok) setTransactions(creditTransactions.transactions ?? [])
      await loadTemplates()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setLoading(false)
    }
  }

  const checkOllama = async () => {
    setOllamaStatus("checking")
    try {
      const response = await fetch("/api/ai/ollama-health", {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      })
      const data = await response.json()
      setOllamaStatus(data?.ok ? "running" : "offline")
    } catch {
      setOllamaStatus("offline")
    }
  }

  const handleOpenProject = (project: Project) => {
    updateChecklist("load", true)
    onOpen(project)
  }

  const createProject = async () => {
    if (!newName.trim()) {
      toast.warning(rt("Project name required"))
      return
    }
    setCreatingProject(true)
    try {
      const selectedAssignees = newAssigneeEmails
        .map(email => assignableMembers.find(member => member.email === email) || { email })
        .map(member => ({ email: member.email, role: member.role || "editor" }))
      const project = await apiCreateProject(newName.trim(), newUrl.trim(), newUploadHtml, undefined, {
        clientName: newClientName.trim() || "",
        dueAt: newDueAt || "",
        assignees: selectedAssignees,
      })
      updateChecklist("create", true)
      if (newUrl.trim()) updateChecklist("load", true)
      setProjects(prev => [project, ...prev.filter(candidate => candidate.id !== project.id)])
      resetNewProjectForm()
      toast.success(rt("Project created"))
      await loadDashboard()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setCreatingProject(false)
    }
  }

  const deleteProject = async (id: number, name: string) => {
    if (!window.confirm(`Delete project "${name}"?`)) return
    try {
      await apiDeleteProject(id)
      setProjects(prev => prev.filter(project => project.id !== id))
      toast.success(rt("Project deleted"))
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const generateLandingPage = async () => {
    if (!landingName.trim()) {
      toast.warning(rt("Product name required"))
      return
    }
    setLandingGenerating(true)
    try {
      const data = await apiFetch<{
        ok?: boolean
        error?: string
        html?: string
        platform?: SitePlatform
      }>("/api/ai/demo-landing-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: landingName.trim(),
          description: landingDesc.trim() || "AI-powered workflow platform",
          audience: landingAudience.trim() || "modern teams",
          language: landingLang,
          complexity: 5,
        }),
      })

      if (!data?.ok || !data.html) {
        throw new Error(data?.error || rt("Landing Page could not be generated"))
      }

      const createdProject = await apiCreateProject(
        landingName.trim(),
        "",
        String(data.html || ""),
        data.platform || "static"
      )

      updateChecklist("ai", true)
      setShowLandingGenerator(false)
      setLandingName("")
      setLandingDesc("")
      setLandingAudience("")
      setLandingLang("english")
      toast.success(rt("Landing Page created"))
      await loadDashboard()
      handleOpenProject(createdProject)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setLandingGenerating(false)
    }
  }

  const extractTemplate = async () => {
    if (!templateUrl.trim()) {
      toast.warning(rt("URL required"))
      return
    }
    setTemplateExtracting(true)
    setTemplateExtractFeedback(rt("Loading website and preparing editor-safe HTML..."))
    try {
      let fallbackName = templateUrl.trim()
      try {
        fallbackName = new URL(templateUrl.trim()).hostname
      } catch {}
      const response = await apiFetch<{
        ok: boolean
        error?: string
        template?: { id: number; name: string; url?: string; platform?: SitePlatform }
      }>("/api/templates/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: templateUrl.trim(),
          name: templateName.trim() || fallbackName,
        }),
      })
      if (!response.ok || !response.template) {
        throw new Error(response.error || rt("Template extraction failed"))
      }
      toast.success(rt("Template saved"))
      setShowTemplateExtract(false)
      setTemplateUrl("")
      setTemplateName("")
      setTemplateExtractFeedback("")
      await loadTemplates()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setTemplateExtracting(false)
    }
  }

  const applyTemplate = async (templateId: number) => {
    const projectName = window.prompt(rt("Project name for this template:"))
    if (!projectName) return
    setApplyingTemplateId(templateId)
    try {
      const response = await apiFetch<{ ok: boolean; error?: string }>("/api/templates/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template_id: templateId, name: projectName }),
      })
      if (!response?.ok) throw new Error(response?.error || "Template apply failed")
      toast.success(rt("Project created from template"))
      await loadDashboard()
      setActiveWorkspace("projects")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setApplyingTemplateId(null)
    }
  }

  const deleteTemplate = async (id: number) => {
    if (!window.confirm(rt("Delete template?"))) return
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE", credentials: "include" })
      await loadTemplates()
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const addNote = () => {
    if (!newNote.trim()) return
    setNotes(previous => [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text: newNote.trim(), done: false },
      ...previous,
    ].slice(0, 8))
    setNewNote("")
  }

  const toggleNote = (id: string) => {
    setNotes(previous => previous.map(note => (note.id === id ? { ...note, done: !note.done } : note)))
  }

  const deleteNote = (id: string) => {
    setNotes(previous => previous.filter(note => note.id !== id))
  }

  const downloadExport = async (project: Project) => {
    setDownloadingExportId(project.id)
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          html: project.html,
          url: project.url,
          mode: project.lastExportMode || "html-clean",
          platform: project.platform,
          project_id: project.id,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let message = rt("Export download failed")
        try {
          const data = JSON.parse(text)
          if (data?.error) message = data.error
        } catch {}
        throw new Error(message)
      }

      const blob = await response.blob()
      const fileUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = fileUrl
      anchor.download = exportFilename(response, project.lastExportMode)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(fileUrl)

      updateChecklist("export", true)
      await loadDashboard()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setDownloadingExportId(null)
    }
  }

  const openExports = () => {
    setActiveWorkspace("exports")
    setExportSectionOpen(true)
  }

  const openAIStudioService = (service: AIStudioService) => {
    if (!hasStudioAccess(plan, service.id)) {
      const requiredPlan = getRequiredPlanForTool(service.id)
      setShowCredits(true)
      toast.info(`${service.name} ${rt("unlocks on")} ${PLAN_META[requiredPlan].label}.`)
      return
    }
    openStudioTool(service.id)
  }

  const logout = async () => {
    await apiLogout()
    onLogout()
  }

  const aiModelRows = [
    { name: "Gemini 2.5 Flash", on: true },
    { name: "Gemini 2.5 Pro", on: true },
    { name: "Claude Sonnet 4.6", on: true },
    { name: "Claude Opus 4.6", on: false },
    { name: "GPT-4o", on: false },
    { name: "GPT-4o mini", on: false },
    { name: "Mistral Large", on: false },
    { name: "Llama 3.3 70B", on: false },
    { name: "Ollama (local)", on: ollamaStatus === "running" },
  ]

  return (
    <div className="pd-shell">
      <header className="pd-header">
        <div className="pd-logo">
          <div className="pd-logo-mark">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.9" />
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.45" />
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.45" />
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.2" />
            </svg>
          </div>
          {rt("Site Editor")}
        </div>

        <div className="pd-header-spacer" />

        <div className="pd-header-right">
          <div className="pd-team-stack" title={rt("Team members")}>
            <div className="pd-team-avatar" style={{ background: "#1a2332" }}>EB</div>
            <div className="pd-team-avatar" style={{ background: "#2a1a20" }}>LK</div>
            <div className="pd-team-avatar" style={{ background: "#1a2a1a" }}>MR</div>
            <div className="pd-team-more">+2</div>
          </div>
          <div className="pd-divider" />

          <div className="pd-studio-split" title={rt("Switch workspace")}>
            <button className="pd-studio-half" type="button">
              <span className="pd-studio-dot" />
              {rt("Studio")}
            </button>
            <button className="pd-studio-half" type="button">{rt("Private")}</button>
          </div>

          <div className="pd-divider" />

          <div className="pd-badge pd-badge-pro">
            <span className="pd-badge-dot" />
            {currentPlanMeta.label}
          </div>

          <button className="pd-btn" type="button" onClick={() => setShowCredits(true)} title={rt("Credits remaining")}>
            <span className="pd-btn-icon">+</span>
            <span className="pd-btn-strong">EUR{balance === null ? "..." : balance.toFixed(2)}</span>
            <span className="pd-btn-muted">{rt("left")}</span>
          </button>

          <div className="pd-divider" />

          <button className="pd-btn" type="button" onClick={() => setShowSettings(true)}>{rt("Settings")}</button>
          <button
            className="pd-btn"
            type="button"
            onClick={() => {
              updateChecklist("invite", true)
              setShowInvite(true)
            }}
          >
            {rt("Invite")}
          </button>
          <button className="pd-btn" type="button" onClick={logout} title={rt("Sign out")}>
            {(user.email || "account").replace(/(.{12}).+/, "$1...")} v
          </button>
        </div>
      </header>

      <div className="pd-body">
        <aside className="pd-sidebar">
          <div className="pd-sidebar-section">{rt("Workspace")}</div>
          <div className="pd-scroll-box">
            <button
              className={`pd-sidebar-item ${activeWorkspace === "ai-studio" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveWorkspace("ai-studio")}
            >
              <span className="pd-sidebar-icon">AI</span>
              {rt("AI Studio")}
              <span className="pd-sidebar-pill">{AI_STUDIO_SERVICES.length}</span>
            </button>
            <button
              className={`pd-sidebar-item ${activeWorkspace === "projects" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveWorkspace("projects")}
            >
              <span className="pd-sidebar-icon">[]</span>
              {rt("Projects")}
              <span className="pd-sidebar-pill">{projects.length}</span>
            </button>
            <button
              className={`pd-sidebar-item ${activeWorkspace === "templates" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveWorkspace("templates")}
            >
              <span className="pd-sidebar-icon">[]</span>
              {rt("Templates")}
              <span className="pd-sidebar-pill">{templates.length}</span>
            </button>
            <button
              className={`pd-sidebar-item ${activeWorkspace === "exports" ? "is-active" : ""}`}
              type="button"
              onClick={openExports}
            >
              <span className="pd-sidebar-icon">D</span>
              {rt("Exports")}
              <span className="pd-sidebar-pill">{exportedProjects.length}</span>
            </button>
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">{rt("Create")}</div>
          <div className="pd-scroll-box">
            <button className="pd-sidebar-item" type="button" onClick={() => setShowNewProject(true)}>
              <span className="pd-sidebar-icon">+</span>
              {rt("New project")}
            </button>
            <button className="pd-sidebar-item" type="button" onClick={() => setShowLandingGenerator(true)}>
              <span className="pd-sidebar-icon">*</span>
              {rt("AI generator")}
            </button>
            <button className="pd-sidebar-item" type="button" onClick={() => toast.warning(rt("SEO optimizer is currently in beta"))}>
              <span className="pd-sidebar-icon">SEO</span>
              {rt("SEO optimizer")}
              <span className="pd-sidebar-pill">{rt("beta")}</span>
            </button>
            <button className="pd-sidebar-item" type="button" onClick={() => toast.warning(rt("Hosting is currently in beta"))}>
              <span className="pd-sidebar-icon">C</span>
              {rt("Hosting")}
              <span className="pd-sidebar-pill">{rt("beta")}</span>
            </button>
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">{rt("AI models")}</div>
          <div className="pd-scroll-box">
            {aiModelRows.map(model => (
              <div key={model.name} className="pd-ai-row">
                <span className="pd-ai-name">{model.name}</span>
                <span className={`pd-ai-status ${model.on ? "is-on" : "is-off"}`}>
                  <span className={`pd-dot ${model.on ? "is-on" : "is-off"}`} />
                  {model.on ? rt("On") : rt("Off")}
                </span>
              </div>
            ))}
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">{rt("Get started")}</div>
          <div className="pd-scroll-box pd-scroll-box-tall">
            {checklist.map(item => (
              <button
                key={item.id}
                className="pd-checklist-item"
                type="button"
                onClick={() => updateChecklist(item.id, !item.done)}
              >
                <div className={`pd-checklist-box ${item.done ? "is-done" : ""}`}>{item.done ? "v" : ""}</div>
                <span className={`pd-checklist-text ${item.done ? "is-done" : ""}`}>{rt(item.label)}</span>
              </button>
            ))}
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">{rt("Activity")}</div>
          <div className="pd-scroll-box pd-scroll-box-tall">
            {MOCK_ACTIVITY.map((item, index) => (
              <div key={`${item.time}-${index}`} className="pd-feed-item">
                <div className={`pd-feed-dot ${item.dot || ""}`} />
                {index < MOCK_ACTIVITY.length - 1 ? <div className="pd-feed-line" /> : null}
                <div className="pd-feed-body">
                  <div className="pd-feed-text" dangerouslySetInnerHTML={{ __html: renderActivityText(item, rt) }} />
                  <div className="pd-feed-time">{rt(item.time)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pd-sidebar-footer">
            <div className="pd-sidebar-divider" />
            <button className="pd-sidebar-item" type="button" onClick={logout}>
              <span className="pd-sidebar-icon">&lt;-</span>
              {rt("Sign out")}
            </button>
          </div>
        </aside>

        <main className="pd-main">
          <div className="pd-pipeline">
            {workspacePipeline.map(([value, label, count, color, onSelect]) => (
              <button
                key={value}
                className={`pd-pipe-stage ${isPipelineFilterActive(value) ? "is-active" : ""}`}
                type="button"
                onClick={onSelect}
              >
                <span className="pd-pipe-dot" style={{ background: color }} />
                <span className="pd-pipe-label">{label}</span>
                <span className="pd-pipe-count">{count}</span>
              </button>
            ))}
          </div>

          <div className="pd-toolbar">
            <span className="pd-toolbar-title">{workspaceTitle}</span>
            <span className="pd-toolbar-count">{activeItemsCount} {rt("items")}</span>
            <div className="pd-toolbar-spacer" />
            <input
              className="pd-filter-input"
              placeholder={rt("Filter...")}
              value={projectSearch}
              onChange={event => setProjectSearch(event.target.value)}
            />
            {activeWorkspace === "ai-studio" ? (
              <button
                className="pd-btn pd-btn-primary"
                type="button"
                onClick={() => openAIStudioService(featuredStudioService)}
              >
                {rt("Launch included tool")}
              </button>
            ) : activeWorkspace === "projects" ? (
              <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowNewProject(true)}>
                {rt("+ New project")}
              </button>
            ) : activeWorkspace === "templates" ? (
              <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowTemplateExtract(true)}>
                {rt("+ Extract template")}
              </button>
            ) : (
              <button className="pd-btn pd-btn-primary" type="button" onClick={() => setActiveWorkspace("projects")}>
                {rt("Projects")}
              </button>
            )}
          </div>

          <div className="pd-stats">
            <section className="pd-stat">
              <span className="pd-stat-label">{workspaceTitle}</span>
              <span className="pd-stat-value">{workspaceSummaryValue}</span>
              <div className="pd-plat-dist">
                {workspaceSummaryChips.length > 0 ? (
                  workspaceSummaryChips.map(([label, count]) => (
                    <span key={label} className="pd-plat-chip">
                      {count} {label}
                    </span>
                  ))
                ) : (
                  <span className="pd-plat-chip">0 {workspaceTitle.toLowerCase()}</span>
                )}
              </div>
            </section>

            <section className="pd-stat">
              <span className="pd-stat-label">{rt("Spending")}</span>
              <span className="pd-stat-value">EUR{totalSpend.toFixed(2)}</span>
              <div className="pd-spend-tabs">
                {(["1h", "24h", "7d", "30d"] as SpendRange[]).map(range => (
                  <button
                    key={range}
                    className={`pd-spend-tab ${spendRange === range ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setSpendRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <div className="pd-sparkline">
                {spendBuckets.map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className={`pd-spark-bar ${height === Math.max(...spendBuckets) && totalSpend > 0 ? "is-hi" : ""}`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </section>

            <section className="pd-stat">
              <span className="pd-stat-label">{rt("Usage")}</span>
              <div className="pd-usage-toggle-row">
                <button
                  className={`pd-usage-toggle ${usageMode === "model" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setUsageMode("model")}
                >
                  {rt("By model")}
                </button>
                <button
                  className={`pd-usage-toggle ${usageMode === "task" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setUsageMode("task")}
                >
                  {rt("By task")}
                </button>
              </div>
              <div className="pd-usage-list">
                {usageBreakdown.length > 0 ? (
                  usageBreakdown.map(item => (
                    <div key={item.label} className="pd-usage-row">
                      <div className="pd-usage-head">
                        <span className="pd-usage-label">{item.label}</span>
                        <span className="pd-usage-percent">{item.percent}%</span>
                      </div>
                      <div className="pd-usage-track">
                        <div className="pd-usage-fill" style={{ width: `${Math.max(item.percent, 6)}%` }} />
                      </div>
                      <div className="pd-usage-amount">EUR{item.amount.toFixed(2)}</div>
                    </div>
                  ))
                ) : (
                  <div className="pd-usage-empty">{rt("No AI spend yet in this range.")}</div>
                )}
              </div>
            </section>

            <section className="pd-stat pd-stat-notes">
              <span className="pd-stat-label">{rt("Notes")}</span>
              <div className="pd-notes-list">
                {notes.length > 0 ? (
                  notes.map(note => (
                    <div key={note.id} className="pd-note-row">
                      <button className={`pd-note-check ${note.done ? "is-done" : ""}`} type="button" onClick={() => toggleNote(note.id)}>
                        {note.done ? "v" : ""}
                      </button>
                      <span className={`pd-note-text ${note.done ? "is-done" : ""}`}>
                        {DEFAULT_NOTE_TEXT_BY_ID[note.id] ? rt(DEFAULT_NOTE_TEXT_BY_ID[note.id]) : note.text}
                      </span>
                      <button className="pd-note-delete" type="button" onClick={() => deleteNote(note.id)}>
                        X
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="pd-usage-empty">{rt("No notes yet.")}</div>
                )}
              </div>
              <div className="pd-note-input-row">
                <input
                  className="pd-note-input"
                  value={newNote}
                  onChange={event => setNewNote(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addNote()
                    }
                  }}
                  placeholder={rt("Add a note...")}
                />
                <button className="pd-note-add" type="button" onClick={addNote}>
                  +
                </button>
              </div>
            </section>
          </div>

          <div className="pd-projects-area">
            {loading ? (
              <div className="pd-projects-grid">
                {[1, 2, 3, 4, 5, 6].map(index => (
                  <div key={index} className="pd-card pd-card-skeleton" />
                ))}
              </div>
            ) : activeWorkspace === "ai-studio" && filteredAIStudioServices.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredAIStudioServices.map(service => (
                  <AIStudioCard
                    key={service.id}
                    service={service}
                    rt={rt}
                    locked={!hasStudioAccess(plan, service.id)}
                    requiredPlan={hasStudioAccess(plan, service.id) ? undefined : getRequiredPlanForTool(service.id)}
                    onOpen={() => openAIStudioService(service)}
                  />
                ))}
              </div>
            ) : activeWorkspace === "projects" && filteredProjects.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    rt={rt}
                    onOpen={() => handleOpenProject(project)}
                    onDelete={() => deleteProject(project.id, project.name)}
                  />
                ))}
              </div>
            ) : activeWorkspace === "templates" && filteredTemplates.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    rt={rt}
                    onUse={() => applyTemplate(template.id)}
                    onDelete={() => deleteTemplate(template.id)}
                  />
                ))}
              </div>
            ) : activeWorkspace === "exports" && filteredExports.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredExports.map(project => (
                  <ExportCard
                    key={project.id}
                    project={project}
                    rt={rt}
                    downloading={downloadingExportId === project.id}
                    onDownload={() => downloadExport(project)}
                  />
                ))}
              </div>
            ) : (
              <div className="pd-empty-state">
                <div className="pd-empty-title">
                  {activeWorkspace === "ai-studio"
                    ? rt("No AI services match this view")
                    : activeWorkspace === "projects"
                    ? rt("No projects yet")
                    : activeWorkspace === "templates"
                    ? rt("No templates yet")
                    : rt("No exports yet")}
                </div>
                <div className="pd-empty-copy">
                  {activeWorkspace === "ai-studio"
                    ? rt("Try another filter or clear the search to reveal the full AI Studio catalog.")
                    : activeWorkspace === "projects"
                    ? rt("Create a new project or use the AI generator to get started.")
                    : activeWorkspace === "templates"
                    ? rt("Extract a site into a reusable template to fill this workspace.")
                    : rt("Export a project from the editor and it will show up here.")}
                </div>
                <div className="pd-empty-actions">
                  {activeWorkspace === "ai-studio" ? (
                    <>
                      <button
                        className="pd-btn pd-btn-primary"
                        type="button"
                        onClick={() => {
                          setAIStudioFilter("all")
                          setProjectSearch("")
                        }}
                      >
                        {rt("Show all")}
                      </button>
                      <button className="pd-btn" type="button" onClick={() => openAIStudioService(featuredStudioService)}>
                        {rt("Launch included tool")}
                      </button>
                    </>
                  ) : activeWorkspace === "projects" ? (
                    <>
                      <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowNewProject(true)}>
                        {rt("+ New project")}
                      </button>
                      <button className="pd-btn" type="button" onClick={() => setShowLandingGenerator(true)}>
                        {rt("AI generator")}
                      </button>
                    </>
                  ) : activeWorkspace === "templates" ? (
                    <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowTemplateExtract(true)}>
                      {rt("+ Extract template")}
                    </button>
                  ) : (
                    <button className="pd-btn pd-btn-primary" type="button" onClick={() => setActiveWorkspace("projects")}>
                      {rt("Open projects")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeWorkspace === "projects" ? (
              <div
                ref={exportSectionRef}
                className={`pd-export-section ${exportSectionOpen ? "is-open" : ""}`}
              >
                <button
                  className="pd-export-section-label"
                  type="button"
                  onClick={() => setExportSectionOpen(open => !open)}
                >
                  {rt("Recent exports")}
                  <span className="pd-export-arrow">v</span>
                </button>
                <div className="pd-export-table">
                  {recentExports.length > 0 ? (
                    recentExports.map(project => (
                      <div key={project.id} className="pd-export-row">
                        <span className="pd-export-icon">D</span>
                        <span className="pd-export-name">{project.name}</span>
                        <span className="pd-export-type">{project.platform ? getPlatformMeta(project.platform).shortLabel : "ZIP"}</span>
                        <span className="pd-export-date">
                          {project.lastExportAt ? new Date(project.lastExportAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "--"}
                        </span>
                        <button
                          className="pd-export-download"
                          type="button"
                          onClick={() => downloadExport(project)}
                        >
                          {downloadingExportId === project.id ? "..." : `D ${rt("Download")}`}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="pd-export-empty">{rt("No exports yet")}</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        projects={projects}
        onOpenProject={handleOpenProject}
        onNewProject={() => setShowNewProject(true)}
        onCredits={() => setShowCredits(true)}
        onSettings={() => setShowSettings(true)}
        onInvite={() => {
          updateChecklist("invite", true)
          setShowInvite(true)
        }}
        onSignOut={logout}
        theme={theme}
      />

      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} theme={theme} />
      {showCredits ? <CreditsPanel onClose={() => { setShowCredits(false); loadDashboard() }} /> : null}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} onThemeChange={value => setTheme(value as "dark" | "light")} /> : null}
      {showInvite ? <ReferralInvite theme={theme} userEmail={user.email} onClose={() => setShowInvite(false)} /> : null}

      <AssistantWidget
        plan={plan}
        context={{
          surface: "dashboard",
          plan,
          workspace: workspaceTitle,
          projectName: selectedStudioProject?.name,
          projectUrl: effectiveStudioUrl,
          platform: selectedStudioProject?.platform || "",
        }}
      />

      {activeStudioTool && studioToolMeta ? (
        <div className="pd-modal-backdrop" onClick={resetStudioTool}>
          <div className="pd-modal pd-modal-wide" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">{rt(studioToolMeta.eyebrow)}</div>
                <div className="pd-modal-title">{rt(studioToolMeta.title)}</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={resetStudioTool}>X</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-studio-layout">
                <div className="pd-studio-main">
                  <div className="pd-helper-copy pd-studio-intro">{rt(studioToolMeta.description)}</div>

                  <section className="pd-studio-block">
                    <div className="pd-studio-block-head">
                      <span className="pd-studio-step">01</span>
                      <div>
                        <div className="pd-studio-block-title">{rt("Choose the source")}</div>
                        <div className="pd-studio-block-copy">{rt("Pick an existing project or paste a live URL for the analysis run.")}</div>
                      </div>
                    </div>
                    <div className="pd-field-grid">
                      <label className="pd-field-label">
                        {rt("Source project")}
                        <select
                          className="pd-field-select"
                          value={studioProjectId === "" ? "" : String(studioProjectId)}
                          onChange={event => {
                            const value = event.target.value
                            if (!value) {
                              setStudioProjectId("")
                              return
                            }
                            const nextProject = normalizedProjects.find(project => project.id === Number(value))
                            setStudioProjectId(Number(value))
                            if (nextProject?.url) setStudioUrl(nextProject.url)
                            if (nextProject?.clientName) setStudioAudience(nextProject.clientName)
                          }}
                        >
                          <option value="">{rt("Manual URL")}</option>
                          {normalizedProjects.map(project => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                        <span className="pd-field-hint">{rt("Selecting a project also pulls in its saved URL and client context.")}</span>
                      </label>
                      <label className="pd-field-label">
                        {rt("Website URL")}
                        <input
                          className="pd-field-input"
                          value={studioUrl}
                          onChange={event => setStudioUrl(event.target.value)}
                          placeholder="https://..."
                        />
                        <span className="pd-field-hint">
                          {studioNeedsLiveUrl
                            ? rt("A live URL is required because this workflow runs a real audit before generating the plan.")
                            : rt("Optional if the selected project already has enough content for analysis.")}
                        </span>
                      </label>
                    </div>
                  </section>

                  <section className="pd-studio-block">
                    <div className="pd-studio-block-head">
                      <span className="pd-studio-step">02</span>
                      <div>
                        <div className="pd-studio-block-title">{rt("Define the outcome")}</div>
                        <div className="pd-studio-block-copy">{rt("Tell the tool what “good” looks like so the output is specific instead of generic.")}</div>
                      </div>
                    </div>
                    <div className="pd-field-grid">
                      <label className="pd-field-label">
                        {rt(studioToolMeta.goalLabel)}
                        <input className="pd-field-input" value={studioGoal} onChange={event => setStudioGoal(event.target.value)} />
                        <div className="pd-studio-chip-row">
                          {studioToolMeta.goalPresets.map(preset => (
                            <button key={preset} className="pd-studio-chip" type="button" onClick={() => setStudioGoal(preset)}>
                              {rt(preset)}
                            </button>
                          ))}
                        </div>
                      </label>
                      <label className="pd-field-label">
                        {rt(studioToolMeta.audienceLabel)}
                        <input className="pd-field-input" value={studioAudience} onChange={event => setStudioAudience(event.target.value)} />
                        <div className="pd-studio-chip-row">
                          {studioToolMeta.audiencePresets.map(preset => (
                            <button key={preset} className="pd-studio-chip" type="button" onClick={() => setStudioAudience(preset)}>
                              {rt(preset)}
                            </button>
                          ))}
                        </div>
                      </label>
                      {studioToolMeta.extraFieldLabel ? (
                        <label className="pd-field-label pd-field-label-full">
                          {rt(studioToolMeta.extraFieldLabel)}
                          <input
                            className="pd-field-input"
                            value={studioMarkets}
                            onChange={event => setStudioMarkets(event.target.value)}
                            placeholder={studioToolMeta.extraFieldPlaceholder ? rt(studioToolMeta.extraFieldPlaceholder) : undefined}
                          />
                          {studioToolMeta.extraFieldPresets?.length ? (
                            <div className="pd-studio-chip-row">
                              {studioToolMeta.extraFieldPresets.map(preset => (
                                <button key={preset} className="pd-studio-chip" type="button" onClick={() => setStudioMarkets(preset)}>
                                  {rt(preset)}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </label>
                      ) : null}
                    </div>
                  </section>

                  <section className="pd-studio-block">
                    <div className="pd-studio-block-head">
                      <span className="pd-studio-step">03</span>
                      <div>
                        <div className="pd-studio-block-title">{rt("Add context")}</div>
                        <div className="pd-studio-block-copy">{rt("Use this to steer the output toward real constraints, hypotheses, or preferences.")}</div>
                      </div>
                    </div>
                    <label className="pd-field-label pd-field-label-full">
                      {rt("Notes")}
                      <textarea
                        className="pd-field-textarea"
                        value={studioNotes}
                        onChange={event => setStudioNotes(event.target.value)}
                        placeholder={rt(studioToolMeta.notePlaceholder)}
                      />
                    </label>
                  </section>

                  {studioResult ? (
                    <div className="pd-studio-result">
                      <div className="pd-studio-head">
                        <div>
                          <div className="pd-studio-kicker">{rt("Latest run")}</div>
                          <div className="pd-studio-title">
                            {studioResult.headline === "Plan generated" ? rt("Plan generated") : studioResult.headline}
                          </div>
                        </div>
                        <div className="pd-studio-pill">
                          {studioResult.audit?.url?.replace(/^https?:\/\//, "") || selectedStudioProject?.name || studioToolMeta.title}
                        </div>
                      </div>
                      <div className="pd-studio-summary">{studioResult.summary}</div>

                      {studioResult.audit ? (
                        <div className="pd-studio-score-grid">
                          <div className="pd-studio-score-card">
                            <span className="pd-studio-score-label">{rt("Performance")}</span>
                            <strong>{studioResult.audit.scores.performance}</strong>
                          </div>
                          <div className="pd-studio-score-card">
                            <span className="pd-studio-score-label">{rt("Accessibility")}</span>
                            <strong>{studioResult.audit.scores.accessibility}</strong>
                          </div>
                          <div className="pd-studio-score-card">
                            <span className="pd-studio-score-label">{rt("SEO")}</span>
                            <strong>{studioResult.audit.scores.seo}</strong>
                          </div>
                          <div className="pd-studio-score-card">
                            <span className="pd-studio-score-label">{rt("Best practices")}</span>
                            <strong>{studioResult.audit.scores.bestPractices}</strong>
                          </div>
                        </div>
                      ) : null}

                      {studioResult.sections.length ? (
                        <div className="pd-studio-section-grid">
                          {studioResult.sections.map(section => (
                            <section key={section.label} className="pd-studio-section">
                              <div className="pd-studio-section-title">{section.label}</div>
                              <div className="pd-studio-bullet-list">
                                {section.items.map(item => (
                                  <div key={item} className="pd-studio-bullet-item">
                                    <span className="pd-studio-bullet-dot" />
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : null}

                      {studioResult.markets?.length ? (
                        <div className="pd-studio-market-grid">
                          {studioResult.markets.map(market => (
                            <article key={`${market.market}-${market.language}`} className="pd-studio-market-card">
                              <div className="pd-studio-market-top">
                                <strong>{market.market}</strong>
                                <span>{market.language}</span>
                              </div>
                              <div className="pd-studio-market-copy">{market.angle}</div>
                              <div className="pd-studio-market-offer">{market.offer}</div>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {studioResult.audit?.opportunities?.length ? (
                        <section className="pd-studio-section">
                          <div className="pd-studio-section-title">{rt("Audit opportunities")}</div>
                          <div className="pd-studio-bullet-list">
                            {studioResult.audit.opportunities.map(opportunity => (
                              <div key={opportunity.id} className="pd-studio-bullet-item">
                                <span className="pd-studio-bullet-dot" />
                                <span>
                                  {opportunity.title}: {opportunity.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <aside className="pd-studio-guide">
                  <section className="pd-studio-guide-card">
                    <div className="pd-studio-guide-title">{rt("What you’ll get")}</div>
                    <div className="pd-studio-guide-list">
                      {studioToolMeta.outcomes.map(item => (
                        <div key={item} className="pd-studio-guide-item">
                          <span className="pd-studio-guide-dot" />
                          <span>{rt(item)}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="pd-studio-guide-card">
                    <div className="pd-studio-guide-title">{rt("This run uses")}</div>
                    <div className="pd-studio-chip-row pd-studio-chip-row-guide">
                      {studioToolMeta.systems.map(item => (
                        <span key={item} className="pd-studio-chip pd-studio-chip-passive">
                          {rt(item)}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="pd-studio-guide-card">
                    <div className="pd-studio-guide-title">{rt("Source snapshot")}</div>
                    <div className="pd-studio-source-grid">
                      <div className="pd-studio-source-card">
                        <span className="pd-studio-source-label">{rt("Selected project")}</span>
                        <strong className="pd-studio-source-value">{selectedStudioProject?.name || rt("Manual input")}</strong>
                      </div>
                      <div className="pd-studio-source-card">
                        <span className="pd-studio-source-label">{rt("Live URL")}</span>
                        <strong className="pd-studio-source-value">
                          {effectiveStudioUrl ? effectiveStudioUrl.replace(/^https?:\/\//, "") : rt("Not set")}
                        </strong>
                      </div>
                      <div className="pd-studio-source-card">
                        <span className="pd-studio-source-label">{rt("Project content")}</span>
                        <strong className="pd-studio-source-value">{selectedStudioProjectText ? rt("Available") : rt("Missing")}</strong>
                      </div>
                      <div className="pd-studio-source-card">
                        <span className="pd-studio-source-label">{rt("Run status")}</span>
                        <strong className={`pd-studio-source-value ${studioSourceReady ? "is-ready" : "is-warn"}`}>
                          {studioSourceReady ? rt("Ready to run") : studioNeedsLiveUrl ? rt("Needs URL") : rt("Needs content")}
                        </strong>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={resetStudioTool}>{rt("Close")}</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={runStudioTool} disabled={studioRunning}>
                {studioRunning ? rt("Running...") : rt(studioToolMeta.actionLabel)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewProject ? (
        <div className="pd-modal-backdrop" onClick={resetNewProjectForm}>
          <div className="pd-modal" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">{rt("Create")}</div>
                <div className="pd-modal-title">{rt("New project")}</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={resetNewProjectForm}>X</button>
            </div>
            <div className="pd-modal-body">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.svg,text/html,image/svg+xml"
                hidden
                onChange={event => void handleUploadProjectFile(event.target.files?.[0] || null)}
              />
              <div className="pd-field-grid">
                <label className="pd-field-label">
                  {rt("Project name")}
                  <input className="pd-field-input" value={newName} onChange={event => setNewName(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  {rt("Website URL")}
                  <input className="pd-field-input" value={newUrl} onChange={event => setNewUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="pd-field-label">
                  {rt("Client name")}
                  <input className="pd-field-input" value={newClientName} onChange={event => setNewClientName(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  {rt("Due date")}
                  <input className="pd-field-input" value={newDueAt} onChange={event => setNewDueAt(event.target.value)} type="date" />
                </label>
                <div className="pd-field-label pd-field-label-full">
                  {rt("Upload file")}
                  <div className="pd-upload-row">
                    <button className="pd-btn" type="button" onClick={() => fileInputRef.current?.click()}>
                      {rt("Upload HTML/SVG")}
                    </button>
                    {newUploadName ? <span className="pd-upload-name">{newUploadName}</span> : null}
                    {newUploadName ? (
                      <button
                        className="pd-btn"
                        type="button"
                        onClick={() => {
                          setNewUploadHtml("")
                          setNewUploadName("")
                          if (fileInputRef.current) fileInputRef.current.value = ""
                        }}
                      >
                        {rt("Clear")}
                      </button>
                    ) : null}
                  </div>
                  <span className="pd-field-hint">{rt("Current local upload support: `.html`, `.htm`, `.svg`.")}</span>
                </div>
                <div className="pd-field-label pd-field-label-full">
                  {rt("Assign team members")}
                  {loadingAssignableMembers ? (
                    <div className="pd-field-hint">{rt("Loading team members...")}</div>
                  ) : assignableMembers.length ? (
                    <div className="pd-assignee-list">
                      {assignableMembers.map(member => {
                        const selected = newAssigneeEmails.includes(member.email)
                        const label = displayMemberName(member)
                        const meta = [
                          member.role ? rt(String(member.role).toLowerCase()) : "",
                          member.status === "pending" ? rt("pending") : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")
                        return (
                          <button
                            key={member.email}
                            type="button"
                            className={`pd-assignee-chip${selected ? " is-selected" : ""}`}
                            onClick={() => toggleAssignee(member.email)}
                          >
                            <span className="pd-assignee-avatar">{label.slice(0, 2).toUpperCase()}</span>
                            <span className="pd-assignee-copy">
                              <span className="pd-assignee-name">{label}</span>
                              <span className="pd-assignee-meta">{meta || member.email}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="pd-field-hint">{rt("No team members yet. Invite them in Settings first.")}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={resetNewProjectForm}>{rt("Cancel")}</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={createProject} disabled={creatingProject}>
                {creatingProject ? rt("Creating...") : rt("Create project")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLandingGenerator ? (
        <div className="pd-modal-backdrop" onClick={() => setShowLandingGenerator(false)}>
          <div className="pd-modal" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">{rt("AI generator")}</div>
                <div className="pd-modal-title">{rt("Generate landing page")}</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={() => setShowLandingGenerator(false)}>X</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-field-grid">
                <label className="pd-field-label">
                  {rt("Product name")}
                  <input className="pd-field-input" value={landingName} onChange={event => setLandingName(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  {rt("Target audience")}
                  <input className="pd-field-input" value={landingAudience} onChange={event => setLandingAudience(event.target.value)} />
                </label>
                <label className="pd-field-label pd-field-label-full">
                  {rt("Description")}
                  <textarea className="pd-field-textarea" value={landingDesc} onChange={event => setLandingDesc(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  {rt("Language")}
                  <select className="pd-field-select" value={landingLang} onChange={event => setLandingLang(event.target.value as "english" | "german")}>
                    <option value="english">{rt("English")}</option>
                    <option value="german">{rt("German")}</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={() => setShowLandingGenerator(false)}>{rt("Cancel")}</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={generateLandingPage} disabled={landingGenerating}>
                {landingGenerating ? rt("Generating...") : rt("Generate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTemplateExtract ? (
        <div className="pd-modal-backdrop" onClick={() => setShowTemplateExtract(false)}>
          <div className="pd-modal" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">{rt("Templates")}</div>
                <div className="pd-modal-title">{rt("Extract template")}</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={() => setShowTemplateExtract(false)}>X</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-field-grid">
                <label className="pd-field-label">
                  {rt("Website URL")}
                  <input className="pd-field-input" value={templateUrl} onChange={event => setTemplateUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="pd-field-label">
                  {rt("Template name")}
                  <input className="pd-field-input" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder={rt("Optional")} />
                </label>
              </div>
              {templateExtractFeedback ? <div className="pd-helper-copy">{templateExtractFeedback}</div> : null}
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={() => setShowTemplateExtract(false)}>{rt("Cancel")}</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={extractTemplate} disabled={templateExtracting}>
                {templateExtracting ? rt("Extracting...") : rt("Save template")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

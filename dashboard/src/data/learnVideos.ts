import { FEATURE_FLAGS } from "../config"

export type LearnVideoCategory =
  | "getting-started"
  | "editor"
  | "ai-studio"
  | "publishing"
  | "teams"
  | "settings"
  | "import-export"
  | "advanced"

export type LearnVideoSubcategory =
  | "first-steps"
  | "project-setup"
  | "navigation"
  | "block-editing"
  | "components"
  | "structure"
  | "styles-assets"
  | "snapshots"
  | "cro"
  | "copy"
  | "seo"
  | "translation"
  | "brand"
  | "refactor"
  | "share-preview"
  | "publish"
  | "domains"
  | "organization"
  | "members"
  | "roles"
  | "api-keys"
  | "models"
  | "general-settings"
  | "website-import"
  | "exports"
  | "automation"
  | "power-workflows"

export type LearnVideo = {
  id: string
  title: string
  category: LearnVideoCategory
  subcategory: LearnVideoSubcategory
  duration: string
  description: string
  embedUrl: string
  ctaLabel: string
  featured?: boolean
  order: number
}

export const LEARN_VIDEO_CATEGORIES: Array<{
  id: LearnVideoCategory
  label: string
  order: number
}> = [
  { id: "getting-started", label: "Getting Started", order: 1 },
  { id: "editor", label: "Editor", order: 2 },
  { id: "ai-studio", label: "AI Studio", order: 3 },
  { id: "publishing", label: "Publishing", order: 4 },
  { id: "teams", label: "Teams", order: 5 },
  { id: "settings", label: "Settings", order: 6 },
  { id: "import-export", label: "Import & Export", order: 7 },
  { id: "advanced", label: "Advanced", order: 8 },
]

export const LEARN_VIDEO_SUBCATEGORIES: Array<{
  id: LearnVideoSubcategory
  category: LearnVideoCategory
  label: string
  order: number
}> = [
  { id: "first-steps", category: "getting-started", label: "First Steps", order: 1 },
  { id: "project-setup", category: "getting-started", label: "Project Setup", order: 2 },
  { id: "navigation", category: "getting-started", label: "Navigation", order: 3 },

  { id: "block-editing", category: "editor", label: "Block Editing", order: 1 },
  { id: "components", category: "editor", label: "Components", order: 2 },
  { id: "structure", category: "editor", label: "Structure", order: 3 },
  { id: "styles-assets", category: "editor", label: "Styles & Assets", order: 4 },
  { id: "snapshots", category: "editor", label: "Snapshots", order: 5 },

  { id: "cro", category: "ai-studio", label: "CRO", order: 1 },
  { id: "copy", category: "ai-studio", label: "Copy", order: 2 },
  { id: "seo", category: "ai-studio", label: "SEO", order: 3 },
  { id: "translation", category: "ai-studio", label: "Translation", order: 4 },
  { id: "brand", category: "ai-studio", label: "Brand", order: 5 },
  { id: "refactor", category: "ai-studio", label: "Refactor", order: 6 },

  { id: "share-preview", category: "publishing", label: "Share Preview", order: 1 },
  { id: "publish", category: "publishing", label: "Publish", order: 2 },
  { id: "domains", category: "publishing", label: "Domains", order: 3 },

  { id: "organization", category: "teams", label: "Organization", order: 1 },
  { id: "members", category: "teams", label: "Members", order: 2 },
  { id: "roles", category: "teams", label: "Roles", order: 3 },

  { id: "api-keys", category: "settings", label: "API Keys", order: 1 },
  { id: "models", category: "settings", label: "Models", order: 2 },
  { id: "general-settings", category: "settings", label: "General", order: 3 },

  { id: "website-import", category: "import-export", label: "Website Import", order: 1 },
  { id: "exports", category: "import-export", label: "Exports", order: 2 },

  { id: "automation", category: "advanced", label: "Automation", order: 1 },
  { id: "power-workflows", category: "advanced", label: "Power Workflows", order: 2 },
]

export const LEARN_VIDEOS: LearnVideo[] = [
  {
    id: "create-first-project",
    title: "Create your first project",
    category: "getting-started",
    subcategory: "first-steps",
    duration: "0:45",
    description: "Go from dashboard to imported project and open it in the editor.",
    embedUrl: "https://embed.app.guidde.com/playbooks/iyeGPeTVt9anr6vLen1CC5?mode=videoOnly",
    ctaLabel: "Try this in Reframe",
    featured: true,
    order: 1,
  },
  {
    id: "what-is-reframe",
    title: "What is Reframe",
    category: "getting-started",
    subcategory: "first-steps",
    duration: "0:30",
    description: "Quick overview placeholder.",
    embedUrl: "",
    ctaLabel: "Start here",
    order: 2,
  },
  {
    id: "dashboard-overview",
    title: "Dashboard overview",
    category: "getting-started",
    subcategory: "navigation",
    duration: "0:30",
    description: "Dashboard navigation placeholder.",
    embedUrl: "",
    ctaLabel: "Open dashboard",
    order: 3,
  },
  {
    id: "import-website",
    title: "Import a website",
    category: "getting-started",
    subcategory: "project-setup",
    duration: "0:30",
    description: "Website import placeholder.",
    embedUrl: "",
    ctaLabel: "Import website",
    order: 4,
  },
  {
    id: "open-project",
    title: "Open a project",
    category: "getting-started",
    subcategory: "project-setup",
    duration: "0:30",
    description: "Open project placeholder.",
    embedUrl: "",
    ctaLabel: "Open project",
    order: 5,
  },

  {
    id: "edit-blocks",
    title: "Edit blocks",
    category: "editor",
    subcategory: "block-editing",
    duration: "0:30",
    description: "Block editing placeholder.",
    embedUrl: "",
    ctaLabel: "Open editor",
    order: 10,
  },
  {
    id: "use-components",
    title: "Use components",
    category: "editor",
    subcategory: "components",
    duration: "0:30",
    description: "Components placeholder.",
    embedUrl: "",
    ctaLabel: "Use components",
    order: 11,
  },
  {
    id: "editor-structure",
    title: "Use the structure panel",
    category: "editor",
    subcategory: "structure",
    duration: "0:30",
    description: "Structure panel placeholder.",
    embedUrl: "",
    ctaLabel: "Open structure",
    order: 12,
  },
  {
    id: "styles-assets-overview",
    title: "Styles and assets overview",
    category: "editor",
    subcategory: "styles-assets",
    duration: "0:30",
    description: "Styles and assets placeholder.",
    embedUrl: "",
    ctaLabel: "Manage assets",
    order: 13,
  },
  {
    id: "save-snapshot",
    title: "Save a snapshot",
    category: "editor",
    subcategory: "snapshots",
    duration: "0:30",
    description: "Snapshots placeholder.",
    embedUrl: "",
    ctaLabel: "Save snapshot",
    order: 14,
  },

  {
    id: "run-cro-audit",
    title: "Run a CRO audit",
    category: "ai-studio",
    subcategory: "cro",
    duration: "0:30",
    description: "CRO audit placeholder.",
    embedUrl: "",
    ctaLabel: "Open AI Studio",
    order: 20,
  },
  {
    id: "improve-copy",
    title: "Improve copy",
    category: "ai-studio",
    subcategory: "copy",
    duration: "0:30",
    description: "Copy tool placeholder.",
    embedUrl: "",
    ctaLabel: "Improve copy",
    order: 21,
  },
  {
    id: "seo-optimize",
    title: "SEO optimize",
    category: "ai-studio",
    subcategory: "seo",
    duration: "0:30",
    description: "SEO tool placeholder.",
    embedUrl: "",
    ctaLabel: "Optimize SEO",
    order: 22,
  },
  {
    id: "translate-site",
    title: "Translate site",
    category: "ai-studio",
    subcategory: "translation",
    duration: "0:30",
    description: "Translation placeholder.",
    embedUrl: "",
    ctaLabel: "Translate site",
    order: 23,
  },
  {
    id: "brand-brain",
    title: "Use Brand Brain",
    category: "ai-studio",
    subcategory: "brand",
    duration: "0:30",
    description: "Brand Brain placeholder.",
    embedUrl: "",
    ctaLabel: "Open Brand Brain",
    order: 24,
  },
  {
    id: "refactor-structure",
    title: "Refactor structure",
    category: "ai-studio",
    subcategory: "refactor",
    duration: "0:30",
    description: "Refactor placeholder.",
    embedUrl: "",
    ctaLabel: "Refactor page",
    order: 25,
  },

  {
    id: "share-preview",
    title: "Create a share preview",
    category: "publishing",
    subcategory: "share-preview",
    duration: "0:30",
    description: "Share preview placeholder.",
    embedUrl: "",
    ctaLabel: "Share preview",
    order: 30,
  },
  {
    id: "publish-site",
    title: "Publish your site",
    category: "publishing",
    subcategory: "publish",
    duration: "0:30",
    description: "Publishing placeholder.",
    embedUrl: "",
    ctaLabel: "Publish site",
    order: 31,
  },
  {
    id: "custom-domains",
    title: "Set up custom domains",
    category: "publishing",
    subcategory: "domains",
    duration: "0:30",
    description: "Custom domains placeholder.",
    embedUrl: "",
    ctaLabel: "Open domains",
    order: 32,
  },

  {
    id: "create-organization",
    title: "Create an organization",
    category: "teams",
    subcategory: "organization",
    duration: "0:30",
    description: "Organization placeholder.",
    embedUrl: "",
    ctaLabel: "Create organization",
    order: 40,
  },
  {
    id: "invite-members",
    title: "Invite members",
    category: "teams",
    subcategory: "members",
    duration: "0:30",
    description: "Invite members placeholder.",
    embedUrl: "",
    ctaLabel: "Invite members",
    order: 41,
  },
  {
    id: "manage-roles",
    title: "Manage roles",
    category: "teams",
    subcategory: "roles",
    duration: "0:30",
    description: "Roles placeholder.",
    embedUrl: "",
    ctaLabel: "Manage roles",
    order: 42,
  },

  {
    id: "add-api-keys",
    title: "Add API keys",
    category: "settings",
    subcategory: "api-keys",
    duration: "0:30",
    description: "API keys placeholder.",
    embedUrl: "",
    ctaLabel: "Open settings",
    order: 50,
  },
  {
    id: "manage-models",
    title: "Manage models",
    category: "settings",
    subcategory: "models",
    duration: "0:30",
    description: "Models placeholder.",
    embedUrl: "",
    ctaLabel: "Manage models",
    order: 51,
  },
  {
    id: "general-settings-overview",
    title: "General settings overview",
    category: "settings",
    subcategory: "general-settings",
    duration: "0:30",
    description: "General settings placeholder.",
    embedUrl: "",
    ctaLabel: "Open general settings",
    order: 52,
  },

  {
    id: "website-import-flow",
    title: "Website import flow",
    category: "import-export",
    subcategory: "website-import",
    duration: "0:30",
    description: "Website import flow placeholder.",
    embedUrl: "",
    ctaLabel: "Import flow",
    order: 60,
  },
  {
    id: "export-project",
    title: "Export a project",
    category: "import-export",
    subcategory: "exports",
    duration: "0:30",
    description: "Export placeholder.",
    embedUrl: "",
    ctaLabel: "Export project",
    order: 61,
  },

  {
    id: "automation-overview",
    title: "Automation overview",
    category: "advanced",
    subcategory: "automation",
    duration: "0:30",
    description: "Automation placeholder.",
    embedUrl: "",
    ctaLabel: "Open automation",
    order: 70,
  },
  {
    id: "power-user-workflows",
    title: "Power user workflows",
    category: "advanced",
    subcategory: "power-workflows",
    duration: "0:30",
    description: "Power workflows placeholder.",
    embedUrl: "",
    ctaLabel: "Open workflows",
    order: 71,
  },
]

export const LEARN_VIDEOS_VERSION = 1

function validateLearnVideoCatalog() {
  const categoryIds = new Set(LEARN_VIDEO_CATEGORIES.map((item) => item.id))
  const subcategoryIds = new Set(LEARN_VIDEO_SUBCATEGORIES.map((item) => item.id))
  const seenVideoIds = new Set<string>()

  for (const video of LEARN_VIDEOS) {
    if (!video.id || seenVideoIds.has(video.id)) {
      throw new Error(`Invalid learn video id: ${video.id || "<empty>"}`)
    }
    seenVideoIds.add(video.id)
    if (!categoryIds.has(video.category)) {
      throw new Error(`Unknown learn video category on ${video.id}: ${video.category}`)
    }
    if (!subcategoryIds.has(video.subcategory)) {
      throw new Error(`Unknown learn video subcategory on ${video.id}: ${video.subcategory}`)
    }
    if (!String(video.title || "").trim()) {
      throw new Error(`Missing learn video title on ${video.id}`)
    }
    if (!String(video.ctaLabel || "").trim()) {
      throw new Error(`Missing learn video CTA label on ${video.id}`)
    }
  }
}

if (FEATURE_FLAGS.learnContentValidation) {
  validateLearnVideoCatalog()
}

export function getCategoryLabel(category: LearnVideoCategory) {
  return LEARN_VIDEO_CATEGORIES.find((item) => item.id === category)?.label || category
}

export function getSubcategoryLabel(subcategory: LearnVideoSubcategory) {
  return LEARN_VIDEO_SUBCATEGORIES.find((item) => item.id === subcategory)?.label || subcategory
}

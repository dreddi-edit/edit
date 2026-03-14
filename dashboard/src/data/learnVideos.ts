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

export type LearnTutorialStep = {
  title: string
  detail: string
}

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
  level: "Beginner" | "Intermediate" | "Advanced"
  goals: string[]
  steps: LearnTutorialStep[]
  outcomes: string[]
  pitfalls: string[]
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

function tutorial(item: LearnVideo): LearnVideo {
  return item
}

export const LEARN_VIDEOS: LearnVideo[] = [
  tutorial({
    id: "create-first-project",
    title: "Create your first project",
    category: "getting-started",
    subcategory: "first-steps",
    duration: "0:45",
    description: "Start from the dashboard, create a project shell, import a source, and open the result in the editor.",
    embedUrl: "https://embed.app.guidde.com/playbooks/iyeGPeTVt9anr6vLen1CC5?mode=videoOnly",
    ctaLabel: "Start with this walkthrough",
    featured: true,
    order: 1,
    level: "Beginner",
    goals: ["Understand the core project flow", "Know where import starts", "Open the editor with a real project"],
    steps: [
      { title: "Open the dashboard", detail: "Sign in, land on the main workspace, and click New project from the projects view." },
      { title: "Name the project", detail: "Add a project name that matches the client or site so later exports and internal search stay clear." },
      { title: "Pick one import source", detail: "Either paste a live URL or upload files like HTML, ZIP, PDF, screenshots, or a full folder." },
      { title: "Create and open", detail: "Review the detected import summary, create the project, and open it in the editor." },
    ],
    outcomes: ["A saved project exists", "The import source is attached", "The editor opens with real content"],
    pitfalls: ["Do not leave the project name blank", "Use either URL import or upload first so the preview has something to build from"],
  }),
  tutorial({
    id: "what-is-reframe",
    title: "What Reframe is actually for",
    category: "getting-started",
    subcategory: "first-steps",
    duration: "1:20",
    description: "Understand the product model: import existing sites, edit with context-aware AI, export into multiple delivery formats.",
    embedUrl: "",
    ctaLabel: "Understand the platform",
    order: 2,
    level: "Beginner",
    goals: ["Understand how Reframe differs from a site builder", "See why import and export are core primitives", "Recognize where AI fits into the workflow"],
    steps: [
      { title: "Think in operations, not blank canvases", detail: "Reframe starts from an existing website, design, or asset pack rather than a blank page." },
      { title: "Use the editor as the control layer", detail: "Once imported, blocks, assets, SEO, and variants are editable inside one workspace." },
      { title: "Use AI with context", detail: "AI actions inherit page structure, brand details, and workflow state, so outputs are tied to the actual project." },
      { title: "Ship to the client format", detail: "When the project is ready, export or deploy in the format the client stack requires." },
    ],
    outcomes: ["You know where Reframe starts", "You understand how the AI layer is constrained", "You know when export matters"],
    pitfalls: ["Do not treat it like a generic prompt box", "Do not expect to rebuild each project manually in a second system"],
  }),
  tutorial({
    id: "dashboard-overview",
    title: "Navigate the dashboard",
    category: "getting-started",
    subcategory: "navigation",
    duration: "1:10",
    description: "Learn the workspace areas, the AI Studio split, the project grid, and where spend and usage surface.",
    embedUrl: "",
    ctaLabel: "Explore the dashboard",
    order: 3,
    level: "Beginner",
    goals: ["Recognize each workspace area", "Know where project, template, export, and AI flows live", "Understand the spend and usage summary"],
    steps: [
      { title: "Start in Projects", detail: "Projects is the operational default and the fastest place to create, open, review, and export work." },
      { title: "Review the top summary", detail: "The dashboard shows workspace count, spending, usage, and note context at the top." },
      { title: "Switch into AI Studio or Google AI Suite", detail: "Use those areas for guided AI workflows and capability-specific operations rather than raw project management." },
      { title: "Use the command palette when the UI is crowded", detail: "Power users can jump through the product faster from shortcuts and search." },
    ],
    outcomes: ["You know where each workflow begins", "You can orient yourself without guessing", "You understand what the top stats are reporting"],
    pitfalls: ["Do not expect the sidebar labels to mean the same thing as editor tabs", "AI Studio and Google AI Suite are related but not identical"],
  }),
  tutorial({
    id: "import-website",
    title: "Import a website from URL or upload",
    category: "getting-started",
    subcategory: "project-setup",
    duration: "1:40",
    description: "Use the import dialog correctly and avoid the common mistake of thinking URL and file upload are both required.",
    embedUrl: "",
    ctaLabel: "Import a source",
    order: 4,
    level: "Beginner",
    goals: ["Use the import dialog correctly", "Understand when to use URL versus upload", "Read the preview before creating the project"],
    steps: [
      { title: "Choose one source path", detail: "For live sites, paste a reachable URL. For local material, upload files, ZIPs, briefs, screenshots, or a folder." },
      { title: "Use URL mode intentionally", detail: "Single keeps to one page, Crawl follows links, and Sitemap reads sitemap.xml for broader imports." },
      { title: "Check the preview summary", detail: "Before creating the project, verify pages detected, platform inference, and support files." },
      { title: "Create only after preview looks sane", detail: "The project should be created from a clear preview, not from guesswork or mixed inputs." },
    ],
    outcomes: ["You can import via URL", "You can import via upload", "You know how to validate the import summary"],
    pitfalls: ["You do not need both URL and upload", "If a source is protected, use auth or header fields only for the URL path"],
  }),
  tutorial({
    id: "open-project",
    title: "Open and inspect a project",
    category: "getting-started",
    subcategory: "project-setup",
    duration: "0:55",
    description: "Open a project, inspect it from the project grid, and understand what is ready before editing.",
    embedUrl: "",
    ctaLabel: "Open a project",
    order: 5,
    level: "Beginner",
    goals: ["Open projects confidently", "Understand the project card signal", "Inspect before editing"],
    steps: [
      { title: "Select the project card", detail: "Open from Projects when you want to edit, export, share, or inspect imported content." },
      { title: "Use the explorer when needed", detail: "The explorer helps you inspect pages, activity, tags, and structure before making changes." },
      { title: "Check project metadata", detail: "Look at platform, page count, export readiness, and workflow state before you touch the content." },
      { title: "Move into the editor", detail: "Once the project looks sane, open it in the editor for page-level work." },
    ],
    outcomes: ["You can distinguish between opening and inspecting", "You know when to rescan or inspect first", "You enter the editor with context"],
    pitfalls: ["Do not blindly edit a project that imported incorrectly", "Use the explorer when page structure looks incomplete"],
  }),
  tutorial({
    id: "edit-blocks",
    title: "Edit blocks without breaking structure",
    category: "editor",
    subcategory: "block-editing",
    duration: "1:45",
    description: "Update content at block level while preserving page structure, variants, and recoverability.",
    embedUrl: "",
    ctaLabel: "Edit blocks",
    order: 10,
    level: "Beginner",
    goals: ["Find the correct block", "Edit safely", "Understand how diffs and snapshots protect the page"],
    steps: [
      { title: "Select the right block", detail: "Use the visual editor or structure tools to isolate the section you want to change." },
      { title: "Edit directly or with AI", detail: "Make copy or layout changes directly when simple, and use AI when context-aware rewriting is more efficient." },
      { title: "Review the result visually", detail: "After changes, scan the affected area to confirm hierarchy, spacing, and meaning still hold." },
      { title: "Rely on snapshots if needed", detail: "If a change goes sideways, snapshots and history are the rollback path." },
    ],
    outcomes: ["The block is edited safely", "The rest of the page remains stable", "You know how to recover if needed"],
    pitfalls: ["Do not rewrite huge page areas when one block is enough", "Avoid pushing multiple unrelated edits without checking the diff"],
  }),
  tutorial({
    id: "use-components",
    title: "Work with reusable components",
    category: "editor",
    subcategory: "components",
    duration: "1:15",
    description: "Use shared UI structures so repeated sections stay aligned across the project.",
    embedUrl: "",
    ctaLabel: "Use components",
    order: 11,
    level: "Intermediate",
    goals: ["Understand when reuse matters", "Keep repeated sections consistent", "Avoid fixing the same pattern manually multiple times"],
    steps: [
      { title: "Find repeated structures", detail: "Identify recurring hero blocks, cards, lists, CTAs, and repeated content layouts." },
      { title: "Edit the pattern deliberately", detail: "Make shared visual or copy decisions with reuse in mind rather than one-off patches." },
      { title: "Check pages that depend on it", detail: "If a component is reused, inspect every dependent page before calling the work done." },
      { title: "Use snapshots around risky changes", detail: "Shared elements can amplify mistakes, so keep a clear recovery point." },
    ],
    outcomes: ["Repeated elements stay coherent", "Consistency work happens once instead of everywhere", "The editor remains predictable"],
    pitfalls: ["Avoid assuming a reused section only exists on one page", "Do not make broad component changes without reviewing impacted pages"],
  }),
  tutorial({
    id: "editor-structure",
    title: "Use the structure panel",
    category: "editor",
    subcategory: "structure",
    duration: "1:05",
    description: "Navigate deep pages faster by working from hierarchy instead of only from the canvas.",
    embedUrl: "",
    ctaLabel: "Open structure tools",
    order: 12,
    level: "Intermediate",
    goals: ["Move faster through dense pages", "Select the correct content layer", "Understand page hierarchy before editing"],
    steps: [
      { title: "Open the structure view", detail: "Use hierarchy to identify sections, sub-sections, and nested content blocks." },
      { title: "Jump to the section you need", detail: "Select from structure when the visual canvas is too long or too dense." },
      { title: "Use names and order as clues", detail: "Headings, nesting, and relative order help you confirm you are editing the intended region." },
      { title: "Cross-check in the canvas", detail: "After selecting structurally, verify visually before applying changes." },
    ],
    outcomes: ["Selection becomes faster", "Complex pages feel less messy", "Edits target the correct area more reliably"],
    pitfalls: ["Do not rely on structure labels alone if imported naming is ambiguous", "Confirm the block visually before large rewrites"],
  }),
  tutorial({
    id: "styles-assets-overview",
    title: "Manage styles and assets",
    category: "editor",
    subcategory: "styles-assets",
    duration: "1:35",
    description: "Review fonts, images, and style changes so imported sites stay visually stable during edits and export.",
    embedUrl: "",
    ctaLabel: "Review styles and assets",
    order: 13,
    level: "Intermediate",
    goals: ["Understand imported asset state", "Avoid layout damage from missing media or font mismatches", "Keep exports consistent"],
    steps: [
      { title: "Audit the imported assets", detail: "Check whether logos, images, and fonts imported correctly and whether any are still remote or missing." },
      { title: "Update assets deliberately", detail: "Replace or localize assets in a controlled way so the project remains export-safe." },
      { title: "Confirm visual stability", detail: "After style changes, compare key sections to ensure spacing, crop, and contrast still work." },
      { title: "Export with confidence", detail: "Assets should look correct before publishing or generating client deliverables." },
    ],
    outcomes: ["Assets are cleaner", "Style changes are controlled", "Export artifacts are less likely to break"],
    pitfalls: ["Do not assume imported fonts are already localized", "Check mobile after major image or spacing updates"],
  }),
  tutorial({
    id: "save-snapshot",
    title: "Save and restore snapshots",
    category: "editor",
    subcategory: "snapshots",
    duration: "0:55",
    description: "Create recovery points before risky AI or structural changes and restore when a branch is not worth fixing.",
    embedUrl: "",
    ctaLabel: "Use snapshots",
    order: 14,
    level: "Beginner",
    goals: ["Protect risky edits", "Create deliberate restore points", "Recover without fear"],
    steps: [
      { title: "Take a snapshot before risky work", detail: "Create one before large rewrites, layout changes, or broad style changes." },
      { title: "Name the branch mentally", detail: "Treat snapshots as a fork point, not as random save spam." },
      { title: "Experiment freely", detail: "Use the snapshot as your rollback safety net for bigger exploration." },
      { title: "Restore if the branch is not worth refining", detail: "If the edit quality is bad, restore faster instead of manually undoing everything." },
    ],
    outcomes: ["Experiments become safer", "You recover faster", "Large changes feel less risky"],
    pitfalls: ["Do not wait until after a bad rewrite to wish you had saved a snapshot", "Use snapshots before broad AI actions"],
  }),
  tutorial({
    id: "run-cro-audit",
    title: "Run a CRO audit",
    category: "ai-studio",
    subcategory: "cro",
    duration: "1:30",
    description: "Generate a conversion-focused audit from a project or URL and turn findings into prioritized next actions.",
    embedUrl: "",
    ctaLabel: "Run CRO audit",
    order: 20,
    level: "Intermediate",
    goals: ["Use AI Studio for structured CRO review", "Generate prioritized findings", "Turn analysis into action"],
    steps: [
      { title: "Choose a project or URL", detail: "Use a real source so the audit can reason from actual page structure and content." },
      { title: "Set the conversion goal", detail: "Tell the audit what success means, such as demos, leads, bookings, or purchases." },
      { title: "Review ranked output", detail: "Read the audit by impact, not just by raw issue count." },
      { title: "Convert output into work items", detail: "Use the recommendations to guide block edits, tests, and copy changes." },
    ],
    outcomes: ["A CRO plan exists", "The next improvements are clearer", "The audit is tied to a real project"],
    pitfalls: ["Do not run the audit with a vague goal", "Treat the output as prioritization, not as blind truth"],
  }),
  tutorial({
    id: "improve-copy",
    title: "Improve copy with AI Studio",
    category: "ai-studio",
    subcategory: "copy",
    duration: "1:15",
    description: "Use AI Studio to sharpen positioning, offers, clarity, and persuasion without losing the current page context.",
    embedUrl: "",
    ctaLabel: "Improve copy",
    order: 21,
    level: "Intermediate",
    goals: ["Improve copy with context", "Avoid generic rewrites", "Turn strategic intent into block-level work"],
    steps: [
      { title: "Pick the right source", detail: "Use a project or URL that already contains the actual copy you want to improve." },
      { title: "State the outcome clearly", detail: "Name the goal such as better clarity, better positioning, stronger proof, or better CTA flow." },
      { title: "Review the generated plan", detail: "Treat the result as a strategic layer above the actual editor actions." },
      { title: "Apply the copy where it matters", detail: "Use the output to guide real block rewrites inside the project." },
    ],
    outcomes: ["Copy improvements become specific", "The page keeps context", "AI output is easier to apply"],
    pitfalls: ["Do not ask for a rewrite without a business goal", "Do not replace strong proof with generic marketing language"],
  }),
  tutorial({
    id: "seo-optimize",
    title: "Generate an SEO optimization plan",
    category: "ai-studio",
    subcategory: "seo",
    duration: "1:20",
    description: "Use AI Studio with page context and audit signals to generate prioritized SEO work instead of isolated tweaks.",
    embedUrl: "",
    ctaLabel: "Optimize SEO",
    order: 22,
    level: "Intermediate",
    goals: ["Combine SEO context with project structure", "Prioritize important fixes", "Avoid shallow keyword-only changes"],
    steps: [
      { title: "Start from the real page source", detail: "Use the project URL or imported project so recommendations tie back to the actual structure." },
      { title: "Describe the SEO objective", detail: "Be explicit about whether you want better ranking, stronger page clarity, or faster technical cleanup." },
      { title: "Review the structured plan", detail: "The output should separate technical issues, content opportunities, and priorities." },
      { title: "Apply and verify", detail: "Turn the plan into edits, then confirm the resulting page still reads well and exports cleanly." },
    ],
    outcomes: ["SEO work is ranked", "Fixes are tied to the actual project", "You avoid random one-off optimization"],
    pitfalls: ["Do not optimize only for terms while harming readability", "Keep technical and content work distinct"],
  }),
  tutorial({
    id: "translate-site",
    title: "Translate a site into new languages",
    category: "ai-studio",
    subcategory: "translation",
    duration: "1:25",
    description: "Create translated variants without disturbing structure, then review market-specific copy where needed.",
    embedUrl: "",
    ctaLabel: "Translate the site",
    order: 23,
    level: "Intermediate",
    goals: ["Understand DOM-safe translation", "Create variants faster", "Know where manual overrides still matter"],
    steps: [
      { title: "Choose the source project", detail: "Start from a project with the correct layout and source-language content." },
      { title: "Select the target language", detail: "Use the runtime translation workflow to create a language variant rather than duplicating the page manually." },
      { title: "Review layout-sensitive sections", detail: "Hero lines, navigation, CTAs, and proof blocks often need a human check after translation." },
      { title: "Share or publish the variant", detail: "Once approved, the translated variant can be used for previews, exports, or deployment." },
    ],
    outcomes: ["A translated variant exists", "Layout remains intact", "Manual review happens in the right places"],
    pitfalls: ["Do not assume every string is final without review", "Check languages with longer text expansion carefully"],
  }),
  tutorial({
    id: "brand-brain",
    title: "Use Brand Brain",
    category: "ai-studio",
    subcategory: "brand",
    duration: "1:10",
    description: "Extract visual and messaging patterns so later AI work stays consistent with the brand instead of drifting per prompt.",
    embedUrl: "",
    ctaLabel: "Open Brand Brain",
    order: 24,
    level: "Intermediate",
    goals: ["Preserve tone and style", "Store reusable brand context", "Reduce prompt drift"],
    steps: [
      { title: "Run Brand Brain on a strong source", detail: "Use a project that already represents the best available brand expression." },
      { title: "Review extracted patterns", detail: "Look for tone, proof style, structure, design cues, and offer language that should be preserved." },
      { title: "Use the output as guardrails", detail: "Apply the extracted brand context when rewriting or generating new page sections." },
      { title: "Refresh when the brand evolves", detail: "Brand memory is useful only when it reflects the current truth of the company." },
    ],
    outcomes: ["Future AI work stays more consistent", "Brand rules are easier to reuse", "The team has a shared brand reference"],
    pitfalls: ["Do not train on weak or outdated pages", "Treat extracted patterns as guidance, not as unchallengeable law"],
  }),
  tutorial({
    id: "refactor-structure",
    title: "Refactor page structure",
    category: "ai-studio",
    subcategory: "refactor",
    duration: "1:25",
    description: "Use structured AI help to rethink page flow, not just sentence-level edits.",
    embedUrl: "",
    ctaLabel: "Refactor the page",
    order: 25,
    level: "Advanced",
    goals: ["Improve page logic", "Rebuild hierarchy when the current flow is weak", "Use AI for structure rather than just copy"],
    steps: [
      { title: "Name the structural problem", detail: "Examples include weak narrative flow, buried proof, poor CTA sequence, or redundant sections." },
      { title: "Generate a refactor plan", detail: "Ask AI Studio for a better section order, stronger logic, and a clearer experience path." },
      { title: "Apply changes incrementally", detail: "Do not rebuild the whole page blindly in one move. Work section by section." },
      { title: "Validate the new flow visually", detail: "Check whether the refactor improved comprehension, proof, and action density." },
    ],
    outcomes: ["The page gets a stronger narrative", "Structure work is intentional", "Large rewrites are easier to control"],
    pitfalls: ["Do not refactor without a clear problem statement", "Protect snapshots before large structural work"],
  }),
  tutorial({
    id: "share-preview",
    title: "Create a share preview",
    category: "publishing",
    subcategory: "share-preview",
    duration: "0:50",
    description: "Generate a lightweight preview for client feedback before full publishing or export handoff.",
    embedUrl: "",
    ctaLabel: "Create preview",
    order: 30,
    level: "Beginner",
    goals: ["Share progress safely", "Collect client feedback earlier", "Avoid publishing unfinished work live"],
    steps: [
      { title: "Open the project ready for review", detail: "Use the current draft once it is coherent enough for feedback." },
      { title: "Generate the preview link", detail: "Use the share preview flow so the client can view without needing full account access." },
      { title: "Send with clear review context", detail: "Tell the reviewer what is final, what is draft, and what kind of feedback you want." },
      { title: "Use feedback to iterate", detail: "Translate client comments into editor or AI Studio work before final publishing." },
    ],
    outcomes: ["Clients can review earlier", "Feedback loops get shorter", "You avoid premature publish pressure"],
    pitfalls: ["Do not share a preview without context", "Make sure the client knows whether they are seeing a draft or near-final state"],
  }),
  tutorial({
    id: "publish-site",
    title: "Publish your site",
    category: "publishing",
    subcategory: "publish",
    duration: "1:15",
    description: "Publish or deploy once content, assets, and review state are ready.",
    embedUrl: "",
    ctaLabel: "Publish the site",
    order: 31,
    level: "Intermediate",
    goals: ["Know when a project is ready", "Use the right publish target", "Reduce deployment surprises"],
    steps: [
      { title: "Confirm the project is approved", detail: "Make sure the workflow state, assets, and content are ready before you publish." },
      { title: "Choose the delivery path", detail: "Use direct deployment where supported or move to export when the client stack requires handoff." },
      { title: "Review the environment target", detail: "Verify whether this should go to staging, production, or a client-specific destination." },
      { title: "Validate after publishing", detail: "Check the live result quickly rather than assuming the deploy finished perfectly." },
    ],
    outcomes: ["The project goes live with intent", "You reduce deployment mistakes", "Post-publish verification becomes standard"],
    pitfalls: ["Do not publish an unreviewed variant", "Avoid skipping the final live check"],
  }),
  tutorial({
    id: "custom-domains",
    title: "Set up custom domains",
    category: "publishing",
    subcategory: "domains",
    duration: "1:20",
    description: "Use the domain setup guidance and connect the right records without guessing through DNS.",
    embedUrl: "",
    ctaLabel: "Set up domains",
    order: 32,
    level: "Intermediate",
    goals: ["Understand the DNS handoff", "Use generated instructions", "Avoid domain setup confusion"],
    steps: [
      { title: "Choose the final hostname", detail: "Decide whether the project will live on root, subdomain, or a temporary staging address." },
      { title: "Generate the domain guide", detail: "Use the platform-specific instructions rather than constructing DNS records from memory." },
      { title: "Apply the records in the registrar or DNS provider", detail: "Enter record type, target, and validation values exactly as shown." },
      { title: "Recheck propagation and status", detail: "Domain work is not done until resolution and validation complete." },
    ],
    outcomes: ["The domain setup becomes clear", "DNS mistakes are reduced", "The project can move from preview to final hostname"],
    pitfalls: ["Do not edit DNS from memory", "Check whether existing records conflict before replacing them"],
  }),
  tutorial({
    id: "create-organization",
    title: "Create an organization",
    category: "teams",
    subcategory: "organization",
    duration: "0:55",
    description: "Create the shared container for team workflows, members, and permissions.",
    embedUrl: "",
    ctaLabel: "Create organization",
    order: 40,
    level: "Beginner",
    goals: ["Understand org ownership", "Separate solo and team work clearly", "Prepare for members and role controls"],
    steps: [
      { title: "Open organization settings", detail: "Go to the organization area from settings when you are ready to move beyond solo use." },
      { title: "Create the org with a clear name", detail: "Use a real business or client-ops label instead of a throwaway internal name." },
      { title: "Confirm ownership and defaults", detail: "Check who owns the org and which work should remain personal versus shared." },
      { title: "Prepare to invite members", detail: "Once the container exists, roles and invites become much easier to manage." },
    ],
    outcomes: ["Team work has a shared home", "Ownership is clearer", "Member management becomes possible"],
    pitfalls: ["Do not create duplicate organizations casually", "Clarify whether client work belongs in the shared org or private space"],
  }),
  tutorial({
    id: "invite-members",
    title: "Invite members",
    category: "teams",
    subcategory: "members",
    duration: "1:00",
    description: "Invite collaborators into the organization and get them into the right workflow without manual back-and-forth.",
    embedUrl: "",
    ctaLabel: "Invite members",
    order: 41,
    level: "Beginner",
    goals: ["Invite users correctly", "Avoid permission confusion", "Get collaborators productive faster"],
    steps: [
      { title: "Open member management", detail: "From the organization area, go to the member or invite controls." },
      { title: "Enter the email and role", detail: "Decide the correct role before sending so the invite reflects intended access." },
      { title: "Send the invite", detail: "The user should receive an invite path tied to the organization context." },
      { title: "Verify acceptance", detail: "Once accepted, the member list should show status and role clearly." },
    ],
    outcomes: ["New members join faster", "Roles are not improvised later", "The team view stays clean"],
    pitfalls: ["Do not assign overly broad roles by default", "Verify email addresses before sending invites"],
  }),
  tutorial({
    id: "manage-roles",
    title: "Manage team roles",
    category: "teams",
    subcategory: "roles",
    duration: "1:05",
    description: "Use roles deliberately so access, approvals, and editing rights stay aligned with real responsibility.",
    embedUrl: "",
    ctaLabel: "Manage roles",
    order: 42,
    level: "Intermediate",
    goals: ["Understand role boundaries", "Reduce accidental over-permissioning", "Align workflow ownership"],
    steps: [
      { title: "Review current members", detail: "Check who has which role today and whether it still reflects their actual responsibility." },
      { title: "Change roles deliberately", detail: "Use the least privilege needed for the person to do their job well." },
      { title: "Confirm approval implications", detail: "Roles affect who can publish, approve, or perform sensitive operations." },
      { title: "Audit periodically", detail: "Role hygiene matters more as the team and client count increase." },
    ],
    outcomes: ["Permissions map better to reality", "Risk drops", "Approvals make more sense"],
    pitfalls: ["Do not give admin rights as the default fix for friction", "Review role changes after staff or client transitions"],
  }),
  tutorial({
    id: "add-api-keys",
    title: "Add API keys",
    category: "settings",
    subcategory: "api-keys",
    duration: "1:15",
    description: "Connect provider keys correctly so models, spend, and capabilities resolve cleanly inside the app.",
    embedUrl: "",
    ctaLabel: "Open API key settings",
    order: 50,
    level: "Beginner",
    goals: ["Connect providers cleanly", "Detect available models", "Avoid broken AI calls caused by key setup"],
    steps: [
      { title: "Open the API key area", detail: "Go to settings and find the provider key controls rather than hardcoding credentials elsewhere." },
      { title: "Paste a valid provider key", detail: "Use the correct provider format for Anthropic, Gemini, Groq, OpenAI, or other supported backends." },
      { title: "Let the app detect models", detail: "Model detection shows what the key can actually access." },
      { title: "Save only the models you intend to expose", detail: "A detected model list should still be curated for real usage." },
    ],
    outcomes: ["AI providers connect correctly", "Available models are visible", "Provider mismatch issues become easier to spot"],
    pitfalls: ["Do not assume a valid key grants every model", "Avoid leaving stale or duplicate provider keys around"],
  }),
  tutorial({
    id: "manage-models",
    title: "Manage model availability",
    category: "settings",
    subcategory: "models",
    duration: "1:05",
    description: "Enable only the models you really want available to the team and hide the rest to reduce confusion and cost drift.",
    embedUrl: "",
    ctaLabel: "Manage models",
    order: 51,
    level: "Intermediate",
    goals: ["Control model sprawl", "Align model choice with use cases", "Reduce avoidable cost noise"],
    steps: [
      { title: "Open the model browser", detail: "Review the detected and configured models by category." },
      { title: "Disable models you do not want exposed", detail: "This keeps the product interface focused for the team." },
      { title: "Match models to tasks", detail: "Reserve stronger or pricier models for work that really needs them." },
      { title: "Revisit after provider changes", detail: "When keys or plans change, the visible model set should be rechecked." },
    ],
    outcomes: ["Model choice is clearer", "The team sees fewer noisy options", "Spend can be easier to explain"],
    pitfalls: ["Do not expose every detected model by default", "Keep expensive models gated to real use cases"],
  }),
  tutorial({
    id: "general-settings-overview",
    title: "Use general settings",
    category: "settings",
    subcategory: "general-settings",
    duration: "1:10",
    description: "Configure language, approval behavior, and general defaults so the app behaves correctly for the way your team works.",
    embedUrl: "",
    ctaLabel: "Open general settings",
    order: 52,
    level: "Beginner",
    goals: ["Know what general settings actually affect", "Use approval gates intentionally", "Control core app defaults"],
    steps: [
      { title: "Review language settings", detail: "Use UI language and translation-related controls deliberately for the team and client workflow." },
      { title: "Set request approval behavior", detail: "Choose whether AI requests need approval and at what cost threshold." },
      { title: "Review theme and general defaults", detail: "Make sure core app behavior fits the operating environment." },
      { title: "Save and test once", detail: "After changing defaults, verify the affected flow once instead of assuming it worked." },
    ],
    outcomes: ["General behavior matches the team", "Approval flows are explicit", "Settings stop feeling opaque"],
    pitfalls: ["Do not enable blanket approvals without understanding cost effects", "Test new defaults once after changing them"],
  }),
  tutorial({
    id: "website-import-flow",
    title: "Understand the website import pipeline",
    category: "import-export",
    subcategory: "website-import",
    duration: "1:30",
    description: "See how the importer classifies uploaded or crawled material into pages, assets, support files, and platform assumptions.",
    embedUrl: "",
    ctaLabel: "Learn the import flow",
    order: 60,
    level: "Intermediate",
    goals: ["Understand what the importer is doing", "Interpret the summary correctly", "Debug odd imports faster"],
    steps: [
      { title: "Start with a real source", detail: "Use a representative live site or upload package so the import summary has signal." },
      { title: "Read the import summary", detail: "Look at page count, homepage detection, content sources, support files, and inferred platform." },
      { title: "Inspect candidates before creation", detail: "Homepage file, navigation model, and page candidates tell you whether the import is sane." },
      { title: "Create only after the signal is good", detail: "A confusing summary should be investigated rather than pushed through." },
    ],
    outcomes: ["Imports become more predictable", "You understand what the preview is telling you", "Debugging bad imports becomes faster"],
    pitfalls: ["Do not ignore a weak import summary", "If the source is private or unusual, expect to use auth or more review"],
  }),
  tutorial({
    id: "export-project",
    title: "Export a project cleanly",
    category: "import-export",
    subcategory: "exports",
    duration: "1:25",
    description: "Export into the target format your client or platform needs without losing structure, assets, or SEO.",
    embedUrl: "",
    ctaLabel: "Export a project",
    order: 61,
    level: "Intermediate",
    goals: ["Choose the correct format", "Understand export readiness", "Reduce handoff friction"],
    steps: [
      { title: "Confirm the project is ready", detail: "Before exporting, check content quality, asset state, and platform alignment." },
      { title: "Choose the right export target", detail: "Different clients need different artifacts such as WordPress, Shopify, React, HTML, or other formats." },
      { title: "Generate and review the artifact", detail: "Use the export output as a deliverable, not just as a button press." },
      { title: "Store or hand off with context", detail: "The export should be named, versioned, and explained well enough for the recipient." },
    ],
    outcomes: ["Exports fit the target stack", "Handoffs are cleaner", "Project delivery becomes more repeatable"],
    pitfalls: ["Do not export before checking assets and copy", "Use the right output for the client stack instead of forcing one format everywhere"],
  }),
  tutorial({
    id: "automation-overview",
    title: "Automation overview",
    category: "advanced",
    subcategory: "automation",
    duration: "1:05",
    description: "Understand where automation fits in the workflow and how it should support, not replace, editorial judgment.",
    embedUrl: "",
    ctaLabel: "Explore automation",
    order: 70,
    level: "Advanced",
    goals: ["See where automation actually helps", "Separate assistive from risky automation", "Use it intentionally"],
    steps: [
      { title: "Identify repetitive work", detail: "Automation is strongest where the work pattern repeats and manual overhead adds little value." },
      { title: "Use AI Studio or platform tools for structured automation", detail: "Prefer guided automation flows over improvised, one-off prompt chains." },
      { title: "Keep approvals where risk is higher", detail: "Not every automated action should go straight to production." },
      { title: "Measure whether it helped", detail: "Automation that saves no real time is just extra complexity." },
    ],
    outcomes: ["Automation is used more selectively", "Risky actions stay governed", "The team saves time where it counts"],
    pitfalls: ["Do not automate vague or poorly defined work", "Keep human review around sensitive output"],
  }),
  tutorial({
    id: "power-user-workflows",
    title: "Power user workflows",
    category: "advanced",
    subcategory: "power-workflows",
    duration: "1:25",
    description: "Combine shortcuts, search, snapshots, AI Studio, and exports into a faster operating rhythm for heavy production work.",
    embedUrl: "",
    ctaLabel: "Use power workflows",
    order: 71,
    level: "Advanced",
    goals: ["Work faster across the product", "Reduce context switching", "Use the system like an operator, not a casual user"],
    steps: [
      { title: "Use search and shortcuts early", detail: "Jumping to the right workspace, project, or command is often faster than drilling through UI layers." },
      { title: "Pair snapshots with aggressive iteration", detail: "Speed comes from safe branching, not from reckless editing." },
      { title: "Use AI Studio for planning and the editor for execution", detail: "Separate strategy generation from block-level implementation." },
      { title: "Close the loop with export and review", detail: "The fastest users still verify outputs before handing them off or publishing them." },
    ],
    outcomes: ["The product feels faster", "Large workloads become more manageable", "You operate from a repeatable rhythm"],
    pitfalls: ["Speed without checkpoints increases rework", "Use shortcuts to reduce friction, not to skip validation"],
  }),
]

export const LEARN_VIDEOS_VERSION = 2

export const LEARN_RUNTIME_STRINGS = Array.from(
  new Set([
    ...LEARN_VIDEO_CATEGORIES.map((item) => item.label),
    ...LEARN_VIDEO_SUBCATEGORIES.map((item) => item.label),
    ...LEARN_VIDEOS.flatMap((video) => [
      video.title,
      video.duration,
      video.description,
      video.ctaLabel,
      video.level,
      ...video.goals,
      ...video.steps.flatMap((step) => [step.title, step.detail]),
      ...video.outcomes,
      ...video.pitfalls,
    ]),
  ]),
)

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
    if (!video.steps.length) {
      throw new Error(`Missing learn tutorial steps on ${video.id}`)
    }
    if (!video.goals.length || !video.outcomes.length || !video.pitfalls.length) {
      throw new Error(`Incomplete learn tutorial metadata on ${video.id}`)
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
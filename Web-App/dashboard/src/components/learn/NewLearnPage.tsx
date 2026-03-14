import { useEffect, useMemo, useState } from "react"
import {
  LEARN_FEATURE_AREAS,
  LEARN_FEATURE_REFERENCES,
  LEARN_FEATURE_REFERENCE_RUNTIME_STRINGS,
  getLearnFeatureAreaLabel,
  type LearnFeatureArea,
} from "../../data/learnFeatureReference"
import {
  LEARN_RUNTIME_STRINGS,
  LEARN_VIDEO_CATEGORIES,
  LEARN_VIDEO_SUBCATEGORIES,
  LEARN_VIDEOS,
  getCategoryLabel,
  getSubcategoryLabel,
  type LearnVideoCategory,
  type LearnVideoSubcategory,
} from "../../data/learnVideos"
import { useRuntimeTranslations, useTranslation } from "../../i18n/useTranslation"
import "./NewLearnPage.css"

type NewLearnPageProps = {
  onBack?: () => void
}

type LearnContentMode = "reference" | "tutorials"
type LearnProgressState = Record<string, string[]>
type LearnListState = string[]
type LearnAreaVisibilityState = Record<string, number>
type LearnAreaExpandedState = Record<string, boolean>

const PROGRESS_STORAGE_KEY = "learn-progress-v2"
const FEATURE_BOOKMARKS_STORAGE_KEY = "learn-feature-bookmarks-v1"
const FEATURE_VIEWED_STORAGE_KEY = "learn-feature-viewed-v1"
const DEFAULT_FEATURES_PER_AREA = 6

const FEATURE_JOURNEYS = [
  {
    id: "ship-fast",
    label: "Ship your first client delivery",
    areas: ["core", "projects", "editor-basics", "publishing"] as LearnFeatureArea[],
    description: "Core workspace → import → editing basics → publish/export flow for first production delivery.",
  },
  {
    id: "ai-power",
    label: "AI-first production workflow",
    areas: ["ai", "editor-advanced", "seo"] as LearnFeatureArea[],
    description: "Move from prompt-based edits to controlled AI workflows with approvals, quality checks and SEO guardrails.",
  },
  {
    id: "ops-scale",
    label: "Scale with team operations",
    areas: ["team-security", "settings-admin", "publishing"] as LearnFeatureArea[],
    description: "Set up team permissions, admin controls, deploy governance, and client-safe operational defaults.",
  },
]

function loadStringList(key: string): LearnListState {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}
function saveStringList(key: string, value: LearnListState) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}
function loadProgress(): LearnProgressState {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LearnProgressState) : {}
  } catch { return {} }
}
function saveProgress(value: LearnProgressState) {
  try { localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(value)) } catch { /* ignore */ }
}
function buildInitialVisibility(): LearnAreaVisibilityState {
  return LEARN_FEATURE_AREAS.reduce((acc, area) => { acc[area.id] = DEFAULT_FEATURES_PER_AREA; return acc }, {} as LearnAreaVisibilityState)
}
function buildInitialExpanded(): LearnAreaExpandedState {
  return LEARN_FEATURE_AREAS.reduce((acc, area, i) => { acc[area.id] = i < 2; return acc }, {} as LearnAreaExpandedState)
}

const LEARN_UI_STRINGS = [
  "Learn Reframe", "Tutorials, demos and guided walkthroughs.",
  "Feature encyclopedia for the real product UI, based on the actual dashboard, editor, AI, export, team, billing and admin surfaces in this app.",
  "A complete learning hub for onboarding, delivery, AI workflows, publishing, settings, and power-user operations.",
  "Back to landing", "Search tutorials, features, workflows…",
  "Categories", "Subcategories", "Tutorial library", "tutorials", "selected",
  "No tutorials match this filter yet.", "Try a different search or switch category.",
  "What you will learn", "Step-by-step walkthrough", "Expected outcomes", "Common mistakes",
  "Progress", "steps completed", "Mark step done", "Reset progress",
  "Open video walkthrough", "Open written walkthrough", "Featured tutorial",
  "Level", "Duration", "Category", "Subcategory", "Video walkthrough", "Written walkthrough",
  "This tutorial is fully usable as a written walkthrough even before a video is added.",
  "Browse tutorials in this subcategory", "Completion",
  "Guided tutorials", "Feature reference", "Reference areas", "All areas",
  "explained functions", "200+ explained functions",
  "This area groups related UI features so you can understand what each control is for before using it.",
  "No explained functions match this filter yet.", "Try a different search or area.",
  "Matching entries", "Area", "Real UI reference",
  "Use the reference when you want to understand a specific control, panel or workflow without watching a video.",
  "Structured feature explorer", "Learning journeys", "Start a journey", "Journey focus",
  "Bookmarked", "Recent", "Mastered", "Mark as mastered", "Remove mastered mark",
  "Bookmark feature", "Remove bookmark", "Recently viewed features", "Bookmarked features",
  "Area progress", "features viewed", "Open area", "Collapse area", "Show more", "Show less",
  "Next suggested feature", "Smart suggestion",
  "Use this panel to follow curated paths instead of browsing all 200 features at once.",
  "Follow this journey",
  "No bookmarks yet. Bookmark important controls so your team can reuse them.",
  "No recently viewed features yet. Open a feature to build your activity trail.",
  "Ship your first client delivery", "AI-first production workflow", "Scale with team operations",
  "Learning paths", "Start path", "Overview",
]

function levelChipClass(level: string) {
  if (level === "Beginner") return "nlrn-chip--green"
  if (level === "Intermediate") return "nlrn-chip--amber"
  return "nlrn-chip"
}

export default function NewLearnPage({ onBack }: NewLearnPageProps) {
  const { t, lang } = useTranslation()
  const rt = useRuntimeTranslations(
    lang,
    [...LEARN_RUNTIME_STRINGS, ...LEARN_FEATURE_REFERENCE_RUNTIME_STRINGS, ...LEARN_UI_STRINGS],
    t,
  )

  const categoryItems = useMemo(() => [...LEARN_VIDEO_CATEGORIES].sort((a, b) => a.order - b.order), [])
  const featureAreaItems = useMemo(() => [...LEARN_FEATURE_AREAS].sort((a, b) => a.order - b.order), [])
  const featuredVideo = LEARN_VIDEOS.find(v => v.featured) || LEARN_VIDEOS[0]

  const [contentMode, setContentMode] = useState<LearnContentMode>("tutorials")
  const [activeCategory, setActiveCategory] = useState<LearnVideoCategory>(featuredVideo?.category || "getting-started")
  const [activeSubcategory, setActiveSubcategory] = useState<LearnVideoSubcategory>(featuredVideo?.subcategory || "first-steps")
  const [selectedVideoId, setSelectedVideoId] = useState<string>(featuredVideo?.id || "")
  const [featureArea, setFeatureArea] = useState<LearnFeatureArea | "all">("core")
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(
    LEARN_FEATURE_REFERENCES.find(i => i.area === "core")?.id || LEARN_FEATURE_REFERENCES[0]?.id || "",
  )
  const [query, setQuery] = useState("")
  const [progress, setProgress] = useState<LearnProgressState>(loadProgress)
  const [bookmarkedFeatures, setBookmarkedFeatures] = useState<LearnListState>(() => loadStringList(FEATURE_BOOKMARKS_STORAGE_KEY))
  const [recentFeatures, setRecentFeatures] = useState<LearnListState>(() => loadStringList(FEATURE_VIEWED_STORAGE_KEY))
  const [areaVisibility, setAreaVisibility] = useState<LearnAreaVisibilityState>(buildInitialVisibility)
  const [areaExpanded, setAreaExpanded] = useState<LearnAreaExpandedState>(buildInitialExpanded)

  useEffect(() => { saveProgress(progress) }, [progress])
  useEffect(() => { saveStringList(FEATURE_BOOKMARKS_STORAGE_KEY, bookmarkedFeatures) }, [bookmarkedFeatures])
  useEffect(() => { saveStringList(FEATURE_VIEWED_STORAGE_KEY, recentFeatures) }, [recentFeatures])

  const subcategoryItems = useMemo(
    () => LEARN_VIDEO_SUBCATEGORIES.filter(i => i.category === activeCategory).sort((a, b) => a.order - b.order),
    [activeCategory],
  )

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LEARN_VIDEOS.filter(v => {
      if (v.category !== activeCategory || v.subcategory !== activeSubcategory) return false
      if (!q) return true
      return [v.title, v.description, v.level, ...v.goals, ...v.outcomes, ...v.pitfalls, ...v.steps.flatMap(s => [s.title, s.detail])].join(" ").toLowerCase().includes(q)
    }).sort((a, b) => a.order - b.order)
  }, [activeCategory, activeSubcategory, query])

  const filteredFeatures = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LEARN_FEATURE_REFERENCES.filter(item => {
      if (featureArea !== "all" && item.area !== featureArea) return false
      if (!q) return true
      return `${item.title} ${item.summary} ${getLearnFeatureAreaLabel(item.area)}`.toLowerCase().includes(q)
    })
  }, [featureArea, query])

  const effectiveVideoId = filteredVideos.some(v => v.id === selectedVideoId) ? selectedVideoId : (filteredVideos[0]?.id || featuredVideo.id)
  const effectiveFeatureId = filteredFeatures.some(i => i.id === selectedFeatureId) ? selectedFeatureId : (filteredFeatures[0]?.id || LEARN_FEATURE_REFERENCES[0].id)

  const selectedVideo = useMemo(
    () => filteredVideos.find(v => v.id === effectiveVideoId) || filteredVideos[0] || featuredVideo,
    [effectiveVideoId, featuredVideo, filteredVideos],
  )
  const selectedFeature = useMemo(
    () => filteredFeatures.find(i => i.id === effectiveFeatureId) || filteredFeatures[0] || LEARN_FEATURE_REFERENCES[0],
    [effectiveFeatureId, filteredFeatures],
  )

  const completedSteps = progress[selectedVideo.id] || []
  const progressPct = selectedVideo.steps.length ? Math.round((completedSteps.length / selectedVideo.steps.length) * 100) : 0

  const viewedSet = useMemo(() => new Set(recentFeatures), [recentFeatures])
  const bookmarkSet = useMemo(() => new Set(bookmarkedFeatures), [bookmarkedFeatures])
  const featureById = useMemo(() => LEARN_FEATURE_REFERENCES.reduce((acc, i) => { acc[i.id] = i; return acc }, {} as Record<string, typeof LEARN_FEATURE_REFERENCES[0]>), [])
  const featuresByArea = useMemo(() => LEARN_FEATURE_AREAS.reduce((acc, area) => { acc[area.id] = LEARN_FEATURE_REFERENCES.filter(i => i.area === area.id); return acc }, {} as Record<LearnFeatureArea, typeof LEARN_FEATURE_REFERENCES>), [])
  const bookmarkedList = useMemo(() => bookmarkedFeatures.map(id => featureById[id]).filter(Boolean), [bookmarkedFeatures, featureById])
  const recentList = useMemo(() => recentFeatures.map(id => featureById[id]).filter(Boolean), [featureById, recentFeatures])

  const nextSuggestedFeature = useMemo(() => {
    const sameArea = featuresByArea[selectedFeature.area]?.find(i => !viewedSet.has(i.id) && i.id !== selectedFeature.id)
    if (sameArea) return sameArea
    return LEARN_FEATURE_REFERENCES.find(i => !viewedSet.has(i.id) && i.id !== selectedFeature.id) || null
  }, [featuresByArea, selectedFeature.area, selectedFeature.id, viewedSet])

  const selectedJourney = useMemo(
    () => FEATURE_JOURNEYS.find(j => j.areas.includes(selectedFeature.area)) || FEATURE_JOURNEYS[0],
    [selectedFeature.area],
  )

  const openFeature = (id: string) => {
    setSelectedFeatureId(id)
    setRecentFeatures(prev => [id, ...prev.filter(x => x !== id)].slice(0, 28))
  }
  const jumpToCategory = (cat: LearnVideoCategory) => {
    setActiveCategory(cat)
    const first = LEARN_VIDEO_SUBCATEGORIES.filter(i => i.category === cat).sort((a, b) => a.order - b.order)[0]
    if (!first) return
    setActiveSubcategory(first.id)
    const firstVid = LEARN_VIDEOS.filter(v => v.category === cat && v.subcategory === first.id).sort((a, b) => a.order - b.order)[0]
    if (firstVid) setSelectedVideoId(firstVid.id)
  }
  const jumpToSubcategory = (sub: LearnVideoSubcategory) => {
    setActiveSubcategory(sub)
    const first = LEARN_VIDEOS.filter(v => v.category === activeCategory && v.subcategory === sub).sort((a, b) => a.order - b.order)[0]
    if (first) setSelectedVideoId(first.id)
  }
  const toggleStep = (stepTitle: string) => {
    setProgress(prev => {
      const cur = prev[selectedVideo.id] || []
      const next = cur.includes(stepTitle) ? cur.filter(s => s !== stepTitle) : [...cur, stepTitle]
      return { ...prev, [selectedVideo.id]: next }
    })
  }
  const toggleBookmark = (id: string) => {
    setBookmarkedFeatures(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev].slice(0, 64))
  }
  const toggleViewed = (id: string) => {
    setRecentFeatures(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev].slice(0, 28))
  }
  const startJourney = (areas: LearnFeatureArea[]) => {
    if (areas.length === 0) return
    const firstArea = areas[0]
    setFeatureArea(firstArea)
    const candidate = featuresByArea[firstArea]?.[0]
    if (candidate) openFeature(candidate.id)
  }
  const openVideo = () => {
    if (selectedVideo.embedUrl) {
      window.open(selectedVideo.embedUrl, "_blank", "noopener,noreferrer")
      return
    }
    document.getElementById("nlrn-steps")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="nlrn">
      {/* ── Top bar ── */}
      <header className="nlrn-topbar">
        <div className="nlrn-topbar__logo">
          <div className="nlrn-logo-mark" />
          <span>Reframe</span>
        </div>
        <span className="nlrn-topbar__title">{rt("Learn Reframe")}</span>
        <div className="nlrn-divider" />
        <div className="nlrn-mode-switch">
          <button
            type="button"
            className={`nlrn-mode-btn${contentMode === "tutorials" ? " nlrn-mode-btn--active" : ""}`}
            onClick={() => setContentMode("tutorials")}
          >
            {rt("Guided tutorials")}
          </button>
          <button
            type="button"
            className={`nlrn-mode-btn${contentMode === "reference" ? " nlrn-mode-btn--active" : ""}`}
            onClick={() => setContentMode("reference")}
          >
            {rt("Feature reference")}
          </button>
        </div>
        <div className="nlrn-topbar__spacer" />
        <div className="nlrn-topbar__search">
          <span className="nlrn-topbar__search-icon">⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={rt("Search tutorials, features, workflows…")}
            aria-label={rt("Search tutorials, features, workflows…")}
          />
        </div>
        <button type="button" className="nlrn-btn" onClick={onBack}>
          {rt("Back to landing")}
        </button>
      </header>

      {/* ── Body ── */}
      <div className="nlrn-body">
        {/* ── Sidebar ── */}
        <aside className="nlrn-sidebar">
          {contentMode === "tutorials" ? (
            <>
              <div className="nlrn-sidebar__section">
                <span className="nlrn-sidebar__label">{rt("Categories")}</span>
                <div className="nlrn-sidebar__list">
                  {categoryItems.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`nlrn-sidebar__item${cat.id === activeCategory ? " nlrn-sidebar__item--active" : ""}`}
                      onClick={() => jumpToCategory(cat.id)}
                    >
                      <span>{rt(cat.label)}</span>
                      <span className="nlrn-sidebar__item-count">
                        {LEARN_VIDEOS.filter(v => v.category === cat.id).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="nlrn-sidebar__scroll">
                <span className="nlrn-sidebar__label">{rt("Subcategories")}</span>
                <div className="nlrn-sidebar__list">
                   {subcategoryItems.map(sub => {
                    const count = LEARN_VIDEOS.filter(v => v.category === activeCategory && v.subcategory === sub.id).length
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        className={`nlrn-sidebar__item${sub.id === activeSubcategory ? " nlrn-sidebar__item--active" : ""}`}
                        onClick={() => jumpToSubcategory(sub.id)}
                      >
                        <span>{rt(sub.label)}</span>
                        <span className="nlrn-sidebar__item-count">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="nlrn-sidebar__section">
                <span className="nlrn-sidebar__label">{rt("Reference areas")}</span>
                <div className="nlrn-sidebar__list">
                  <button
                    type="button"
                    className={`nlrn-sidebar__item${featureArea === "all" ? " nlrn-sidebar__item--active" : ""}`}
                    onClick={() => setFeatureArea("all")}
                  >
                    <span>{rt("All areas")}</span>
                    <span className="nlrn-sidebar__item-count">{LEARN_FEATURE_REFERENCES.length}</span>
                  </button>
                  {featureAreaItems.map(area => {
                    const count = LEARN_FEATURE_REFERENCES.filter(i => i.area === area.id).length
                    const seen = featuresByArea[area.id]?.filter(i => viewedSet.has(i.id)).length ?? 0
                    const pct = count ? Math.round((seen / count) * 100) : 0
                    return (
                      <button
                        key={area.id}
                        type="button"
                        className={`nlrn-sidebar__item${featureArea === area.id ? " nlrn-sidebar__item--active" : ""}`}
                        onClick={() => setFeatureArea(area.id)}
                      >
                        <span>{rt(area.label)}</span>
                        <span className="nlrn-sidebar__item-count">{count}</span>
                        <div className="nlrn-sidebar__progress" style={{ width: "100%", gridColumn: "1 / -1" }}>
                          <div className="nlrn-sidebar__progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="nlrn-sidebar__scroll">
                <span className="nlrn-sidebar__label">{rt("Learning journeys")}</span>
                <div className="nlrn-sidebar__list">
                  {FEATURE_JOURNEYS.map(journey => (
                    <button
                      key={journey.id}
                      type="button"
                      className={`nlrn-sidebar__item${selectedJourney.id === journey.id ? " nlrn-sidebar__item--active" : ""}`}
                      onClick={() => startJourney(journey.areas)}
                    >
                      <span>{rt(journey.label)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* ── Content ── */}
        <div className="nlrn-content">
          <div className="nlrn-content__scroll">
            {contentMode === "tutorials" ? (
              <>
                {/* Journey cards */}
                <div className="nlrn-journeys">
                  {FEATURE_JOURNEYS.map((journey, idx) => (
                    <button
                      key={journey.id}
                      type="button"
                      className={`nlrn-journey-card${selectedJourney.id === journey.id ? " nlrn-journey-card--active" : ""}`}
                      onClick={() => { setContentMode("reference"); startJourney(journey.areas) }}
                    >
                      <div className="nlrn-journey-card__num">Path {idx + 1}</div>
                      <div className="nlrn-journey-card__label">{rt(journey.label)}</div>
                      <div className="nlrn-journey-card__desc">{rt(journey.description)}</div>
                      <div className="nlrn-journey-card__areas">
                        {journey.areas.map(a => (
                          <span key={a} className="nlrn-journey-card__area-tag">{rt(getLearnFeatureAreaLabel(a))}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Tutorial viewer */}
                <div className="nlrn-viewer">
                  <div className="nlrn-viewer__head">
                    <div className="nlrn-viewer__head-left">
                      <div className="nlrn-viewer__eyebrow">{rt("Tutorial library")}</div>
                      <h2 className="nlrn-viewer__title">{rt(selectedVideo.title)}</h2>
                      <p className="nlrn-viewer__desc">{rt(selectedVideo.description)}</p>
                    </div>
                    <button className="nlrn-btn nlrn-btn--primary" type="button" onClick={openVideo}>
                      {selectedVideo.embedUrl ? rt("Open video walkthrough") : rt("Open written walkthrough")}
                    </button>
                  </div>
                  <div className="nlrn-viewer__meta">
                    <span className="nlrn-chip">{rt("Level")}: {rt(selectedVideo.level)}</span>
                    <span className="nlrn-chip">{rt("Duration")}: {rt(selectedVideo.duration)}</span>
                    <span className="nlrn-chip">{rt("Category")}: {rt(getCategoryLabel(selectedVideo.category))}</span>
                    <span className="nlrn-chip">{rt("Subcategory")}: {rt(getSubcategoryLabel(selectedVideo.subcategory))}</span>
                  </div>
                  <div className="nlrn-viewer__video">
                    {selectedVideo.embedUrl ? (
                      <iframe src={selectedVideo.embedUrl} title={selectedVideo.title} allow="fullscreen" allowFullScreen />
                    ) : (
                      <div className="nlrn-viewer__placeholder">
                        <div className="nlrn-viewer__placeholder-play">▶</div>
                        <strong>{rt("Written walkthrough")}</strong>
                        <p>{rt("This tutorial is fully usable as a written walkthrough even before a video is added.")}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress + Goals */}
                <div className="nlrn-info-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className="nlrn-progress-panel">
                    <div className="nlrn-progress-panel__head">
                      <h3>{rt("Progress")}</h3>
                      <span className="nlrn-progress-panel__pct">{progressPct}%</span>
                    </div>
                    <div className="nlrn-progress-bar">
                      <div className="nlrn-progress-bar__fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="nlrn-progress-panel__meta">{completedSteps.length}/{selectedVideo.steps.length} {rt("steps completed")}</div>
                    <button className="nlrn-btn" type="button" style={{ marginTop: 10 }} onClick={() => setProgress(p => ({ ...p, [selectedVideo.id]: [] }))}>
                      {rt("Reset progress")}
                    </button>
                  </div>
                  <div className="nlrn-info-panel">
                    <h3>{rt("What you will learn")}</h3>
                    <ul className="nlrn-info-panel__list">
                      {selectedVideo.goals.map(g => <li key={g}>{rt(g)}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Steps */}
                <div className="nlrn-steps" id="nlrn-steps">
                  <div className="nlrn-steps__head">
                    <h3>{rt("Step-by-step walkthrough")}</h3>
                    <span className="nlrn-section-head__meta">{completedSteps.length}/{selectedVideo.steps.length}</span>
                  </div>
                  {selectedVideo.steps.map((step, idx) => {
                    const done = completedSteps.includes(step.title)
                    return (
                      <button
                        key={step.title}
                        type="button"
                        className={`nlrn-step${done ? " nlrn-step--done" : ""}`}
                        onClick={() => toggleStep(step.title)}
                      >
                        <span className="nlrn-step__idx">{String(idx + 1).padStart(2, "0")}</span>
                        <div className="nlrn-step__body">
                          <div className="nlrn-step__title">{rt(step.title)}</div>
                          <div className="nlrn-step__detail">{rt(step.detail)}</div>
                        </div>
                        <span className="nlrn-step__check">{done ? "✓" : rt("Mark step done")}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Outcomes + Pitfalls */}
                <div className="nlrn-info-grid">
                  <div className="nlrn-info-panel">
                    <h3>{rt("Expected outcomes")}</h3>
                    <ul className="nlrn-info-panel__list">
                      {selectedVideo.outcomes.map(o => <li key={o}>{rt(o)}</li>)}
                    </ul>
                  </div>
                  <div className="nlrn-info-panel">
                    <h3>{rt("Common mistakes")}</h3>
                    <ul className="nlrn-info-panel__list nlrn-info-panel__list--warn">
                      {selectedVideo.pitfalls.map(p => <li key={p}>{rt(p)}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Tutorial grid */}
                <div className="nlrn-section-head">
                  <h2>{rt("Browse tutorials in this subcategory")}</h2>
                  <span className="nlrn-section-head__meta">{filteredVideos.length} {rt("selected")}</span>
                </div>
                {filteredVideos.length ? (
                  <div className="nlrn-tutorial-grid">
                    {filteredVideos.map(video => {
                      const done = (progress[video.id] || []).length
                      const total = video.steps.length
                      const pct = total ? Math.round((done / total) * 100) : 0
                      const isActive = video.id === selectedVideo.id
                      return (
                        <button
                          key={video.id}
                          type="button"
                          className={`nlrn-tutorial-card${isActive ? " nlrn-tutorial-card--active" : ""}`}
                          onClick={() => setSelectedVideoId(video.id)}
                        >
                          <div className="nlrn-tutorial-card__meta">
                            <span className={`nlrn-chip ${levelChipClass(video.level)}`}>{rt(video.level)}</span>
                            <span className="nlrn-chip">{rt(video.duration)}</span>
                            {video.embedUrl && <span className="nlrn-chip nlrn-chip--blue">▶</span>}
                          </div>
                          <div className="nlrn-tutorial-card__title">{rt(video.title)}</div>
                          <div className="nlrn-tutorial-card__desc">{rt(video.description)}</div>
                          <div className="nlrn-tutorial-card__progress">
                            <div className="nlrn-tutorial-card__progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="nlrn-tutorial-card__foot">
                            <span>{done}/{total} {rt("Completion")}</span>
                            <span>{video.embedUrl ? rt("Video walkthrough") : rt("Written walkthrough")}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="nlrn-empty">
                    <strong>{rt("No tutorials match this filter yet.")}</strong><br />
                    {rt("Try a different search or switch category.")}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Feature Reference mode */}
                {nextSuggestedFeature && (
                  <button
                    type="button"
                    className="nlrn-suggestion"
                    onClick={() => openFeature(nextSuggestedFeature.id)}
                  >
                    <div className="nlrn-suggestion__icon">→</div>
                    <div>
                      <div className="nlrn-suggestion__label">{rt("Smart suggestion")}</div>
                      <div className="nlrn-suggestion__title">{rt(nextSuggestedFeature.title)}</div>
                      <div className="nlrn-suggestion__summary">{rt(nextSuggestedFeature.summary)}</div>
                    </div>
                  </button>
                )}

                {/* Selected feature viewer */}
                <div className="nlrn-feat-viewer">
                  <div className="nlrn-feat-viewer__head">
                    <div>
                      <div className="nlrn-feat-viewer__title">{rt(selectedFeature.title)}</div>
                      <div className="nlrn-feat-viewer__area">{rt("Area")}: {rt(getLearnFeatureAreaLabel(selectedFeature.area))}</div>
                    </div>
                    <div className="nlrn-feat-viewer__actions">
                      <button type="button" className="nlrn-btn" onClick={() => toggleViewed(selectedFeature.id)}>
                        {viewedSet.has(selectedFeature.id) ? rt("Remove mastered mark") : rt("Mark as mastered")}
                      </button>
                      <button type="button" className="nlrn-btn" onClick={() => toggleBookmark(selectedFeature.id)}>
                        {bookmarkSet.has(selectedFeature.id) ? rt("Remove bookmark") : rt("Bookmark feature")}
                      </button>
                    </div>
                  </div>
                  <div className="nlrn-feat-viewer__body">
                    <p className="nlrn-feat-viewer__summary">{rt(selectedFeature.summary)}</p>
                    <div className="nlrn-feat-viewer__actions">
                      <span className={`nlrn-chip${viewedSet.has(selectedFeature.id) ? " nlrn-chip--green" : ""}`}>
                        {viewedSet.has(selectedFeature.id) ? rt("Mastered") : rt("Not yet mastered")}
                      </span>
                      <span className={`nlrn-chip${bookmarkSet.has(selectedFeature.id) ? " nlrn-chip--blue" : ""}`}>
                        {bookmarkSet.has(selectedFeature.id) ? rt("Bookmarked") : rt("Not bookmarked")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bookmarks + Recent quick lists */}
                <div className="nlrn-info-grid">
                  <div className="nlrn-quick-list">
                    <div className="nlrn-quick-list__head">
                      <h3>{rt("Bookmarked features")}</h3>
                      <span className="nlrn-section-head__meta">{bookmarkedList.length}</span>
                    </div>
                    {bookmarkedList.length ? bookmarkedList.slice(0, 8).map(item => (
                      <button key={item.id} type="button" className="nlrn-quick-item" onClick={() => openFeature(item.id)}>
                        <strong>{rt(item.title)}</strong>
                        <span>{rt(getLearnFeatureAreaLabel(item.area))}</span>
                      </button>
                    )) : <div className="nlrn-empty">{rt("No bookmarks yet. Bookmark important controls so your team can reuse them.")}</div>}
                  </div>
                  <div className="nlrn-quick-list">
                    <div className="nlrn-quick-list__head">
                      <h3>{rt("Recently viewed features")}</h3>
                      <span className="nlrn-section-head__meta">{recentList.length}</span>
                    </div>
                    {recentList.length ? recentList.slice(0, 8).map(item => (
                      <button key={item.id} type="button" className="nlrn-quick-item" onClick={() => openFeature(item.id)}>
                        <strong>{rt(item.title)}</strong>
                        <span>{rt(getLearnFeatureAreaLabel(item.area))}</span>
                      </button>
                    )) : <div className="nlrn-empty">{rt("No recently viewed features yet. Open a feature to build your activity trail.")}</div>}
                  </div>
                </div>

                {/* Feature area groups */}
                <div className="nlrn-section-head">
                  <h2>{rt("Structured feature explorer")}</h2>
                  <span className="nlrn-section-head__meta">{filteredFeatures.length} {rt("Matching entries")}</span>
                </div>
                {featureAreaItems
                  .filter(area => featureArea === "all" || area.id === featureArea)
                  .map(area => {
                    const areaItems = filteredFeatures.filter(i => i.area === area.id)
                    const visibleCount = areaVisibility[area.id] ?? DEFAULT_FEATURES_PER_AREA
                    const isExpanded = areaExpanded[area.id]
                    const seen = areaItems.filter(i => viewedSet.has(i.id)).length
                    const pct = areaItems.length ? Math.round((seen / areaItems.length) * 100) : 0
                    return (
                      <div key={area.id} className="nlrn-area-group">
                        <button
                          type="button"
                          className="nlrn-area-group__head"
                          onClick={() => setAreaExpanded(prev => ({ ...prev, [area.id]: !prev[area.id] }))}
                        >
                          <strong>{rt(area.label)}</strong>
                          <div className="nlrn-area-group__head-meta">
                            <span className="nlrn-area-group__count">{areaItems.length} {rt("explained functions")} · {pct}% {rt("features viewed")}</span>
                            <div className="nlrn-area-group__progress">
                              <div className="nlrn-area-group__progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="nlrn-area-group__toggle">{isExpanded ? rt("Collapse area") : rt("Open area")}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          areaItems.length ? (
                            <>
                              <div className="nlrn-feat-grid">
                                {areaItems.slice(0, visibleCount).map(item => {
                                  const isActive = item.id === selectedFeature.id
                                  const isBookmarked = bookmarkSet.has(item.id)
                                  const isViewed = viewedSet.has(item.id)
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className={`nlrn-feat-card${isActive ? " nlrn-feat-card--active" : ""}`}
                                      onClick={() => openFeature(item.id)}
                                    >
                                      <div className="nlrn-feat-card__top">
                                        {isBookmarked && <span className="nlrn-chip nlrn-chip--blue">★</span>}
                                        {isViewed && <span className="nlrn-chip nlrn-chip--green">✓</span>}
                                      </div>
                                      <div className="nlrn-feat-card__title">{rt(item.title)}</div>
                                      <div className="nlrn-feat-card__summary">{rt(item.summary)}</div>
                                    </button>
                                  )
                                })}
                              </div>
                              {areaItems.length > DEFAULT_FEATURES_PER_AREA && (
                                <div className="nlrn-area-group__footer">
                                  {visibleCount < areaItems.length ? (
                                    <button type="button" className="nlrn-btn" onClick={() => setAreaVisibility(prev => ({ ...prev, [area.id]: prev[area.id] + DEFAULT_FEATURES_PER_AREA }))}>
                                      {rt("Show more")}
                                    </button>
                                  ) : (
                                    <button type="button" className="nlrn-btn" onClick={() => setAreaVisibility(prev => ({ ...prev, [area.id]: DEFAULT_FEATURES_PER_AREA }))}>
                                      {rt("Show less")}
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="nlrn-empty">{rt("No explained functions match this filter yet.")}</div>
                          )
                        )}
                      </div>
                    )
                  })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
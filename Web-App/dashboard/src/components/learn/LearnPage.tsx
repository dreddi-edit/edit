import React, { useEffect, useMemo, useState } from "react"
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
import "./LearnPage.css"

type LearnPageProps = {
  onBack?: () => void
}

type LearnContentMode = "reference" | "tutorials"

type LearnProgressState = Record<string, string[]>
type LearnListState = string[]
type LearnAreaVisibilityState = Record<LearnFeatureArea, number>
type LearnAreaExpandedState = Record<LearnFeatureArea, boolean>

const PROGRESS_STORAGE_KEY = "learn-progress-v2"
const FEATURE_BOOKMARKS_STORAGE_KEY = "learn-feature-bookmarks-v1"
const FEATURE_VIEWED_STORAGE_KEY = "learn-feature-viewed-v1"

const DEFAULT_FEATURES_PER_AREA = 6

const FEATURE_JOURNEYS: Array<{ id: string; label: string; areas: LearnFeatureArea[]; description: string }> = [
  {
    id: "ship-fast",
    label: "Ship your first client delivery",
    areas: ["core", "projects", "editor-basics", "publishing"],
    description: "Core workspace -> import -> editing basics -> publish/export flow for first production delivery.",
  },
  {
    id: "ai-power",
    label: "AI-first production workflow",
    areas: ["ai", "editor-advanced", "seo"],
    description: "Move from prompt-based edits to controlled AI workflows with approvals, quality checks and SEO guardrails.",
  },
  {
    id: "ops-scale",
    label: "Scale with team operations",
    areas: ["team-security", "settings-admin", "publishing"],
    description: "Set up team permissions, admin controls, deploy governance, and client-safe operational defaults.",
  },
]

function loadStringList(storageKey: string): LearnListState {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

function saveStringList(storageKey: string, value: LearnListState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // Ignore storage errors.
  }
}

function buildInitialAreaVisibility(): LearnAreaVisibilityState {
  return LEARN_FEATURE_AREAS.reduce((acc, area) => {
    acc[area.id] = DEFAULT_FEATURES_PER_AREA
    return acc
  }, {} as LearnAreaVisibilityState)
}

function buildInitialAreaExpanded(): LearnAreaExpandedState {
  return LEARN_FEATURE_AREAS.reduce((acc, area, index) => {
    acc[area.id] = index < 2
    return acc
  }, {} as LearnAreaExpandedState)
}

function loadProgress(): LearnProgressState {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LearnProgressState) : {}
  } catch {
    return {}
  }
}

function saveProgress(value: LearnProgressState) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Ignore storage errors.
  }
}

const LEARN_UI_STRINGS = [
  "Learn Reframe",
  "Tutorials, demos and guided walkthroughs.",
  "A complete learning hub for onboarding, delivery, AI workflows, publishing, settings, and power-user operations.",
  "Feature encyclopedia for the real product UI, based on the actual dashboard, editor, AI, export, team, billing and admin surfaces in this app.",
  "Back to landing",
  "Search learn content",
  "Search by tutorial, feature, workflow or problem",
  "Categories",
  "Subcategories",
  "Tutorial library",
  "tutorials",
  "selected",
  "No tutorials match this filter yet.",
  "Try a different search or switch category.",
  "What you will learn",
  "Step-by-step walkthrough",
  "Expected outcomes",
  "Common mistakes",
  "Progress",
  "steps completed",
  "Mark step done",
  "Reset progress",
  "Open video walkthrough",
  "Open written walkthrough",
  "Featured tutorial",
  "Level",
  "Duration",
  "Category",
  "Subcategory",
  "Video walkthrough",
  "Written walkthrough",
  "This tutorial is fully usable as a written walkthrough even before a video is added.",
  "Browse tutorials in this subcategory",
  "Completion",
  "Guided tutorials",
  "Feature reference",
  "Reference areas",
  "All areas",
  "explained functions",
  "200+ explained functions",
  "This area groups related UI features so you can understand what each control is for before using it.",
  "Explained functions in this area",
  "No explained functions match this filter yet.",
  "Try a different search or area.",
  "Matching entries",
  "Area",
  "Real UI reference",
  "Use the reference when you want to understand a specific control, panel or workflow without watching a video.",
  "Structured feature explorer",
  "Learning journeys",
  "Start a journey",
  "Journey focus",
  "Bookmarked",
  "Recent",
  "Mastered",
  "Mark as mastered",
  "Remove mastered mark",
  "Bookmark feature",
  "Remove bookmark",
  "Recently viewed features",
  "Bookmarked features",
  "Area progress",
  "features viewed",
  "Open area",
  "Collapse area",
  "Show more",
  "Show less",
  "Next suggested feature",
  "Smart suggestion",
  "Use this panel to follow curated paths instead of browsing all 200 features at once.",
  "Follow this journey",
  "No bookmarks yet. Bookmark important controls so your team can reuse them.",
  "No recently viewed features yet. Open a feature to build your activity trail.",
]

export default function LearnPage({ onBack }: LearnPageProps) {
  const { t, lang } = useTranslation()
  const rt = useRuntimeTranslations(
    lang,
    [...LEARN_RUNTIME_STRINGS, ...LEARN_FEATURE_REFERENCE_RUNTIME_STRINGS, ...LEARN_UI_STRINGS],
    t,
  )

  const categoryItems = useMemo(
    () => [...LEARN_VIDEO_CATEGORIES].sort((a, b) => a.order - b.order),
    [],
  )
  const featureAreaItems = useMemo(
    () => [...LEARN_FEATURE_AREAS].sort((a, b) => a.order - b.order),
    [],
  )

  const featuredVideo = LEARN_VIDEOS.find((video) => video.featured) || LEARN_VIDEOS[0]
  const [contentMode, setContentMode] = useState<LearnContentMode>("tutorials")
  const [activeCategory, setActiveCategory] = useState<LearnVideoCategory>(featuredVideo?.category || "getting-started")
  const [activeSubcategory, setActiveSubcategory] = useState<LearnVideoSubcategory>(featuredVideo?.subcategory || "first-steps")
  const [selectedVideoId, setSelectedVideoId] = useState<string>(featuredVideo?.id || "")
  const [featureArea, setFeatureArea] = useState<LearnFeatureArea | "all">("core")
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(
    LEARN_FEATURE_REFERENCES.find((item) => item.area === "core")?.id || LEARN_FEATURE_REFERENCES[0]?.id || "",
  )
  const [query, setQuery] = useState("")
  const [progress, setProgress] = useState<LearnProgressState>(loadProgress)
  const [bookmarkedFeatures, setBookmarkedFeatures] = useState<LearnListState>(() => loadStringList(FEATURE_BOOKMARKS_STORAGE_KEY))
  const [recentFeatures, setRecentFeatures] = useState<LearnListState>(() => loadStringList(FEATURE_VIEWED_STORAGE_KEY))
  const [areaVisibility, setAreaVisibility] = useState<LearnAreaVisibilityState>(buildInitialAreaVisibility)
  const [areaExpanded, setAreaExpanded] = useState<LearnAreaExpandedState>(buildInitialAreaExpanded)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    saveStringList(FEATURE_BOOKMARKS_STORAGE_KEY, bookmarkedFeatures)
  }, [bookmarkedFeatures])

  useEffect(() => {
    saveStringList(FEATURE_VIEWED_STORAGE_KEY, recentFeatures)
  }, [recentFeatures])

  const subcategoryItems = useMemo(
    () => LEARN_VIDEO_SUBCATEGORIES.filter((item) => item.category === activeCategory).sort((a, b) => a.order - b.order),
    [activeCategory],
  )

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return LEARN_VIDEOS.filter((video) => {
      if (video.category !== activeCategory || video.subcategory !== activeSubcategory) return false
      if (!normalizedQuery) return true
      const haystack = [
        video.title,
        video.description,
        video.level,
        ...video.goals,
        ...video.outcomes,
        ...video.pitfalls,
        ...video.steps.flatMap((step) => [step.title, step.detail]),
      ].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    }).sort((a, b) => a.order - b.order)
  }, [activeCategory, activeSubcategory, query])

  const filteredFeatures = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return LEARN_FEATURE_REFERENCES.filter((item) => {
      if (featureArea !== "all" && item.area !== featureArea) return false
      if (!normalizedQuery) return true
      return `${item.title} ${item.summary} ${getLearnFeatureAreaLabel(item.area)}`.toLowerCase().includes(normalizedQuery)
    })
  }, [featureArea, query])

  const effectiveSelectedVideoId =
    filteredVideos.some((video) => video.id === selectedVideoId)
      ? selectedVideoId
      : (filteredVideos[0]?.id || featuredVideo.id)

  const effectiveSelectedFeatureId =
    filteredFeatures.some((item) => item.id === selectedFeatureId)
      ? selectedFeatureId
      : (filteredFeatures[0]?.id || LEARN_FEATURE_REFERENCES[0].id)

  const selectedVideo = useMemo(
    () => filteredVideos.find((video) => video.id === effectiveSelectedVideoId) || filteredVideos[0] || featuredVideo,
    [effectiveSelectedVideoId, featuredVideo, filteredVideos],
  )
  const selectedFeature = useMemo(
    () => filteredFeatures.find((item) => item.id === effectiveSelectedFeatureId) || filteredFeatures[0] || LEARN_FEATURE_REFERENCES[0],
    [effectiveSelectedFeatureId, filteredFeatures],
  )

  const completedSteps = progress[selectedVideo.id] || []
  const progressCount = completedSteps.length
  const progressPercent = selectedVideo.steps.length ? Math.round((progressCount / selectedVideo.steps.length) * 100) : 0
  const totalTutorials = LEARN_VIDEOS.length
  const totalFeatures = LEARN_FEATURE_REFERENCES.length
  const featureById = useMemo(
    () => LEARN_FEATURE_REFERENCES.reduce((acc, item) => {
      acc[item.id] = item
      return acc
    }, {} as Record<string, (typeof LEARN_FEATURE_REFERENCES)[number]>),
    [],
  )
  const featuresByArea = useMemo(
    () =>
      LEARN_FEATURE_AREAS.reduce((acc, area) => {
        acc[area.id] = LEARN_FEATURE_REFERENCES.filter((item) => item.area === area.id)
        return acc
      }, {} as Record<LearnFeatureArea, typeof LEARN_FEATURE_REFERENCES>),
    [],
  )
  const viewedSet = useMemo(() => new Set(recentFeatures), [recentFeatures])
  const bookmarkSet = useMemo(() => new Set(bookmarkedFeatures), [bookmarkedFeatures])
  const bookmarkedList = useMemo(
    () => bookmarkedFeatures.map((id) => featureById[id]).filter(Boolean),
    [bookmarkedFeatures, featureById],
  )
  const recentList = useMemo(
    () => recentFeatures.map((id) => featureById[id]).filter(Boolean),
    [featureById, recentFeatures],
  )
  const selectedJourney = useMemo(
    () => FEATURE_JOURNEYS.find((journey) => journey.areas.includes(selectedFeature.area)) || FEATURE_JOURNEYS[0],
    [selectedFeature.area],
  )
  const nextSuggestedFeature = useMemo(() => {
    const sameAreaUnseen = featuresByArea[selectedFeature.area].find((item) => !viewedSet.has(item.id) && item.id !== selectedFeature.id)
    if (sameAreaUnseen) return sameAreaUnseen
    return LEARN_FEATURE_REFERENCES.find((item) => !viewedSet.has(item.id) && item.id !== selectedFeature.id) || null
  }, [featuresByArea, selectedFeature.area, selectedFeature.id, viewedSet])

  const openFeature = (featureId: string) => {
    setSelectedFeatureId(featureId)
    setRecentFeatures((previous) => [featureId, ...previous.filter((id) => id !== featureId)].slice(0, 28))
  }

  const jumpToCategory = (category: LearnVideoCategory) => {
    setActiveCategory(category)
    const firstSubcategory = LEARN_VIDEO_SUBCATEGORIES.filter((item) => item.category === category).sort((a, b) => a.order - b.order)[0]
    if (!firstSubcategory) return
    setActiveSubcategory(firstSubcategory.id)
    const firstVideo = LEARN_VIDEOS.filter((video) => video.category === category && video.subcategory === firstSubcategory.id).sort((a, b) => a.order - b.order)[0]
    if (firstVideo) setSelectedVideoId(firstVideo.id)
  }

  const jumpToSubcategory = (subcategory: LearnVideoSubcategory) => {
    setActiveSubcategory(subcategory)
    const firstVideo = LEARN_VIDEOS.filter((video) => video.category === activeCategory && video.subcategory === subcategory).sort((a, b) => a.order - b.order)[0]
    if (firstVideo) setSelectedVideoId(firstVideo.id)
  }

  const toggleStep = (stepTitle: string) => {
    setProgress((previous) => {
      const current = previous[selectedVideo.id] || []
      const next = current.includes(stepTitle)
        ? current.filter((item) => item !== stepTitle)
        : [...current, stepTitle]
      return { ...previous, [selectedVideo.id]: next }
    })
  }

  const resetTutorialProgress = () => {
    setProgress((previous) => ({ ...previous, [selectedVideo.id]: [] }))
  }

  const toggleBookmark = (featureId: string) => {
    setBookmarkedFeatures((previous) =>
      previous.includes(featureId)
        ? previous.filter((id) => id !== featureId)
        : [featureId, ...previous.filter((id) => id !== featureId)].slice(0, 64),
    )
  }

  const toggleViewed = (featureId: string) => {
    setRecentFeatures((previous) =>
      previous.includes(featureId)
        ? previous.filter((id) => id !== featureId)
        : [featureId, ...previous.filter((id) => id !== featureId)].slice(0, 28),
    )
  }

  const toggleAreaExpanded = (area: LearnFeatureArea) => {
    setAreaExpanded((previous) => ({ ...previous, [area]: !previous[area] }))
  }

  const showMoreAreaItems = (area: LearnFeatureArea) => {
    setAreaVisibility((previous) => ({ ...previous, [area]: previous[area] + DEFAULT_FEATURES_PER_AREA }))
  }

  const showLessAreaItems = (area: LearnFeatureArea) => {
    setAreaVisibility((previous) => ({ ...previous, [area]: DEFAULT_FEATURES_PER_AREA }))
  }

  const startJourney = (journeyAreas: LearnFeatureArea[]) => {
    const firstArea = journeyAreas[0] || "all"
    setFeatureArea(firstArea)
    if (firstArea !== "all") {
      const candidate = featuresByArea[firstArea][0]
      if (candidate) openFeature(candidate.id)
    }
  }

  const openTutorialPrimaryAction = () => {
    if (selectedVideo.embedUrl) {
      window.open(selectedVideo.embedUrl, "_blank", "noopener,noreferrer")
      return
    }
    document.getElementById("learn-steps")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <main className="learn-page">
      <div className="learn-page__shell">
        <header className="learn-page__hero">
          <div className="learn-page__hero-copy">
            <div className="learn-page__badge">{rt("Learn Reframe")}</div>
            <h1 className="learn-page__title">{rt("Tutorials, demos and guided walkthroughs.")}</h1>
            <p className="learn-page__subtitle">
              {contentMode === "reference"
                ? rt("Feature encyclopedia for the real product UI, based on the actual dashboard, editor, AI, export, team, billing and admin surfaces in this app.")
                : rt("A complete learning hub for onboarding, delivery, AI workflows, publishing, settings, and power-user operations.")}
            </p>
            <div className="learn-page__hero-meta">
              <span className="learn-page__meta-chip">{totalTutorials} {rt("tutorials")}</span>
              <span className="learn-page__meta-chip">{totalFeatures} {rt("explained functions")}</span>
              <span className="learn-page__meta-chip">{rt("Featured tutorial")}: {rt(featuredVideo.title)}</span>
            </div>
          </div>
          <div className="learn-page__hero-actions">
            <div className="learn-page__mode-switch">
              <button
                type="button"
                className={`learn-page__mode-btn${contentMode === "reference" ? " is-active" : ""}`}
                onClick={() => setContentMode("reference")}
              >
                {rt("Feature reference")}
              </button>
              <button
                type="button"
                className={`learn-page__mode-btn${contentMode === "tutorials" ? " is-active" : ""}`}
                onClick={() => setContentMode("tutorials")}
              >
                {rt("Guided tutorials")}
              </button>
            </div>
            <label className="learn-page__search">
              <span>{rt("Search learn content")}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={rt("Search by tutorial, feature, workflow or problem")}
              />
            </label>
            <button className="learn-page__back" type="button" onClick={onBack}>{rt("Back to landing")}</button>
          </div>
        </header>

        {contentMode === "tutorials" ? (
          <div className="learn-page__layout">
            <aside className="learn-page__sidebar">
              <section className="learn-page__panel">
                <h2>{rt("Categories")}</h2>
                <div className="learn-page__stack">
                  {categoryItems.map((category) => {
                    const isActive = category.id === activeCategory
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`learn-page__nav-btn${isActive ? " is-active" : ""}`}
                        onClick={() => jumpToCategory(category.id)}
                      >
                        <strong>{rt(category.label)}</strong>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="learn-page__panel">
                <h2>{rt("Subcategories")}</h2>
                <div className="learn-page__stack">
                  {subcategoryItems.map((subcategory) => {
                    const count = LEARN_VIDEOS.filter((video) => video.category === activeCategory && video.subcategory === subcategory.id).length
                    const isActive = subcategory.id === activeSubcategory
                    return (
                      <button
                        key={subcategory.id}
                        type="button"
                        className={`learn-page__nav-btn${isActive ? " is-active is-alt" : ""}`}
                        onClick={() => jumpToSubcategory(subcategory.id)}
                      >
                        <strong>{rt(subcategory.label)}</strong>
                        <span>{count} {rt("tutorials")}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </aside>

            <section className="learn-page__content">
              <article className="learn-page__viewer">
                <div className="learn-page__viewer-head">
                  <div>
                    <div className="learn-page__eyebrow">{rt("Tutorial library")}</div>
                    <h2>{rt(selectedVideo.title)}</h2>
                    <p>{rt(selectedVideo.description)}</p>
                  </div>
                  <button className="learn-page__primary" type="button" onClick={openTutorialPrimaryAction}>
                    {selectedVideo.embedUrl ? rt("Open video walkthrough") : rt("Open written walkthrough")}
                  </button>
                </div>

                <div className="learn-page__viewer-meta">
                  <span className="learn-page__meta-chip">{rt("Level")}: {rt(selectedVideo.level)}</span>
                  <span className="learn-page__meta-chip">{rt("Duration")}: {rt(selectedVideo.duration)}</span>
                  <span className="learn-page__meta-chip">{rt("Category")}: {rt(getCategoryLabel(selectedVideo.category))}</span>
                  <span className="learn-page__meta-chip">{rt("Subcategory")}: {rt(getSubcategoryLabel(selectedVideo.subcategory))}</span>
                </div>

                <div className="learn-page__video-shell">
                  {selectedVideo.embedUrl ? (
                    <iframe
                      src={selectedVideo.embedUrl}
                      title={selectedVideo.title}
                      allow="fullscreen"
                      allowFullScreen
                      className="learn-page__frame"
                    />
                  ) : (
                    <div className="learn-page__placeholder">
                      <div className="learn-page__placeholder-mark">▶</div>
                      <strong>{rt("Written walkthrough")}</strong>
                      <p>{rt("This tutorial is fully usable as a written walkthrough even before a video is added.")}</p>
                    </div>
                  )}
                </div>

                <div className="learn-page__grid learn-page__grid--summary">
                  <section className="learn-page__panel">
                    <h3>{rt("What you will learn")}</h3>
                    <ul className="learn-page__list">
                      {selectedVideo.goals.map((goal) => <li key={goal}>{rt(goal)}</li>)}
                    </ul>
                  </section>
                  <section className="learn-page__panel">
                    <h3>{rt("Progress")}</h3>
                    <div className="learn-page__progress-head">
                      <strong>{progressPercent}%</strong>
                      <span>{progressCount}/{selectedVideo.steps.length} {rt("steps completed")}</span>
                    </div>
                    <div className="learn-page__progress-bar">
                      <span style={{ width: `${progressPercent}%` }} />
                    </div>
                    <button className="learn-page__secondary" type="button" onClick={resetTutorialProgress}>{rt("Reset progress")}</button>
                  </section>
                </div>

                <section id="learn-steps" className="learn-page__panel">
                  <h3>{rt("Step-by-step walkthrough")}</h3>
                  <div className="learn-page__steps">
                    {selectedVideo.steps.map((step, index) => {
                      const done = completedSteps.includes(step.title)
                      return (
                        <button
                          key={step.title}
                          type="button"
                          className={`learn-page__step${done ? " is-done" : ""}`}
                          onClick={() => toggleStep(step.title)}
                        >
                          <span className="learn-page__step-index">{String(index + 1).padStart(2, "0")}</span>
                          <div className="learn-page__step-copy">
                            <strong>{rt(step.title)}</strong>
                            <p>{rt(step.detail)}</p>
                          </div>
                          <span className="learn-page__step-toggle">{done ? "✓" : rt("Mark step done")}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <div className="learn-page__grid">
                  <section className="learn-page__panel">
                    <h3>{rt("Expected outcomes")}</h3>
                    <ul className="learn-page__list">
                      {selectedVideo.outcomes.map((item) => <li key={item}>{rt(item)}</li>)}
                    </ul>
                  </section>
                  <section className="learn-page__panel">
                    <h3>{rt("Common mistakes")}</h3>
                    <ul className="learn-page__list learn-page__list--warn">
                      {selectedVideo.pitfalls.map((item) => <li key={item}>{rt(item)}</li>)}
                    </ul>
                  </section>
                </div>
              </article>

              <section className="learn-page__panel">
                <div className="learn-page__section-head">
                  <h3>{rt("Browse tutorials in this subcategory")}</h3>
                  <span>{filteredVideos.length} {rt("selected")}</span>
                </div>
                {filteredVideos.length ? (
                  <div className="learn-page__cards">
                    {filteredVideos.map((video) => {
                      const isActive = video.id === selectedVideo.id
                      const done = (progress[video.id] || []).length
                      const total = video.steps.length
                      return (
                        <button
                          key={video.id}
                          type="button"
                          className={`learn-page__card${isActive ? " is-active" : ""}`}
                          onClick={() => setSelectedVideoId(video.id)}
                        >
                          <div className="learn-page__card-top">
                            <span className="learn-page__meta-chip">{rt(video.level)}</span>
                            <span className="learn-page__meta-chip">{rt(video.duration)}</span>
                          </div>
                          <strong>{rt(video.title)}</strong>
                          <p>{rt(video.description)}</p>
                          <div className="learn-page__card-foot">
                            <span>{done}/{total} {rt("Completion")}</span>
                            <span>{video.embedUrl ? rt("Video walkthrough") : rt("Written walkthrough")}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="learn-page__empty">
                    <strong>{rt("No tutorials match this filter yet.")}</strong>
                    <span>{rt("Try a different search or switch category.")}</span>
                  </div>
                )}
              </section>
            </section>
          </div>
        ) : (
          <div className="learn-page__layout">
            <aside className="learn-page__sidebar">
              <section className="learn-page__panel">
                <h2>{rt("Reference areas")}</h2>
                <div className="learn-page__stack">
                  <button
                    type="button"
                    className={`learn-page__nav-btn${featureArea === "all" ? " is-active" : ""}`}
                    onClick={() => setFeatureArea("all")}
                  >
                    <strong>{rt("All areas")}</strong>
                    <span>{totalFeatures} {rt("explained functions")}</span>
                  </button>
                  {featureAreaItems.map((area) => {
                    const count = LEARN_FEATURE_REFERENCES.filter((item) => item.area === area.id).length
                    const isActive = featureArea === area.id
                    const seen = featuresByArea[area.id].filter((item) => viewedSet.has(item.id)).length
                    const seenPercent = count ? Math.round((seen / count) * 100) : 0
                    return (
                      <button
                        key={area.id}
                        type="button"
                        className={`learn-page__nav-btn${isActive ? " is-active is-alt" : ""}`}
                        onClick={() => setFeatureArea(area.id)}
                      >
                        <strong>{rt(area.label)}</strong>
                        <span>{count} {rt("explained functions")}</span>
                        <span>{seenPercent}% {rt("features viewed")}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="learn-page__panel">
                <h2>{rt("Learning journeys")}</h2>
                <p className="learn-page__plain-copy">{rt("Use this panel to follow curated paths instead of browsing all 200 features at once.")}</p>
                <div className="learn-page__stack">
                  {FEATURE_JOURNEYS.map((journey) => (
                    <button
                      key={journey.id}
                      type="button"
                      className={`learn-page__nav-btn${selectedJourney.id === journey.id ? " is-active is-alt" : ""}`}
                      onClick={() => startJourney(journey.areas)}
                    >
                      <strong>{rt(journey.label)}</strong>
                      <span>{rt(journey.description)}</span>
                      <span>{rt("Journey focus")}: {journey.areas.map((area) => rt(getLearnFeatureAreaLabel(area))).join(" • ")}</span>
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <section className="learn-page__content">
              <article className="learn-page__viewer">
                <div className="learn-page__viewer-head">
                  <div>
                    <div className="learn-page__eyebrow">{rt("Real UI reference")}</div>
                    <h2>{rt(selectedFeature.title)}</h2>
                    <p>{rt(selectedFeature.summary)}</p>
                  </div>
                  <div className="learn-page__viewer-actions">
                    <span className="learn-page__meta-chip">{rt("Area")}: {rt(getLearnFeatureAreaLabel(selectedFeature.area))}</span>
                    <button
                      type="button"
                      className="learn-page__secondary"
                      onClick={() => toggleViewed(selectedFeature.id)}
                    >
                      {viewedSet.has(selectedFeature.id) ? rt("Remove mastered mark") : rt("Mark as mastered")}
                    </button>
                    <button
                      type="button"
                      className="learn-page__secondary"
                      onClick={() => toggleBookmark(selectedFeature.id)}
                    >
                      {bookmarkSet.has(selectedFeature.id) ? rt("Remove bookmark") : rt("Bookmark feature")}
                    </button>
                    {nextSuggestedFeature ? (
                      <button
                        type="button"
                        className="learn-page__primary"
                        onClick={() => openFeature(nextSuggestedFeature.id)}
                      >
                        {rt("Next suggested feature")}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="learn-page__grid learn-page__grid--summary">
                  <section className="learn-page__panel">
                    <h3>{rt("Smart suggestion")}</h3>
                    <p className="learn-page__plain-copy">
                      {nextSuggestedFeature
                        ? `${rt(nextSuggestedFeature.title)} - ${rt(nextSuggestedFeature.summary)}`
                        : rt("Use the reference when you want to understand a specific control, panel or workflow without watching a video.")}
                    </p>
                  </section>
                  <section className="learn-page__panel">
                    <h3>{rt("Feature reference")}</h3>
                    <p className="learn-page__plain-copy">{rt("Use the reference when you want to understand a specific control, panel or workflow without watching a video.")}</p>
                  </section>
                  <section className="learn-page__panel">
                    <h3>{rt("Area")}</h3>
                    <p className="learn-page__plain-copy">{rt("This area groups related UI features so you can understand what each control is for before using it.")}</p>
                  </section>
                </div>
              </article>

              <section className="learn-page__panel">
                <div className="learn-page__section-head">
                  <h3>{rt("Structured feature explorer")}</h3>
                  <span>{filteredFeatures.length} {rt("Matching entries")}</span>
                </div>
                {featureAreaItems
                  .filter((area) => featureArea === "all" || area.id === featureArea)
                  .map((area) => {
                    const areaItems = filteredFeatures.filter((item) => item.area === area.id)
                    const visibleCount = areaVisibility[area.id] || DEFAULT_FEATURES_PER_AREA
                    const isExpanded = areaExpanded[area.id]
                    const areaSeen = areaItems.filter((item) => viewedSet.has(item.id)).length
                    const seenPercent = areaItems.length ? Math.round((areaSeen / areaItems.length) * 100) : 0

                    return (
                      <section key={area.id} className="learn-page__group">
                        <button
                          type="button"
                          className="learn-page__group-head"
                          onClick={() => toggleAreaExpanded(area.id)}
                        >
                          <div>
                            <strong>{rt(area.label)}</strong>
                            <span>{areaItems.length} {rt("explained functions")} · {seenPercent}% {rt("features viewed")}</span>
                          </div>
                          <span>{isExpanded ? rt("Collapse area") : rt("Open area")}</span>
                        </button>

                        {isExpanded ? (
                          areaItems.length ? (
                            <div className="learn-page__cards">
                              {areaItems.slice(0, visibleCount).map((item) => {
                                const isActive = item.id === selectedFeature.id
                                const isBookmarked = bookmarkSet.has(item.id)
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={`learn-page__card${isActive ? " is-active" : ""}`}
                                    onClick={() => openFeature(item.id)}
                                  >
                                    <div className="learn-page__card-top">
                                      <span className="learn-page__meta-chip">{rt(getLearnFeatureAreaLabel(item.area))}</span>
                                      <span className="learn-page__status-pill">{isBookmarked ? rt("Bookmarked") : viewedSet.has(item.id) ? rt("Mastered") : rt("Recent")}</span>
                                    </div>
                                    <strong>{rt(item.title)}</strong>
                                    <p>{rt(item.summary)}</p>
                                    <div className="learn-page__card-foot">
                                      <span>{rt("Area progress")}: {seenPercent}%</span>
                                      <span>{isBookmarked ? rt("Bookmarked") : rt("Mark as mastered")}</span>
                                    </div>
                                  </button>
                                )
                              })}
                              {areaItems.length > DEFAULT_FEATURES_PER_AREA ? (
                                <div className="learn-page__group-actions">
                                  {visibleCount < areaItems.length ? (
                                    <button type="button" className="learn-page__secondary" onClick={() => showMoreAreaItems(area.id)}>
                                      {rt("Show more")}
                                    </button>
                                  ) : (
                                    <button type="button" className="learn-page__secondary" onClick={() => showLessAreaItems(area.id)}>
                                      {rt("Show less")}
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="learn-page__empty">
                              <strong>{rt("No explained functions match this filter yet.")}</strong>
                              <span>{rt("Try a different search or area.")}</span>
                            </div>
                          )
                        ) : null}
                      </section>
                    )
                  })}
              </section>

              <section className="learn-page__grid learn-page__grid--summary">
                <section className="learn-page__panel">
                  <h3>{rt("Bookmarked features")}</h3>
                  {bookmarkedList.length ? (
                    <div className="learn-page__stack">
                      {bookmarkedList.slice(0, 8).map((item) => (
                        <button key={item.id} type="button" className="learn-page__nav-btn" onClick={() => openFeature(item.id)}>
                          <strong>{rt(item.title)}</strong>
                          <span>{rt(getLearnFeatureAreaLabel(item.area))}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="learn-page__plain-copy">{rt("No bookmarks yet. Bookmark important controls so your team can reuse them.")}</p>
                  )}
                </section>
                <section className="learn-page__panel">
                  <h3>{rt("Recently viewed features")}</h3>
                  {recentList.length ? (
                    <div className="learn-page__stack">
                      {recentList.slice(0, 8).map((item) => (
                        <button key={item.id} type="button" className="learn-page__nav-btn" onClick={() => openFeature(item.id)}>
                          <strong>{rt(item.title)}</strong>
                          <span>{rt(getLearnFeatureAreaLabel(item.area))}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="learn-page__plain-copy">{rt("No recently viewed features yet. Open a feature to build your activity trail.")}</p>
                  )}
                </section>
              </section>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

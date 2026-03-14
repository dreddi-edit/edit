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

const PROGRESS_STORAGE_KEY = "learn-progress-v2"

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
  const [contentMode, setContentMode] = useState<LearnContentMode>("reference")
  const [activeCategory, setActiveCategory] = useState<LearnVideoCategory>(featuredVideo?.category || "getting-started")
  const [activeSubcategory, setActiveSubcategory] = useState<LearnVideoSubcategory>(featuredVideo?.subcategory || "first-steps")
  const [selectedVideoId, setSelectedVideoId] = useState<string>(featuredVideo?.id || "")
  const [featureArea, setFeatureArea] = useState<LearnFeatureArea | "all">("all")
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(LEARN_FEATURE_REFERENCES[0]?.id || "")
  const [query, setQuery] = useState("")
  const [progress, setProgress] = useState<LearnProgressState>(loadProgress)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

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
                    return (
                      <button
                        key={area.id}
                        type="button"
                        className={`learn-page__nav-btn${isActive ? " is-active is-alt" : ""}`}
                        onClick={() => setFeatureArea(area.id)}
                      >
                        <strong>{rt(area.label)}</strong>
                        <span>{count} {rt("explained functions")}</span>
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
                    <div className="learn-page__eyebrow">{rt("Real UI reference")}</div>
                    <h2>{rt(selectedFeature.title)}</h2>
                    <p>{rt(selectedFeature.summary)}</p>
                  </div>
                  <div className="learn-page__viewer-actions">
                    <span className="learn-page__meta-chip">{rt("Area")}: {rt(getLearnFeatureAreaLabel(selectedFeature.area))}</span>
                    <span className="learn-page__meta-chip">{rt("200+ explained functions")}</span>
                  </div>
                </div>
                <div className="learn-page__grid learn-page__grid--summary">
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
                  <h3>{rt("Explained functions in this area")}</h3>
                  <span>{filteredFeatures.length} {rt("Matching entries")}</span>
                </div>
                {filteredFeatures.length ? (
                  <div className="learn-page__cards">
                    {filteredFeatures.map((item) => {
                      const isActive = item.id === selectedFeature.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`learn-page__card${isActive ? " is-active" : ""}`}
                          onClick={() => setSelectedFeatureId(item.id)}
                        >
                          <div className="learn-page__card-top">
                            <span className="learn-page__meta-chip">{rt(getLearnFeatureAreaLabel(item.area))}</span>
                          </div>
                          <strong>{rt(item.title)}</strong>
                          <p>{rt(item.summary)}</p>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="learn-page__empty">
                    <strong>{rt("No explained functions match this filter yet.")}</strong>
                    <span>{rt("Try a different search or area.")}</span>
                  </div>
                )}
              </section>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

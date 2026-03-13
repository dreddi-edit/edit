import React, { useMemo, useState } from "react";
import {
  LEARN_VIDEO_CATEGORIES,
  LEARN_VIDEO_SUBCATEGORIES,
  LEARN_VIDEOS,
  getCategoryLabel,
  getSubcategoryLabel,
  type LearnVideoCategory,
  type LearnVideoSubcategory,
} from "../data/learnVideos";

type LearnPageProps = {
  onBack?: () => void;
};

const cardStyle: React.CSSProperties = {
  background: "rgba(12,18,34,.78)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 20px 60px rgba(0,0,0,.25)",
};

export default function LearnPage({ onBack }: LearnPageProps) {
  const featuredVideo =
    LEARN_VIDEOS.find((video) => video.featured) || LEARN_VIDEOS[0];

  const initialCategory = featuredVideo?.category || "getting-started";
  const initialSubcategory = featuredVideo?.subcategory || "first-steps";
  const initialVideoId = featuredVideo?.id || "";

  const [activeCategory, setActiveCategory] =
    useState<LearnVideoCategory>(initialCategory);

  const [activeSubcategory, setActiveSubcategory] =
    useState<LearnVideoSubcategory>(initialSubcategory);

  const [selectedVideoId, setSelectedVideoId] = useState<string>(initialVideoId);

  const categoryItems = useMemo(
    () => [...LEARN_VIDEO_CATEGORIES].sort((a, b) => a.order - b.order),
    []
  );

  const subcategoryItems = useMemo(
    () =>
      LEARN_VIDEO_SUBCATEGORIES
        .filter((item) => item.category === activeCategory)
        .sort((a, b) => a.order - b.order),
    [activeCategory]
  );

  const videosInSubcategory = useMemo(
    () =>
      LEARN_VIDEOS
        .filter(
          (video) =>
            video.category === activeCategory &&
            video.subcategory === activeSubcategory
        )
        .sort((a, b) => a.order - b.order),
    [activeCategory, activeSubcategory]
  );

  const fallbackVideo =
    LEARN_VIDEOS.find(
      (video) =>
        video.category === activeCategory &&
        video.subcategory === activeSubcategory
    ) || featuredVideo;

  const selectedVideo =
    LEARN_VIDEOS.find((video) => video.id === selectedVideoId) || fallbackVideo;

  return (
    <main
      style={{
        height: "100vh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background:
          "radial-gradient(circle at 15% 20%, rgba(97,89,255,.18), transparent 32%), radial-gradient(circle at 85% 75%, rgba(52,209,255,.12), transparent 26%), linear-gradient(180deg, #040714 0%, #050816 100%)",
        color: "#f5f7fb",
        padding: "32px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(139,124,255,.28)",
                background: "rgba(139,124,255,.08)",
                color: "#c9c2ff",
                fontSize: 12,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Learn Reframe
            </div>

            <h1
              style={{
                fontSize: "clamp(2.8rem, 7vw, 5.6rem)",
                lineHeight: ".92",
                letterSpacing: "-0.06em",
                margin: "0 0 16px",
              }}
            >
              Tutorials, demos
              <br />
              and guided walkthroughs.
            </h1>

            <p
              style={{
                maxWidth: 820,
                color: "#9aa7c2",
                fontSize: "1.06rem",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              Full tutorial infrastructure: categories, subcategories, and video
              slots are now predefined. You only need to add real Guidde links
              later.
            </p>
          </div>

          <button
            onClick={onBack}
            style={{
              border: "1px solid rgba(255,255,255,.1)",
              background: "rgba(255,255,255,.04)",
              color: "#f5f7fb",
              borderRadius: 999,
              padding: "14px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Return to Landing Page
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 280px 1fr",
            gap: 22,
            alignItems: "start",
          }}
        >
          <aside style={{ ...cardStyle, position: "sticky", top: 24 }}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: "1.05rem",
                letterSpacing: "-0.03em",
              }}
            >
              Categories
            </h3>

            <div style={{ display: "grid", gap: 10 }}>
              {categoryItems.map((category) => {
                const isActive = category.id === activeCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category.id);
                      const firstSubcategory = LEARN_VIDEO_SUBCATEGORIES
                        .filter((item) => item.category === category.id)
                        .sort((a, b) => a.order - b.order)[0];

                      if (firstSubcategory) {
                        setActiveSubcategory(firstSubcategory.id);
                        const firstVideo = LEARN_VIDEOS
                          .filter(
                            (video) =>
                              video.category === category.id &&
                              video.subcategory === firstSubcategory.id
                          )
                          .sort((a, b) => a.order - b.order)[0];

                        if (firstVideo) setSelectedVideoId(firstVideo.id);
                      }
                    }}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: isActive
                        ? "1px solid rgba(139,124,255,.28)"
                        : "1px solid rgba(255,255,255,.06)",
                      background: isActive
                        ? "rgba(139,124,255,.12)"
                        : "rgba(255,255,255,.04)",
                      color: "#f5f7fb",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </aside>

          <aside style={{ ...cardStyle, position: "sticky", top: 24 }}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: "1.05rem",
                letterSpacing: "-0.03em",
              }}
            >
              Subcategories
            </h3>

            <div style={{ display: "grid", gap: 10 }}>
              {subcategoryItems.map((subcategory) => {
                const isActive = subcategory.id === activeSubcategory;
                const count = LEARN_VIDEOS.filter(
                  (video) =>
                    video.category === activeCategory &&
                    video.subcategory === subcategory.id
                ).length;

                return (
                  <button
                    key={subcategory.id}
                    type="button"
                    onClick={() => {
                      setActiveSubcategory(subcategory.id);
                      const firstVideo = LEARN_VIDEOS
                        .filter(
                          (video) =>
                            video.category === activeCategory &&
                            video.subcategory === subcategory.id
                        )
                        .sort((a, b) => a.order - b.order)[0];

                      if (firstVideo) setSelectedVideoId(firstVideo.id);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: isActive
                        ? "1px solid rgba(52,209,255,.28)"
                        : "1px solid rgba(255,255,255,.06)",
                      background: isActive
                        ? "rgba(52,209,255,.10)"
                        : "rgba(255,255,255,.04)",
                      color: "#f5f7fb",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {subcategory.label}
                    </div>
                    <div style={{ color: "#9aa7c2", fontSize: ".9rem" }}>
                      {count} video slot{count === 1 ? "" : "s"}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div style={{ display: "grid", gap: 22 }}>
            <section
              style={{
                ...cardStyle,
                overflow: "hidden",
                padding: 0,
              }}
            >
              <div
                style={{
                  padding: "18px 20px",
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.08)",
                      color: "#d7ddf1",
                      fontSize: ".8rem",
                    }}
                  >
                    {getCategoryLabel(selectedVideo.category)} ·{" "}
                    {getSubcategoryLabel(selectedVideo.subcategory)}
                  </div>
                  <h2
                    style={{
                      margin: "12px 0 4px",
                      fontSize: "1.45rem",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {selectedVideo.title}
                  </h2>
                  <div style={{ color: "#7f8aa8", fontSize: ".9rem" }}>
                    {selectedVideo.duration}
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    border: "1px solid rgba(255,255,255,.1)",
                    background: "rgba(255,255,255,.04)",
                    color: "#f5f7fb",
                    borderRadius: 999,
                    padding: "12px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {selectedVideo.ctaLabel}
                </button>
              </div>

              <div
                style={{
                  aspectRatio: "16 / 9",
                  background: "#090d18",
                  position: "relative",
                }}
              >
                {selectedVideo.embedUrl ? (
                  <iframe
                    src={selectedVideo.embedUrl}
                    title={selectedVideo.title}
                    allow="fullscreen"
                    allowFullScreen
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      border: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      padding: 24,
                      textAlign: "center",
                      background:
                        "linear-gradient(180deg, rgba(2,5,10,.15), rgba(2,5,10,.55)), radial-gradient(circle at 30% 20%, rgba(139,124,255,.2), transparent 28%), radial-gradient(circle at 80% 70%, rgba(52,209,255,.16), transparent 24%), #090d18",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: 999,
                          background: "linear-gradient(135deg, #8b7cff, #34d1ff)",
                          display: "grid",
                          placeItems: "center",
                          boxShadow: "0 18px 40px rgba(86,115,255,.38)",
                          fontSize: 30,
                          color: "white",
                          fontWeight: 900,
                          margin: "0 auto 18px",
                        }}
                      >
                        ▶
                      </div>
                      <div
                        style={{
                          fontSize: "1.15rem",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Video placeholder
                      </div>
                      <div style={{ color: "#9aa7c2", maxWidth: 560 }}>
                        This slot is ready. Later you only need to paste the
                        Guidde embed URL into learnVideos.ts for this tutorial.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 22,
              }}
            >
              <div style={cardStyle}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: "1.1rem",
                    letterSpacing: "-0.03em",
                  }}
                >
                  What this tutorial covers
                </h3>
                <p style={{ margin: 0, color: "#9aa7c2", lineHeight: 1.7 }}>
                  {selectedVideo.description}
                </p>
              </div>

              <div style={cardStyle}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: "1.1rem",
                    letterSpacing: "-0.03em",
                  }}
                >
                  Infrastructure status
                </h3>
                <p style={{ margin: 0, color: "#9aa7c2", lineHeight: 1.7 }}>
                  Full category and subcategory structure is now predefined. You
                  can keep expanding only the data file without rewriting this UI.
                </p>
              </div>
            </section>

            <section style={cardStyle}>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontSize: "1.1rem",
                  letterSpacing: "-0.03em",
                }}
              >
                Videos in this subcategory
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                {videosInSubcategory.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelectedVideoId(video.id)}
                    style={{
                      textAlign: "left",
                      padding: 16,
                      borderRadius: 18,
                      border:
                        selectedVideo.id === video.id
                          ? "1px solid rgba(52,209,255,.28)"
                          : "1px solid rgba(255,255,255,.06)",
                      background:
                        selectedVideo.id === video.id
                          ? "rgba(52,209,255,.10)"
                          : "rgba(255,255,255,.04)",
                      color: "#f5f7fb",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: "16 / 9",
                        borderRadius: 14,
                        marginBottom: 12,
                        background:
                          "linear-gradient(180deg, rgba(2,5,10,.15), rgba(2,5,10,.45)), linear-gradient(135deg, rgba(139,124,255,.15), rgba(52,209,255,.12)), #0a0f1b",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 24,
                      }}
                    >
                      ▶
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {video.title}
                    </div>
                    <div style={{ color: "#9aa7c2", fontSize: ".92rem" }}>
                      {video.duration}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

import React from "react";

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
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
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
                maxWidth: 760,
                color: "#9aa7c2",
                fontSize: "1.06rem",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              This page will hold your tutorial collection for first-time users:
              Getting Started, Editor, AI Studio and Publishing.
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
            Back to landing
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr .85fr",
            gap: 22,
            marginBottom: 22,
          }}
        >
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
                  Getting started
                </div>
                <h2
                  style={{
                    margin: "12px 0 4px",
                    fontSize: "1.45rem",
                    letterSpacing: "-0.03em",
                  }}
                >
                  Create your first project
                </h2>
                <div style={{ color: "#7f8aa8", fontSize: ".9rem" }}>
                  Main featured tutorial
                </div>
              </div>
            </div>

            <div
              style={{
                aspectRatio: "16 / 9",
                background: "#090d18",
                position: "relative",
              }}
            >
              <iframe
                src="https://embed.app.guidde.com/playbooks/iyeGPeTVt9anr6vLen1CC5?mode=videoOnly"
                title="Create your first project"
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
            </div>
          </section>

          <aside style={cardStyle}>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: "1.1rem",
                letterSpacing: "-0.03em",
              }}
            >
              Why this page is better
            </h3>

            <p style={{ margin: 0, color: "#9aa7c2", lineHeight: 1.7 }}>
              Your landing page stays clean and conversion-focused. All video
              education lives here in one structured place, so first-time users
              can actually understand the product.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {[
                "Getting Started tutorials",
                "Editor walkthroughs",
                "AI Studio videos",
                "Publishing and sharing guides",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.06)",
                    color: "#dfe5f7",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {[
            ["Getting Started", "Create first project, import website, open editor"],
            ["Editor", "Edit blocks, use components, save snapshots"],
            ["AI Studio", "Run CRO audit, improve copy, translate site"],
            ["Publishing", "Share preview, publish website, manage outputs"],
          ].map(([title, desc]) => (
            <div key={title} style={cardStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>{title}</h3>
              <p style={{ margin: 0, color: "#9aa7c2", lineHeight: 1.7 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

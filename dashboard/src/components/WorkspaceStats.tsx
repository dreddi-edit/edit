import React from 'react';

type Props = {
  theme: "dark" | "light"
  projectCount: number
  credits: number | null
  plan: string
  planAccent: string
}

export default function WorkspaceStats({ theme, projectCount, credits, plan, planAccent }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 24,
    }}>
      <div style={{
        padding: "16px 18px",
        borderRadius: 14,
        border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
        background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.7)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.5)", marginBottom: 6, textTransform: "uppercase" }}>
          Projects
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: theme === "light" ? "#0f172a" : "white" }}>
          {projectCount}
        </div>
      </div>
      <div style={{
        padding: "16px 18px",
        borderRadius: 14,
        border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
        background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.7)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.5)", marginBottom: 6, textTransform: "uppercase" }}>
          Credits
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: credits !== null && credits <= 1 ? "rgba(239,68,68,0.9)" : (theme === "light" ? "#0f172a" : "white") }}>
          {credits === null ? "—" : `€${credits.toFixed(2)}`}
        </div>
      </div>
      <div style={{
        gridColumn: "1 / -1",
        padding: "14px 18px",
        borderRadius: 14,
        border: `1px solid ${planAccent}30`,
        background: `${planAccent}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: planAccent }}>{plan}</span>
        <span style={{ fontSize: 11, color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.6)" }}>Current plan</span>
      </div>
    </div>
  )
}

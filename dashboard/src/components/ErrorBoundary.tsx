import React from 'react';

import { Component, type ReactNode } from "react"

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown UI error",
    }
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("UI ErrorBoundary caught an error", error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "radial-gradient(circle at top, rgba(99,102,241,0.16), transparent 40%), #0c0c10",
          color: "#f8fafc",
          padding: "32px",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15,23,42,0.92)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
            padding: "28px",
          }}
        >
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(148,163,184,0.92)" }}>
            UI recovery mode
          </div>
          <h1 style={{ fontSize: "34px", lineHeight: 1.05, margin: "12px 0 16px", fontFamily: "Syne, sans-serif" }}>
            Something in the app crashed.
          </h1>
          <p style={{ color: "rgba(226,232,240,0.88)", marginBottom: "18px" }}>
            Your session is still there, but this screen failed to render. Reload and continue where you left off.
          </p>
          <div
            style={{
              fontSize: "13px",
              color: "rgba(248,250,252,0.82)",
              background: "rgba(2,6,23,0.72)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "20px",
              wordBreak: "break-word",
            }}
          >
            {this.state.message || "Unknown UI error"}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              border: "1px solid rgba(99,102,241,0.35)",
              background: "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(16,185,129,0.92))",
              color: "#fff",
              borderRadius: "999px",
              padding: "12px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}

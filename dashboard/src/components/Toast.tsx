import React from 'react';
import { useEffect, useState } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

type Toast = {
  id: string
  message: string
  type: ToastType
}

const listeners: Array<(t: Toast) => void> = []

export function toast(message: string, type: ToastType = "info") {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  listeners.forEach(l => l({ id, message, type }))
}

toast.success = (m: string) => toast(m, "success")
toast.error = (m: string) => toast(m, "error")
toast.warning = (m: string) => toast(m, "warning")
toast.info = (m: string) => toast(m, "info")

const COLORS = {
  success: { accent: "#7fd1a7", border: "rgba(127,209,167,0.28)", bg: "rgba(127,209,167,0.08)", label: "Success" },
  error:   { accent: "#e08686", border: "rgba(224,134,134,0.28)", bg: "rgba(224,134,134,0.08)", label: "Error" },
  warning: { accent: "#d6b37a", border: "rgba(214,179,122,0.28)", bg: "rgba(214,179,122,0.08)", label: "Warning" },
  info:    { accent: "#8aa4ff", border: "rgba(138,164,255,0.28)", bg: "rgba(138,164,255,0.08)", label: "Info" },
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, 4000)
    }
    listeners.push(handler)
    return () => { const i = listeners.indexOf(handler); if (i !== -1) listeners.splice(i, 1) }
  }, [])

  if (toasts.length === 0) return null

  const visible = toasts.slice(-5).reverse()

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: "fixed",
        top: 24,
        right: 32,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: "min(400px, 60vh)",
        overflow: "hidden auto",
        pointerEvents: "none",
      }}
    >
      {visible.map(t => {
        const c = COLORS[t.type]
        return (
          <div
            key={t.id}
            role="alert"
            style={{
              padding: "0",
              borderRadius: 16,
              border: `1px solid ${c.border}`,
              background: "var(--bg-panel)",
              boxShadow: "var(--shadow-lg)",
              color: "var(--text-primary)",
              maxWidth: 360,
              minWidth: 240,
              animation: "toastIn 0.25s ease",
              pointerEvents: "auto",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 3, background: c.accent, opacity: 0.88 }} />
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "14px 16px 15px",
            }}>
              <div
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  marginTop: 4,
                  background: c.accent,
                  boxShadow: `0 0 0 4px ${c.bg}`,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: c.accent,
                  marginBottom: 4,
                }}>
                  {c.label}
                </div>
                <div style={{ lineHeight: 1.45, fontSize: 13, fontWeight: 600 }}>
                  {t.message}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

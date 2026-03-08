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
  success: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", icon: "✅" },
  error:   { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", icon: "❌" },
  warning: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", icon: "⚠️" },
  info:    { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.4)", icon: "ℹ️" },
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

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      zIndex: 99999, display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const c = COLORS[t.type]
        return (
          <div key={t.id} style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            background: `rgba(8,12,24,0.97)`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px ${c.border}`,
            backdropFilter: "blur(12px)",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 360,
            animation: "toastIn 0.25s ease",
            pointerEvents: "auto",
          }}>
            <span style={{ fontSize: 16 }}>{c.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          </div>
        )
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

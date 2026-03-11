import { useState, useEffect } from "react"
import { toast } from "./Toast"

type Props = {
  theme: "dark" | "light"
  userEmail?: string
  onClose: () => void
}

export default function ReferralInvite({ theme, userEmail, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname || "/"}?ref=${encodeURIComponent(userEmail || "friend")}`
    : ""

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success("Referral link copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy. Try selecting manually.")
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-title"
    >
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          padding: 32,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          background: theme === "light" ? "#ffffff" : "rgba(12,16,28,0.98)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="referral-title" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: theme === "light" ? "#0f172a" : "white" }}>
          Invite your team
        </h2>
        <p style={{ fontSize: 14, color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.8)", margin: "0 0 20px" }}>
          Share Site Editor. Earn credits when friends sign up.
        </p>
        <div style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
        }}>
          <input
            readOnly
            value={referralLink}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(0,0,0,0.2)",
              color: theme === "light" ? "#0f172a" : "white",
              fontSize: 13,
            }}
          />
          <button
            onClick={copyLink}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: copied ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg, #6366f1, #7c3aed)",
              color: copied ? "#22c55e" : "white",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.8)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

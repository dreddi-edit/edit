import React from 'react';

import { ResetRateLimitUI } from './ResetRateLimitUI';
import { useState } from "react"
import { apiResetPassword } from "../api/auth"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"

export default function ResetPasswordScreen({ token, onDone }: { token: string, onDone: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handle = async () => {
    if (!password || password.length < 6) { toast.warning("Passwort min. 6 Zeichen"); return }
    if (password !== confirm) { toast.warning("Passwörter stimmen nicht überein"); return }
    setLoading(true)
    try {
      await apiResetPassword(token, password)
      setDone(true)
      setTimeout(() => {
        window.history.replaceState({}, "", "/")
        onDone()
      }, 2000)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    height: 46, borderRadius: 12,
    border: "1px solid rgba(99,102,241,0.25)",
    background: "rgba(0,0,0,0.3)",
    color: "white", padding: "0 16px",
    outline: "none", fontSize: 14,
    width: "100%", boxSizing: "border-box",
  }

  return (
    <div style={{ height: "100vh", background: "#080c18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: 420, padding: 40, background: "rgba(15,23,42,0.95)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>⬡ Site Editor</div>
          <div style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>Neues Passwort setzen</div>
        </div>

        {done ? (
          <div style={{ textAlign: "center", color: "#22c55e", fontSize: 15, fontWeight: 700 }}>✅ Passwort geändert! Weiterleitung...</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Neues Passwort" type="password" style={inputStyle} />
              <input value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="Passwort bestätigen" type="password" style={inputStyle} />
            </div>
            <button onClick={handle} disabled={loading} style={{ marginTop: 20, width: "100%", height: 46, borderRadius: 12, border: "none", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}>
              {loading ? "⟳ Bitte warten..." : "Passwort speichern"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

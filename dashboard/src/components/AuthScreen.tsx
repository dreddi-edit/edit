import { useState } from "react"
import { apiLogin, apiRegister, type User } from "../api/auth"
import { toast } from "./Toast"

export default function AuthScreen({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login")
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    if (!email || !password) { toast.warning("Email und Passwort erforderlich"); return }
    setLoading(true)
    try {
      const user = mode === "login"
        ? await apiLogin(email, password)
        : await apiRegister(email, password, name)
      toast.success(`Willkommen${user.name ? ", " + user.name : ""}!`)
      onAuth(user)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: "100vh", background: "#080c18",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: 420, padding: 40,
        background: "rgba(15,23,42,0.95)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 20,
        boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: 32, fontWeight: 900,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}>⬡ Site Editor</div>
          <div style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
            {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Name (optional)"
              style={inputStyle}
            />
          )}
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="Email"
            type="email"
            style={inputStyle}
          />
          <input
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="Passwort"
            type="password"
            style={inputStyle}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handle}
          disabled={loading}
          style={{
            marginTop: 20, width: "100%", height: 46, borderRadius: 12,
            border: "none",
            background: loading
              ? "rgba(99,102,241,0.4)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "white", fontWeight: 800, fontSize: 15,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
            transition: "opacity 0.2s",
          }}
        >
          {loading ? "⟳ Bitte warten..." : mode === "login" ? "Einloggen" : "Registrieren"}
        </button>

        {/* Toggle */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "rgba(148,163,184,0.7)" }}>
          {mode === "login" ? "Noch kein Konto?" : "Bereits registriert?"}{" "}
          <span
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{ color: "#6366f1", fontWeight: 700, cursor: "pointer" }}
          >
            {mode === "login" ? "Registrieren" : "Einloggen"}
          </span>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  height: 46, borderRadius: 12,
  border: "1px solid rgba(99,102,241,0.25)",
  background: "rgba(0,0,0,0.3)",
  color: "white", padding: "0 16px",
  outline: "none", fontSize: 14,
  width: "100%", boxSizing: "border-box",
}

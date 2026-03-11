import { useState } from "react"
import { apiLogin, apiRegister, apiForgotPassword, type User } from "../api/auth"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"

export default function AuthScreen({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login")
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    if (mode === "forgot") {
      if (!email) { toast.warning("Email erforderlich"); return }
      setLoading(true)
      try {
        await apiForgotPassword(email)
        setResetSent(true)
      } catch (e) {
        toast.error(errMsg(e))
      } finally {
        setLoading(false)
      }
      return
    }
    if (!email || !password) { toast.warning("Email und Passwort erforderlich"); return }
    setLoading(true)
    try {
      const user = mode === "login"
        ? await apiLogin(email, password)
        : await apiRegister(email, password, name)
      toast.success(`Willkommen${user.name ? ", " + user.name : ""}!`)
      onAuth(user)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="draft-auth-screen">
      <div className="draft-auth-glow" />
      <div className="draft-auth-card">
        <div className="draft-auth-logo-wrap">
          <div className="draft-auth-logo-mark">
            <svg width="18" height="18" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.9" />
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.45" />
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.45" />
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.2" />
            </svg>
          </div>
        </div>

        <div className="draft-auth-header">
          <div className="draft-auth-eyebrow">Agency Workflow</div>
          <h1 className="draft-auth-title">Site Editor</h1>
          <p className="draft-auth-subtitle">
            {mode === "login"
              ? "Sign in to continue working on live client websites."
              : mode === "forgot"
                ? "Request a reset link for your workspace."
                : "Create a workspace for structured website editing and delivery."}
          </p>
        </div>

        <div className="draft-auth-form">
          {mode === "register" && (
            <input
              className="draft-auth-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name (optional)"
            />
          )}
          <input
            className="draft-auth-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="Email"
            type="email"
          />
          {mode !== "forgot" && (
            <input
              className="draft-auth-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()}
              placeholder="Passwort"
              type="password"
            />
          )}
          <button
            className="draft-auth-submit btn"
            onClick={handle}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}
          </button>
        </div>

        {resetSent ? (
          <div className="draft-auth-message draft-auth-message--success">
            Reset link sent. Check your inbox.
          </div>
        ) : (
          <div className="draft-auth-footer">
            {mode === "forgot" ? (
              <button className="draft-auth-link" onClick={() => setMode("login")}>
                Back to sign in
              </button>
            ) : (
              <>
                <div className="draft-auth-footline">
                  {mode === "login" ? "No account yet?" : "Already registered?"}{" "}
                  <button className="draft-auth-link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                    {mode === "login" ? "Create one" : "Sign in"}
                  </button>
                </div>
                {mode === "login" && (
                  <button className="draft-auth-muted-link" onClick={() => setMode("forgot")}>
                    Forgot password?
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

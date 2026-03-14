import React from 'react';

import { useEffect, useState } from "react"
import {
  apiGetAuthProviders,
  apiForgotPassword,
  apiLogin,
  apiLogin2FA,
  apiRegister,
  isTwoFactorChallenge,
  type User,
} from "../api/auth"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"

export default function AuthScreen({ onAuth, onBack }: { onAuth: (u: User) => void; onBack?: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login")
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [twoFaState, setTwoFaState] = useState<{ required: boolean; sessionToken: string } | null>(null)
  const [twoFaCode, setTwoFaCode] = useState("")
  const [twoFaError, setTwoFaError] = useState("")
  const [providers, setProviders] = useState<Record<string, { enabled: boolean }>>({})

  useEffect(() => {
    let active = true
    apiGetAuthProviders()
      .then((providers) => {
        if (active) setProviders(providers)
      })
      .catch(() => {
        if (active) setProviders({})
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const error = params.get("error")
    if (!error) return
    toast.error(error)
    params.delete("error")
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`
    window.history.replaceState({}, "", nextUrl)
  }, [])

  const switchMode = (nextMode: "login" | "register" | "forgot") => {
    setMode(nextMode)
    setResetSent(false)
    setTwoFaState(null)
    setTwoFaCode("")
    setTwoFaError("")
  }

  const handle = async () => {
    if (mode === "forgot") {
      if (!email) {
        toast.warning("Email erforderlich")
        return
      }
      setLoading(true)
      try {
        await apiForgotPassword(email)
        setResetSent(true)
      } catch (error) {
        toast.error(errMsg(error))
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email || !password) {
      toast.warning("Email und Passwort erforderlich")
      return
    }

    setLoading(true)
    try {
      const result = mode === "login"
        ? await apiLogin(email, password)
        : await apiRegister(email, password, name)

      if (isTwoFactorChallenge(result)) {
        setTwoFaState({ required: true, sessionToken: result.session_token })
        return
      }

      if (mode === "register" && result.email_verified === false) {
        toast.success("Account erstellt. Bitte bestätige jetzt deine Email.")
      } else {
        toast.success(`Willkommen${result.name ? `, ${result.name}` : ""}!`)
      }
      onAuth(result)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setLoading(false)
    }
  }

  const handleTwoFactor = async () => {
    if (!twoFaState?.sessionToken || twoFaCode.length !== 6) return
    setLoading(true)
    setTwoFaError("")
    try {
      const user = await apiLogin2FA(twoFaState.sessionToken, twoFaCode)
      setTwoFaState(null)
      setTwoFaCode("")
      toast.success(`Willkommen${user.name ? `, ${user.name}` : ""}!`)
      onAuth(user)
    } catch (error) {
      const message = errMsg(error)
      setTwoFaError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="draft-auth-screen">
      <div className="draft-auth-glow" />
      <div className="draft-auth-card">
        {onBack ? (
          <button className="draft-auth-back" type="button" onClick={onBack}>
            ← Back to landing
          </button>
        ) : null}
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
            {twoFaState?.required
              ? "Open your authenticator app and enter the 6-digit code."
              : mode === "login"
                ? "Sign in to continue working on live client websites."
                : mode === "forgot"
                  ? "Request a reset link for your workspace."
                  : "Create a workspace for structured website editing and delivery."}
          </p>
        </div>

        {twoFaState?.required ? (
          <div className="draft-auth-form">
            <input
              className="draft-auth-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              aria-label="Two-factor authentication code"
              value={twoFaCode}
              onChange={(event) => setTwoFaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => event.key === "Enter" && void handleTwoFactor()}
              style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: "24px" }}
            />
            {twoFaError ? (
              <div className="draft-auth-message" style={{ color: "#fca5a5" }}>
                {twoFaError}
              </div>
            ) : null}
            <button
              className="draft-auth-submit btn"
              onClick={() => void handleTwoFactor()}
              disabled={loading || twoFaCode.length !== 6}
              aria-busy={loading}
            >
              {loading ? "Please wait..." : "Verify"}
            </button>
            <button
              className="draft-auth-muted-link"
              onClick={() => {
                setTwoFaState(null)
                setTwoFaCode("")
                setTwoFaError("")
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="draft-auth-form">
              {mode === "register" && (
                <input
                  className="draft-auth-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name (optional)"
                />
              )}
              <input
                className="draft-auth-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handle()}
                placeholder="Email"
                type="email"
              />
              {mode !== "forgot" && (
                <input
                  className="draft-auth-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handle()}
                  placeholder="Passwort"
                  type="password"
                />
              )}
              <button
                className="draft-auth-submit btn"
                onClick={() => void handle()}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Please wait..." : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}
              </button>

              {mode !== "forgot" ? (
                <>
                  <div style={{ textAlign: "center", margin: "12px 0", color: "rgba(255,255,255,0.55)", fontSize: "13px" }}>
                    or
                  </div>
                  {[
                    { id: "google", label: "Continue with Google", icon: "G" },
                    { id: "github", label: "Continue with GitHub", icon: "GH" },
                    { id: "facebook", label: "Continue with Facebook", icon: "f" },
                    { id: "x", label: "Continue with X", icon: "X" },
                    { id: "figma", label: "Continue with Figma", icon: "F" },
                  ].map((provider) => {
                    const enabled = Boolean(providers[provider.id]?.enabled)
                    return enabled ? (
                      <a
                        key={provider.id}
                        href={`/api/auth/${provider.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 0",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#efefed",
                          textDecoration: "none",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ width: 18, textAlign: "center", fontWeight: 800 }}>{provider.icon}</span>
                        {provider.label}
                      </a>
                    ) : (
                      <button
                        key={provider.id}
                        type="button"
                        disabled
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 0",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.02)",
                          color: "rgba(239,239,237,0.45)",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                        title="Will be enabled as soon as provider keys are configured"
                      >
                        <span style={{ width: 18, textAlign: "center", fontWeight: 800 }}>{provider.icon}</span>
                        {provider.label}
                      </button>
                    )
                  })}
                </>
              ) : null}
            </div>

            {resetSent ? (
              <div className="draft-auth-message draft-auth-message--success">
                Reset link sent. Check your inbox.
              </div>
            ) : (
              <div className="draft-auth-footer">
                {mode === "forgot" ? (
                  <button className="draft-auth-link" onClick={() => switchMode("login")}>
                    Back to sign in
                  </button>
                ) : (
                  <>
                    <div className="draft-auth-footline">
                      {mode === "login" ? "No account yet?" : "Already registered?"}{" "}
                      <button className="draft-auth-link" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                        {mode === "login" ? "Create one" : "Sign in"}
                      </button>
                    </div>
                    {mode === "login" ? (
                      <button className="draft-auth-muted-link" onClick={() => switchMode("forgot")}>
                        Forgot password?
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

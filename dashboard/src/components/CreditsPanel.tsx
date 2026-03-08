import { useEffect, useState } from "react"
import { toast } from "./Toast"

const BASE = ""

type Package = { id: string; label: string; amount_eur: number; credits_eur: number; description: string }
type Transaction = { id: number; amount_eur: number; type: string; description: string; created_at: string }

export default function CreditsPanel({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState<number | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    load()
    // Nach Stripe-Redirect Balance aktualisieren
    const params = new URLSearchParams(window.location.search)
    if (params.get("payment") === "success") {
      setTimeout(() => load(), 2000)
      toast.success("Zahlung erfolgreich! Guthaben wird aktualisiert...")
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const load = async () => {
    try {
      const [b, p, t] = await Promise.all([
        fetch(`${BASE}/api/credits/balance`, { credentials: "include" }).then(r => r.json()),
        fetch(`${BASE}/api/stripe/packages`).then(r => r.json()),
        fetch(`${BASE}/api/credits/transactions`, { credentials: "include" }).then(r => r.json()),
      ])
      if (b.ok) setBalance(b.balance_eur)
      if (p.ok) setPackages(p.packages)
      if (t.ok) setTransactions(t.transactions)
    } catch (e: any) { toast.error(e.message) }
  }

  const checkout = async (pkg: Package) => {
    setLoading(pkg.id)
    try {
      const r = await fetch(`${BASE}/api/stripe/checkout`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ package_id: pkg.id })
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      window.location.href = d.url // Stripe Checkout öffnen
    } catch (e: any) {
      toast.error(e.message)
      setLoading(null)
    }
  }

  const BONUS: Record<string, string> = {
    starter: "",
    plus: "+10% Bonus",
    pro: "+15% Bonus",
    business: "+20% Bonus",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 540, maxHeight: "85vh", display: "flex", flexDirection: "column",
        background: "var(--bg-panel, rgba(8,12,24,0.99))",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        color: "var(--text-primary, white)", fontFamily: "system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Guthaben</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4,
              color: balance !== null && balance <= 0.01 ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)"
            }}>
              € {balance === null ? "..." : balance.toFixed(2)}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "rgba(148,163,184,0.7)", cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>

          {/* Pakete */}
          <div style={{ marginBottom: 28 }}>
            <div style={sectionTitle}>GUTHABEN AUFLADEN</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {packages.map(pkg => (
                <div key={pkg.id} onClick={() => checkout(pkg)} style={{
                  padding: "16px", borderRadius: 12, cursor: "pointer",
                  border: pkg.id === "pro" ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: pkg.id === "pro" ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                  position: "relative", transition: "transform 0.15s",
                  opacity: loading === pkg.id ? 0.6 : 1,
                }}>
                  {pkg.id === "pro" && (
                    <div style={{
                      position: "absolute", top: -10, right: 12,
                      fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "white", letterSpacing: 0.5,
                    }}>BELIEBT</div>
                  )}
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 2 }}>
                    € {pkg.amount_eur}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", marginBottom: 8 }}>
                    {pkg.label}
                  </div>
                  {BONUS[pkg.id] && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "rgba(34,197,94,0.8)",
                      background: "rgba(34,197,94,0.1)", borderRadius: 6,
                      padding: "2px 8px", display: "inline-block",
                    }}>{BONUS[pkg.id]} · € {pkg.credits_eur} Guthaben</div>
                  )}
                  <div style={{
                    marginTop: 12, width: "100%", height: 34, borderRadius: 8, border: "none",
                    background: loading === pkg.id ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "white", fontWeight: 700, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}>
                    {loading === pkg.id ? "Wird geladen..." : "Jetzt kaufen"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaktionen */}
          {transactions.length > 0 && (
            <div>
              <div style={sectionTitle}>TRANSAKTIONEN</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                    fontSize: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{
                        tx.type === "topup" ? "Aufladung" :
                        tx.type === "stripe" ? "Stripe-Zahlung" :
                        tx.type === "deduct" ? "KI-Nutzung" : tx.type
                      }</div>
                      <div style={{ color: "rgba(148,163,184,0.5)", marginTop: 2, fontSize: 11 }}>
                        {new Date(tx.created_at).toLocaleString("de-DE")}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 800,
                      color: tx.amount_eur >= 0 ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.8)",
                    }}>
                      {tx.amount_eur >= 0 ? "+" : ""}€ {Math.abs(tx.amount_eur).toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: 1,
  color: "rgba(148,163,184,0.4)", marginBottom: 12,
  textTransform: "uppercase",
}

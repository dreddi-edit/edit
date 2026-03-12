import { useEffect, useState } from "react"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"
import {
  apiGetBalance,
  apiGetCreditsTransactions,
  apiGetStripePackages,
  apiStripeCheckout,
  apiStripeSubscriptionCheckout,
} from "../api/credits"
import type { StripePackage, StripeSubscriptionPlan, CreditTransaction } from "../api/types"

export default function CreditsPanel({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState<number | null>(null)
  const [packages, setPackages] = useState<StripePackage[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<StripeSubscriptionPlan[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

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
        apiGetBalance(),
        apiGetStripePackages(),
        apiGetCreditsTransactions(),
      ])
      if (b != null) setBalance(b)
      if (p.ok) {
        setPackages(p.packages)
        setSubscriptionPlans(p.subscription_plans || [])
      }
      if (t.ok) setTransactions(t.transactions)
    } catch (e) { toast.error(errMsg(e)) }
  }

  const checkout = async (pkg: StripePackage) => {
    setLoading(`credits:${pkg.id}`)
    try {
      const url = await apiStripeCheckout(pkg.id)
      window.location.href = url
    } catch (e: unknown) {
      toast.error(errMsg(e))
      setLoading(null)
    }
  }

  const subscribe = async (plan: StripeSubscriptionPlan) => {
    setLoading(`plan:${plan.id}`)
    try {
      const url = await apiStripeSubscriptionCheckout(plan.id as "starter" | "pro" | "scale")
      window.location.href = url
    } catch (e: unknown) {
      toast.error(errMsg(e))
      setLoading(null)
    }
  }

  const BONUS: Record<string, string> = {
    starter: "",
    plus: "+10% Bonus",
    pro: "+15% Bonus",
    business: "+20% Bonus",
  }

  const PLAN_STYLE: Record<string, React.CSSProperties> = {
    basis: {
      padding: "16px",
      borderRadius: 16,
      border: "1px solid rgba(138,164,255,0.24)",
      background: "rgba(138,164,255,0.08)",
    },
    starter: {
      padding: "16px",
      borderRadius: 16,
      border: "1px solid rgba(127,209,167,0.24)",
      background: "rgba(127,209,167,0.08)",
    },
    pro: {
      padding: "16px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.04)",
      position: "relative",
    },
    scale: {
      padding: "16px",
      borderRadius: 16,
      border: "1px solid rgba(214,179,122,0.24)",
      background: "rgba(214,179,122,0.08)",
    },
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-title"
      style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(5,8,12,0.78)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxHeight: "85vh", display: "flex", flexDirection: "column",
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 24, overflow: "hidden",
        boxShadow: "var(--shadow-xl)",
        color: "var(--text-primary)", fontFamily: "var(--font-sans)",
      }}>
        <div style={{
          padding: "22px 28px", borderBottom: "1px solid var(--divider)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Credits
            </div>
            <div id="credits-title" style={{ fontSize: 18, fontWeight: 750, letterSpacing: -0.3 }}>Workspace balance</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, letterSpacing: -0.8,
              color: balance !== null && balance <= 0.01 ? "#e08686" : "var(--text-primary)"
            }}>
              € {balance === null ? "..." : balance.toFixed(2)}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.03)", color: "var(--text-muted)", cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={sectionTitle}>Plans</div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={PLAN_STYLE.basis}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>Basis</div>
                  <div style={{ fontSize:12, fontWeight:800, color:"var(--text-secondary)" }}>Current default</div>
                </div>
                <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.45 }}>
                  Platform access with manual credit loading.
                </div>
                <div style={{ marginTop:10, fontSize:11, color:"var(--text-muted)", lineHeight:1.5 }}>
                  • 1 user<br/>
                  • 3 active projects<br/>
                  • Team not included<br/>
                  • Local Ollama allowed<br/>
                  • Cloud AI via credits
                </div>
              </div>
              {subscriptionPlans.map((plan) => {
                const style =
                  plan.id === "pro" ? PLAN_STYLE.pro :
                  plan.id === "scale" ? PLAN_STYLE.scale :
                  PLAN_STYLE.starter

                return (
                  <div key={plan.id} style={style}>
                    {plan.id === "pro" ? (
                      <div style={{
                        position:"absolute", top:-10, right:12,
                        fontSize:10, fontWeight:800, padding:"3px 8px", borderRadius:999,
                        border: "1px solid rgba(138,164,255,0.24)",
                        background:"rgba(138,164,255,0.12)", color:"#a7baff", letterSpacing:0.7,
                      }}>Recommended</div>
                    ) : null}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ fontWeight:800, fontSize:16 }}>{plan.label}</div>
                      <div style={{ fontSize:12, fontWeight:800, color:"var(--text-secondary)" }}>€{plan.amount_eur}/mo</div>
                    </div>
                    <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.45 }}>
                      {plan.description}
                    </div>
                    <div style={{ marginTop:10, fontSize:11, color:"var(--text-muted)", lineHeight:1.5 }}>
                      • {plan.project_limit} active projects<br/>
                      • € {plan.credits_eur.toFixed(2)} monthly AI allowance<br/>
                      • Stripe-managed billing portal<br/>
                      • VAT handled at checkout
                    </div>
                    <div
                      onClick={() => void subscribe(plan)}
                      style={{
                        marginTop: 14, width: "100%", height: 38, borderRadius: 12, border: "1px solid rgba(138,164,255,0.26)",
                        background: loading === `plan:${plan.id}` ? "rgba(138,164,255,0.16)" : "linear-gradient(180deg, #9bb1ff 0%, #7f99f6 100%)",
                        color: loading === `plan:${plan.id}` ? "var(--text-primary)" : "#0d1320", fontWeight: 700, fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {loading === `plan:${plan.id}` ? "Loading..." : `Start ${plan.label}`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <div style={sectionTitle}>Top up credits</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {packages.map(pkg => (
                <div key={pkg.id} onClick={() => checkout(pkg)} style={{
                  padding: "18px", borderRadius: 16, cursor: "pointer",
                  border: pkg.id === "pro" ? "1px solid rgba(138,164,255,0.26)" : "1px solid var(--border)",
                  background: pkg.id === "pro" ? "rgba(138,164,255,0.08)" : "rgba(255,255,255,0.03)",
                  position: "relative", transition: "transform 0.15s",
                  opacity: loading === `credits:${pkg.id}` ? 0.6 : 1,
                }}>
                  {pkg.id === "pro" && (
                    <div style={{
                      position: "absolute", top: -10, right: 12,
                      fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                      border: "1px solid rgba(138,164,255,0.24)",
                      background: "rgba(138,164,255,0.12)",
                      color: "#a7baff", letterSpacing: 0.7,
                    }}>Recommended</div>
                  )}
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 2 }}>
                    € {pkg.amount_eur}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                    {pkg.label}
                  </div>
                  {BONUS[pkg.id] && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#7fd1a7",
                      background: "rgba(127,209,167,0.1)", borderRadius: 999,
                      padding: "2px 8px", display: "inline-block",
                    }}>{BONUS[pkg.id]} · € {pkg.credits_eur} Guthaben</div>
                  )}
                  <div style={{
                    marginTop: 14, width: "100%", height: 38, borderRadius: 12, border: "1px solid rgba(138,164,255,0.26)",
                    background: loading === `credits:${pkg.id}` ? "rgba(138,164,255,0.16)" : "linear-gradient(180deg, #9bb1ff 0%, #7f99f6 100%)",
                    color: loading === `credits:${pkg.id}` ? "var(--text-primary)" : "#0d1320", fontWeight: 700, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}>
                    {loading === `credits:${pkg.id}` ? "Loading..." : "Buy now"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {transactions.length > 0 && (
            <div>
              <div style={sectionTitle}>Transactions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.03)",
                    fontSize: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{
                        tx.type === "topup" ? "Aufladung" :
                        tx.type === "stripe" ? "Stripe-Zahlung" :
                        tx.type === "deduct" ? "KI-Nutzung" : tx.type
                      }</div>
                      <div style={{ color: "var(--text-muted)", marginTop: 2, fontSize: 11 }}>
                        {new Date(tx.created_at).toLocaleString("de-DE")}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 800,
                      color: tx.amount_eur >= 0 ? "#7fd1a7" : "#e08686",
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
  fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
  color: "var(--text-muted)", marginBottom: 12,
  textTransform: "uppercase",
}

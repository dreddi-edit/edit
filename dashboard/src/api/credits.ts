import { apiFetch } from "./client"
import type { BalanceRes, PlanRes, CreditsTransactionsRes, StripePackagesRes, StripeCheckoutRes, Plan } from "./types"

const BASE = ""

export async function apiGetBalance(): Promise<number | null> {
  try {
    const d = await apiFetch<BalanceRes>(`${BASE}/api/credits/balance`)
    return d.ok ? d.balance_eur : null
  } catch {
    return null
  }
}

export async function apiGetPlan(): Promise<Plan | null> {
  try {
    const d = await apiFetch<PlanRes>(`${BASE}/api/user/plan`)
    return d.ok && d.plan ? d.plan : null
  } catch {
    return null
  }
}

export async function apiGetCreditsTransactions(): Promise<CreditsTransactionsRes> {
  return apiFetch<CreditsTransactionsRes>(`${BASE}/api/credits/transactions`)
}

export async function apiGetStripePackages(): Promise<StripePackagesRes> {
  return apiFetch<StripePackagesRes>(`${BASE}/api/stripe/packages`)
}

export async function apiStripeCheckout(packageId: string): Promise<string> {
  const d = await apiFetch<StripeCheckoutRes>(`${BASE}/api/stripe/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ package_id: packageId }),
  })
  if (!d.ok || !d.url) throw new Error("checkout_failed")
  return d.url
}

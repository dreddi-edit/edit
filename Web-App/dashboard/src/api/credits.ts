import { apiFetch } from "./client"
import type {
  BalanceRes,
  PlanRes,
  CreditsTransactionsRes,
  StripeCheckoutRes,
  StripeInvoicesRes,
  StripePackagesRes,
  Plan,
} from "./types"

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
  return apiFetch<StripePackagesRes>(`${BASE}/api/stripe/packages`).catch((e) => {
    if (e instanceof Error && /Not found\./.test(e.message)) {
      return { ok: true, packages: [], subscription_plans: [] }
    }
    throw e
  })
}

export async function apiStripeCheckout(priceId: string): Promise<string> {
  const d = await apiFetch<StripeCheckoutRes>(`${BASE}/api/stripe/create-checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ priceId }),
  })
  return d.url
}

export async function apiStripeSubscriptionCheckout(priceId: Plan): Promise<string> {
  const d = await apiFetch<StripeCheckoutRes>(`${BASE}/api/stripe/create-checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ priceId }),
  })
  return d.url
}

export async function apiGetStripeInvoices(): Promise<StripeInvoicesRes> {
  return apiFetch<StripeInvoicesRes>(`${BASE}/api/stripe/invoices`).catch((e) => {
    if (e instanceof Error && /Not found\./.test(e.message)) {
      return { ok: true, invoices: [] }
    }
    throw e
  })
}

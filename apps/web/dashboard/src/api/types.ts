/**
 * Shared API response types – backend contract.
 * Keep in sync with server response shapes.
 */

/** Standard error shape from backend */
export type ApiError = { ok: false; error: string }

/** Credits balance */
export type BalanceRes = { ok: true; balance_eur: number } | ApiError

/** User plan (from user_settings.plan) */
export type Plan = "basis" | "starter" | "pro" | "scale"
export type PlanRes = { ok: boolean; plan?: Plan } | ApiError

/** Credit transaction row */
export type CreditTransaction = {
  id: number
  amount_eur: number
  type: string
  description: string
  created_at: string
}

/** Credits transactions list */
export type CreditsTransactionsRes = { ok: true; transactions: CreditTransaction[] } | ApiError

/** Stripe package (buyable) */
export type StripePackage = {
  id: string
  label: string
  amount_eur: number
  credits_eur: number
  description: string
}

export type StripeSubscriptionPlan = StripePackage & {
  project_limit: number
}

export type UserInvoice = {
  id: number
  stripe_invoice_id?: string | null
  stripe_charge_id?: string | null
  amount_eur?: number | null
  status?: string | null
  receipt_url?: string | null
  refunded?: number
  created_at: string
}

/** Stripe packages list */
export type StripePackagesRes = {
  ok: true
  packages: StripePackage[]
  subscription_plans?: StripeSubscriptionPlan[]
} | ApiError

export type StripeInvoicesRes = { ok: true; invoices: UserInvoice[] } | ApiError

/** Stripe checkout redirect */
export type StripeCheckoutRes = { ok: true; url: string } | ApiError

/** SEO audit scores */
export type SeoAuditRes =
  | {
      ok: true
      url: string
      scores: { performance: number; accessibility: number; seo: number; bestPractices: number }
      metrics: { fcp: string; lcp: string; cls: string; ttfb: string }
      opportunities: Array<{ id: string; title: string; value: string }>
    }
  | ApiError

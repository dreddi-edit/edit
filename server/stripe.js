import Stripe from "stripe"

import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { addCredits, getBalance } from "./credits.js"
import { sendPaymentConfirmation, sendPaymentFailed } from "./email.js"
import { ownerOnly } from "./accessControl.js"
import { logAudit } from "./auditLog.js"
import { readRequiredString } from "./validation.js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const PACKAGES = [
  { id: "starter", label: "Starter", amount_eur: 5, credits_eur: 5, description: "5 € Guthaben" },
  { id: "plus", label: "Plus", amount_eur: 15, credits_eur: 16.5, description: "15 € + 10% Bonus" },
  { id: "pro", label: "Pro", amount_eur: 30, credits_eur: 34.5, description: "30 € + 15% Bonus" },
  { id: "business", label: "Business", amount_eur: 100, credits_eur: 120, description: "100 € + 20% Bonus" },
]

const SUBSCRIPTION_PLANS = [
  { id: "starter", label: "Starter", amount_eur: 15, credits_eur: 16.5, description: "Starter monthly subscription", project_limit: 5 },
  { id: "pro", label: "Pro", amount_eur: 30, credits_eur: 34.5, description: "Pro monthly subscription", project_limit: 20 },
  { id: "scale", label: "Scale", amount_eur: 100, credits_eur: 120, description: "Scale monthly subscription", project_limit: 9999 },
]

function mapPlanId(planId) {
  const normalized = String(planId || "").trim().toLowerCase()
  return ["basis", "starter", "pro", "scale"].includes(normalized) ? normalized : "basis"
}

function getSubscriptionPlan(planId) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === mapPlanId(planId))
}

function syncUserPlan(userId, planId, planStatus = "active", stripeSubscriptionId = undefined, stripeCustomerId = undefined) {
  const normalizedPlan = mapPlanId(planId)
  const fields = ["plan_id = ?", "plan_status = ?"]
  const values = [normalizedPlan, planStatus || "active"]

  if (stripeSubscriptionId !== undefined) {
    fields.push("stripe_subscription_id = ?")
    values.push(stripeSubscriptionId)
  }
  if (stripeCustomerId !== undefined) {
    fields.push("stripe_customer_id = ?")
    values.push(stripeCustomerId)
  }

  values.push(userId)
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values)
  db.prepare(`
    INSERT INTO user_settings (user_id, plan)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan
  `).run(userId, normalizedPlan)
}

async function getOrCreateStripeCustomer(userId, user) {
  if (user?.stripe_customer_id) return user.stripe_customer_id
  const existingCustomers = await stripe.customers.list({
    email: user.email,
    limit: 1,
  })
  const customer = existingCustomers.data[0] || await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { user_id: String(userId) },
  })
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customer.id, userId)
  return customer.id
}

function getProjectLimit(planId) {
  return getSubscriptionPlan(planId)?.project_limit || 0
}

function enforceProjectLimit(userId, planId) {
  const limit = getProjectLimit(planId)
  if (!limit) return
  const row = db.prepare("SELECT COUNT(*) AS count FROM projects WHERE user_id = ? AND status != 'locked'").get(userId)
  const activeCount = Number(row?.count || 0)
  if (activeCount <= limit) return

  const overflow = activeCount - limit
  const toLock = db.prepare(`
    SELECT id
    FROM projects
    WHERE user_id = ? AND status != 'locked'
    ORDER BY created_at ASC
    LIMIT ?
  `).all(userId, overflow)

  for (const project of toLock) {
    db.prepare("UPDATE projects SET status = 'locked' WHERE id = ?").run(project.id)
  }
}

function recordCreditTransaction(userId, amountEur, type, description) {
  db.prepare(`
    INSERT INTO credit_transactions (user_id, amount_eur, type, description)
    VALUES (?, ?, ?, ?)
  `).run(userId, amountEur, type, description)
}

function adjustBalance(userId, amountEur) {
  db.prepare(`
    INSERT INTO credits (user_id, balance_eur)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET balance_eur = balance_eur + excluded.balance_eur
  `).run(userId, amountEur)
}

function extractRefundReference(invoice) {
  return invoice?.stripe_charge_id || null
}

export function registerStripeRoutes(app) {
  app.get("/api/stripe/packages", (_req, res) => {
    res.json({ ok: true, packages: PACKAGES, subscription_plans: SUBSCRIPTION_PLANS })
  })

  app.get("/api/stripe/invoices", authMiddleware, (req, res) => {
    try {
      const invoices = db.prepare(`
        SELECT
          id,
          stripe_invoice_id,
          stripe_charge_id,
          amount_eur,
          status,
          receipt_url,
          refunded,
          created_at
        FROM user_invoices
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 12
      `).all(req.user.id)
      res.json({ ok: true, invoices })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to load invoices" })
    }
  })

  app.post("/api/stripe/checkout", authMiddleware, async (req, res) => {
    try {
      const billingMode = String(req.body?.billing_mode || "").trim().toLowerCase()
      const requestedPlanId = mapPlanId(req.body?.plan_id || req.body?.package_id)
      const user = db.prepare(`
        SELECT id, email, name, stripe_customer_id
        FROM users
        WHERE id = ?
      `).get(req.user.id)
      if (!user?.email) return res.status(404).json({ ok: false, error: "User not found" })

      if (billingMode === "subscription" || req.body?.plan_id) {
        const plan = getSubscriptionPlan(requestedPlanId)
        if (!plan) return res.status(400).json({ ok: false, error: "Plan nicht gefunden" })

        const customerId = await getOrCreateStripeCustomer(req.user.id, user)
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          payment_method_types: ["card"],
          automatic_tax: { enabled: true },
          customer_update: { address: "auto" },
          line_items: [{
            price_data: {
              currency: "eur",
              recurring: { interval: "month" },
              product_data: {
                name: `Site Editor – ${plan.label}`,
                description: plan.description,
                metadata: {
                  plan_id: plan.id,
                  credits_eur: String(plan.credits_eur),
                  project_limit: String(plan.project_limit),
                },
              },
              unit_amount: Math.round(plan.amount_eur * 100),
            },
            quantity: 1,
          }],
          subscription_data: {
            metadata: {
              user_id: String(req.user.id),
              plan_id: plan.id,
              credits_eur: String(plan.credits_eur),
              project_limit: String(plan.project_limit),
            },
          },
          success_url: `${req.protocol}://${req.get("host")}/?payment=success&plan=${plan.id}`,
          cancel_url: `${req.protocol}://${req.get("host")}/?payment=cancelled`,
          metadata: {
            user_id: String(req.user.id),
            billing_mode: "subscription",
            plan_id: plan.id,
            credits_eur: String(plan.credits_eur),
            project_limit: String(plan.project_limit),
          },
        })

        return res.json({ ok: true, url: session.url })
      }

      const packageId = String(req.body?.package_id || "").trim()
      const pkg = PACKAGES.find((entry) => entry.id === packageId)
      if (!pkg) return res.status(400).json({ ok: false, error: "Paket nicht gefunden" })

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `Site Editor – ${pkg.label}`,
              description: pkg.description,
            },
            unit_amount: Math.round(pkg.amount_eur * 100),
          },
          quantity: 1,
        }],
        success_url: `${req.protocol}://${req.get("host")}/?payment=success&package=${pkg.id}`,
        cancel_url: `${req.protocol}://${req.get("host")}/?payment=cancelled`,
        metadata: {
          user_id: String(req.user.id),
          package_id: pkg.id,
          credits_eur: String(pkg.credits_eur),
          billing_mode: "credits",
        },
        customer_email: user.email,
      })

      res.json({ ok: true, url: session.url })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Checkout failed" })
    }
  })

  app.post("/api/stripe/portal", authMiddleware, async (req, res) => {
    try {
      const user = db.prepare("SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?").get(req.user.id)
      if (!user?.email) return res.status(404).json({ ok: false, error: "User not found" })

      const customerId = await getOrCreateStripeCustomer(req.user.id, user)
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.protocol}://${req.get("host")}/`,
      })

      res.json({ ok: true, url: session.url })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Portal failed" })
    }
  })

  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"]
    let event

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
      console.error("Webhook Fehler:", error?.message || error)
      return res.status(400).send(`Webhook Error: ${error?.message || error}`)
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object
        const userId = Number.parseInt(String(session.metadata?.user_id || "0"), 10)
        if (userId && session.customer) {
          db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(String(session.customer), userId)
        }

        if (session.mode === "subscription" && userId) {
          const planId = mapPlanId(session.metadata?.plan_id)
          syncUserPlan(userId, planId, "active", session.subscription ? String(session.subscription) : null, session.customer ? String(session.customer) : undefined)
        }

        if (session.mode === "payment") {
          const creditsEur = Number.parseFloat(String(session.metadata?.credits_eur || "0"))
          const packageId = String(session.metadata?.package_id || "")
          const existing = db.prepare("SELECT id FROM credit_transactions WHERE description LIKE ?").get(`%${session.id}%`)
          if (userId && creditsEur > 0 && !existing) {
            addCredits(userId, creditsEur)
            db.prepare("UPDATE credit_transactions SET type = 'stripe', description = ? WHERE id = last_insert_rowid()").run(`Stripe: ${packageId} (${session.id})`)
            const pkg = PACKAGES.find((entry) => entry.id === packageId)
            const amountEur = pkg ? pkg.amount_eur : (session.amount_total != null ? session.amount_total / 100 : creditsEur)
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId)
            if (user) {
              sendPaymentConfirmation(user.email, user.name, amountEur, creditsEur).catch((error) => {
                console.error("Payment mail:", error?.message || error)
              })
            }
          }
        }
      }

      if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object
        const user = db.prepare("SELECT * FROM users WHERE stripe_customer_id = ?").get(String(invoice.customer || ""))
        if (user) {
          const existingInvoice = db.prepare("SELECT id FROM user_invoices WHERE stripe_invoice_id = ?").get(invoice.id || null)
          db.prepare(`
            INSERT INTO user_invoices (user_id, stripe_invoice_id, stripe_charge_id, amount_eur, status, receipt_url, refunded)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT(stripe_invoice_id) DO UPDATE SET
              stripe_charge_id = excluded.stripe_charge_id,
              amount_eur = excluded.amount_eur,
              status = excluded.status,
              receipt_url = excluded.receipt_url
          `).run(
            user.id,
            invoice.id || null,
            invoice.charge || invoice.payment_intent || null,
            Number(invoice.amount_paid || 0) / 100,
            invoice.status || "paid",
            invoice.hosted_invoice_url || null
          )

          const existingCredit = db.prepare("SELECT id FROM credit_transactions WHERE description LIKE ?").get(`%${invoice.id}%`)
          const plan = getSubscriptionPlan(user.plan_id)
          const creditsEur = Number.parseFloat(String(invoice.lines?.data?.[0]?.metadata?.credits_eur || plan?.credits_eur || 0))
          if (creditsEur > 0 && !existingCredit) {
            addCredits(user.id, creditsEur)
            db.prepare("UPDATE credit_transactions SET type = 'stripe_recurring', description = ? WHERE id = last_insert_rowid()").run(`Stripe subscription renewal (${invoice.id})`)
            sendPaymentConfirmation(
              user.email,
              user.name,
              Number(invoice.amount_paid || 0) / 100,
              creditsEur || Number(invoice.amount_paid || 0) / 100
            ).catch((error) => {
              console.error("Payment confirmation mail:", error?.message || error)
            })
          } else if (!existingInvoice) {
            sendPaymentConfirmation(
              user.email,
              user.name,
              Number(invoice.amount_paid || 0) / 100,
              creditsEur || Number(invoice.amount_paid || 0) / 100
            ).catch((error) => {
              console.error("Payment confirmation mail:", error?.message || error)
            })
          }

          syncUserPlan(user.id, user.plan_id || "basis", "active")
        }
      }

      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object
        const user = db.prepare(`
          SELECT id, email, name, stripe_customer_id, plan_id
          FROM users
          WHERE stripe_customer_id = ?
        `).get(String(invoice.customer || ""))
        if (user) {
          syncUserPlan(user.id, user.plan_id || "basis", "past_due")
          let portalUrl = ""
          try {
            const portal = await stripe.billingPortal.sessions.create({
              customer: user.stripe_customer_id,
              return_url: `${process.env.APP_BASE_URL || ""}/`,
            })
            portalUrl = portal.url
          } catch {}
          sendPaymentFailed(user.email, user.name || "", portalUrl).catch((error) => {
            console.error("Payment failed mail:", error?.message || error)
          })
        }
      }

      if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        const sub = event.data.object
        const user = db.prepare(`
          SELECT id, plan_id
          FROM users
          WHERE stripe_subscription_id = ? OR stripe_customer_id = ?
        `).get(String(sub.id || ""), String(sub.customer || ""))

        if (user) {
          const planId = mapPlanId(sub.metadata?.plan_id || user.plan_id || "basis")
          if (event.type === "customer.subscription.deleted") {
            syncUserPlan(user.id, "basis", "canceled", null)
          } else {
            syncUserPlan(user.id, planId, sub.status || "active", String(sub.id || ""))
            enforceProjectLimit(user.id, planId)
          }
        }
      }

      res.json({ received: true })
    } catch (error) {
      console.error("Stripe webhook handling failed:", error?.message || error)
      res.status(500).json({ ok: false, error: error?.message || "Webhook handling failed" })
    }
  })

  app.get("/api/stripe/verify-payment", authMiddleware, (req, res) => {
    const balance = getBalance(req.user.id)
    res.json({ ok: true, balance_eur: balance })
  })

  app.post("/api/admin/refund", authMiddleware, ownerOnly, async (req, res) => {
    try {
      const stripeInvoiceId = readRequiredString(req.body?.stripe_invoice_id, "stripe_invoice_id", { max: 128 })
      const invoice = db.prepare("SELECT * FROM user_invoices WHERE stripe_invoice_id = ?").get(stripeInvoiceId)
      if (!invoice) return res.status(404).json({ ok: false, error: "Invoice not found" })
      if (invoice.refunded) return res.status(400).json({ ok: false, error: "Invoice already refunded" })

      const referenceId = extractRefundReference(invoice)
      if (!referenceId) {
        return res.status(400).json({ ok: false, error: "No refund reference on invoice" })
      }

      const refund = referenceId.startsWith("pi_")
        ? await stripe.refunds.create({ payment_intent: referenceId })
        : await stripe.refunds.create({ charge: referenceId })

      db.prepare("UPDATE user_invoices SET refunded = 1, status = 'refunded' WHERE id = ?").run(invoice.id)
      const creditsToDeduct = Number(invoice.amount_eur || 0)
      if (creditsToDeduct > 0) {
        adjustBalance(invoice.user_id, -creditsToDeduct)
        recordCreditTransaction(
          invoice.user_id,
          -creditsToDeduct,
          "admin_refund",
          `Admin refund for invoice ${stripeInvoiceId} (refund: ${refund.id})`
        )
      }

      logAudit({
        userId: req.user.id,
        action: "admin.refund.issued",
        targetType: "user",
        targetId: invoice.user_id,
        meta: { stripeInvoiceId, refundId: refund.id, amountEur: creditsToDeduct },
      })

      res.json({ ok: true, refund_id: refund.id, credits_deducted: creditsToDeduct })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Refund failed" })
    }
  })
}

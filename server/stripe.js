import { sendPaymentConfirmation } from "./email.js"
import Stripe from "stripe"
import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { addCredits, getBalance } from "./credits.js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Pakete die man kaufen kann
export const PACKAGES = [
  { id: "starter",    label: "Starter",     amount_eur: 5,   credits_eur: 5,   description: "5 € Guthaben" },
  { id: "plus",       label: "Plus",        amount_eur: 15,  credits_eur: 16.5, description: "15 € + 10% Bonus" },
  { id: "pro",        label: "Pro",         amount_eur: 30,  credits_eur: 34.5, description: "30 € + 15% Bonus" },
  { id: "business",  label: "Business",    amount_eur: 100, credits_eur: 120,  description: "100 € + 20% Bonus" },
]

export function registerStripeRoutes(app) {

  // Pakete abrufen
  app.get("/api/stripe/packages", (req, res) => {
    res.json({ ok: true, packages: PACKAGES })
  })

  // Checkout Session erstellen
  app.post("/api/stripe/checkout", authMiddleware, async (req, res) => {
    const { package_id } = req.body
    const pkg = PACKAGES.find(p => p.id === package_id)
    if (!pkg) return res.status(400).json({ ok: false, error: "Paket nicht gefunden" })

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `Site Editor – ${pkg.label}`,
              description: pkg.description,
            },
            unit_amount: Math.round(pkg.amount_eur * 100), // Cent
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `http://localhost:8788?payment=success&package=${pkg.id}`,
        cancel_url: `http://localhost:8788?payment=cancelled`,
        metadata: {
          user_id: String(req.user.id),
          package_id: pkg.id,
          credits_eur: String(pkg.credits_eur),
        },
        customer_email: req.user.email,
      })

      res.json({ ok: true, url: session.url })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // Webhook – Stripe ruft das auf nach erfolgreicher Zahlung
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"]
    let event

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (e) {
      console.error("Webhook Fehler:", e.message)
      return res.status(400).send(`Webhook Error: ${e.message}`)
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object
      const userId = parseInt(session.metadata.user_id)
      const creditsEur = parseFloat(session.metadata.credits_eur)
      const packageId = session.metadata.package_id

      // Duplikat-Check
      const existing = db.prepare(
        "SELECT id FROM credit_transactions WHERE description LIKE ?"
      ).get(`%${session.id}%`)

      if (!existing) {
        addCredits(userId, creditsEur)
        db.prepare(
          "INSERT INTO credit_transactions (user_id, amount_eur, type, description) VALUES (?, ?, 'stripe', ?)"
        ).run(userId, creditsEur, `Stripe: ${packageId} (${session.id})`)
        console.log(`✅ Credits hinzugefügt: ${creditsEur}€ für User ${userId}`)
        // Bestätigungs-Mail
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId)
        if (user) sendPaymentConfirmation(user.email, user.name, pkg.amount_eur, creditsEur).catch(e => console.error("Payment mail:", e.message))
      }
    }

    res.json({ received: true })
  })

  // Aktuelles Guthaben nach Zahlung abrufen
  app.get("/api/stripe/verify-payment", authMiddleware, (req, res) => {
    const balance = getBalance(req.user.id)
    res.json({ ok: true, balance_eur: balance })
  })
}

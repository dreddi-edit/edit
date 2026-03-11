import db from "./db.js"
import { authMiddleware } from "./auth.js"

// Kosten pro Token in EUR (Anthropic USD Preise * 1.2 Aufschlag)
const COSTS_EUR = {
  "claude-sonnet-4-6":  { input: 3.6,  output: 18   },
  "claude-haiku-4-5-20251001":   { input: 0.3,  output: 1.5  },
  "gemini-2.5-flash":   { input: 0.09, output: 0.36 },
  "gemini-2.5-pro":     { input: 1.44, output: 4.32 },
  "groq:llama-3.1-8b-instant": { input: 0.12, output: 0.24 },
  "groq:llama-3.3-70b-versatile": { input: 0.9, output: 1.8 },
  "ollama:qwen2.5-coder:7b": { input: 0, output: 0 },
}

export function getBalance(userId) {
  const row = db.prepare("SELECT balance_eur FROM credits WHERE user_id = ?").get(userId)
  return row?.balance_eur ?? 0
}

export function estimateCreditCost(model, inputTokens, outputTokens) {
  const costs = COSTS_EUR[model] || COSTS_EUR["claude-sonnet-4-6"]
  const raw = ((inputTokens / 1_000_000) * costs.input) + ((outputTokens / 1_000_000) * costs.output)
  if (raw <= 0) return 0
  return Math.max(0.01, raw)
}

export function hasEnoughCredits(userId, model, inputTokens, outputTokens) {
  const needed = estimateCreditCost(model, inputTokens, outputTokens)
  const balance = getBalance(userId)
  return {
    ok: balance >= needed,
    balance,
    needed
  }
}

export function deductCredits(userId, model, inputTokens, outputTokens, taskLabel = "AI usage") {
  const costs = COSTS_EUR[model] || COSTS_EUR["claude-sonnet-4-6"]
  const amount = ((inputTokens / 1_000_000) * costs.input) + ((outputTokens / 1_000_000) * costs.output)
  if (amount === 0) return 0

  db.prepare(`
    INSERT INTO credits (user_id, balance_eur) VALUES (?, 0)
    ON CONFLICT(user_id) DO UPDATE SET balance_eur = balance_eur - ?
  `).run(userId, amount)

  db.prepare(`
    INSERT INTO credit_transactions (user_id, amount_eur, type, description)
    VALUES (?, ?, 'deduct', ?)
  `).run(userId, -amount, `AI: ${taskLabel} | ${model} (${inputTokens}in/${outputTokens}out tokens)`)

  return amount
}

export function addCredits(userId, amountEur) {
  db.prepare(`
    INSERT INTO credits (user_id, balance_eur) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET balance_eur = balance_eur + ?
  `).run(userId, amountEur, amountEur)

  db.prepare(`
    INSERT INTO credit_transactions (user_id, amount_eur, type, description)
    VALUES (?, ?, 'topup', 'Manuelle Aufladung')
  `).run(userId, amountEur)
}

export function registerCreditRoutes(app) {

  // Guthaben abrufen
  app.get("/api/credits/balance", authMiddleware, (req, res) => {
    const balance = getBalance(req.user.id)
    res.json({ ok: true, balance_eur: balance })
  })

  // Transaktionen
  app.get("/api/credits/transactions", authMiddleware, (req, res) => {
    const txs = db.prepare(
      "SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(req.user.id)
    res.json({ ok: true, transactions: txs })
  })

  // Aufladung (später Stripe – jetzt manuell für Demo)
  app.post("/api/credits/topup", authMiddleware, (req, res) => {
    const { amount_eur } = req.body
    if (!amount_eur || amount_eur < 1 || amount_eur > 100) {
      return res.status(400).json({ ok: false, error: "Betrag zwischen 1 und 100 EUR" })
    }
    addCredits(req.user.id, amount_eur)
    const balance = getBalance(req.user.id)
    res.json({ ok: true, balance_eur: balance })
  })
}

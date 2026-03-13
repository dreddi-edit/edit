import Stripe from 'stripe';
import db from './db.js';

function getBaseUrl() {
  return String(process.env.APP_URL || process.env.ALLOWED_ORIGIN || '').split(',')[0].trim().replace(/\/$/, '');
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function requireUser(req, res) {
  if (!req.user?.id) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return null;
  }
  return req.user;
}

function defaultPackages() {
  const oneTime = [
    {
      id: process.env.STRIPE_PRICE_STARTER || 'starter',
      label: 'Starter',
      amount_eur: 9,
      credits_eur: 9,
      description: 'Starter credits package',
    },
    {
      id: process.env.STRIPE_PRICE_PRO || 'pro',
      label: 'Pro',
      amount_eur: 29,
      credits_eur: 29,
      description: 'Pro credits package',
    },
    {
      id: process.env.STRIPE_PRICE_SCALE || 'scale',
      label: 'Scale',
      amount_eur: 99,
      credits_eur: 99,
      description: 'Scale credits package',
    },
  ];

  const subscription_plans = [
    {
      id: process.env.STRIPE_SUB_STARTER || 'sub_starter',
      label: 'Starter Monthly',
      amount_eur: 19,
      credits_eur: 19,
      description: 'Starter subscription',
      project_limit: 3,
    },
    {
      id: process.env.STRIPE_SUB_PRO || 'sub_pro',
      label: 'Pro Monthly',
      amount_eur: 49,
      credits_eur: 49,
      description: 'Pro subscription',
      project_limit: 15,
    },
    {
      id: process.env.STRIPE_SUB_SCALE || 'sub_scale',
      label: 'Scale Monthly',
      amount_eur: 149,
      credits_eur: 149,
      description: 'Scale subscription',
      project_limit: 100,
    },
  ];

  return { packages: oneTime, subscription_plans };
}

function mapInvoiceRow(row) {
  return {
    id: Number(row.id),
    stripe_invoice_id: row.stripe_invoice_id ?? null,
    stripe_charge_id: row.stripe_charge_id ?? null,
    amount_eur: row.amount_eur ?? null,
    status: row.status ?? null,
    receipt_url: row.receipt_url ?? null,
    refunded: row.refunded ?? 0,
    created_at: row.created_at,
  };
}

function tryReadInvoices(userId) {
  const candidates = [
    `SELECT id, stripe_invoice_id, stripe_charge_id, amount_eur, status, receipt_url, refunded, created_at
     FROM user_invoices
     WHERE user_id = ?
     ORDER BY datetime(created_at) DESC, id DESC`,
    `SELECT id, stripe_invoice_id, stripe_charge_id, amount_eur, status, receipt_url, refunded, created_at
     FROM invoices
     WHERE user_id = ?
     ORDER BY datetime(created_at) DESC, id DESC`,
    `SELECT id, NULL as stripe_invoice_id, NULL as stripe_charge_id, amount_eur, type as status, NULL as receipt_url, 0 as refunded, created_at
     FROM credit_transactions
     WHERE user_id = ? AND amount_eur > 0
     ORDER BY datetime(created_at) DESC, id DESC`,
  ];

  for (const sql of candidates) {
    try {
      const rows = db.prepare(sql).all(userId);
      return rows.map(mapInvoiceRow);
    } catch {}
  }

  return [];
}

export function registerStripeRoutes(app) {
  app.get('/api/stripe/packages', (req, res) => {
    res.json({ ok: true, ...defaultPackages() });
  });

  app.get('/api/stripe/invoices', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({ ok: true, invoices: tryReadInvoices(user.id) });
  });

  const checkoutHandler = async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const priceId = String(req.body?.priceId || '').trim();
      if (!priceId) {
        return res.status(400).json({ ok: false, error: 'Missing priceId' });
      }

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ ok: false, error: 'Stripe is not configured' });
      }

      const baseUrl = getBaseUrl();
      if (!baseUrl) {
        return res.status(500).json({ ok: false, error: 'APP_URL or ALLOWED_ORIGIN is not configured' });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/dashboard?payment=success`,
        cancel_url: `${baseUrl}/dashboard?payment=cancel`,
        client_reference_id: String(user.id),
        metadata: { userId: String(user.id) },
      });

      res.json({ ok: true, url: session.url });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'Stripe checkout failed' });
    }
  };

  app.post('/api/stripe/checkout', checkoutHandler);
  app.post('/api/stripe/create-checkout', checkoutHandler);

  app.post('/api/stripe/webhook', async (_req, res) => {
    res.json({ received: true });
  });
}

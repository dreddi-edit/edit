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

function persistStripeCustomerId(userId, customerId) {
  const normalizedUserId = Number(userId);
  const normalizedCustomerId = String(customerId || '').trim();
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return;
  if (!normalizedCustomerId) return;
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(normalizedCustomerId, normalizedUserId);
}

function persistStripeSubscription(userId, subscriptionId, planId, planStatus) {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return;

  const normalizedSubscriptionId = String(subscriptionId || '').trim() || null;
  const normalizedPlanId = String(planId || '').trim() || 'basis';
  const normalizedPlanStatus = String(planStatus || '').trim() || 'active';

  db.prepare(`
    UPDATE users
    SET
      stripe_subscription_id = ?,
      plan_id = ?,
      plan_status = ?
    WHERE id = ?
  `).run(normalizedSubscriptionId, normalizedPlanId, normalizedPlanStatus, normalizedUserId);
}


function normalizePlanFromPriceId(priceId) {
  const value = String(priceId || '').trim().toLowerCase();
  if (!value) return 'basis';
  if (value.includes('scale')) return 'scale';
  if (value.includes('pro')) return 'pro';
  if (value.includes('starter')) return 'starter';
  return value;
}

function normalizePlanStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'active';
  if (value === 'trialing') return 'active';
  if (value === 'past_due') return 'past_due';
  if (value === 'unpaid') return 'past_due';
  if (value === 'canceled') return 'canceled';
  if (value === 'incomplete') return 'incomplete';
  if (value === 'incomplete_expired') return 'canceled';
  if (value === 'paused') return 'paused';
  if (value === 'active') return 'active';
  return value;
}

function persistStripeInvoice(userId, invoice) {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return;

  const invoiceId = String(invoice?.id || '').trim();
  if (!invoiceId) return;

  const chargeId =
    typeof invoice?.charge === 'string'
      ? invoice.charge
      : (invoice?.charge?.id || null);

  const amountEur = Number.isFinite(Number(invoice?.amount_paid))
    ? Number(invoice.amount_paid) / 100
    : (
        Number.isFinite(Number(invoice?.amount_due))
          ? Number(invoice.amount_due) / 100
          : 0
      );

  const receiptUrl = invoice?.hosted_invoice_url || invoice?.invoice_pdf || null;
  const status = String(invoice?.status || '').trim() || 'open';

  db.prepare(`
    INSERT INTO user_invoices (
      user_id,
      stripe_invoice_id,
      stripe_charge_id,
      amount_eur,
      status,
      receipt_url,
      refunded,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
    ON CONFLICT(stripe_invoice_id) DO UPDATE SET
      stripe_charge_id = excluded.stripe_charge_id,
      amount_eur = excluded.amount_eur,
      status = excluded.status,
      receipt_url = excluded.receipt_url
  `).run(
    normalizedUserId,
    invoiceId,
    chargeId || null,
    amountEur,
    status,
    receiptUrl
  );
}

function getWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim() || null;
}

function getRawWebhookBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body || {});
}

function resolveUserIdFromEventObject(object) {
  const metadataUserId = Number(object?.metadata?.userId);
  if (Number.isInteger(metadataUserId) && metadataUserId > 0) return metadataUserId;

  const customerId = String(object?.customer || '').trim();
  if (customerId) {
    const row = db.prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(customerId);
    if (row?.id) return Number(row.id);
  }

  const subscriptionId = String(object?.subscription || object?.id || '').trim();
  if (subscriptionId) {
    const row = db.prepare("SELECT id FROM users WHERE stripe_subscription_id = ?").get(subscriptionId);
    if (row?.id) return Number(row.id);
  }

  return null;
}

function handleStripeEvent(event) {
  const type = String(event?.type || '').trim();
  const object = event?.data?.object || {};

  if (type === 'checkout.session.completed') {
    const userId = resolveUserIdFromEventObject(object);
    if (!userId) return;

    if (object?.customer) {
      persistStripeCustomerId(userId, object.customer);
    }

    const mode = String(object?.mode || '').trim();
    if (mode === 'subscription') {
      const subscriptionId = typeof object?.subscription === 'string'
        ? object.subscription
        : object?.subscription?.id;

      const planId = normalizePlanFromPriceId(object?.metadata?.priceId);
      persistStripeSubscription(userId, subscriptionId, planId, 'active');
    }

    return;
  }

  if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
    const userId = resolveUserIdFromEventObject(object);
    if (!userId) return;

    if (object?.customer) {
      persistStripeCustomerId(userId, object.customer);
    }

    const priceId =
      object?.items?.data?.[0]?.price?.id ||
      object?.plan?.id ||
      object?.metadata?.priceId ||
      '';

    const planId = normalizePlanFromPriceId(priceId);
    const planStatus = normalizePlanStatus(object?.status);

    persistStripeSubscription(userId, object?.id, planId, planStatus);
    return;
  }

  if (type === 'customer.subscription.deleted') {
    const userId = resolveUserIdFromEventObject(object);
    if (!userId) return;

    persistStripeSubscription(userId, null, 'basis', 'canceled');
    return;
  }

  if (type === 'invoice.payment_failed') {
    const userId = resolveUserIdFromEventObject(object);
    if (!userId) return;

    persistStripeInvoice(userId, object);
    db.prepare("UPDATE users SET plan_status = ? WHERE id = ?").run('past_due', userId);
    return;
  }

  if (type === 'invoice.paid') {
    const userId = resolveUserIdFromEventObject(object);
    if (!userId) return;

    persistStripeInvoice(userId, object);
    db.prepare("UPDATE users SET plan_status = ? WHERE id = ?").run('active', userId);
    return;
  }
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

      const catalog = defaultPackages();
      const isSubscription = Array.isArray(catalog.subscription_plans)
        && catalog.subscription_plans.some((plan) => String(plan.id) === priceId);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: isSubscription ? 'subscription' : 'payment',
        customer_creation: isSubscription ? undefined : 'always',
        success_url: `${baseUrl}/dashboard?payment=success`,
        cancel_url: `${baseUrl}/dashboard?payment=cancel`,
        client_reference_id: String(user.id),
        metadata: { userId: String(user.id), priceId, mode: isSubscription ? 'subscription' : 'payment' },
      });

      if (session?.customer) {
        persistStripeCustomerId(user.id, session.customer);
      }

      res.json({ ok: true, url: session.url });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'Stripe checkout failed' });
    }
  };

  app.post('/api/stripe/checkout', checkoutHandler);
  app.post('/api/stripe/create-checkout', checkoutHandler);

  app.post('/api/stripe/portal', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ ok: false, error: 'Stripe is not configured' });
      }

      const baseUrl = getBaseUrl();
      if (!baseUrl) {
        return res.status(500).json({ ok: false, error: 'APP_URL or ALLOWED_ORIGIN is not configured' });
      }

      const customerId =
        req.user?.stripe_customer_id ||
        db.prepare("SELECT stripe_customer_id FROM users WHERE id = ?").get(user.id)?.stripe_customer_id;

      if (!customerId) {
        return res.status(400).json({ ok: false, error: 'No Stripe customer found for this user' });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: String(customerId),
        return_url: `${baseUrl}/dashboard?billing=returned`,
      });

      return res.json({ ok: true, url: session.url });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || 'Stripe billing portal failed' });
    }
  });

  app.post('/api/stripe/webhook', async (req, res) => {
    try {
      const stripe = getStripe();
      const webhookSecret = getWebhookSecret();

      let event = req.body;

      if (stripe && webhookSecret) {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
          return res.status(400).json({ ok: false, error: 'Missing Stripe signature' });
        }

        const rawBody = getRawWebhookBody(req);
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      }

      handleStripeEvent(event);
      return res.json({ received: true });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error?.message || 'Stripe webhook failed' });
    }
  });
}

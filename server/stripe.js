import Stripe from 'stripe';
import db from './db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export function registerStripeRoutes(app) {
  app.post('/api/stripe/create-checkout', async (req, res) => {
    try {
      const { priceId } = req.body;
      const userId = req.user.id;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${process.env.ALLOWED_ORIGIN}/dashboard?payment=success`,
        cancel_url: `${process.env.ALLOWED_ORIGIN}/dashboard?payment=cancel`,
        client_reference_id: userId.toString(),
      });

      res.json({ url: session.url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook für die Gutschrift der Credits nach Zahlung
  app.post('/api/stripe/webhook', async (req, res) => {
    // Logik zur Gutschrift der Credits in die Datenbank (db.js)
    res.json({ received: true });
  });
}

// api/get-stripe-data.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { stripeCustomerId } = req.body;
  if (!stripeCustomerId) return res.status(400).json({ error: 'Missing stripeCustomerId' });

  try {
    const cacheKey = `stripeData:${stripeCustomerId}`;
    
    // 3) lecture du cache
    const cached: any = await redis.get(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.status(200).json(data);
    }

    // 4) fetch subscriptions
    const subsList = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      expand: ['data.items.data.price'],
    });
    const enrichedSubscriptions = await Promise.all(
      subsList.data.map(async sub => {
        const items = await Promise.all(
          sub.items.data.map(async item => {
            const price = item.price as Stripe.Price;
            let product_name = '';
            if (typeof price.product === 'string') {
              const prod = await stripe.products.retrieve(price.product);
              product_name = prod.name;
            }
            return { ...item, product_name };
          })
        );
        return { ...sub, items: { ...sub.items, data: items } };
      })
    );

    // 5) fetch invoices
    const invList = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 10,
    });
    const enrichedInvoices = await Promise.all(
      invList.data.map(async inv => {
        const lines = await Promise.all(
          inv.lines.data.map(async line => {
            if (!line.price) return { ...line, product_name: '' };
            const price = line.price as Stripe.Price;
            let product_name = '';
            if (typeof price.product === 'string') {
              const prod = await stripe.products.retrieve(price.product);
              product_name = prod.name;
            }
            return { ...line, product_name };
          })
        );
        return { ...inv, lines: { ...inv.lines, data: lines } };
      })
    );

    const result = { subscriptions: enrichedSubscriptions, invoices: enrichedInvoices };

    // 6) mise en cache 5 minutes
    await redis.set(cacheKey, JSON.stringify(result), { ex: 300 });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erreur lors de la récupération des données Stripe :', err);
    return res.status(500).json({ error: 'Failed to fetch Stripe data' });
  }
}

// api/create-payment-intent.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { generateInvoiceBuffer } from '../lib/generateInvoice';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const getPriceIdFromProductId = (productId: string): string | undefined => {
  const map: Record<string, string> = {
    "domiciliation-mensuel-societe-Abonnement-Mensuel": "price_1RZSgAL4PnylHeS6yEgwLzzW",
    "domiciliation-mensuel-societe-Abonnement-6-mois": "price_1RZSNFL4PnylHeS6bmP6YUy2",
    "domiciliation-mensuel-auto-entrepreneur-Abonnement-Mensuel": "price_1RZSLML4PnylHeS6UMlLbJXY",
    "domiciliation-mensuel-auto-entreprise-Abonnement-6-mois": "price_1RZSM3L4PnylHeS6sa3QIcxv",
  };
  return map[productId];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 👉 nouveau mode juste pour récupérer le clientSecret
    if (req.body.requestOnlyClientSecret) {
      const pi = await stripe.paymentIntents.create({
        amount: req.body.total * 100,
        currency: 'eur',
      });
      return res.status(200).json({ clientSecret: pi.client_secret });
    }

  try {
    const {
      email,
      paymentMethodId,
      userId,
      oneTimeItems = [],
      subscriptionItems = [],
      items = [],
      total = 0,
      clientInfo = {},
    } = req.body;

    const { firstName = '', lastName = '', address = '', siretNumber = '' } = clientInfo;

    if (!email || !paymentMethodId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let [customer] = (await stripe.customers.list({ email, limit: 1 })).data;
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        payment_method: paymentMethodId,
        preferred_locales: ['fr'],
      });
        console.log("👤 Nouveau client créé :", customer.id);

    }

    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    } catch (err: any) {
      if (err.code !== 'resource_already_exists') console.warn('Attach PM error:', err.message);
    }

    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
      preferred_locales: ['fr'],
    });

    await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);

    const paymentIntents = await Promise.all(
      oneTimeItems.map(it =>
        stripe.paymentIntents.create({
          amount: it.amount,
          currency: 'eur',
          customer: customer.id,
          payment_method: paymentMethodId,
          confirm: false,
          metadata: { reservationIndex: String(it.index) },
        })
      )
    );

    let subscriptionIntent: Stripe.PaymentIntent | null = null;
    if (subscriptionItems.length) {
      const firstItem = subscriptionItems[0];
      const priceId = firstItem.price;

      const isSocieteEngage = priceId === getPriceIdFromProductId("domiciliation-mensuel-societe-reduit");
      const isAutoEngage = priceId === getPriceIdFromProductId("domiciliation-mensuel-auto-entreprise-reduit");

      if (isSocieteEngage || isAutoEngage) {
        const schedule = await stripe.subscriptionSchedules.create({
          customer: customer.id,
          start_date: 'now',
          end_behavior: 'cancel',
          phases: [
            {
              items: [{ price: priceId, quantity: firstItem.quantity || 1 }],
              iterations: 3,
            },
            {
              items: [
                {
                  price: isSocieteEngage
                    ? getPriceIdFromProductId("domiciliation-mensuel-societe-normal")!
                    : getPriceIdFromProductId("domiciliation-mensuel-auto-entrepreneur-normal")!,
                  quantity: firstItem.quantity || 1,
                },
              ],
              iterations: 3,
            },
          ],
        });

        const subscription = await stripe.subscriptions.retrieve(schedule.subscription as string, {
          expand: ['latest_invoice.payment_intent'],
        });

        const invoiceId = (subscription.latest_invoice as Stripe.Invoice).id;
        await stripe.invoices.finalizeInvoice(invoiceId);
        await stripe.invoices.pay(invoiceId);
        const paidInvoice = await stripe.invoices.retrieve(invoiceId, {
          expand: ['payment_intent'],
        });
        subscriptionIntent = paidInvoice.payment_intent as Stripe.PaymentIntent;
      } else {
        const sub = await stripe.subscriptions.create({
          customer: customer.id,
          items: subscriptionItems,
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        });
        subscriptionIntent = (sub.latest_invoice as Stripe.Invoice).payment_intent as Stripe.PaymentIntent;
      }
    }

    const logoUrl = 'https://lys-and-co.com/wp-content/uploads/2025/03/logo-lysco.jpg';
    const clientName = `${firstName} ${lastName}`.trim() || '–';
    const orderLinesHtml = items.map((i: any) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${i.title}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${i.price.toFixed(2)} €</td>
      </tr>
    `).join('');

    const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;background-color:#f9f9f9;padding:20px;">
    <table width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#7bdcb5;">
        <td style="padding:15px;text-align:center;">
          <img src="${logoUrl}" alt="Lys&Co" width="150" style="display:block;margin:0 auto;" />
        </td>
      </tr>
      <tr>
        <td style="padding:20px;">
          <h2 style="color:#f9429e;margin-top:0;">Nouvelle commande Lys & Co</h2>
          <p><strong>Client :</strong> ${clientName} (<a href="mailto:${email}">${email}</a>)</p>
          <p><strong>Adresse :</strong> ${address || '–'}</p>
          <p><strong>SIRET :</strong> ${siretNumber || '–'}</p>
          <table style="border-collapse:collapse;width:100%;margin-top:16px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Article</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:center;">Qté</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Prix</th>
              </tr>
            </thead>
            <tbody>${orderLinesHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:8px;border:1px solid #ddd;text-align:right;"><strong>Total</strong></td>
                <td style="padding:8px;border:1px solid #ddd;text-align:right;"><strong>${total.toFixed(2)} €</strong></td>
              </tr>
            </tfoot>
          </table>
          <p style="margin-top:24px;">Merci,<br/>L’équipe Lys & Co</p>
        </td>
      </tr>
      <tr style="background-color:#f0f0f0;">
        <td style="padding:15px;text-align:center;font-size:12px;color:#777;">
          Lys & Co • <a href="https://lys-and-co.com" style="color:#7bdcb5;text-decoration:none;">Visiter notre site</a>
        </td>
      </tr>
    </table>
  </div>
  `;
    // Génération auto : YYYYMMDD + timestamp court
const now = new Date();
const datePart = now.toISOString().split('T')[0].replace(/-/g, ''); // format YYYYMMDD
const timestamp = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
const invoiceNumber = `INV-${datePart}-${timestamp}`;
const orderNumber = `ORD-${datePart}-${timestamp}`;
const invoiceDate = now.toLocaleDateString('fr-FR');
const orderDate = invoiceDate;
const paymentMethod = 'Carte'; // ou extraire dynamiquement selon le contexte

    const invoiceBuffer = await generateInvoiceBuffer({
      clientName,
      email,
      address,
      siretNumber,
      items,
      total,
      invoiceNumber,
      orderNumber,
      invoiceDate, // formaté en dehors si tu veux personnaliser
      orderDate,
      paymentMethod,
    });

    await transporter.sendMail({
      from: `"Lys&Co" <${process.env.EMAIL_USER}>`,
      to: [email, process.env.RESPONSIBLE_EMAIL],   // destinataires : client + responsable
      subject: 'Nouvelle commande & Facture Lys & Co',
      html: html,                             // même contenu HTML que pour le responsable
      attachments: [
        {
          filename: `facture-${invoiceNumber}.pdf`,
          content: invoiceBuffer,
          contentType: 'application/pdf',
        },
      ],
    });


    return res.status(200).json({
      oneTimePaymentIntents: paymentIntents.map(pi => ({
        index: Number(pi.metadata.reservationIndex),
        id: pi.id,
        clientSecret: pi.client_secret!,
      })),
      subscriptionPaymentIntent: subscriptionIntent
        ? { id: subscriptionIntent.id, clientSecret: subscriptionIntent.client_secret! }
        : null,
    });
  } catch (err: any) {
    console.error('create-payment-intent error:', err);
    return res.status(500).json({ error: err.message });
  }
}
catch(error){
  console.error('error general')
}
}
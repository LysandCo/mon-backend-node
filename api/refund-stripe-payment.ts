// File: api/refund-stripe-payment.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { humanizeReservationType } from '../utils/humanize';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

// Configure nodemailer transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  console.log('Body:', req.body);
  const { paymentIntentId, userEmail, reservationDate, reservationType } = req.body;
  if (!paymentIntentId || !userEmail) {
    console.log('Missing paymentIntentId or userEmail');
    return res.status(400).json({ success: false, error: 'Missing paymentIntentId or userEmail' });
  }

  const humanType = humanizeReservationType(reservationType);
  try {
    // Issue a refund on the provided PaymentIntent
    console.log('Attempting Stripe refund for:', paymentIntentId);
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
    console.log('Stripe refund success:', refund);
    const logoUrl = 'https://lys-and-co.com/wp-content/uploads/2025/03/logo-lysco.jpg';


    // Notify admin via email
    const adminMailHtml = `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;background-color:#f9f9f9;padding:20px;">
    <table width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#7bdcb5;">
        <td style="padding:15px;text-align:center;">
          <img src="${logoUrl}" alt="Lys&Co" width="150" style="display:block;margin:0 auto;" />
        </td>
      </tr>
      <tr>
        <td style="padding:20px;">
          <h2 style="color:#f9429e;margin-top:0;">Nouvelle annulation de réservation</h2>
          <p><strong>Utilisateur :</strong> ${userEmail}</p>
          ${reservationDate ? `<p><strong>Date :</strong> ${new Date(reservationDate).toLocaleDateString('fr-FR')}</p>` : ''}
          ${reservationType ? `<p><strong>Type :</strong> ${reservationType}</p>` : ''}
          <p>La réservation a été annulée et remboursée (PaymentIntent : <code>${paymentIntentId}</code>).</p>
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
    console.log('Sending admin email to:', process.env.RESPONSIBLE_EMAIL);
    await transporter.sendMail({
      from: `"Lys&Co" <${process.env.EMAIL_USER}>`,
      to: process.env.RESPONSIBLE_EMAIL,
      subject: 'Notification d\'annulation de réservation',
      html: adminMailHtml,
    });
    console.log('Admin email sent');

    // Notify customer via email
    const clientMailHtml = `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;background-color:#f9f9f9;padding:20px;">
    <table width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#7bdcb5;">
        <td style="padding:15px;text-align:center;">
          <img src="${logoUrl}" alt="Lys&Co" width="150" style="display:block;margin:0 auto;" />
        </td>
      </tr>
      <tr>
        <td style="padding:20px;">
          <h2 style="color:#f9429e;margin-top:0;">Votre réservation a été annulée</h2>
          <p>Bonjour,</p>
          <p>
            Votre réservation
            ${reservationDate ? `du <strong>${new Date(reservationDate).toLocaleDateString('fr-FR')}</strong>` : ''}
            ${reservationType ? ` (${reservationType})` : ''}
            a bien été annulée.
          </p>
          <p>Le montant a été remboursé sur votre moyen de paiement initial (PaymentIntent : <code>${paymentIntentId}</code>).</p>
          <p>Merci de votre compréhension,<br/>L’équipe Lys & Co</p>
        </td>
      </tr>
      <tr style="background-color:#f0f0f0;">
        <td style="padding:15px;text-align:center;font-size:12px;color:#777;">
          <a href="https://lys-and-co.com" style="color:#7bdcb5;text-decoration:none;">lys-and-co.com</a>
        </td>
      </tr>
    </table>
  </div>
`;
    console.log('Sending client email to:', userEmail);
    await transporter.sendMail({
      from: `"Lys&Co" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Annulation et remboursement de votre réservation',
      html: clientMailHtml,
    });
    console.log('Client email sent');

    return res.status(200).json({ success: true, refund });
  } catch (error: any) {
    console.error('Error in refund-stripe-payment:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

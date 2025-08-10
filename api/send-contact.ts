// // api/send-contact.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Configure transport via environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Récupère tous les champs
    const {
      firstName, lastName, email, subject, message,
      phone, company, serviceType, budget
    } = req.body;

    // Si c'est un contact classique
    if (subject) {
      if (!firstName || !lastName || !email || !subject || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const html = `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background:#f9f9f9;">
          <h2 style="color:#333;">Nouveau message depuis le formulaire de contact</h2>
          <p><strong>Nom :</strong> ${firstName} ${lastName}</p>
          <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Sujet :</strong> ${subject}</p>
          <hr style="margin:20px 0;">
          <p><strong>Message :</strong></p>
          <p style="white-space:pre-line; background:#fff; padding:10px; border-radius:6px; border:1px solid #ccc;">${message}</p>
          <hr style="margin-top:30px;">
          <p style="font-size:12px; color:#888;">Ce message vous a été envoyé via le site <strong>lys-and-co.com</strong>.</p>
        </div>
      `;
      await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
        to: process.env.RESPONSIBLE_EMAIL,
        subject: `Nouveau message de ${firstName} ${lastName} - Sujet: ${subject}`,
        html,
      });
      return res.status(200).json({ status: 'success' });
    }

    // Sinon, c'est une demande de devis
    if (!firstName || !lastName || !email || !phone || !serviceType || !message) {
      return res.status(400).json({ error: 'Missing required fields for quote' });
    }
    const htmlDevis = `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background:#f9f9f9;">
        <h2 style="color:#333;">Nouvelle demande de devis</h2>
        <p><strong>Nom :</strong> ${firstName} ${lastName}</p>
        <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Téléphone :</strong> ${phone}</p>
        <p><strong>Entreprise :</strong> ${company || '-'}</p>
        <p><strong>Type de service :</strong> ${serviceType}</p>
        <p><strong>Budget :</strong> ${budget || '-'}</p>
        <hr style="margin:20px 0;">
        <p><strong>Description du projet :</strong></p>
        <p style="white-space:pre-line; background:#fff; padding:10px; border-radius:6px; border:1px solid #ccc;">${message}</p>
        <hr style="margin-top:30px;">
        <p style="font-size:12px; color:#888;">Cette demande a été envoyée via le site <strong>lys-and-co.com</strong>.</p>
      </div>
    `;
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to: process.env.RESPONSIBLE_EMAIL,
      subject: `Demande de devis de ${firstName} ${lastName}`,
      html: htmlDevis,
    });
    return res.status(200).json({ status: 'success' });

  } catch (err: any) {
    console.error('Error sending mail:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

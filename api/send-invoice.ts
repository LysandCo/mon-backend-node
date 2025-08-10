// api/send-invoice.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { convert } from 'html-to-text';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, fullName, invoiceHtml } = req.body;

    if (!email || !invoiceHtml) {
      return res.status(400).json({ error: 'Missing email or invoice HTML' });
    }

    const pdfPath = join('/tmp', `facture-${Date.now()}.pdf`);

    // Générer le PDF à partir du HTML
    // const browser = await puppeteer.launch({ headless: 'new' });
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(invoiceHtml, { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4' });
    await browser.close();

    const htmlMessage = `
      <p>Bonjour ${fullName || ''},</p>
      <p>Merci pour votre commande chez Lys & Co.</p>
      <p>Veuillez trouver en pièce jointe votre facture au format PDF.</p>
      <p>À très bientôt,<br>L’équipe Lys & Co</p>
    `;

    // Envoi à client + copie à la gérante
    await transporter.sendMail({
      from: `"Lys&Co" <${process.env.EMAIL_USER}>`,
      to: email,
      cc: process.env.RESPONSIBLE_EMAIL,
      subject: '🧾 Votre facture Lys & Co',
      text: convert(htmlMessage),
      html: htmlMessage,
      attachments: [{
        filename: 'facture-lys-and-co.pdf',
        path: pdfPath,
        contentType: 'application/pdf'
      }]
    });

    unlinkSync(pdfPath);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('send-invoice error:', err);
    return res.status(500).json({ error: err.message });
  }
}

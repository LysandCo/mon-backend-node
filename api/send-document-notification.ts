// pages/api/send-document-notification.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// --- 1.1) Configuration de Nodemailer (via variables d’env) ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true, // true si SSL/TLS (ex : 465), false sinon (ex : 587)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- 1.2) Méthode utilitaire pour générer le HTML de l’e-mail ---
function buildHtmlEmail(fileName: string, fileUrl: string) {
  // Ici, un exemple simple. Vous pouvez ajouter un logo, un footer, etc.
  return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;padding:20px; background-color:#f9f9f9;">
        <table width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr style="background-color:#7bdcb5;">
            <td style="padding:15px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;">Lys & Co</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <h2 style="color:#f9429e;">Nouveau document disponible</h2>
              <p>Bonjour,</p>
              <p>Un nouveau document vous a été envoyé. Vous pouvez consulter ou télécharger le fichier en cliquant sur le lien ci-dessous :</p>
              <p>
                <a href="${fileUrl}" target="_blank" style="display:inline-block;padding:10px 20px;background-color:#f9429e;color:#ffffff;text-decoration:none;border-radius:4px;">
                  Voir le document : ${fileName}
                </a>
              </p>
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
}

// --- 1.3) Handler principal de l’API ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autoriser uniquement la méthode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, fileName, fileUrl } = req.body as {
      email?: string;
      fileName?: string;
      fileUrl?: string;
    };

    if (!email || !fileName || !fileUrl) {
      return res.status(400).json({ error: 'Champs manquants : email, fileName ou fileUrl' });
    }

    // Construire le contenu HTML de l’e-mail
    const htmlContent = buildHtmlEmail(fileName, fileUrl);

    // Envoyer l’e-mail
    await transporter.sendMail({
      from: `"Lys & Co" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Nouveau document : ${fileName}`,
      html: htmlContent,
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('send-document-notification error:', err);
    return res.status(500).json({ error: err.message });
  }
}

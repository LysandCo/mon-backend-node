// File: api/disable-account.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ⚙️ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // ✅ NOUVEAU : gérer GET pour Google Play ou humains
  if (req.method === "GET") {
    return res
      .status(200)
      .send(`
        <html>
          <head><title>Suppression de compte - Lys & Co</title></head>
          <body style="font-family:sans-serif;padding:2rem;">
            <h1>Suppression de compte - Lys & Co</h1>
            <p>Vous pouvez demander la suppression de votre compte via l'application Lys & Co.</p>
            <p>Une fois désactivé, votre compte sera supprimé définitivement au bout de 30 jours.</p>
            <p>Les données supprimées incluent : profil, réservations, documents.</p>
            <p>Pour toute question, contactez-nous à <a href="mailto:contact@lys-and-co.com">contact@lys-and-co.com</a>.</p>
          </body>
        </html>
      `);
  }

  // ❌ Si pas POST à ce stade → refus
  if (req.method !== "POST") return res.status(405).end("Méthode non autorisée");

  // 🔁 Désactivation du compte
  const { id, email, first_name, last_name, frontendUrl } = req.body;

  if (!id || !email) {
    return res.status(400).json({ error: "Informations manquantes" });
  }

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: now })
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: "Erreur base de données" });
    }

    // 🔗 Lien de réactivation
    const restoreLink = `lysco://reactiver-mon-compte`;
    // const restoreLink = `${frontendUrl}?user=${id}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color:#f9429e;">Compte désactivé</h2>
        <p>Bonjour ${first_name || ''} ${last_name || ''},</p>
        <p>Votre compte a été désactivé. Il sera supprimé définitivement dans 30 jours.</p>
        <p>Pour réactiver votre compte :</p>
        <button onclick="window.location.href='lysco://reactiver-mon-compte'" style="padding: 10px 20px; background-color: #5cb9bc; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Réactiver mon compte
        </button>
        <p style="margin-top: 10px;">
          Si le bouton ne fonctionne pas, envoyez un mail à l'adresse suivante :
          <a href="mailto:communication.lysconseil@gmail.com">communication.lysconseil@gmail.com</a>
        </p>
        <p style="margin-top:30px;">Merci,<br/>L’équipe Lys & Co</p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Lys&Co" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Votre compte Lys & Co a été désactivé",
      text: `Bonjour ${first_name || ''} ${last_name || ''},

Votre compte a été désactivé. Il sera supprimé définitivement dans 30 jours.

Réactiver mon compte : ${restoreLink}

Merci,
L’équipe Lys & Co`,
      html: htmlContent,
    });

    console.log("✅ E-mail envoyé à", email);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Erreur disable-account :", err);
    return res.status(500).json({ error: "Erreur interne" });
  }
}

// api/delete-old-users.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end("Méthode non autorisée");
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: "Non autorisé" });
}

  const now = new Date();
  const cutoff = new Date(now.setDate(now.getDate() - 30)).toISOString();

  const { data: oldProfiles, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .lte("deleted_at", cutoff)
    .not("deleted_at", "is", null);

  if (error) {
    console.error("❌ Erreur récupération comptes :", error);
    return res.status(500).json({ error: "Erreur récupération comptes expirés" });
  }

  for (const profile of oldProfiles ?? []) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background:#f9f9f9;">
        <h2 style="color:#f9429e;">Votre compte a été supprimé</h2>
        <p>Bonjour ${profile.first_name || ''} ${profile.last_name || ''},</p>
        <p>Votre compte Lys & Co était désactivé depuis 30 jours et vient d’être <strong>supprimé définitivement</strong>.</p>
        <p>Nous vous remercions pour le temps passé avec nous.</p>
        <p>Pour toute question, contactez-nous à <a href="mailto:contact@lys-and-co.com">contact@lys-and-co.com</a>.</p>
        <p style="margin-top:30px;">L’équipe Lys & Co</p>
        <hr style="margin-top:30px;">
        <p style="font-size:12px; color:#888;">Ce message vous a été envoyé automatiquement par <strong>lys-and-co.com</strong>.</p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Lys&Co" <${process.env.EMAIL_USER}>`,
        to: profile.email,
        subject: `Votre compte Lys & Co a été supprimé définitivement`,
        html,
      });

      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(profile.id);

      console.log(`✅ Supprimé & mail : ${profile.email}`);
    } catch (err) {
      console.error(`❌ Erreur traitement ${profile.email}`, err);
    }
  }

  return res.status(200).json({ success: true, deleted: oldProfiles?.length || 0 });
}

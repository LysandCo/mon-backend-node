// // api/reactivate-account.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'Missing user ID' });

  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", user);

  if (error) {
    console.error("Erreur réactivation :", error);
    return res.status(500).json({ error: "Impossible de réactiver le compte." });
  }

  return res.status(200).json({ success: true, message: "Compte réactivé." });
}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { file_path } = req.body;

  if (!file_path) {
    return res.status(400).json({ error: "file_path requis" });
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .remove([file_path]);

  if (error) {
    return res
      .status(500)
      .json({ error: "Erreur suppression fichier", detail: error });
  }

  return res.status(200).json({ success: true, deleted: data });
}

// import type { NextApiRequest, NextApiResponse } from "next";
// import { createClient } from "@supabase/supabase-js";
// import formidable from "formidable";
// import fs from "fs";

// // Désactive le bodyParser intégré de Next.js pour permettre le multipart/form-data
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// // Initialise Supabase avec clé service role
// const supabase = createClient(
//   process.env.SUPABASE_URL as string,
//   process.env.SUPABASE_SERVICE_ROLE_KEY as string
// );

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== "POST") {
//     return res.status(405).json({ error: "Méthode non autorisée" });
//   }

//   const form = formidable({ multiples: false });

//   form.parse(req, async (err, fields, files) => {
//     if (err) {
//       console.error("Erreur parsing formulaire :", err);
//       return res.status(500).json({ error: "Erreur parsing formulaire" });
//     }

//     const userId = Array.isArray(fields.user_id) ? fields.user_id[0] : fields.user_id;
//     const rawFile = files.file;

//     if (!rawFile) {
//       return res.status(400).json({ error: "Fichier manquant" });
//     }

//     const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;
//     if (!file || typeof file.filepath !== "string") {
//       return res.status(400).json({ error: "Fichier invalide" });
//     }

//     const fileData = fs.readFileSync(file.filepath);
//     const fileName = file.originalFilename || "document.pdf";
//     const filePath = `${userId}/${fileName}`;

//     // Upload dans Supabase Storage
//     const { error: uploadError } = await supabase.storage
//       .from("documents")
//       .upload(filePath, fileData, {
//         contentType: file.mimetype || "application/octet-stream",
//         upsert: true,
//       });

//     if (uploadError) {
//       console.error("Erreur upload storage :", uploadError);
//       return res.status(500).json({ error: "Erreur upload Supabase Storage" });
//     }

//     // Récupère l'URL publique
//     const { data: publicUrl } = supabase.storage
//       .from("documents")
//       .getPublicUrl(filePath);

//     // Insertion en base
//     const { data: insertedDoc, error: insertError } = await supabase
//       .from("user_documents")
//       .insert({
//         user_id: userId,
//         file_name: fileName,
//         file_url: publicUrl.publicUrl,
//       })
//       .single();

//     if (insertError) {
//       console.error("Erreur insertion base :", insertError);
//       return res.status(500).json({ error: "Erreur insertion BDD" });
//     }

//     return res.status(200).json({ file: insertedDoc });
//   });
// }



import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

// 🔒 Désactiver le bodyParser pour gérer les fichiers
export const config = {
  api: {
    bodyParser: false,
  },
};

// 🔑 Connexion Supabase avec service role
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erreur parsing formulaire :", err);
      return res.status(500).json({ error: "Erreur parsing formulaire" });
    }

    const userId = Array.isArray(fields.user_id) ? fields.user_id[0] : fields.user_id;
    const rawFile = files.file;

    if (!rawFile) {
      return res.status(400).json({ error: "Fichier manquant" });
    }

    const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;
    if (!file || typeof file.filepath !== "string") {
      return res.status(400).json({ error: "Fichier invalide" });
    }

    const fileData = fs.readFileSync(file.filepath);
    const fileName = file.originalFilename || "document.pdf";
    const filePath = `${userId}/${fileName}`;

    // 📤 Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, fileData, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erreur upload storage :", uploadError);
      return res.status(500).json({ error: "Erreur upload Supabase Storage" });
    }

    // 🔗 Obtenir URL publique
    const { data: publicUrl } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    // 🗃️ Insertion en base
    const { data: insertedDoc, error: insertError } = await supabase
      .from("user_documents")
      .insert({
        user_id: userId,
        file_name: fileName,
        file_url: publicUrl.publicUrl,
      })
      .single();

    if (insertError) {
      console.error("Erreur insertion base :", insertError);
      return res.status(500).json({ error: "Erreur insertion BDD" });
    }

    // 📧 Récupérer email utilisateur
    const { data: userData, error: userError } = await supabase
      .from("profiles") // ⬅️ Remplace par ta vraie table utilisateurs si différent
      .select("email")
      .eq("id", userId)
      .single();

    if (userError || !userData?.email) {
      console.error("❌ Email utilisateur introuvable :", userError);
      return res.status(500).json({ error: "Email utilisateur introuvable" });
    }

    // 📮 Appel API de notification
    try {
      const apiUrl =
        process.env.VERCEL_URL || "https://mon-backend-node.vercel.app";

      const mailRes = await fetch(`${apiUrl}/api/send-document-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          fileName,
          fileUrl: publicUrl.publicUrl,
        }),
      });

      const mailJson = await mailRes.json();

      if (!mailRes.ok) {
        console.error("Erreur envoi e-mail :", mailJson.error);
      } else {
        console.log("✅ E-mail envoyé à :", userData.email);
      }
    } catch (mailErr) {
      console.error("Erreur exception e-mail :", mailErr);
    }

    return res.status(200).json({ file: insertedDoc });
  });
}

// src/utils/humanizeReservationType.ts
export function humanizeReservationType(raw: string): string {
  // on capture 3 groupes : 
  // 1) le "slug" produit (ex: "formation-room")
  // 2) la date (qu’on ignore)
  // 3) le créneau ("morning"|"afternoon")
  const m = raw.match(/^(.+)-\d{4}-\d{2}-\d{2}-(morning|afternoon)$/);
  if (!m) {
    // fallback basique : transforme tous les "-" en " "
    return raw.replace(/-/g, ' ');
  }
  const [_, slug, periodKey] = m;

  // map slug → libellé FR (optionnel mais conseillé)
  const nameMap: Record<string,string> = {
    'formation-room': 'Salle de formation',
    'location-bureau': 'Location bureau',
    'coworking-space': 'Espace coworking',
    // ajoutez vos autres mappings ici…
  };
  const base = nameMap[slug] ?? slug.replace(/-/g, ' ');

  // map créneau
  const periodMap: Record<string,string> = {
    morning:   'matin',
    afternoon: 'après-midi',
  };
  const period = periodMap[periodKey];

  return `${base} ${period}`;
}

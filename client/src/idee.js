// « Idée du soir » : un seul titre à proposer, parmi ceux qu'on a mis « à voir » et qui
// sont déjà sortis. Pur et sans réseau.

import { isUpcoming } from './status.js';

// Générateur pseudo-aléatoire à graine : même graine, même suite.
function mulberry32(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hachage(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cleDe = (i) => `${i.mediaType}-${i.id}`;

// Date du jour à l'heure locale, « AAAA-MM-JJ » : l'idée change à minuit chez toi.
export function aujourdhui(maintenant = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}

// Les candidats : « à voir » et déjà sortis. Les séries en cours ont leur rangée « Reprendre ».
export function candidatsIdee(items) {
  return items.filter((i) => i.status === 'a_voir' && !isUpcoming(i));
}

// Le titre proposé. `rang` passe à l'idée suivante du même tirage : tant qu'il reste des
// candidats, deux rangs différents donnent deux titres différents ; au-delà on reboucle.
// Le tirage ne dépend que du profil, du jour et de l'ensemble des candidats (pas de leur ordre).
export function ideeDuSoir(items, { profileId, date, rang = 0 }) {
  const candidats = candidatsIdee(items).sort((a, b) => (cleDe(a) < cleDe(b) ? -1 : 1));
  if (candidats.length === 0) return null;
  const hasard = mulberry32(hachage(`${profileId}|${date}`));
  for (let i = candidats.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [candidats[i], candidats[j]] = [candidats[j], candidats[i]];
  }
  return candidats[((rang % candidats.length) + candidats.length) % candidats.length];
}

// « depuis 3 semaines » : depuis quand un titre attend dans la liste. `addedAt` est la date
// de la base (« AAAA-MM-JJ HH:MM:SS », en UTC). Rien si la date manque ou est illisible.
export function depuisLibelle(addedAt, maintenant = new Date()) {
  if (!addedAt) return null;
  const debut = new Date(`${String(addedAt).replace(' ', 'T')}Z`);
  if (Number.isNaN(debut.getTime())) return null;
  const jours = Math.floor((maintenant.getTime() - debut.getTime()) / 86400000);
  if (jours < 1) return "ajouté aujourd'hui";
  if (jours === 1) return 'depuis hier';
  if (jours < 14) return `depuis ${jours} jours`;
  if (jours < 60) return `depuis ${Math.floor(jours / 7)} semaines`;
  if (jours < 365) return `depuis ${Math.floor(jours / 30)} mois`;
  return "depuis plus d'un an";
}

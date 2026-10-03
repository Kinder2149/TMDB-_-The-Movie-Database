// Logique — profil partagé (amis par code). Cadrage : PLAN_V2.md, point 4 bis.
//
// Un profil peut publier une **fiche** : son pseudo, son avatar, ses titres avec
// leurs étoiles, et ses listes — sauf celles marquées « privées ». Jamais d'avis
// écrit, jamais de date. Facultatif, désactivé par défaut : tant qu'on n'active
// rien, rien ne quitte le téléphone.
//
// Ce fichier décide *quoi* publier et tient l'état local (code ami, clé secrète,
// réglages). Le dépôt lui-même est dans `firebase.js`.

import { reduirePhoto, MAX_AVATAR } from './photo.js';
import { query, run } from './db.js';
import { listSuivi } from './store.js';
import * as service from './firebase.js';

export const STATUTS = ['a_voir', 'en_cours', 'vu', 'abandonne'];
export const MAX_TITRES = 5000; // même plafond que les règles de sécurité
export const MAX_LISTES = 50;
export const PSEUDO_MAX = 24;

// Sans 0/O ni 1/I : un code se lit, se dicte, se recopie.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function aleatoire(n) {
  const octets = new Uint8Array(n);
  crypto.getRandomValues(octets);
  // 256 est un multiple de 32 : aucun biais.
  return Array.from(octets, (o) => ALPHABET[o % 32]).join('');
}

export const genererCode = () => aleatoire(12); // ~10^18 combinaisons
export const genererCle = () => aleatoire(20); // ~10^30 : c'est le code de récupération

// K7F2M9QX3DTB -> K7F2-M9QX-3DTB
export const formater = (c) => (c || '').match(/.{1,4}/g)?.join('-') || '';
// Ce que l'utilisateur tape (minuscules, tirets, espaces) -> le code réel.
export const normaliser = (saisie) => (saisie || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const codeValide = (c) => /^[A-HJ-NP-Z2-9]{12}$/.test(c || '');

// Empreinte SHA-256 en hexadécimal **minuscule** : celle que les règles comparent.
export async function empreinte(texte) {
  const octets = new TextEncoder().encode(texte);
  const hash = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(hash), (o) => o.toString(16).padStart(2, '0')).join('');
}

// --- État local ---

function lire(ligne) {
  if (!ligne) return null;
  return {
    actif: !!ligne.actif,
    code: ligne.code,
    cle: ligne.cle,
    pseudo: ligne.pseudo,
    statutsPrives: ligne.statuts_prives ? ligne.statuts_prives.split(',') : [],
    derniereMaj: ligne.maj || null,
  };
}

export async function getPartage(profileId) {
  const [ligne] = await query('SELECT * FROM partage WHERE profile_id = ?', [profileId]);
  return lire(ligne);
}

export const configure = () => service.isConfigured();

// --- La fiche ---

// Ce qu'on publie pour ce profil. Un titre n'apparaît que s'il figure dans au
// moins une liste publique (son statut, ou une liste créée à la main) ; il n'est
// écrit qu'une fois, les listes pointent vers lui par sa position. Une liste
// privée n'est pas masquée : elle n'est tout simplement pas là.
export async function construireFiche(profileId, partage, avatar) {
  const suivi = await listSuivi(profileId); // du plus récent au plus ancien
  const listesRows = await query(
    'SELECT id, name FROM listes WHERE profile_id = ? AND prive = 0 ORDER BY created_at',
    [profileId]
  );
  const liens = await query(
    'SELECT liste_id AS listeId, tmdb_id AS id, media_type AS mediaType FROM liste_items WHERE profile_id = ?',
    [profileId]
  );

  const cle = (mediaType, id) => `${mediaType}-${id}`;
  const parListe = new Map();
  for (const l of liens) {
    if (!parListe.has(l.listeId)) parListe.set(l.listeId, new Set());
    parListe.get(l.listeId).add(cle(l.mediaType, l.id));
  }

  const statutsPublics = STATUTS.filter((s) => !partage.statutsPrives.includes(s));
  const listes = [];
  for (const s of statutsPublics) {
    const ids = suivi.filter((t) => (t.status || 'a_voir') === s).map((t) => cle(t.mediaType, t.id));
    if (ids.length) listes.push({ k: 's', n: s, ids });
  }
  for (const l of listesRows) {
    listes.push({ k: 'l', n: l.name, ids: [...(parListe.get(l.id) || [])] });
  }
  const listesGardees = listes.slice(0, MAX_LISTES);

  // Les titres : ceux qui sont dans une liste gardée, dans l'ordre du suivi.
  const voulus = new Set(listesGardees.flatMap((l) => l.ids));
  const titres = [];
  const position = new Map();
  let tronque = listes.length > MAX_LISTES;
  for (const t of suivi) {
    const k = cle(t.mediaType, t.id);
    if (!voulus.has(k)) continue;
    if (titres.length >= MAX_TITRES) {
      tronque = true;
      continue;
    }
    position.set(k, titres.length);
    titres.push(`${t.mediaType === 'movie' ? 'm' : 't'}${t.id}:${t.rating || 0}`);
  }

  return {
    tronque,
    fiche: {
      v: 1,
      pseudo: partage.pseudo,
      avatar: avatar || '',
      titres,
      listes: listesGardees.map((l) => ({
        k: l.k,
        n: l.n,
        // Position dans `titres` ; un titre écarté par le plafond disparaît de la liste.
        ids: l.ids.map((k) => position.get(k)).filter((p) => p !== undefined),
      })),
    },
  };
}

// Ce que les amis voient de ton avatar : « couleur:symbole » tel quel ; pour une photo, une
// miniature de 48 px (quelques kilo-octets), jamais la photo elle-même. Si la miniature ne
// peut pas être faite, ils voient l'initiale de ton pseudo.
async function avatarDe(profileId) {
  const [p] = await query('SELECT avatar FROM profiles WHERE id = ?', [profileId]);
  const v = p?.avatar || '';
  if (v.startsWith('data:image/')) {
    const mini = await reduirePhoto(v);
    return mini.startsWith('data:image/jpeg;base64,') && mini.length <= MAX_AVATAR ? mini : '';
  }
  return v.length > 40 ? '' : v;
}

// Envoie la fiche si elle a changé depuis le dernier envoi. `force` : toujours.
// Renvoie { envoye, tronque }.
async function envoyer(profileId, partage, { force = false } = {}) {
  const { fiche, tronque } = await construireFiche(profileId, partage, await avatarDe(profileId));
  const marque = await empreinte(JSON.stringify(fiche) + partage.code);
  const [ligne] = await query('SELECT empreinte FROM partage WHERE profile_id = ?', [profileId]);
  if (!force && ligne?.empreinte === marque) return { envoye: false, tronque };

  await service.publier(partage.code, partage.cle, { ...fiche, cleHash: await empreinte(partage.cle) });
  await run(`UPDATE partage SET empreinte = ?, maj = datetime('now') WHERE profile_id = ?`, [
    marque,
    profileId,
  ]);
  return { envoye: true, tronque };
}

// --- Actions ---

function pseudoValide(pseudo) {
  const p = (pseudo || '').trim();
  if (!p) throw new Error('Choisis un pseudo.');
  if (p.length > PSEUDO_MAX) throw new Error(`Le pseudo fait ${PSEUDO_MAX} caractères au plus.`);
  return p;
}

// Active le partage. La ligne locale (donc la clé) est écrite **avant** l'envoi :
// si l'envoi échoue, la clé n'est pas perdue et le prochain essai reprend la même fiche.
export async function activer(profileId, pseudo) {
  const p = pseudoValide(pseudo);
  let partage = await getPartage(profileId);
  if (!partage) {
    await run(
      `INSERT INTO partage (profile_id, code, cle, pseudo, actif) VALUES (?, ?, ?, ?, 0)`,
      [profileId, genererCode(), genererCle(), p]
    );
  } else {
    await run('UPDATE partage SET pseudo = ? WHERE profile_id = ?', [p, profileId]);
  }
  partage = await getPartage(profileId);
  const res = await envoyer(profileId, partage, { force: true });
  await run('UPDATE partage SET actif = 1 WHERE profile_id = ?', [profileId]);
  return { partage: await getPartage(profileId), tronque: res.tronque };
}

// Retrouver sa fiche sur un nouvel appareil (réinstallation, téléphone changé) avec le
// code ami et le code de récupération, quand la sauvegarde Drive n'a pas pu les rendre.
// On vérifie d'abord, sans rien écrire, que la clé correspond bien à la fiche en ligne :
// une faute de frappe ne doit pas créer un état local inutilisable. La fiche en ligne
// est ensuite remplacée par ce que contient CET appareil.
export async function retrouver(profileId, saisieCode, saisieCle) {
  if (await getPartage(profileId)) throw new Error('Le partage est déjà actif sur ce profil.');
  const code = normaliser(saisieCode);
  const cle = normaliser(saisieCle);
  if (!codeValide(code)) throw new Error('Le code ami n’est pas valide (12 caractères).');
  if (!/^[A-HJ-NP-Z2-9]{20}$/.test(cle)) {
    throw new Error('Le code de récupération n’est pas valide (20 caractères).');
  }
  const enLigne = await service.lire(code);
  if (!enLigne) throw new Error('Aucune fiche ne correspond à ce code ami (peut-être supprimée).');
  if (enLigne.cleHash !== (await empreinte(cle))) {
    throw new Error('Ce code de récupération ne correspond pas à cette fiche.');
  }
  const pseudo = typeof enLigne.pseudo === 'string' && enLigne.pseudo ? enLigne.pseudo.slice(0, PSEUDO_MAX) : 'Moi';
  await run(
    `INSERT INTO partage (profile_id, code, cle, pseudo, actif) VALUES (?, ?, ?, ?, 0)`,
    [profileId, code, cle, pseudo]
  );
  const res = await envoyer(profileId, await getPartage(profileId), { force: true });
  await run('UPDATE partage SET actif = 1 WHERE profile_id = ?', [profileId]);
  return { partage: await getPartage(profileId), tronque: res.tronque };
}

// Retire la fiche du serveur **puis** efface l'état local. Si le réseau manque, on
// s'arrête avant : effacer la clé en local laisserait une fiche orpheline en ligne,
// impossible à retirer ensuite.
export async function desactiver(profileId) {
  const partage = await getPartage(profileId);
  if (!partage) return;
  await service.retirer(partage.code, partage.cle);
  await run('DELETE FROM partage WHERE profile_id = ?', [profileId]);
}

export async function changerPseudo(profileId, pseudo) {
  const p = pseudoValide(pseudo);
  await run('UPDATE partage SET pseudo = ? WHERE profile_id = ?', [p, profileId]);
  return publierSiActif(profileId);
}

export async function setStatutPrive(profileId, statut, prive) {
  if (!STATUTS.includes(statut)) throw new Error('Statut inconnu.');
  const partage = await getPartage(profileId);
  if (!partage) throw new Error('Le partage n’est pas activé.');
  const liste = new Set(partage.statutsPrives);
  if (prive) liste.add(statut);
  else liste.delete(statut);
  await run('UPDATE partage SET statuts_prives = ? WHERE profile_id = ?', [
    [...liste].join(','),
    profileId,
  ]);
  return publierSiActif(profileId);
}

// Met la fiche à jour si le partage est actif. Silencieux quand il ne l'est pas.
export async function publierSiActif(profileId, options) {
  const partage = await getPartage(profileId);
  if (!partage?.actif) return { envoye: false, tronque: false };
  return envoyer(profileId, partage, options);
}

// Mise à jour discrète (en quittant, en revenant) : jamais d'erreur à l'écran.
export async function publierAutomatique(profileId) {
  try {
    return await publierSiActif(profileId);
  } catch {
    return { envoye: false, tronque: false };
  }
}

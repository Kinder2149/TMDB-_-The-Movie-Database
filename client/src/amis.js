// Logique — amis suivis par code. Cadrage : PLAN_V2.md, point 4 bis.
//
// Un ami, c'est un code. Le suivi est à sens unique (comme Letterboxd) : on lit la
// fiche de quelqu'un sans qu'il en soit prévenu ni qu'il ait à accepter, et il ne
// sait pas qu'on le lit. La liste de nos amis reste sur le téléphone ; le serveur
// ne garde aucun réseau social, seulement les fiches.
//
// Les fiches viennent d'autres utilisateurs : tout ce qu'on en lit est nettoyé
// (`decoder`) avant d'être gardé ou affiché.

import { query, run } from './db.js';
import { getCardInfo } from './tmdb.js';
import { TMDB_LANG, getCatalogLanguage, getCatalogRegion } from './lang.js';
import * as service from './firebase.js';
import { normaliser, codeValide } from './partage.js';
import { MAX_AVATAR } from './photo.js';

export const MAX_AMIS = 100;
export const DELAI_CACHE = 60 * 60 * 1000; // une fiche n'est pas relue plus d'une fois par heure
// Secondes, pas millisecondes : un entier de 13 chiffres déborde sur certains moteurs SQLite.
const maintenant = () => Math.floor(Date.now() / 1000);

const texte = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// L'avatar d'un ami n'est accepté que sous deux formes sûres : « couleur:symbole » (court) ou
// une miniature JPEG encodée en texte, de taille bornée. Tout le reste est ignoré : l'écran
// retombe alors sur l'initiale du pseudo.
const MINIATURE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const COULEUR_SYMBOLE = /^[a-z]{1,12}:[a-z]{1,12}$/;
export function avatarSur(v) {
  if (typeof v !== 'string') return '';
  if (COULEUR_SYMBOLE.test(v)) return v;
  return v.length <= MAX_AVATAR && MINIATURE.test(v) ? v : '';
}

// Fiche brute du serveur -> ce que l'écran affiche. Rien n'est fait confiance : les
// titres doivent avoir la forme exacte « m603:5 », les listes pointent des positions
// existantes, les textes sont tronqués.
export function decoder(brut) {
  const titres = (Array.isArray(brut?.titres) ? brut.titres : []).map((t) => {
    const m = /^([mt])(\d{1,9}):([0-5])$/.exec(String(t));
    return m ? { mediaType: m[1] === 'm' ? 'movie' : 'tv', id: Number(m[2]), rating: Number(m[3]) || null } : null;
  });
  const listes = (Array.isArray(brut?.listes) ? brut.listes : []).slice(0, 50).map((l) => ({
    kind: l?.k === 's' ? 'statut' : 'liste',
    nom: texte(l?.n, 60),
    items: (Array.isArray(l?.ids) ? l.ids : []).map((i) => titres[i]).filter(Boolean),
  }));
  return {
    pseudo: texte(brut?.pseudo, 24) || 'Ami',
    avatar: avatarSur(brut?.avatar),
    listes,
    nbTitres: titres.filter(Boolean).length,
    maj: Number.isFinite(brut?.maj) ? brut.maj : null,
  };
}

// --- Liste d'amis ---

export function listerAmis(profileId) {
  return query(
    `SELECT code, pseudo, avatar, ajoute, disparu FROM amis
     WHERE profile_id = ? ORDER BY pseudo COLLATE NOCASE`,
    [profileId]
  );
}

export async function ajouterAmi(profileId, saisie) {
  const code = normaliser(saisie);
  if (!codeValide(code)) {
    throw new Error('Ce code n’est pas valide : il fait 12 caractères, par exemple K7F2-M9QX-3DTB.');
  }
  const [mien] = await query('SELECT profile_id FROM partage WHERE code = ?', [code]);
  if (mien) throw new Error('C’est le code d’un de tes propres profils.');

  const [deja] = await query('SELECT code FROM amis WHERE profile_id = ? AND code = ?', [profileId, code]);
  if (deja) throw new Error('Cet ami est déjà dans ta liste.');
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM amis WHERE profile_id = ?', [profileId]);
  if (n >= MAX_AMIS) throw new Error(`Tu peux suivre ${MAX_AMIS} amis au plus.`);

  const brut = await service.lire(code);
  if (!brut) throw new Error('Aucune fiche ne correspond à ce code. Vérifie qu’il est bien recopié.');
  const fiche = decoder(brut);
  await run(
    `INSERT INTO amis (profile_id, code, pseudo, avatar, fiche, lu) VALUES (?, ?, ?, ?, ?, ?)`,
    [profileId, code, fiche.pseudo, fiche.avatar, JSON.stringify(fiche), maintenant()]
  );
  return { code, pseudo: fiche.pseudo, avatar: fiche.avatar };
}

export async function retirerAmi(profileId, code) {
  await run('DELETE FROM amis WHERE profile_id = ? AND code = ?', [profileId, code]);
}

// La fiche d'un ami : la copie du téléphone si elle a moins d'une heure, sinon le
// serveur. Hors connexion, on garde la copie (signalée `horsLigne`) plutôt que rien.
// `disparu` : l'ami a supprimé sa fiche (ou changé de code) — on le dit, sans l'effacer.
export async function ouvrirAmi(profileId, code, { force = false } = {}) {
  const [ligne] = await query('SELECT * FROM amis WHERE profile_id = ? AND code = ?', [profileId, code]);
  if (!ligne) throw new Error('Cet ami n’est plus dans ta liste.');
  const copie = ligne.fiche ? JSON.parse(ligne.fiche) : null;

  if (copie && !ligne.disparu && !force && (maintenant() - (ligne.lu || 0)) * 1000 < DELAI_CACHE) {
    return { ...copie, code };
  }
  try {
    const brut = await service.lire(code);
    if (!brut) {
      await run('UPDATE amis SET disparu = 1 WHERE profile_id = ? AND code = ?', [profileId, code]);
      return { code, pseudo: ligne.pseudo, avatar: ligne.avatar || '', listes: [], nbTitres: 0, disparu: true };
    }
    const fiche = decoder(brut);
    await run(
      `UPDATE amis SET pseudo = ?, avatar = ?, fiche = ?, lu = ?, disparu = 0
       WHERE profile_id = ? AND code = ?`,
      [fiche.pseudo, fiche.avatar, JSON.stringify(fiche), maintenant(), profileId, code]
    );
    return { ...fiche, code };
  } catch (e) {
    if (copie) return { ...copie, code, horsLigne: true };
    throw e;
  }
}

// --- Affiches ---
//
// Une fiche ne contient que des identifiants : titres et affiches viennent de TMDB, par
// lots de 5 (ni un par un, trop lent, ni tout d'un coup, TMDB coupe) et mémorisés pour
// la séance. Un titre introuvable est simplement absent du résultat.
const cartes = new Map();

export async function chargerCartes(items) {
  const langue = getCatalogLanguage();
  const cle = (it) => `${langue}:${it.mediaType}-${it.id}`;
  const manquants = items.filter((it) => !cartes.has(cle(it)));
  for (let i = 0; i < manquants.length; i += 5) {
    await Promise.all(
      manquants.slice(i, i + 5).map((it) =>
        getCardInfo(it.mediaType, it.id, TMDB_LANG[langue], getCatalogRegion(langue))
          .then((c) => cartes.set(cle(it), c))
          .catch(() => {})
      )
    );
  }
  return items
    .map((it) => (cartes.has(cle(it)) ? { ...cartes.get(cle(it)), rating: it.rating } : null))
    .filter(Boolean);
}

// --- « Chez tes amis » (rayon de Découvrir) ---
//
// Ce que tes amis ont aimé : leurs titres notés 4 ou 5 étoiles, et ceux qu'ils ont
// vus sans les noter (comptés pour un 3, une approbation tiède). Classés d'abord par
// le nombre d'amis qui l'ont aimé, puis par la somme de leurs notes. Les fiches sont
// lues par la même porte que l'écran d'un ami (copie d'une heure) ; celle d'un ami
// injoignable est simplement ignorée.
const SANS_NOTE = 3;

export async function recommandationsAmis(profileId, { max = 60 } = {}) {
  const liste = await listerAmis(profileId);
  const fiches = [];
  for (let i = 0; i < liste.length; i += 5) {
    const lot = await Promise.all(
      liste.slice(i, i + 5).map((a) =>
        ouvrirAmi(profileId, a.code)
          .then((f) => (f.disparu ? null : f))
          .catch(() => null)
      )
    );
    fiches.push(...lot.filter(Boolean));
  }

  const parTitre = new Map();
  for (const f of fiches) {
    const vusParCetAmi = new Map();
    for (const l of f.listes) {
      for (const it of l.items) {
        const cle = `${it.mediaType}-${it.id}`;
        const note = it.rating || (l.kind === 'statut' && l.nom === 'vu' ? SANS_NOTE : 0);
        if (note && note >= (vusParCetAmi.get(cle)?.note || 0)) {
          vusParCetAmi.set(cle, { mediaType: it.mediaType, id: it.id, note, rated: !!it.rating });
        }
      }
    }
    for (const [cle, v] of vusParCetAmi) {
      if (v.note < SANS_NOTE) continue; // 1 ou 2 étoiles : il n'a pas aimé
      if (!parTitre.has(cle)) parTitre.set(cle, { mediaType: v.mediaType, id: v.id, amis: [] });
      parTitre.get(cle).amis.push({ pseudo: f.pseudo, rating: v.rated ? v.note : null, note: v.note });
    }
  }

  return [...parTitre.values()]
    .sort(
      (a, b) =>
        b.amis.length - a.amis.length ||
        b.amis.reduce((s, x) => s + x.note, 0) - a.amis.reduce((s, x) => s + x.note, 0)
    )
    .slice(0, max)
    .map(({ mediaType, id, amis }) => ({
      mediaType,
      id,
      amis: amis.map(({ pseudo, rating }) => ({ pseudo, rating })),
    }));
}

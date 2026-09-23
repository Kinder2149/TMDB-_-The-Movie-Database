// Filtres et tris de la recherche (M2). Logique pure : pas de réseau, pas d'écran.
//
// Deux usages :
//  - « Explorer » : les filtres partent chez TMDB (`discover`), qui sait tout faire.
//  - « Titre » et « Acteur » : TMDB ne filtre pas ces listes. On filtre et on trie
//    ce qui est déjà affiché, avec `appliquerFiltres` — sans plateforme.

// Périodes proposées, d'un appui chacune. `from` / `to` sont des bornes de date
// (AAAA-MM-JJ) ; une borne absente veut dire « sans limite ».
export const PERIODES = [
  { key: 'annee', label: 'Cette année' },
  { key: '2020s', label: '2020s' },
  { key: '2010s', label: '2010s' },
  { key: '2000s', label: '2000s' },
  { key: '1990s', label: '90s' },
  { key: 'avant1990', label: 'Avant 1990' },
];

export const TRIS = [
  { key: 'popularite', label: 'Popularité' },
  { key: 'recent', label: 'Plus récent' },
  { key: 'ancien', label: 'Plus ancien' },
  { key: 'notes', label: 'Mieux notés' },
];

export const FILTRES_VIDES = Object.freeze({
  periode: null,
  tri: 'popularite',
  plateformes: [],
});

// --- Ma bibliothèque (« Mes listes », M3) ---
//
// Ici tout se fait sur ce qu'on a déjà en base : pas de plateforme (elle change
// avec le temps) ni de genre (pas stocké). « Ajouté récemment » est l'ordre reçu
// de la base : on le laisse tel quel.
export const TRIS_BIBLIO = [
  { key: 'ajout', label: 'Ajouté récemment' },
  { key: 'titre', label: 'Titre A → Z' },
  { key: 'sortie_recente', label: 'Sortie récente' },
  { key: 'sortie_ancienne', label: 'Sortie ancienne' },
  { key: 'note', label: 'Ma note' },
];

export const NOTES_BIBLIO = [
  { key: 'bien', label: '4 étoiles et plus' },
  { key: 'non', label: 'Pas encore noté' },
];

export const FILTRES_BIBLIO_VIDES = Object.freeze({
  periode: null,
  tri: 'ajout',
  note: null,
});

export function filtresBiblioActifs(f) {
  return !!f && (!!f.periode || !!f.note || f.tri !== 'ajout');
}

// Filtre et trie une liste de la bibliothèque. Sans date de sortie, un titre
// est écarté par un filtre d'année et passe en dernier d'un tri par date ; sans
// note, il passe en dernier du tri par note. À égalité, l'ordre reçu est gardé.
export function appliquerFiltresBiblio(items, filtres, aujourdhui = new Date()) {
  const { periode, tri, note } = filtres;
  let liste = items.map((it, i) => ({ it, i }));

  if (periode) {
    const { from, to } = bornesDePeriode(periode, aujourdhui);
    liste = liste.filter(({ it }) => {
      const d = it.releaseDate;
      return !!d && (!from || d >= from) && (!to || d <= to);
    });
  }
  if (note === 'bien') liste = liste.filter(({ it }) => (it.rating ?? 0) >= 4);
  if (note === 'non') liste = liste.filter(({ it }) => !it.rating);

  const parDate = (sens) => (a, b) => {
    const x = a.it.releaseDate;
    const y = b.it.releaseDate;
    if (!x || !y) return !x && !y ? 0 : !x ? 1 : -1;
    return x === y ? 0 : (x < y ? -1 : 1) * sens;
  };
  const comparateurs = {
    titre: (a, b) => a.it.title.localeCompare(b.it.title, 'fr'),
    sortie_recente: parDate(-1),
    sortie_ancienne: parDate(1),
    note: (a, b) => {
      const x = a.it.rating;
      const y = b.it.rating;
      if (!x || !y) return !x && !y ? 0 : !x ? 1 : -1;
      return y - x;
    },
  };
  const cmp = comparateurs[tri];
  if (cmp) liste.sort((a, b) => cmp(a, b) || a.i - b.i);
  return liste.map(({ it }) => it);
}

// Un titre à peine noté (un vote à 10/10) ne doit pas passer devant un classique.
export const VOTES_MIN = { notes: 300, ancien: 100 };

const iso = (d) => d.toISOString().slice(0, 10);

// Date du jour au format AAAA-MM-JJ, ou décalée de `jours`.
export function dateRelative(jours = 0, aujourdhui = new Date()) {
  const d = new Date(aujourdhui);
  d.setUTCDate(d.getUTCDate() + jours);
  return iso(d);
}

// Bornes d'une période. `aujourdhui` est injectable pour les tests.
export function bornesDePeriode(key, aujourdhui = new Date()) {
  const annee = aujourdhui.getUTCFullYear();
  switch (key) {
    case 'annee':
      return { from: `${annee}-01-01`, to: `${annee}-12-31` };
    case '2020s':
      return { from: '2020-01-01', to: '2029-12-31' };
    case '2010s':
      return { from: '2010-01-01', to: '2019-12-31' };
    case '2000s':
      return { from: '2000-01-01', to: '2009-12-31' };
    case '1990s':
      return { from: '1990-01-01', to: '1999-12-31' };
    case 'avant1990':
      return { from: null, to: '1989-12-31' };
    default:
      return { from: null, to: null };
  }
}

// Vrai dès qu'un filtre s'écarte de l'état de départ (le point sur « Filtres »).
export function filtresActifs(f) {
  return !!f && (!!f.periode || f.tri !== 'popularite' || f.plateformes.length > 0);
}

// Filtre et trie une liste déjà affichée (modes Titre et Acteur).
//  - Période : on garde les titres dont la date de sortie y tombe ; sans date, on écarte.
//  - Popularité : on ne touche pas à l'ordre reçu (pertinence ou popularité de TMDB).
//  - Plus récent : les titres déjà sortis d'abord, du plus récent au plus ancien ;
//    ceux pas encore sortis (ou sans date) à la fin — comme dans Explorer.
//  - Mieux notés : par note décroissante ; sous le seuil de votes, à la fin.
export function appliquerFiltres(items, filtres, aujourdhui = new Date()) {
  const { periode, tri } = filtres;
  let liste = items;

  if (periode) {
    const { from, to } = bornesDePeriode(periode, aujourdhui);
    liste = liste.filter((it) => {
      const d = it.releaseDate;
      return !!d && (!from || d >= from) && (!to || d <= to);
    });
  }

  const auj = iso(aujourdhui);
  const rang = (it) => liste.indexOf(it);
  const copie = [...liste];

  if (tri === 'recent' || tri === 'ancien') {
    const sorti = (it) => !!it.releaseDate && it.releaseDate <= auj;
    copie.sort((a, b) => {
      if (sorti(a) !== sorti(b)) return sorti(a) ? -1 : 1;
      if (!sorti(a)) return rang(a) - rang(b);
      const ordre = a.releaseDate < b.releaseDate ? -1 : a.releaseDate > b.releaseDate ? 1 : 0;
      return tri === 'recent' ? -ordre : ordre;
    });
  } else if (tri === 'notes') {
    const fiable = (it) => (it.votes ?? 0) >= 50 && typeof it.note === 'number';
    copie.sort((a, b) => {
      if (fiable(a) !== fiable(b)) return fiable(a) ? -1 : 1;
      if (!fiable(a)) return rang(a) - rang(b);
      return b.note - a.note;
    });
  }
  return copie;
}

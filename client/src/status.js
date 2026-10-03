// Les 4 statuts du suivi, dans l'ordre d'affichage des listes.
export const STATUSES = [
  { value: 'a_voir', label: 'À voir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'vu', label: 'Vu' },
  { value: 'abandonne', label: 'Abandonné' },
];

export const STATUS_LABEL = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label])
);

// Statut d'une série déduit de sa progression (hors « abandonné », manuel).
export function deriveSeriesStatus(progress) {
  if (!progress || progress.watched === 0) return 'a_voir';
  if (progress.total && progress.watched >= progress.total) return 'vu';
  return 'en_cours';
}

// Un titre est « pas encore sorti » si sa date de sortie est dans le futur.
// Purement dérivé de la date à l'affichage : dès qu'elle est dépassée, le
// titre repasse automatiquement dans « à voir » classique, sans rien à faire.
export function isUpcoming(item) {
  if (!item.releaseDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return item.releaseDate > today;
}

// Vrai si le titre contient le texte cherché, sans tenir compte des accents
// ni des majuscules : « amelie » doit trouver « Le Fabuleux Destin d'Amélie ».
const plat = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function titreCorrespond(titre, recherche) {
  const q = plat(recherche.trim());
  return !q || plat(titre || '').includes(q);
}

// Badge « sortie à venir » de la fiche : ce que TMDB sait de la prochaine
// date à attendre pour ce titre. `null` = rien à annoncer (déjà sorti /
// série terminée) — pas de badge dans ce cas.
export function releaseBadge({ isSeries, releaseDate, status, nextEpisodeDate, seriesEnded }) {
  if (isSeries) {
    if (seriesEnded) return null;
    if (nextEpisodeDate) return `Prochain épisode le ${formatReleaseDate(nextEpisodeDate)}`;
    return 'Nouvelle saison à venir — date inconnue';
  }
  if (releaseDate) {
    return isUpcoming({ releaseDate }) ? `Sort le ${formatReleaseDate(releaseDate)}` : null;
  }
  // Pas de date : seulement annoncé si TMDB dit que le film n'est pas encore
  // sorti (Planned, In Production, Post Production…).
  if (status && status !== 'Released' && status !== 'Canceled') {
    return 'Sortie annoncée — date inconnue';
  }
  return null;
}

// Ce que le cycle de vérification (store.checkNotifications) doit retenir
// pour un titre : la date à surveiller, et s'il faut encore le revérifier au
// prochain lancement. Une fois une date trouvée, l'élément reste en attente
// tant qu'il n'est pas notifié (étape ultérieure) — une sortie annoncée peut
// encore être reportée. Ne sort du cycle que ce qui n'a plus rien à attendre :
// un film déjà sorti (ou dont le projet est abandonné), une série terminée.
export function classifyNotif({ isSeries, releaseDate, status, nextEpisodeDate, seriesEnded }) {
  if (isSeries) {
    if (seriesEnded) return { date: null, enAttente: false };
    return { date: nextEpisodeDate || null, enAttente: true };
  }
  if (status === 'Released' || status === 'Canceled') {
    return { date: null, enAttente: false };
  }
  return { date: releaseDate || null, enAttente: true };
}

// Texte de la carte « Prochain épisode » d'une série : « S2E10 · Cold Harbor »
// et « Diffusé le 12 septembre ». `null` (à jour) : pas de prochain épisode.
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function dateEnToutesLettres(date, maintenant = new Date()) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const jour = d === 1 ? '1er' : String(d);
  const base = `${jour} ${MOIS[m - 1]}`;
  return y === maintenant.getFullYear() ? base : `${base} ${y}`;
}

// Durée d'un film : « 2 h 35 », « 2 h » ou « 45 min ». `null` si inconnue.
export function formatDuree(minutes) {
  if (!minutes || minutes < 1) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function libelleProchain(next, maintenant = new Date()) {
  if (!next) return null;
  const numero = `S${next.season}E${String(next.episode).padStart(2, '0')}`;
  const date = dateEnToutesLettres(next.airDate, maintenant);
  return {
    numero,
    titre: next.name ? `${numero} · ${next.name}` : numero,
    diffuse: date ? `Diffusé le ${date}` : null,
    bouton: `Marquer ${numero} comme vu`,
  };
}

export function formatReleaseDate(releaseDate) {
  if (!releaseDate) return null;
  const [y, m, d] = releaseDate.split('-');
  return `${d}/${m}/${y}`;
}

// Les trois chiffres du bandeau de « Mes listes » : titres suivis, titres vus, note moyenne
// (une décimale, `null` si rien n'est noté). Calculés sur les titres déjà chargés : instantané.
export function resumeBiblio(items) {
  const notes = items.filter((i) => i.rating != null).map((i) => i.rating);
  return {
    titres: items.length,
    vus: items.filter((i) => i.status === 'vu').length,
    noteMoyenne: notes.length
      ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
      : null,
  };
}

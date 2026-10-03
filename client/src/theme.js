// Thème de l'application : « Automatique » (suit le téléphone), « Clair » ou « Sombre ».
// Le choix est gardé sous la clé `theme` : 'light' ou 'dark'. Pas de clé = Automatique.

const CLE = 'theme';

export const CHOIX_THEME = [
  ['auto', 'Automatique', 'Suit le réglage de ton téléphone'],
  ['light', 'Clair', null],
  ['dark', 'Sombre', null],
];

export function lireChoix() {
  try {
    const v = localStorage.getItem(CLE);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

// Le thème réellement affiché pour un choix donné.
export function resoudre(choix, systemeSombre) {
  if (choix === 'light' || choix === 'dark') return choix;
  return systemeSombre ? 'dark' : 'light';
}

const requeteSysteme = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

let ecouteur = null;
let suivi = null; // la requête sur laquelle l'écouteur est posé

function poser(choix) {
  const sombre = requeteSysteme()?.matches ?? false;
  document.documentElement.dataset.theme = resoudre(choix, sombre);
}

// Pose le thème maintenant et, en Automatique, le fait suivre le téléphone en direct.
export function appliquer(choix) {
  try {
    if (choix === 'auto') localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, choix);
  } catch {
    /* stockage indisponible : le choix vaut pour la séance */
  }
  if (suivi && ecouteur) {
    suivi.removeEventListener?.('change', ecouteur);
    ecouteur = null;
    suivi = null;
  }
  const mq = requeteSysteme();
  if (choix === 'auto' && mq) {
    ecouteur = () => poser('auto');
    suivi = mq;
    mq.addEventListener?.('change', ecouteur);
  }
  poser(choix);
}

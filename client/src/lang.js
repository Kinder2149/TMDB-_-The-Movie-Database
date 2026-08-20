// Langue du catalogue — celle dans laquelle les fiches films et séries (titres,
// synopsis, genres, affiches) sont demandées à TMDB.
//
// À ne pas confondre avec la langue de l'interface : les libellés de
// l'application restent en français quel que soit ce réglage.
//
// Le choix est enregistré dans les préférences locales de l'appareil, hors base
// de données : c'est un réglage d'application, pas une donnée de profil.

const KEY = 'catalogLang';

export const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

// Code attendu par TMDB pour chaque langue proposée.
export const TMDB_LANG = { fr: 'fr-FR', en: 'en-US' };

// Vrai tant que l'utilisateur n'a jamais choisi : l'écran de bienvenue s'affiche.
export function hasCatalogLanguage() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function getCatalogLanguage() {
  try {
    return localStorage.getItem(KEY) || 'fr';
  } catch {
    return 'fr';
  }
}

export function setCatalogLanguage(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* préférences indisponibles : le choix ne vaut que pour la session */
  }
}

export function languageLabel(value) {
  return LANGUAGES.find((l) => l.value === value)?.label || value;
}

// Retour tactile : une courte vibration quand on marque « vu » ou qu'on change de statut.
// Silencieux là où le téléphone ou le navigateur ne sait pas vibrer.
export function vibre(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    /* pas de vibreur : sans conséquence */
  }
}

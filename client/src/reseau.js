// Hors connexion : savoir si une erreur vient du réseau, et suivre l'état de la connexion.

import { useEffect, useState } from 'react';

// Vrai si l'échec ressemble à un réseau absent (et non à une réponse d'erreur de TMDB).
// `fetch` qui n'aboutit pas lève une TypeError (« Failed to fetch », « Load failed »…).
export function estErreurReseau(err, enLigne = typeof navigator === 'undefined' ? true : navigator.onLine) {
  if (enLigne === false) return true;
  if (!err) return false;
  if (err instanceof TypeError) return true;
  return /failed to fetch|network|load failed|internet|offline|timeout/i.test(String(err.message || err));
}

// Vrai tant que le téléphone se dit connecté ; se met à jour quand la connexion revient ou part.
export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return enLigne;
}

import { getProfile } from '../db/profiles.repo.js';

// Couche Logique. Exige un profil valide sur les routes de suivi.
// L'UI envoie l'id du profil actif via l'en-tête X-Profile-Id.
//
// En V2 (en ligne), l'id proviendra de la session/token au lieu de l'en-tête :
// seule cette lecture changera, le reste de l'app reste identique.
export function requireProfile(req, res, next) {
  const id = req.get('X-Profile-Id');
  if (!id) {
    return res.status(400).json({ error: 'Profil actif manquant (X-Profile-Id).' });
  }
  if (!getProfile(id)) {
    return res.status(400).json({ error: 'Profil inconnu.' });
  }
  req.profileId = id;
  next();
}

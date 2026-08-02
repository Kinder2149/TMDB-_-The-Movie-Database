import { randomUUID } from 'node:crypto';
import { getDb } from './database.js';

// Accès à la table des profils (couche Données). Aucune logique métier ici.
// L'id est un UUID *portable* : il pourra suivre le profil jusqu'en ligne (V2).

export function listProfiles() {
  return getDb()
    .prepare('SELECT id, name, created_at AS createdAt FROM profiles ORDER BY created_at')
    .all();
}

// Renvoie le profil (ou undefined). Sert à valider l'en-tête X-Profile-Id.
export function getProfile(id) {
  return getDb()
    .prepare('SELECT id, name, created_at AS createdAt FROM profiles WHERE id = ?')
    .get(id);
}

export function createProfile(name) {
  const id = randomUUID();
  getDb().prepare('INSERT INTO profiles (id, name) VALUES (?, ?)').run(id, name);
  return { id, name };
}

// Renomme un profil. Renvoie true si une ligne a été modifiée.
export function renameProfile(id, name) {
  const info = getDb().prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name, id);
  return info.changes > 0;
}

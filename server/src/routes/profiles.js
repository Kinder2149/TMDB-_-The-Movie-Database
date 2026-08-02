import { Router } from 'express';
import { listProfiles, createProfile, renameProfile } from '../db/profiles.repo.js';

const router = Router();

// GET /api/profiles — la liste des profils locaux.
router.get('/', (req, res) => {
  res.json({ profiles: listProfiles() });
});

// POST /api/profiles — créer un profil. Renvoie { id, name }.
router.post('/', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Nom de profil requis.' });
  }
  res.status(201).json(createProfile(name));
});

// PATCH /api/profiles/:id — renommer un profil.
router.patch('/:id', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Nom de profil requis.' });
  }
  const changed = renameProfile(req.params.id, name);
  if (!changed) {
    return res.status(404).json({ error: 'Profil introuvable.' });
  }
  res.json({ ok: true });
});

export default router;

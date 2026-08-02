import { Router } from 'express';
import {
  listSuivi,
  addToSuivi,
  removeFromSuivi,
  setStatus,
} from '../db/suivi.repo.js';

const router = Router();

// GET /api/suivi — la liste de ce qui est suivi (sert à marquer les
// résultats de recherche déjà ajoutés).
router.get('/', (req, res) => {
  res.json({ items: listSuivi() });
});

// POST /api/suivi — ajouter un élément au suivi.
router.post('/', (req, res) => {
  const { id, mediaType, title, year, posterUrl } = req.body || {};
  if (!id || !mediaType || !title) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  addToSuivi({
    id,
    mediaType,
    title,
    year: year ?? null,
    posterUrl: posterUrl ?? null,
  });
  res.status(201).json({ ok: true });
});

// PATCH /api/suivi/:mediaType/:id — changer l'état vu/à voir (films seulement).
router.patch('/:mediaType/:id', (req, res) => {
  const { mediaType, id } = req.params;
  const { status } = req.body || {};

  if (mediaType !== 'movie') {
    return res.status(400).json({
      error: "Le marquage vu/à voir n'est disponible que pour les films.",
    });
  }
  if (status !== 'vu' && status !== 'a_voir') {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  const changed = setStatus(Number(id), mediaType, status);
  if (!changed) {
    return res.status(404).json({ error: 'Film absent du suivi.' });
  }
  res.json({ ok: true });
});

// DELETE /api/suivi/:mediaType/:id — retirer un élément du suivi.
router.delete('/:mediaType/:id', (req, res) => {
  const { mediaType, id } = req.params;
  removeFromSuivi(Number(id), mediaType);
  res.json({ ok: true });
});

export default router;

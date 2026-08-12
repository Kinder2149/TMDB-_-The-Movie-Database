import { Router } from 'express';
import {
  listListes,
  createListe,
  renameListe,
  deleteListe,
  listItems,
  addItem,
  removeItem,
  listesForItem,
} from '../db/listes.repo.js';
import { addToSuivi } from '../db/suivi.repo.js';

const router = Router();

// GET /api/listes — les listes du profil (avec nombre d'éléments).
router.get('/', (req, res) => {
  res.json({ listes: listListes(req.profileId) });
});

// POST /api/listes — créer une liste.
router.post('/', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom de liste requis.' });
  res.status(201).json(createListe(req.profileId, name));
});

// GET /api/listes/for/:mediaType/:tmdbId — ids des listes contenant ce titre.
router.get('/for/:mediaType/:tmdbId', (req, res) => {
  const { mediaType, tmdbId } = req.params;
  res.json({ listeIds: listesForItem(req.profileId, Number(tmdbId), mediaType) });
});

// GET /api/listes/:id/items — éléments d'une liste.
router.get('/:id/items', (req, res) => {
  res.json({ items: listItems(req.profileId, Number(req.params.id)) });
});

// POST /api/listes/:id/items — ajouter un titre (l'ajoute aussi au suivi).
router.post('/:id/items', (req, res) => {
  const { id, mediaType, title, year, releaseDate, posterUrl } = req.body || {};
  if (!id || !mediaType || !title) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  // « Ajouter à une liste = suivre » : on garantit la présence dans le suivi.
  addToSuivi(req.profileId, {
    id,
    mediaType,
    title,
    year: year ?? null,
    releaseDate: releaseDate ?? null,
    posterUrl: posterUrl ?? null,
  });
  addItem(req.profileId, Number(req.params.id), Number(id), mediaType);
  res.status(201).json({ ok: true });
});

// DELETE /api/listes/:id/items/:mediaType/:tmdbId — retirer un titre d'une liste.
router.delete('/:id/items/:mediaType/:tmdbId', (req, res) => {
  const { id, mediaType, tmdbId } = req.params;
  removeItem(req.profileId, Number(id), Number(tmdbId), mediaType);
  res.json({ ok: true });
});

// PATCH /api/listes/:id — renommer une liste.
router.patch('/:id', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom requis.' });
  const ok = renameListe(req.profileId, Number(req.params.id), name);
  if (!ok) return res.status(404).json({ error: 'Liste introuvable.' });
  res.json({ ok: true });
});

// DELETE /api/listes/:id — supprimer une liste.
router.delete('/:id', (req, res) => {
  deleteListe(req.profileId, Number(req.params.id));
  res.json({ ok: true });
});

export default router;

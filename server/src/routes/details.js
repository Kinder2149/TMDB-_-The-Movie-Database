import { Router } from 'express';
import { getDetails } from '../services/tmdb.js';

const router = Router();

// GET /api/details/:mediaType/:id — fiche détaillée (données TMDB, pas de profil).
router.get('/:mediaType/:id', async (req, res) => {
  const { mediaType, id } = req.params;
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return res.status(400).json({ error: 'Type invalide (movie|tv).' });
  }
  try {
    res.json(await getDetails(mediaType, Number(id)));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

export default router;

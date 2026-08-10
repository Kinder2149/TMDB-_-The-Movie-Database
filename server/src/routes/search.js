import { Router } from 'express';
import { searchMulti, searchByActor } from '../services/tmdb.js';

const router = Router();

// GET /api/search/person?q=... — filmographie d'un acteur.
router.get('/person', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'Paramètre "q" requis.' });
  try {
    res.json(await searchByActor(query));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/search?q=...
router.get('/', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Paramètre "q" requis.' });
  }
  try {
    const results = await searchMulti(query);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

export default router;

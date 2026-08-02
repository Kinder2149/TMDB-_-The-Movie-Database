import { Router } from 'express';
import { searchMulti } from '../services/tmdb.js';

const router = Router();

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

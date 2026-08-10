import { Router } from 'express';
import { getGenres, discoverByGenre, getTrending } from '../services/tmdb.js';

const router = Router();

// GET /api/browse/genres — liste des genres (films + séries).
router.get('/genres', async (req, res) => {
  try {
    res.json({ genres: await getGenres() });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/browse/trending — tendances de la semaine (écran de recherche à vide).
router.get('/trending', async (req, res) => {
  try {
    res.json({ results: await getTrending() });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/browse/discover?movieGenre=&tvGenre= — titres d'un genre.
router.get('/discover', async (req, res) => {
  const movieGenreId = req.query.movieGenre ? Number(req.query.movieGenre) : null;
  const tvGenreId = req.query.tvGenre ? Number(req.query.tvGenre) : null;
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  if (!movieGenreId && !tvGenreId) {
    // Genre inexistant pour ce type (ex. « Horreur » côté séries) : liste vide,
    // pas une erreur.
    return res.json({ results: [] });
  }
  try {
    res.json({ results: await discoverByGenre({ movieGenreId, tvGenreId, page }) });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

export default router;

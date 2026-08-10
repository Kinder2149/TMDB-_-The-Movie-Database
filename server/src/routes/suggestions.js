import { Router } from 'express';
import { listSuivi } from '../db/suivi.repo.js';
import { getRecommendations } from '../services/tmdb.js';

const router = Router();

// GET /api/suggestions — suggestions personnalisées à partir du suivi du profil.
// On agrège les recommandations TMDB des titres vus / en cours, on écarte ce
// qui est déjà suivi, et on classe par nombre de recommandations puis popularité.
router.get('/', async (req, res) => {
  try {
    const suivi = listSuivi(req.profileId);
    const suiviKeys = new Set(suivi.map((i) => `${i.mediaType}-${i.id}`));

    // Graines : ce qu'on a vu ou commencé en priorité, sinon tout le suivi.
    let seeds = suivi.filter((i) => i.status === 'vu' || i.status === 'en_cours');
    if (seeds.length === 0) seeds = suivi;
    // Mélange : « Actualiser » propose d'autres suggestions à chaque appel.
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }
    seeds = seeds.slice(0, 12); // borne le nombre d'appels TMDB

    const lists = await Promise.all(
      seeds.map((s) =>
        getRecommendations(s.mediaType, s.id)
          .then((recs) => ({ seed: s, recs }))
          .catch(() => ({ seed: s, recs: [] }))
      )
    );

    const agg = new Map();
    for (const { seed, recs } of lists) {
      for (const r of recs) {
        const key = `${r.mediaType}-${r.id}`;
        if (suiviKeys.has(key)) continue; // déjà dans le suivi
        const cur = agg.get(key);
        if (cur) {
          cur.score += 1;
          if (r._pop > cur._pop) cur._pop = r._pop;
        } else {
          agg.set(key, { ...r, score: 1, reason: seed.title });
        }
      }
    }

    const results = [...agg.values()]
      .sort((a, b) => b.score - a.score || b._pop - a._pop)
      .slice(0, 30)
      .map(({ _pop, score, ...rest }) => rest);

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

export default router;

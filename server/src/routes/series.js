import { Router } from 'express';
import { getSeasons, getEpisodes } from '../services/tmdb.js';
import {
  listWatchedEpisodes,
  markEpisode,
  unmarkEpisode,
  markSeason,
  unmarkSeason,
} from '../db/episodes.repo.js';

const router = Router();

// GET /api/tv/:id/seasons — liste des saisons d'une série.
router.get('/:id/seasons', async (req, res) => {
  try {
    const seasons = await getSeasons(Number(req.params.id));
    res.json({ seasons });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/tv/:id/season/:n — épisodes d'une saison + leur état vu.
router.get('/:id/season/:n', async (req, res) => {
  const seriesId = Number(req.params.id);
  const season = Number(req.params.n);
  try {
    const episodes = await getEpisodes(seriesId, season);
    const watched = new Set(
      listWatchedEpisodes(req.profileId, seriesId)
        .filter((e) => e.season === season)
        .map((e) => e.episode)
    );
    res.json({
      episodes: episodes.map((e) => ({
        ...e,
        watched: watched.has(e.episodeNumber),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/tv/:id/progress — progression (vus / total) + prochain épisode à voir.
router.get('/:id/progress', async (req, res) => {
  const seriesId = Number(req.params.id);
  try {
    const seasons = [...(await getSeasons(seriesId))].sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    );
    const watched = listWatchedEpisodes(req.profileId, seriesId);

    const total = seasons.reduce((sum, s) => sum + s.episodeCount, 0);
    const watchedCount = watched.length;

    const watchedBySeason = new Map();
    for (const w of watched) {
      if (!watchedBySeason.has(w.season)) watchedBySeason.set(w.season, new Set());
      watchedBySeason.get(w.season).add(w.episode);
    }

    // Prochain à voir = premier épisode non coché, dans l'ordre, déjà diffusé.
    const today = new Date().toISOString().slice(0, 10);
    let next = null;
    for (const s of seasons) {
      const seen = watchedBySeason.get(s.seasonNumber) || new Set();
      if (seen.size >= s.episodeCount) continue; // saison complète
      const eps = [...(await getEpisodes(seriesId, s.seasonNumber))].sort(
        (a, b) => a.episodeNumber - b.episodeNumber
      );
      const firstUnwatched = eps.find((e) => !seen.has(e.episodeNumber));
      if (firstUnwatched) {
        if (firstUnwatched.airDate && firstUnwatched.airDate <= today) {
          next = {
            season: s.seasonNumber,
            episode: firstUnwatched.episodeNumber,
            name: firstUnwatched.name,
          };
        }
        break; // premier non-vu trouvé (diffusé → next ; à venir → à jour)
      }
    }

    res.json({ total, watched: watchedCount, next });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// POST/DELETE /api/tv/:id/season/:n/episode/:e — cocher / décocher un épisode.
router.post('/:id/season/:n/episode/:e', (req, res) => {
  markEpisode(
    req.profileId,
    Number(req.params.id),
    Number(req.params.n),
    Number(req.params.e)
  );
  res.status(201).json({ ok: true });
});

router.delete('/:id/season/:n/episode/:e', (req, res) => {
  unmarkEpisode(
    req.profileId,
    Number(req.params.id),
    Number(req.params.n),
    Number(req.params.e)
  );
  res.json({ ok: true });
});

// POST /api/tv/:id/season/:n — cocher toute la saison (body { episodes: [...] }).
router.post('/:id/season/:n', (req, res) => {
  const episodes = req.body?.episodes;
  if (!Array.isArray(episodes)) {
    return res.status(400).json({ error: 'Liste d\'épisodes attendue.' });
  }
  markSeason(
    req.profileId,
    Number(req.params.id),
    Number(req.params.n),
    episodes.map(Number)
  );
  res.json({ ok: true });
});

// DELETE /api/tv/:id/season/:n — décocher toute la saison.
router.delete('/:id/season/:n', (req, res) => {
  unmarkSeason(req.profileId, Number(req.params.id), Number(req.params.n));
  res.json({ ok: true });
});

export default router;

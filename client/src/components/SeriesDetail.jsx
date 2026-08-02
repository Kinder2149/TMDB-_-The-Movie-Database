import { useState, useEffect } from 'react';
import {
  getSeasons,
  getSeasonEpisodes,
  getProgress,
  markEpisode,
  unmarkEpisode,
  markWholeSeason,
  unmarkWholeSeason,
} from '../api.js';

export default function SeriesDetail({ item, onClose }) {
  const [seasons, setSeasons] = useState([]);
  const [progress, setProgress] = useState(null); // { total, watched, next }
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null); // numéro de saison ouverte
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  function refreshProgress() {
    getProgress(item.id).then(setProgress).catch(() => {});
  }

  useEffect(() => {
    getSeasons(item.id).then(setSeasons).catch((e) => setError(e.message));
    refreshProgress();
  }, [item.id]);

  async function openSeason(seasonNumber) {
    if (expanded === seasonNumber) {
      setExpanded(null);
      return;
    }
    setExpanded(seasonNumber);
    setEpisodes([]);
    setLoadingEpisodes(true);
    try {
      setEpisodes(await getSeasonEpisodes(item.id, seasonNumber));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingEpisodes(false);
    }
  }

  async function toggleEpisode(ep) {
    try {
      if (ep.watched) {
        await unmarkEpisode(item.id, expanded, ep.episodeNumber);
      } else {
        await markEpisode(item.id, expanded, ep.episodeNumber);
      }
      setEpisodes((prev) =>
        prev.map((e) =>
          e.episodeNumber === ep.episodeNumber ? { ...e, watched: !e.watched } : e
        )
      );
      refreshProgress();
    } catch (e) {
      setError(e.message);
    }
  }

  const allWatched = episodes.length > 0 && episodes.every((e) => e.watched);

  async function toggleWholeSeason() {
    try {
      if (allWatched) {
        await unmarkWholeSeason(item.id, expanded);
        setEpisodes((prev) => prev.map((e) => ({ ...e, watched: false })));
      } else {
        await markWholeSeason(
          item.id,
          expanded,
          episodes.map((e) => e.episodeNumber)
        );
        setEpisodes((prev) => prev.map((e) => ({ ...e, watched: true })));
      }
      refreshProgress();
    } catch (e) {
      setError(e.message);
    }
  }

  const pct =
    progress && progress.total
      ? Math.round((progress.watched / progress.total) * 100)
      : 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>{item.title}</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        {progress && (
          <div className="progress">
            <div className="progress__bar">
              <div className="progress__fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="progress__text">
              {progress.watched} / {progress.total} épisodes vus
              {' · '}
              {progress.next ? (
                <span>
                  Prochain : S{progress.next.season}E
                  {String(progress.next.episode).padStart(2, '0')} —{' '}
                  {progress.next.name}
                </span>
              ) : (
                <span className="progress__done">À jour ✓</span>
              )}
            </p>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <ul className="season-list">
          {seasons.map((s) => (
            <li key={s.seasonNumber} className="season">
              <button
                className="season__head"
                onClick={() => openSeason(s.seasonNumber)}
              >
                <span>{s.name}</span>
                <span className="season__count">{s.episodeCount} ép.</span>
              </button>

              {expanded === s.seasonNumber && (
                <div className="season__body">
                  {loadingEpisodes ? (
                    <p className="hint">Chargement des épisodes…</p>
                  ) : (
                    <>
                      <button className="season__all" onClick={toggleWholeSeason}>
                        {allWatched
                          ? 'Décocher toute la saison'
                          : 'Cocher toute la saison'}
                      </button>
                      <ul className="episode-list">
                        {episodes.map((ep) => (
                          <li key={ep.episodeNumber}>
                            <label className="episode">
                              <input
                                type="checkbox"
                                checked={ep.watched}
                                onChange={() => toggleEpisode(ep)}
                              />
                              <span className="episode__num">
                                E{String(ep.episodeNumber).padStart(2, '0')}
                              </span>
                              <span className="episode__name">{ep.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

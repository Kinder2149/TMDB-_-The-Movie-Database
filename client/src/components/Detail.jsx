import { useState, useEffect } from 'react';
import {
  getDetails,
  getSeasons,
  getSeasonEpisodes,
  getProgress,
  markEpisode,
  unmarkEpisode,
  markWholeSeason,
  unmarkWholeSeason,
  getItemListes,
} from '../api.js';
import { STATUSES, STATUS_LABEL, deriveSeriesStatus } from '../status.js';

// Fiche détail générique (film ou série). Pour une série suivie, la
// progression et les saisons/épisodes sont intégrées ici.
export default function Detail({
  item,
  isFollowed,
  status,
  listes,
  onToggleFollow,
  onSetStatus,
  onCreateListe,
  onAddToListe,
  onRemoveFromListe,
  onClose,
}) {
  const isSeries = item.mediaType === 'tv';

  const [info, setInfo] = useState(null); // affiche, synopsis, genres, acteurs
  const [error, setError] = useState('');
  const [listeIds, setListeIds] = useState([]); // listes contenant ce titre

  useEffect(() => {
    getItemListes(item.mediaType, item.id).then(setListeIds).catch(() => setListeIds([]));
  }, [item.id, item.mediaType]);

  async function toggleListe(l) {
    if (listeIds.includes(l.id)) {
      await onRemoveFromListe(l.id, item);
      setListeIds((ids) => ids.filter((x) => x !== l.id));
    } else {
      await onAddToListe(l.id, item);
      setListeIds((ids) => [...ids, l.id]);
    }
  }

  async function handleNewListe() {
    const name = window.prompt('Nom de la nouvelle liste ?');
    if (!name || !name.trim()) return;
    const created = await onCreateListe(name.trim());
    if (created) {
      await onAddToListe(created.id, item);
      setListeIds((ids) => [...ids, created.id]);
    }
  }

  // --- Épisodes (séries suivies uniquement) ---
  const [seasons, setSeasons] = useState([]);
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    getDetails(item.mediaType, item.id).then(setInfo).catch((e) => setError(e.message));
  }, [item.id, item.mediaType]);

  // Recharge la progression ET aligne le statut de la série dessus
  // (à voir / en cours / vu), sauf si la série est marquée « abandonné ».
  async function refreshProgress() {
    try {
      const p = await getProgress(item.id);
      setProgress(p);
      const cur = status || 'a_voir';
      if (cur !== 'abandonne') {
        const derived = deriveSeriesStatus(p);
        if (derived !== cur) onSetStatus(item, derived);
      }
    } catch {
      /* progression indisponible : on n'aligne pas le statut */
    }
  }

  // Charger saisons + progression dès qu'une série est suivie.
  useEffect(() => {
    if (isSeries && isFollowed) {
      getSeasons(item.id).then(setSeasons).catch((e) => setError(e.message));
      refreshProgress();
    }
  }, [item.id, isSeries, isFollowed]);

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
      if (ep.watched) await unmarkEpisode(item.id, expanded, ep.episodeNumber);
      else await markEpisode(item.id, expanded, ep.episodeNumber);
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
        await markWholeSeason(item.id, expanded, episodes.map((e) => e.episodeNumber));
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
  const current = status || 'a_voir';

  // Location et achat sont souvent la même liste : on fusionne et dédoublonne.
  const providers = info?.providers;
  const locationAchat = providers
    ? Array.from(
        new Map([...providers.rent, ...providers.buy].map((p) => [p.name, p])).values()
      )
    : [];
  const hasStreaming =
    providers && (providers.flatrate.length > 0 || locationAchat.length > 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>{info?.title || item.title}</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        {/* En-tête riche : affiche + infos */}
        <div
          className="detail-hero"
          style={
            info?.backdropUrl
              ? { backgroundImage: `url(${info.backdropUrl})` }
              : undefined
          }
        >
          <div className="detail-hero__scrim">
            {info?.posterUrl && (
              <img className="detail-hero__poster" src={info.posterUrl} alt={info.title} />
            )}
            <div className="detail-hero__info">
              <div className="detail-hero__sub">
                {isSeries ? 'Série' : 'Film'}
                {info?.year && ` · ${info.year}`}
              </div>
              {info?.genres?.length > 0 && (
                <div className="genres">
                  {info.genres.map((g) => (
                    <span key={g}>{g}</span>
                  ))}
                </div>
              )}
              <div className="detail-actions">
                <button
                  className={`btn ${isFollowed ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => onToggleFollow(item)}
                >
                  {isFollowed ? '✓ Dans mes listes' : '+ Ajouter'}
                </button>
                {info?.trailer && (
                  <a
                    className="btn btn--ghost"
                    href={info.trailer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ▸ Bande-annonce
                  </a>
                )}
              </div>

              {isFollowed && (
                <div className="status-control">
                  {isSeries ? (
                    <>
                      <span className={`status-badge status--${current}`}>
                        {STATUS_LABEL[current]}
                      </span>
                      {current === 'abandonne' ? (
                        <button
                          className="btn btn--ghost"
                          onClick={() => onSetStatus(item, deriveSeriesStatus(progress))}
                        >
                          Reprendre le suivi
                        </button>
                      ) : (
                        <button
                          className="btn btn--ghost"
                          onClick={() => onSetStatus(item, 'abandonne')}
                        >
                          Abandonner
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="status-picker">
                      {STATUSES.map((s) => (
                        <button
                          key={s.value}
                          className={`status-chip status--${s.value} ${
                            current === s.value ? 'on' : ''
                          }`}
                          onClick={() => onSetStatus(item, s.value)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <p className="error detail-pad">{error}</p>}

        {info?.overview && (
          <div className="section">
            <h4>Synopsis</h4>
            <p className="synopsis">{info.overview}</p>
          </div>
        )}

        <div className="section">
          <h4>Mes listes</h4>
          <div className="liste-toggles">
            {listes.map((l) => (
              <button
                key={l.id}
                className={`chip-toggle ${listeIds.includes(l.id) ? 'on' : ''}`}
                onClick={() => toggleListe(l)}
              >
                {listeIds.includes(l.id) ? '✓ ' : ''}
                {l.name}
              </button>
            ))}
            <button className="chip-toggle chip-toggle--new" onClick={handleNewListe}>
              + Nouvelle liste
            </button>
          </div>
        </div>

        {info && (
          <div className="section">
            <h4>Où le voir en France</h4>
            {hasStreaming ? (
              <>
                {providers.flatrate.length > 0 && (
                  <div className="prov-group">
                    <span className="prov-label">En abonnement</span>
                    <div className="providers">
                      {providers.flatrate.map((p) => (
                        <span className="prov" key={p.name}>
                          {p.logoUrl && <img className="prov__logo" src={p.logoUrl} alt="" />}
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {locationAchat.length > 0 && (
                  <div className="prov-group">
                    <span className="prov-label">Location / Achat</span>
                    <div className="providers">
                      {locationAchat.map((p) => (
                        <span className="prov" key={p.name}>
                          {p.logoUrl && <img className="prov__logo" src={p.logoUrl} alt="" />}
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="attn">Disponibilité fournie par JustWatch (via TMDB).</p>
              </>
            ) : (
              <p className="hint">Pas d'info de disponibilité pour le moment.</p>
            )}
          </div>
        )}

        {info?.cast?.length > 0 && (
          <div className="section">
            <h4>Têtes d'affiche</h4>
            <div className="cast">
              {info.cast.map((a) => (
                <div className="actor" key={a.name + (a.character || '')}>
                  {a.photoUrl ? (
                    <img className="actor__ph" src={a.photoUrl} alt={a.name} />
                  ) : (
                    <div className="actor__ph actor__ph--empty">{a.name.charAt(0)}</div>
                  )}
                  <span className="actor__n">{a.name}</span>
                  {a.character && <span className="actor__r">{a.character}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Séries : progression + saisons/épisodes (si suivie) */}
        {isSeries && !isFollowed && (
          <div className="section">
            <p className="hint">
              Ajoute la série à ton suivi pour cocher les épisodes.
            </p>
          </div>
        )}

        {isSeries && isFollowed && (
          <>
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

            <ul className="season-list">
              {seasons.map((s) => (
                <li key={s.seasonNumber} className="season">
                  <button className="season__head" onClick={() => openSeason(s.seasonNumber)}>
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
          </>
        )}
      </div>
    </div>
  );
}

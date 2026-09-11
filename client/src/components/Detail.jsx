import { useState, useEffect, useRef } from 'react';
import {
  getDetails,
  getSeasonsProgress,
  getSeasonEpisodes,
  getProgress,
  markEpisode,
  unmarkEpisode,
  markWholeSeason,
  unmarkWholeSeason,
  markSeasonWatched,
  markSeriesWatched,
  unmarkSeriesWatched,
  getItemListes,
  getNote,
  setNote,
  getCollection,
} from '../api.js';
import { STATUSES, deriveSeriesStatus } from '../status.js';
import Icon from './Icon.jsx';
import MovieCard from './MovieCard.jsx';

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
  suivi, // Map des titres suivis : l'état de chaque film de la saga
  cardProps,
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

  // --- Note personnelle ---
  //
  // Deux champs indépendants : des étoiles (1 à 5) et un avis écrit. On peut
  // n'en remplir qu'un. La note appartient au suivi : elle n'apparaît que sur
  // un titre suivi, et disparaît avec lui.
  const [rating, setRating] = useState(null);
  const [avis, setAvis] = useState('');
  const [noteEnregistree, setNoteEnregistree] = useState(true);

  // Les étoiles s'enregistrent au clic ; l'avis écrit, lui, part tout seul peu
  // après qu'on a arrêté de taper. Attendre que le champ perde le focus ne
  // suffirait pas : fermer la fiche avec le bouton retour d'Android ne le
  // déclenche pas, et l'avis serait perdu sans que rien ne le dise.
  const ratingRef = useRef(null);
  const avisTimer = useRef(null);
  const avisEnAttente = useRef(null); // texte tapé, pas encore enregistré
  const sauveRef = useRef(() => {});

  useEffect(() => {
    if (!isFollowed) return;
    getNote(item.mediaType, item.id)
      .then((n) => {
        setRating(n?.rating ?? null);
        ratingRef.current = n?.rating ?? null;
        setAvis(n?.note ?? '');
        setNoteEnregistree(true);
      })
      .catch(() => {});
  }, [item.id, item.mediaType, isFollowed]);

  async function ecritNote(nouvelleNote, nouvelAvis) {
    setNoteEnregistree(false);
    try {
      await setNote(item.mediaType, item.id, { note: nouvelAvis, rating: nouvelleNote });
      setNoteEnregistree(true);
    } catch (e) {
      setError(e.message);
    }
  }

  // Recliquer sur l'étoile déjà donnée retire la note : c'est le seul moyen de
  // revenir à « pas encore noté » sans un bouton de plus.
  function cliqueEtoile(n) {
    const valeur = n === rating ? null : n;
    setRating(valeur);
    ratingRef.current = valeur;
    ecritNote(valeur, avisEnAttente.current ?? avis);
  }

  function tapeAvis(texte) {
    setAvis(texte);
    setNoteEnregistree(false);
    avisEnAttente.current = texte;
    clearTimeout(avisTimer.current);
    avisTimer.current = setTimeout(() => sauveRef.current(), 800);
  }

  function sauveAvis() {
    clearTimeout(avisTimer.current);
    const texte = avisEnAttente.current;
    if (texte == null) return; // rien de neuf depuis le dernier enregistrement
    avisEnAttente.current = null;
    ecritNote(ratingRef.current, texte);
  }
  sauveRef.current = sauveAvis;

  // Filet de sécurité : ce qui reste en attente part à la fermeture de la fiche.
  useEffect(() => () => sauveRef.current(), []);

  // --- Épisodes (séries suivies uniquement) ---
  const [seasons, setSeasons] = useState([]);
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [busy, setBusy] = useState(false); // un raccourci est en cours

  useEffect(() => {
    getDetails(item.mediaType, item.id).then(setInfo).catch((e) => setError(e.message));
  }, [item.id, item.mediaType]);

  // --- Saga ---
  // Chargée après la fiche, dont on a besoin pour savoir s'il y a une saga.
  // Une saga injoignable ne mérite pas un message d'erreur : le rayon manque, rien de plus.
  const [saga, setSaga] = useState(null);
  const collectionId = info?.collection?.id;
  useEffect(() => {
    if (!collectionId) return;
    getCollection(collectionId).then(setSaga).catch(() => setSaga(null));
  }, [collectionId]);

  // Dans une longue saga, le film ouvert peut être hors de l'écran : on fait
  // défiler la rangée (et elle seule) jusqu'à lui.
  const sagaRef = useRef(null);
  useEffect(() => {
    const rangee = sagaRef.current;
    const ici = rangee?.querySelector('.is-here');
    if (ici) {
      rangee.scrollLeft +=
        ici.getBoundingClientRect().left - rangee.getBoundingClientRect().left - 16;
    }
  }, [saga]);

  // Recharge la progression ET aligne le statut de la série dessus
  // (à voir / en cours / vu), sauf si la série est marquée « abandonné ».
  async function refreshProgress() {
    try {
      const p = await getProgress(item.id);
      setProgress(p);
      getSeasonsProgress(item.id).then(setSeasons).catch(() => {});
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
      getSeasonsProgress(item.id).then(setSeasons).catch((e) => setError(e.message));
      refreshProgress();
    }
  }, [item.id, isSeries, isFollowed]);

  // --- Raccourcis « déjà vu » ---
  //
  // Ajouter une série qu'on a déjà regardée demandait de déplier chaque saison
  // et de cocher chaque épisode. Ces deux raccourcis ne cochent que les
  // épisodes *déjà diffusés* : une série en cours de diffusion devient « à
  // jour », pas « terminée ».

  // Cocher une saison depuis sa ligne, sans avoir à la déplier.
  async function toggleSaisonDepuisLaListe(saison, event) {
    event.stopPropagation(); // ne pas déplier/replier la saison au passage
    setBusy(true);
    try {
      if (saisonVue(saison)) await unmarkWholeSeason(item.id, saison.seasonNumber);
      else await markSeasonWatched(item.id, saison.seasonNumber);
      if (expanded === saison.seasonNumber) {
        setEpisodes(await getSeasonEpisodes(item.id, saison.seasonNumber));
      }
      await refreshProgress();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSerieEntiere() {
    setBusy(true);
    try {
      if (serieVue) await unmarkSeriesWatched(item.id);
      else await markSeriesWatched(item.id);
      if (expanded != null) setEpisodes(await getSeasonEpisodes(item.id, expanded));
      await refreshProgress();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Une saison est « vue » quand tout ce qui en est sorti est coché.
  const saisonVue = (s) => s.aired > 0 && s.watched >= s.aired;
  const serieVue =
    progress != null && progress.watched > 0 && progress.watched >= (progress.aired ?? 0);

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

  // La progression se lit sur les épisodes *diffusés* : afficher « 6 / 10 »
  // à quelqu'un qui a vu tout ce qui est sorti lui ferait croire qu'il a du
  // retard. Les épisodes déjà programmés sont annoncés à part, en dessous.
  const diffuses = progress ? progress.aired ?? progress.total : 0;
  const aVenir = progress ? Math.max(0, progress.total - diffuses) : 0;
  const pct = diffuses ? Math.round((progress.watched / diffuses) * 100) : 0;
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

  // Statut d'une série : dérivé de la progression, sauf « Abandonné » qui est
  // le seul choix manuel. On montre quand même les 4 pour que la lecture soit
  // la même partout ; les trois dérivés ne sont cliquables que pour sortir
  // d'un abandon (ils rendent alors la série à sa progression réelle).
  function pickStatus(value) {
    if (!isSeries) return onSetStatus(item, value);
    if (value === 'abandonne') return onSetStatus(item, 'abandonne');
    if (current === 'abandonne') return onSetStatus(item, deriveSeriesStatus(progress));
  }

  const statusDisabled = (value) =>
    isSeries && value !== 'abandonne' && current !== 'abandonne';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>{info?.title || item.title}</h2>
        </header>

        {/* En-tête : affiche posée sur l'image de fond du titre. */}
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
              <h3 className="detail-hero__title">{info?.title || item.title}</h3>
              <div className="detail-hero__sub">
                {isSeries ? 'Série' : 'Film'}
                {info?.year && ` · ${info.year}`}
                {info?.genres?.length > 0 && ` · ${info.genres.join(', ')}`}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-pad">
          <button
            className={`btn btn--wide ${isFollowed ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => onToggleFollow(item)}
          >
            <Icon name={isFollowed ? 'check' : 'plus'} size={16} />
            {isFollowed ? 'Dans mon suivi — retirer' : 'Ajouter à mon suivi'}
          </button>

          {isFollowed && (
            <div className="statuspick">
              {STATUSES.map((st) => (
                <button
                  key={st.value}
                  className={`statuspick__btn status--${st.value} ${
                    current === st.value ? 'on' : ''
                  }`}
                  disabled={statusDisabled(st.value)}
                  title={
                    statusDisabled(st.value)
                      ? 'Pour une série, ce statut suit les épisodes cochés'
                      : st.label
                  }
                  onClick={() => pickStatus(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}

          {info?.trailer && (
            <a
              className="btn btn--primary btn--wide"
              href={info.trailer.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="play" size={15} />
              Bande-annonce
            </a>
          )}
        </div>

        {error && <p className="error detail-pad">{error}</p>}

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
                  {progress.watched} / {diffuses} épisodes vus
                  {' · '}
                  {progress.next ? (
                    <span>
                      Prochain : S{progress.next.season}E
                      {String(progress.next.episode).padStart(2, '0')} —{' '}
                      {progress.next.name}
                    </span>
                  ) : (
                    <span className="progress__done">À jour</span>
                  )}
                </p>
                {aVenir > 0 && (
                  <p className="hint">
                    {aVenir === 1
                      ? '1 épisode annoncé, pas encore diffusé.'
                      : `${aVenir} épisodes annoncés, pas encore diffusés.`}
                  </p>
                )}
              </div>
            )}

            <button
              className="btn btn--ghost btn--wide season-all"
              onClick={toggleSerieEntiere}
              disabled={busy}
            >
              <Icon name="check" size={16} />
              {serieVue ? "Je n'ai pas vu cette série" : "J'ai vu toute la série"}
            </button>

            <ul className="season-list">
              {seasons.map((s) => (
                <li key={s.seasonNumber} className="season">
                  {/* Deux commandes distinctes sur la même ligne : ouvrir la
                      saison, ou la marquer vue sans l'ouvrir. */}
                  <div className="season__head">
                    <button
                      className="season__open"
                      onClick={() => openSeason(s.seasonNumber)}
                    >
                      <span>{s.name}</span>
                      <span className="season__count">
                        {s.watched} / {s.aired} ép.
                      </span>
                    </button>
                    <button
                      className={`season__tick ${saisonVue(s) ? 'on' : ''}`}
                      disabled={busy}
                      title={saisonVue(s) ? 'Décocher la saison' : 'Marquer la saison vue'}
                      aria-label={
                        saisonVue(s) ? 'Décocher la saison' : 'Marquer la saison vue'
                      }
                      onClick={(e) => toggleSaisonDepuisLaListe(s, e)}
                    >
                      <Icon name="check" size={15} />
                    </button>
                  </div>

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

        {info?.overview && (
          <div className="section">
            <h4>Synopsis</h4>
            <p className="synopsis">{info.overview}</p>
          </div>
        )}

        {/* Saga : les films dans l'ordre de sortie, celui qu'on regarde repéré
            à sa place. Ce sont les cartes des grilles — même liseré d'état, même
            pastille d'ajout, même appui long — pour compléter une saga sans
            ouvrir chaque fiche. */}
        {saga?.length > 1 && (
          <div className="section">
            <h4>{info.collection.name}</h4>
            <p className="hint saga__hint">
              {saga.length} films, dans l'ordre de sortie.
            </p>
            <div className="saga" ref={sagaRef}>
              {saga.map((film, i) => {
                const cle = `movie-${film.id}`;
                const ici = film.id === item.id;
                return (
                  <div key={cle} className={`saga__item ${ici ? 'is-here' : ''}`}>
                    <span className="saga__rank">{ici ? 'Ce film' : `${i + 1}`}</span>
                    <MovieCard
                      item={film}
                      isFollowed={suivi.has(cle)}
                      status={suivi.get(cle)?.status}
                      {...cardProps}
                      // Toucher le film ouvert ne rouvre pas la même fiche.
                      onOpenDetail={ici ? () => {} : cardProps.onOpenDetail}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isFollowed && (
          <div className="section">
            <h4>Ma note</h4>
            <div className="rating" role="group" aria-label="Note en étoiles">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`rating__star ${rating >= n ? 'on' : ''}`}
                  aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                  aria-pressed={rating >= n}
                  onClick={() => cliqueEtoile(n)}
                >
                  <Icon name="star" size={26} />
                </button>
              ))}
              <span className="rating__value">
                {rating ? `${rating} / 5` : 'Pas encore noté'}
              </span>
            </div>

            <textarea
              className="avis"
              rows={3}
              placeholder="Ce que j'en ai pensé…"
              value={avis}
              onChange={(e) => tapeAvis(e.target.value)}
              onBlur={sauveAvis}
            />
            <p className="hint rating__state">
              {noteEnregistree ? 'Enregistré' : 'Non enregistré'}
            </p>
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
                {listeIds.includes(l.id) && <Icon name="check" size={13} />}
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

      </div>
    </div>
  );
}

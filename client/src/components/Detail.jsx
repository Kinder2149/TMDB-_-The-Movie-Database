import { vibre } from '../tactile.js';
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
  getVisionnages,
  addVisionnage,
  removeVisionnage,
  setVisionnageDate,
  rewatchSeason,
  getCollection,
  getRecommendations,
} from '../api.js';
import { deriveSeriesStatus, releaseBadge } from '../status.js';
import Icon from './Icon.jsx';
import Visionnages from './Visionnages.jsx';
import MovieCard from './MovieCard.jsx';
import FicheEntete from './FicheEntete.jsx';
import FicheStatut from './FicheStatut.jsx';
import FicheProgression from './FicheProgression.jsx';
import FicheSaisons from './FicheSaisons.jsx';

// Fiche détail générique (film ou série). Pour une série suivie, la
// progression et les saisons/épisodes sont intégrées ici.
// Ce fichier garde l'état et les appels ; l'affichage est dans les Fiche*.jsx.
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
  onOpenActor, // touche un acteur : ses films et séries
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

  // --- Journal de visionnages (M4) ---
  // Une ligne par visionnage, par film ou par épisode. Chargé une fois le
  // titre suivi ; rechargé après chaque « J'ai revu ».
  const [visionnages, setVisionnages] = useState([]);
  const [revoirEnCours, setRevoirEnCours] = useState(false);

  useEffect(() => {
    if (!isFollowed) return;
    getVisionnages(item.mediaType, item.id).then(setVisionnages).catch(() => {});
    // `status` : marquer « Vu » pose un visionnage automatique (M4, D2) —
    // sans cette dépendance, le compteur ne le voyait qu'au prochain « J'ai
    // revu » ou à la réouverture de la fiche.
  }, [item.id, item.mediaType, isFollowed, status]);

  // Films : compte et date du dernier visionnage. Un film qu'on vient de
  // marquer « vu » a déjà une ligne (posée automatiquement) — ce bouton sert
  // aux fois suivantes.
  const visionnagesFilm = !isSeries ? visionnages : [];
  async function revoirLeFilm() {
    setRevoirEnCours(true);
    try {
      await addVisionnage(item.mediaType, item.id, {});
      setVisionnages(await getVisionnages(item.mediaType, item.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setRevoirEnCours(false);
    }
  }

  // Séries : visionnages par épisode (du plus récent au plus ancien), pour la
  // pastille sous la case et pour savoir quelle ligne retirer en premier.
  const visionnagesParEpisode = new Map();
  for (const v of visionnages) {
    if (v.season == null) continue;
    const cle = `${v.season}-${v.episode}`;
    if (!visionnagesParEpisode.has(cle)) visionnagesParEpisode.set(cle, []);
    visionnagesParEpisode.get(cle).push(v);
  }
  async function revoirEpisode(season, episode) {
    await addVisionnage(item.mediaType, item.id, { season, episode });
    setVisionnages(await getVisionnages(item.mediaType, item.id));
  }

  // Retirer une ligne du journal (correction d'un clic de trop). `listVisionnages`
  // rend le plus récent en premier : sans préciser d'id, on retire toujours le
  // dernier — c'est le seul qu'on vient de poser par erreur.
  async function retirerVisionnage(id) {
    await removeVisionnage(id);
    setVisionnages(await getVisionnages(item.mediaType, item.id));
  }

  async function changerDateVisionnage(id, date) {
    try {
      await setVisionnageDate(id, date);
      setVisionnages(await getVisionnages(item.mediaType, item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  // Ajoute un visionnage à une date choisie : sert surtout au 1er visionnage
  // des titres vus avant que le journal n'existe.
  async function ajouterVisionnageDate(options, date) {
    try {
      await addVisionnage(item.mediaType, item.id, { ...options, date });
      setVisionnages(await getVisionnages(item.mediaType, item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  // Épisode dont on montre les dates (un seul à la fois).
  const [episodeDates, setEpisodeDates] = useState(null);

  // « J'ai revu toute la saison » : +1 visionnage sur chaque épisode déjà vu.
  async function revoirSaison() {
    setBusy(true);
    try {
      await rewatchSeason(item.id, expanded);
      setVisionnages(await getVisionnages(item.mediaType, item.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // --- Épisodes (séries suivies uniquement) ---
  const [seasons, setSeasons] = useState([]);
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [busy, setBusy] = useState(false); // un raccourci est en cours

  // Le catalogue injoignable ne vide pas la fiche : on garde ce que le suivi sait déjà
  // (titre, affiche) et on propose de réessayer.
  const [detailsErreur, setDetailsErreur] = useState(false);
  const [essai, setEssai] = useState(0);
  const [synopsisOuvert, setSynopsisOuvert] = useState(false);

  useEffect(() => {
    setDetailsErreur(false);
    getDetails(item.mediaType, item.id)
      .then(setInfo)
      .catch(() => setDetailsErreur(true));
  }, [item.id, item.mediaType, essai]);

  // --- Saga ---
  // Chargée après la fiche, dont on a besoin pour savoir s'il y a une saga.
  // Une saga injoignable ne mérite pas un message d'erreur : le rayon manque, rien de plus.
  const [saga, setSaga] = useState(null);
  const collectionId = info?.collection?.id;
  useEffect(() => {
    if (!collectionId) return;
    getCollection(collectionId).then(setSaga).catch(() => setSaga(null));
  }, [collectionId]);

  // --- Dans le même esprit ---
  // Recommandations TMDB, chargées à part : leur absence ne doit rien casser.
  const [similaires, setSimilaires] = useState([]);
  useEffect(() => {
    let annule = false;
    getRecommendations(item.mediaType, item.id)
      .then((liste) => {
        if (!annule) setSimilaires(liste.slice(0, 12));
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [item.id, item.mediaType]);

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
      // Cocher un épisode pose un visionnage (M4) sans forcément changer le
      // statut de la série — la dépendance sur `status` de l'effet plus haut
      // ne suffirait donc pas à rafraîchir le journal.
      getVisionnages(item.mediaType, item.id).then(setVisionnages).catch(() => {});
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
      else {
        await markEpisode(item.id, expanded, ep.episodeNumber);
        vibre();
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
        await markWholeSeason(item.id, expanded, episodes.map((e) => e.episodeNumber));
        vibre();
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


  // « Marquer S2E10 comme vu » : l'épisode suivant, sans ouvrir la saison.
  async function marquerProchain() {
    const next = progress?.next;
    if (!next) return;
    setBusy(true);
    try {
      await markEpisode(item.id, next.season, next.episode);
      vibre();
      if (expanded === next.season) {
        setEpisodes(await getSeasonEpisodes(item.id, next.season));
      }
      await refreshProgress();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Location et achat sont souvent la même liste : on fusionne et dédoublonne.
  const providers = info?.providers;
  const locationAchat = providers
    ? Array.from(
        new Map([...providers.rent, ...providers.buy].map((p) => [p.name, p])).values()
      )
    : [];
  const hasStreaming =
    providers && (providers.flatrate.length > 0 || locationAchat.length > 0);

  // Statut d'une série : dérivé de la progression, sauf « Abandonné » qui est le seul choix
  // manuel (et « Reprendre le suivi » qui en sort : le statut revient à la progression réelle).
  function pickStatus(value) {
    const poser = (statut) => {
      vibre();
      return onSetStatus(item, statut);
    };
    if (!isSeries) return poser(value);
    if (value === 'abandonne') return poser('abandonne');
    if (current === 'abandonne') return poser(deriveSeriesStatus(progress));
  }

  const enChargement = !info && !detailsErreur;
  const horsConnexion = !info && detailsErreur;
  const badge =
    isFollowed && info
      ? releaseBadge({
          isSeries,
          releaseDate: info.releaseDate,
          status: info.status,
          nextEpisodeDate: info.nextEpisodeDate,
          seriesEnded: info.seriesEnded,
        })
      : null;
  const synopsisLong = (info?.overview || '').length > 190;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet fiche" onClick={(e) => e.stopPropagation()}>
        <FicheEntete
          item={item}
          info={info}
          isSeries={isSeries}
          enChargement={enChargement}
          onClose={onClose}
        />

        <div className="fiche__corps">
          <FicheStatut
            isSeries={isSeries}
            isFollowed={isFollowed}
            current={current}
            onPick={pickStatus}
            onAjouter={() => onToggleFollow(item)}
          />

          {error && <p className="message message--erreur">{error}</p>}

          {horsConnexion && (
            <div className="panel">
              <div className="vide">
                <span className="vide__ico">
                  <Icon name="info" size={28} />
                </span>
                <p className="vide__titre">Détails indisponibles</p>
                <p className="vide__texte">
                  Impossible de joindre le catalogue. Vérifie ta connexion.
                </p>
                <button className="btn btn--ghost" onClick={() => setEssai((n) => n + 1)}>
                  <Icon name="refresh" size={15} /> Réessayer
                </button>
              </div>
            </div>
          )}

          {badge && (
            <div className="panel panel--accent fiche__badge">
              <span className="tag">
                <Icon name="calendar" size={14} />
                {badge}
              </span>
            </div>
          )}

          {/* Série suivie : où j'en suis, puis les saisons. */}
          {isSeries && isFollowed && (
            <>
              <FicheProgression
                progress={progress}
                diffuses={diffuses}
                aVenir={aVenir}
                pct={pct}
                busy={busy}
                onMarquer={marquerProchain}
              />
              <FicheSaisons
                seasons={seasons}
                expanded={expanded}
                episodes={episodes}
                loadingEpisodes={loadingEpisodes}
                busy={busy}
                serieVue={serieVue}
                allWatched={allWatched}
                visionnagesParEpisode={visionnagesParEpisode}
                episodeDates={episodeDates}
                saisonVue={saisonVue}
                onOpenSeason={openSeason}
                onToggleSaison={toggleSaisonDepuisLaListe}
                onToggleSerie={toggleSerieEntiere}
                onToggleWholeSeason={toggleWholeSeason}
                onRevoirSaison={revoirSaison}
                onToggleEpisode={toggleEpisode}
                onRevoirEpisode={revoirEpisode}
                onToggleDates={(n) => setEpisodeDates(episodeDates === n ? null : n)}
                onRetirerVisionnage={retirerVisionnage}
                onChangeDate={changerDateVisionnage}
                onAjouterDate={ajouterVisionnageDate}
              />
            </>
          )}

          {isSeries && !isFollowed && (
            <p className="panel__note">Ajoute la série à ton suivi pour cocher les épisodes.</p>
          )}

          {/* Ma note (étoiles) et bande-annonce : sur une même carte. */}
          {(isFollowed || info?.trailer) && (
            <div className="panel fiche__note">
              {isFollowed && (
                <div className="fiche__etoiles">
                  <p className="eyebrow">Ma note</p>
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
                  </div>
                  <p className="rating__value">{rating ? `${rating} / 5` : 'Pas encore noté'}</p>
                </div>
              )}
              {info?.trailer && (
                <a
                  className="btn btn--ghost fiche__trailer"
                  href={info.trailer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="play" size={14} />
                  {info.trailer.recherche ? 'Chercher la bande-annonce' : 'Bande-annonce'}
                </a>
              )}
            </div>
          )}

          {enChargement && (
            <div className="skeleton skeleton--bloc" aria-hidden="true" />
          )}

          {info && (
            <section className="sec">
              <header className="sec__head">
                <div className="sec__txt">
                  <h3 className="sec__title">Où le regarder</h3>
                  <p className="sec__sub">En France</p>
                </div>
              </header>
              {hasStreaming ? (
                <>
                  {providers.flatrate.length > 0 && (
                    <Plateformes etiquette="Abonnement" liste={providers.flatrate} />
                  )}
                  {locationAchat.length > 0 && (
                    <Plateformes etiquette="Location et achat" liste={locationAchat} />
                  )}
                  <p className="attn">Disponibilité fournie par JustWatch (via TMDB).</p>
                </>
              ) : (
                <p className="panel__note">Pas d’info de disponibilité pour le moment.</p>
              )}
            </section>
          )}

          {info?.overview && (
            <section className="sec">
              <header className="sec__head">
                <div className="sec__txt">
                  <h3 className="sec__title">Synopsis</h3>
                </div>
              </header>
              <p className={`synopsis ${synopsisLong && !synopsisOuvert ? 'synopsis--replie' : ''}`}>
                {info.overview}
              </p>
              {synopsisLong && (
                <button className="lien lien--gauche" onClick={() => setSynopsisOuvert((o) => !o)}>
                  {synopsisOuvert ? 'Réduire' : 'Lire la suite'}
                </button>
              )}
            </section>
          )}

          {info?.cast?.length > 0 && (
            <section className="sec">
              <header className="sec__head">
                <div className="sec__txt">
                  <h3 className="sec__title">Têtes d’affiche</h3>
                </div>
              </header>
              <div className="cast">
                {info.cast.map((a) => (
                  <button
                    className="actor"
                    key={a.id}
                    onClick={() => onOpenActor(a)}
                    aria-label={`Voir les films et séries avec ${a.name}`}
                  >
                    {a.photoUrl ? (
                      <img className="actor__ph" src={a.photoUrl} alt="" />
                    ) : (
                      <div className="actor__ph actor__ph--empty">{a.name.charAt(0)}</div>
                    )}
                    <span className="actor__n">{a.name}</span>
                    {a.character && <span className="actor__r">{a.character}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Journal de visionnages (M4) : un film seulement, une série se revoit épisode par
              épisode, dans ses saisons. */}
          {!isSeries && isFollowed && (
            <section className="sec">
              <div className="panel">
                <h3 className="panel__title">Mes visionnages</h3>
                <p className="panel__note">
                  {visionnagesFilm.length > 1
                    ? `Vu ${visionnagesFilm.length} fois. Une date par fois, modifiable.`
                    : 'Une date par fois, modifiable. Rien d’obligatoire.'}
                </p>
                <Visionnages
                  liste={visionnagesFilm}
                  onChangeDate={changerDateVisionnage}
                  onRemove={retirerVisionnage}
                  onAdd={(date) => ajouterVisionnageDate({}, date)}
                />
                <button
                  className="btn btn--primary btn--wide fiche__revoir"
                  onClick={revoirLeFilm}
                  disabled={revoirEnCours}
                >
                  <Icon name="refresh" size={16} />
                  J’ai revu ce film
                </button>
              </div>
            </section>
          )}

          {isFollowed && (
            <section className="sec">
              <div className="panel">
                <h3 className="panel__title">Mon avis</h3>
                <textarea
                  className="avis"
                  rows={3}
                  placeholder="Ce que j'en ai pensé…"
                  value={avis}
                  onChange={(e) => tapeAvis(e.target.value)}
                  onBlur={sauveAvis}
                />
                <p className="panel__note rating__state">
                  {noteEnregistree ? 'Enregistré' : 'Non enregistré'}
                </p>
              </div>
            </section>
          )}

          {similaires.length > 0 && (
            <section className="sec">
              <header className="sec__head">
                <div className="sec__txt">
                  <h3 className="sec__title">Dans le même esprit</h3>
                </div>
              </header>
              <div className="rail" role="list">
                {similaires.map((s, i) => {
                  const cle = `${s.mediaType}-${s.id}`;
                  return (
                    <div
                      key={cle}
                      className="rail__item rise"
                      role="listitem"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <MovieCard
                        item={s}
                        isFollowed={suivi.has(cle)}
                        status={suivi.get(cle)?.status}
                        {...cardProps}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Saga : les films dans l'ordre de sortie, celui qu'on regarde repéré à sa place.
              Ce sont les cartes des grilles — même liseré d'état, même pastille d'ajout,
              même appui long — pour compléter une saga sans ouvrir chaque fiche. */}
          {saga?.length > 1 && (
            <section className="sec">
              <header className="sec__head">
                <div className="sec__txt">
                  <h3 className="sec__title">{info.collection.name}</h3>
                  <p className="sec__sub">{saga.length} films, dans l’ordre de sortie</p>
                </div>
              </header>
              <div className="rail" role="list" ref={sagaRef}>
                {saga.map((film, i) => {
                  const cle = `movie-${film.id}`;
                  const ici = film.id === item.id;
                  return (
                    <div
                      key={cle}
                      role="listitem"
                      className={`rail__item rise ${ici ? 'is-here' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <MovieCard
                        item={film}
                        isFollowed={suivi.has(cle)}
                        status={suivi.get(cle)?.status}
                        {...cardProps}
                        // Toucher le film ouvert ne rouvre pas la même fiche.
                        onOpenDetail={ici ? () => {} : cardProps.onOpenDetail}
                      />
                      <span className="rail__legende">{ici ? 'Ce film' : `${i + 1}`}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {isFollowed && (
            <section className="sec">
              <div className="panel">
                <h3 className="panel__title">Mes listes</h3>
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
                    <Icon name="plus" size={13} /> Nouvelle liste
                  </button>
                </div>
              </div>
            </section>
          )}

          {isFollowed && (
            <button className="lien lien--danger" onClick={() => onToggleFollow(item)}>
              Retirer de mon suivi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Logos des plateformes (abonnement, location / achat) : l'image porte l'information, les
// noms sont écrits dessous pour qui ne reconnaît pas un logo.
function Plateformes({ etiquette, liste }) {
  return (
    <div className="prov-groupe">
      <p className="eyebrow">{etiquette}</p>
      <div className="prov-logos">
        {liste.map((p) =>
          p.logoUrl ? (
            <img className="prov-logo" key={p.name} src={p.logoUrl} alt={p.name} title={p.name} />
          ) : (
            <span className="prov-logo prov-logo--lettre" key={p.name} title={p.name}>
              {p.name.charAt(0)}
            </span>
          )
        )}
      </div>
      <p className="panel__note">{liste.map((p) => p.name).join(', ')}</p>
    </div>
  );
}

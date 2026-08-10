import { useState, useEffect, useRef } from 'react';
import SearchBar from './components/SearchBar.jsx';
import MovieCard from './components/MovieCard.jsx';
import Detail from './components/Detail.jsx';
import Lists from './components/Lists.jsx';
import Tonight from './components/Tonight.jsx';
import Suggestions from './components/Suggestions.jsx';
import ProfileSelector from './components/ProfileSelector.jsx';
import {
  searchTitles,
  searchByActor,
  getGenres,
  discoverGenre,
  getTrending,
  getSuggestions,
  getSuivi,
  addToSuivi,
  removeFromSuivi,
  setStatus as apiSetStatus,
  getProfiles,
  createProfile,
  renameProfile,
  getActiveProfileId,
  setActiveProfileId,
  getListes,
  createListe as apiCreateListe,
  deleteListe as apiDeleteListe,
  addToListe as apiAddToListe,
  removeFromListe as apiRemoveFromListe,
} from './api.js';

const keyOf = (item) => `${item.mediaType}-${item.id}`;

export default function App() {
  const [view, setView] = useState('search'); // 'search' | 'lists'
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [mediaFilter, setMediaFilter] = useState('all'); // all | movie | tv
  const [searchMode, setSearchMode] = useState('title'); // title | actor | genre
  const [person, setPerson] = useState(null); // acteur résolu (mode acteur)
  const [genres, setGenres] = useState([]); // [{ name, movieId, tvId }]
  const [trending, setTrending] = useState([]); // tendances (champ vide)
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genrePage, setGenrePage] = useState(1);
  const [genreMore, setGenreMore] = useState(true);
  const searchSeq = useRef(0);
  // Suivi complet : clé -> item (avec status et listStatus).
  const [suivi, setSuivi] = useState(() => new Map());
  const [openDetail, setOpenDetail] = useState(null);
  // Profils : la liste et l'id actif. Tant qu'aucun profil n'est prêt, on ne
  // lance aucune requête de suivi (elles exigent l'en-tête X-Profile-Id).
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(getActiveProfileId());
  // Thème clair / sombre (posé sur <html> par main.jsx au démarrage).
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  );

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* localStorage indisponible : le thème reste juste pour la session */
    }
  }

  const [listes, setListes] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  function loadSuivi() {
    getSuivi()
      .then((items) => setSuivi(new Map(items.map((i) => [keyOf(i), i]))))
      .catch(() => {});
  }

  function loadListes() {
    getListes().then(setListes).catch(() => {});
  }

  function loadSuggestions() {
    setSuggestionsLoading(true);
    getSuggestions()
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }

  // Au démarrage : charger les profils et fixer le profil actif.
  // Si l'id mémorisé (localStorage) n'existe plus, on prend le premier profil.
  useEffect(() => {
    getProfiles()
      .then((list) => {
        setProfiles(list);
        const stored = getActiveProfileId();
        const chosen = list.find((p) => p.id === stored) || list[0];
        if (chosen) {
          setActiveProfileId(chosen.id);
          setActiveProfile(chosen.id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  // Recharger le suivi dès qu'un profil actif est disponible / change.
  useEffect(() => {
    if (activeProfile) {
      loadSuivi();
      loadListes();
    }
  }, [activeProfile]);

  // Genres et tendances chargés une fois (indépendants du profil).
  useEffect(() => {
    getGenres().then(setGenres).catch(() => {});
    getTrending().then(setTrending).catch(() => {});
  }, []);

  // En mode genre, changer le filtre Films/Séries relance la découverte.
  // Si le genre sélectionné n'existe pas pour le nouveau filtre (ex. « Action »
  // en filtre Séries), on désélectionne plutôt que d'afficher une liste vide.
  useEffect(() => {
    if (searchMode !== 'genre' || !selectedGenre) return;
    const stillValid =
      mediaFilter === 'movie'
        ? !!selectedGenre.movieId
        : mediaFilter === 'tv'
        ? !!selectedGenre.tvId
        : true;
    if (!stillValid) {
      setSelectedGenre(null);
      setResults([]);
      setHasSearched(false);
      setStatus('idle');
      return;
    }
    runDiscover(selectedGenre, mediaFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFilter]);

  function handleSelectProfile(id) {
    setActiveProfileId(id);
    setActiveProfile(id);
    setOpenDetail(null); // la fiche ouverte appartenait à l'ancien profil
  }

  async function handleCreateProfile(name) {
    try {
      const created = await createProfile(name);
      setProfiles((prev) => [...prev, created]);
      handleSelectProfile(created.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRenameProfile(id, name) {
    try {
      await renameProfile(id, name);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSearch(query) {
    const seq = ++searchSeq.current;
    if (!query) {
      setResults([]);
      setPerson(null);
      setStatus('idle');
      setHasSearched(false);
      return;
    }
    setStatus('loading');
    setError('');
    setHasSearched(true);
    try {
      if (searchMode === 'actor') {
        const { person: found, results: credits } = await searchByActor(query);
        if (seq === searchSeq.current) {
          setPerson(found);
          setResults(credits);
          setStatus('done');
        }
      } else {
        const found = await searchTitles(query);
        if (seq === searchSeq.current) {
          setPerson(null);
          setResults(found);
          setStatus('done');
        }
      }
    } catch (err) {
      // On ignore les réponses dépassées (frappe rapide).
      if (seq === searchSeq.current) {
        setError(err.message);
        setStatus('error');
      }
    }
  }

  // Change de mode de recherche en repartant d'un état propre.
  function changeMode(mode) {
    setSearchMode(mode);
    setSelectedGenre(null);
    setPerson(null);
    setResults([]);
    setHasSearched(false);
    setStatus('idle');
  }

  async function runDiscover(genre, filter, page = 1, append = false) {
    const seq = ++searchSeq.current;
    setError('');
    setHasSearched(true);
    setPerson(null);
    const params = { page };
    if ((filter === 'all' || filter === 'movie') && genre.movieId)
      params.movieGenre = genre.movieId;
    if ((filter === 'all' || filter === 'tv') && genre.tvId)
      params.tvGenre = genre.tvId;

    // Genre inexistant pour ce filtre (ex. « Horreur » en séries) : liste vide.
    if (!params.movieGenre && !params.tvGenre) {
      setResults([]);
      setGenreMore(false);
      setStatus('done');
      return;
    }
    if (!append) setStatus('loading');
    try {
      const found = await discoverGenre(params);
      if (seq !== searchSeq.current) return;
      setGenrePage(page);
      setGenreMore(found.length > 0);
      setResults((prev) => {
        if (!append) return found;
        const seen = new Set(prev.map((r) => `${r.mediaType}-${r.id}`));
        return [...prev, ...found.filter((r) => !seen.has(`${r.mediaType}-${r.id}`))];
      });
      setStatus('done');
    } catch (err) {
      if (seq === searchSeq.current) {
        setError(err.message);
        setStatus('error');
      }
    }
  }

  function selectGenre(genre) {
    setSelectedGenre(genre);
    setGenrePage(1);
    setGenreMore(true);
    runDiscover(genre, mediaFilter, 1, false);
  }

  async function handleToggleFollow(item) {
    const key = keyOf(item);
    try {
      if (suivi.has(key)) {
        await removeFromSuivi(item.mediaType, item.id);
      } else {
        await addToSuivi(item);
      }
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetStatus(item, newStatus) {
    try {
      await apiSetStatus(item.mediaType, item.id, newStatus);
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateListe(name) {
    try {
      const created = await apiCreateListe(name);
      loadListes();
      return created;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteListe(id) {
    try {
      await apiDeleteListe(id);
      loadListes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddToListe(listeId, item) {
    try {
      await apiAddToListe(listeId, item);
      loadListes();
      loadSuivi(); // ajouter à une liste ajoute aussi au suivi
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveFromListe(listeId, item) {
    try {
      await apiRemoveFromListe(listeId, item.mediaType, item.id);
      loadListes();
    } catch (err) {
      setError(err.message);
    }
  }

  // À la fermeture de la fiche, on recharge : cocher des épisodes / marquer vu
  // a pu faire passer le titre d'une liste à l'autre.
  function closeDetail() {
    setOpenDetail(null);
    loadSuivi();
  }

  const cardProps = {
    onToggleFollow: handleToggleFollow,
    onSetStatus: handleSetStatus,
    onOpenDetail: setOpenDetail,
  };

  const filteredResults =
    mediaFilter === 'all'
      ? results
      : results.filter((r) => r.mediaType === mediaFilter);

  // Certains genres TMDB n'existent que côté films ou que côté séries
  // (ex. « Action » n'a pas d'équivalent séries, qui a « Action & Aventure »).
  // On ne propose que les genres valides pour le filtre Films/Séries actif,
  // sinon le clic donnerait toujours une liste vide.
  const availableGenres = genres.filter((g) => {
    if (mediaFilter === 'movie') return !!g.movieId;
    if (mediaFilter === 'tv') return !!g.tvId;
    return !!(g.movieId || g.tvId);
  });

  // Écran de recherche à vide (titre / acteur, avant toute frappe) : on propose
  // les tendances plutôt qu'un écran vide.
  const isDefault = searchMode !== 'genre' && !hasSearched;
  const trendingFiltered =
    mediaFilter === 'all'
      ? trending
      : trending.filter((r) => r.mediaType === mediaFilter);

  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <span className="brand__dot" aria-hidden="true"></span>
          <span className="brand__name">Suivi</span>
        </div>

        <nav className="nav">
          <button
            className={view === 'search' ? 'is-active' : ''}
            onClick={() => setView('search')}
          >
            Recherche
          </button>
          <button
            className={view === 'tonight' ? 'is-active' : ''}
            onClick={() => {
              setView('tonight');
              loadSuivi();
            }}
          >
            Ce soir
          </button>
          <button
            className={view === 'lists' ? 'is-active' : ''}
            onClick={() => {
              setView('lists');
              loadSuivi();
            }}
          >
            Mes listes
          </button>
          <button
            className={view === 'suggestions' ? 'is-active' : ''}
            onClick={() => {
              setView('suggestions');
              loadSuivi();
              loadSuggestions();
            }}
          >
            Suggestions
          </button>
        </nav>

        <div className="appbar__right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title="Basculer clair / sombre"
            aria-label="Basculer le thème"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <ProfileSelector
            profiles={profiles}
            activeId={activeProfile}
            onSelect={handleSelectProfile}
            onCreate={handleCreateProfile}
            onRename={handleRenameProfile}
          />
        </div>
      </header>

      <main className="content">

      {view === 'search' && (
        <>
          <div className="searchmodes">
            <span className="searchmodes__label">Chercher par</span>
            <button
              className={`chip ${searchMode === 'title' ? 'on' : ''}`}
              onClick={() => changeMode('title')}
            >
              Titre
            </button>
            <button
              className={`chip ${searchMode === 'actor' ? 'on' : ''}`}
              onClick={() => changeMode('actor')}
            >
              Acteur
            </button>
            <button
              className={`chip ${searchMode === 'genre' ? 'on' : ''}`}
              onClick={() => changeMode('genre')}
            >
              Genre
            </button>
          </div>

          {searchMode === 'genre' ? (
            <div className="genre-picker">
              {genres.map((g) => {
                const available = availableGenres.includes(g);
                return (
                  <button
                    key={g.name}
                    className={`chip ${selectedGenre?.name === g.name ? 'on' : ''} ${
                      available ? '' : 'chip--disabled'
                    }`}
                    disabled={!available}
                    onClick={() => selectGenre(g)}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <SearchBar
              onSearch={handleSearch}
              mode={searchMode}
              placeholder={
                searchMode === 'actor'
                  ? 'Chercher un acteur…'
                  : 'Chercher un film ou une série…'
              }
            />
          )}

          {(hasSearched || (isDefault && trending.length > 0)) && (
            <div className="filters">
              {[
                ['all', 'Tout'],
                ['movie', 'Films'],
                ['tv', 'Séries'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  className={`chip ${mediaFilter === v ? 'on' : ''}`}
                  onClick={() => setMediaFilter(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {searchMode === 'actor' && person && (
            <div className="actor-head">
              {person.photoUrl && <img src={person.photoUrl} alt={person.name} />}
              <span>
                Films &amp; séries avec <b>{person.name}</b>
              </span>
            </div>
          )}

          {searchMode === 'genre' && selectedGenre && (
            <div className="actor-head">
              <span>
                Genre : <b>{selectedGenre.name}</b>
              </span>
            </div>
          )}

          {status === 'loading' && <p className="hint">Recherche en cours…</p>}
          {status === 'error' && <p className="error">{error}</p>}
          {status === 'done' &&
            hasSearched &&
            searchMode === 'actor' &&
            !person && <p className="hint">Aucun acteur trouvé.</p>}
          {status === 'done' &&
            hasSearched &&
            filteredResults.length === 0 &&
            !(searchMode === 'actor' && !person) && (
              <p className="hint">Aucun résultat.</p>
            )}

          {isDefault && trendingFiltered.length > 0 && (
            <>
              <div className="actor-head">
                <span>✨ Tendances de la semaine</span>
              </div>
              <section className="grid">
                {trendingFiltered.map((item) => (
                  <MovieCard
                    key={keyOf(item)}
                    item={item}
                    isFollowed={suivi.has(keyOf(item))}
                    status={suivi.get(keyOf(item))?.status}
                    {...cardProps}
                  />
                ))}
              </section>
            </>
          )}

          <section className="grid">
            {filteredResults.map((item) => (
              <MovieCard
                key={keyOf(item)}
                item={item}
                isFollowed={suivi.has(keyOf(item))}
                status={suivi.get(keyOf(item))?.status}
                {...cardProps}
              />
            ))}
          </section>

          {searchMode === 'genre' &&
            selectedGenre &&
            genreMore &&
            status === 'done' &&
            filteredResults.length > 0 && (
              <div className="voirplus">
                <button
                  className="btn btn--ghost"
                  onClick={() =>
                    runDiscover(selectedGenre, mediaFilter, genrePage + 1, true)
                  }
                >
                  Voir plus
                </button>
              </div>
            )}
        </>
      )}

      {view === 'lists' && (
        <Lists
          items={Array.from(suivi.values())}
          listes={listes}
          onCreateListe={handleCreateListe}
          onDeleteListe={handleDeleteListe}
          {...cardProps}
        />
      )}

      {view === 'tonight' && (
        <Tonight items={Array.from(suivi.values())} cardProps={cardProps} />
      )}

      {view === 'suggestions' && (
        <Suggestions
          items={Array.from(suivi.values())}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
          onRefreshSuggestions={loadSuggestions}
          cardProps={cardProps}
        />
      )}
      </main>

      {openDetail && (
        <Detail
          item={openDetail}
          isFollowed={suivi.has(keyOf(openDetail))}
          status={suivi.get(keyOf(openDetail))?.status}
          listes={listes}
          onToggleFollow={handleToggleFollow}
          onSetStatus={handleSetStatus}
          onCreateListe={handleCreateListe}
          onAddToListe={handleAddToListe}
          onRemoveFromListe={handleRemoveFromListe}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar.jsx';
import MovieCard from './components/MovieCard.jsx';
import SeriesDetail from './components/SeriesDetail.jsx';
import Lists from './components/Lists.jsx';
import ProfileSelector from './components/ProfileSelector.jsx';
import {
  searchTitles,
  getSuivi,
  addToSuivi,
  removeFromSuivi,
  setWatched,
  getProfiles,
  createProfile,
  renameProfile,
  getActiveProfileId,
  setActiveProfileId,
} from './api.js';

const keyOf = (item) => `${item.mediaType}-${item.id}`;

export default function App() {
  const [view, setView] = useState('search'); // 'search' | 'lists'
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  // Suivi complet : clé -> item (avec status et listStatus).
  const [suivi, setSuivi] = useState(() => new Map());
  const [openSeries, setOpenSeries] = useState(null);
  // Profils : la liste et l'id actif. Tant qu'aucun profil n'est prêt, on ne
  // lance aucune requête de suivi (elles exigent l'en-tête X-Profile-Id).
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(getActiveProfileId());

  function loadSuivi() {
    getSuivi()
      .then((items) => setSuivi(new Map(items.map((i) => [keyOf(i), i]))))
      .catch(() => {});
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
    if (activeProfile) loadSuivi();
  }, [activeProfile]);

  function handleSelectProfile(id) {
    setActiveProfileId(id);
    setActiveProfile(id);
    setOpenSeries(null); // le panneau série appartenait à l'ancien profil
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
    setStatus('loading');
    setError('');
    setHasSearched(true);
    try {
      const found = await searchTitles(query);
      setResults(found);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
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

  async function handleToggleWatched(item) {
    const key = keyOf(item);
    const newStatus = suivi.get(key)?.status === 'vu' ? 'a_voir' : 'vu';
    try {
      await setWatched(item.mediaType, item.id, newStatus);
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  // À la fermeture du panneau série, on recharge : cocher des épisodes a pu
  // faire passer la série d'une liste à l'autre.
  function closeSeries() {
    setOpenSeries(null);
    loadSuivi();
  }

  const cardProps = {
    onToggleFollow: handleToggleFollow,
    onToggleWatched: handleToggleWatched,
    onOpenSeries: setOpenSeries,
  };

  return (
    <main className="app">
      <header className="app__head">
        <h1>Suivi Films &amp; Séries</h1>
        <ProfileSelector
          profiles={profiles}
          activeId={activeProfile}
          onSelect={handleSelectProfile}
          onCreate={handleCreateProfile}
          onRename={handleRenameProfile}
        />
      </header>

      <nav className="nav">
        <button
          className={view === 'search' ? 'is-active' : ''}
          onClick={() => setView('search')}
        >
          Recherche
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
      </nav>

      {view === 'search' && (
        <>
          <SearchBar onSearch={handleSearch} disabled={status === 'loading'} />

          {status === 'loading' && <p className="hint">Recherche en cours…</p>}
          {status === 'error' && <p className="error">{error}</p>}
          {status === 'done' && hasSearched && results.length === 0 && (
            <p className="hint">Aucun résultat.</p>
          )}

          <section className="grid">
            {results.map((item) => (
              <MovieCard
                key={keyOf(item)}
                item={item}
                isFollowed={suivi.has(keyOf(item))}
                watchStatus={suivi.get(keyOf(item))?.status}
                {...cardProps}
              />
            ))}
          </section>
        </>
      )}

      {view === 'lists' && (
        <Lists items={Array.from(suivi.values())} {...cardProps} />
      )}

      {openSeries && <SeriesDetail item={openSeries} onClose={closeSeries} />}
    </main>
  );
}

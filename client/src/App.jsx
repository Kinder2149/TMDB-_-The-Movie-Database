import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar.jsx';
import MovieCard from './components/MovieCard.jsx';
import SeriesDetail from './components/SeriesDetail.jsx';
import Lists from './components/Lists.jsx';
import {
  searchTitles,
  getSuivi,
  addToSuivi,
  removeFromSuivi,
  setWatched,
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

  function loadSuivi() {
    getSuivi()
      .then((items) => setSuivi(new Map(items.map((i) => [keyOf(i), i]))))
      .catch(() => {});
  }

  useEffect(() => {
    loadSuivi();
  }, []);

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
      <h1>Suivi Films &amp; Séries</h1>

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

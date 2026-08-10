import MovieCard from './MovieCard.jsx';

// Onglet « Suggestions » : recommandations TMDB agrégées depuis les titres
// marqués vus / en cours du profil.
export default function Suggestions({
  items,
  suggestions,
  suggestionsLoading,
  onRefreshSuggestions,
  cardProps,
}) {
  const sugFilms = suggestions.filter((i) => i.mediaType === 'movie');
  const sugSeries = suggestions.filter((i) => i.mediaType === 'tv');
  const byKey = new Map(items.map((i) => [`${i.mediaType}-${i.id}`, i]));

  const grid = (list) => (
    <section className="grid">
      {list.map((item) => {
        const key = `${item.mediaType}-${item.id}`;
        const followed = byKey.get(key);
        return (
          <MovieCard
            key={key}
            item={item}
            isFollowed={!!followed}
            status={followed?.status}
            {...cardProps}
          />
        );
      })}
    </section>
  );

  return (
    <div className="tonight">
      <h2 className="tonight__hero">Suggestions pour toi</h2>
      <p className="tonight__sub">
        Des idées basées sur ce que tu as déjà vu ou en cours.
      </p>

      <section className="tonight__section">
        <h3 className="tonight__title">
          <button
            className="btn btn--ghost tonight__refresh"
            onClick={onRefreshSuggestions}
            disabled={suggestionsLoading}
          >
            ↻ Actualiser
          </button>
        </h3>
        {suggestionsLoading ? (
          <p className="hint">Recherche de suggestions…</p>
        ) : suggestions.length === 0 ? (
          <p className="hint">
            Marque des titres comme vus ou en cours pour recevoir des
            suggestions.
          </p>
        ) : (
          <>
            {sugFilms.length > 0 && (
              <div className="media-section">
                <h4 className="subhead">Films</h4>
                {grid(sugFilms)}
              </div>
            )}
            {sugSeries.length > 0 && (
              <div className="media-section">
                <h4 className="subhead">Séries</h4>
                {grid(sugSeries)}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

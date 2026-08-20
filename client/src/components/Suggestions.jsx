import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';

// Section « Parce que vous avez aimé… » : recommandations TMDB agrégées depuis
// les titres marqués vus / en cours du profil. Affichée à l'intérieur de
// « Ce soir » (embedded), plus d'onglet dédié.
export default function Suggestions({
  items,
  suggestions,
  suggestionsLoading,
  onRefreshSuggestions,
  cardProps,
  embedded = false,
}) {
  const sugFilms = suggestions.filter((i) => i.mediaType === 'movie');
  const sugSeries = suggestions.filter((i) => i.mediaType === 'tv');
  const byKey = new Map(items.map((i) => [`${i.mediaType}-${i.id}`, i]));

  const grid = (list) => (
    <div className="grid">
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
    </div>
  );

  const body = suggestionsLoading ? (
    <p className="hint">Recherche de suggestions…</p>
  ) : suggestions.length === 0 ? (
    <p className="hint">
      Marque des titres comme vus ou en cours pour recevoir des suggestions.
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
  );

  return (
    <section className={embedded ? 'tonight__section' : 'tonight'}>
      <h3 className="tonight__title">
        Parce que vous avez aimé…
        <button
          className="btn btn--ghost tonight__refresh"
          onClick={onRefreshSuggestions}
          disabled={suggestionsLoading}
        >
          <Icon name="refresh" size={14} />
          Actualiser
        </button>
      </h3>
      {body}
    </section>
  );
}

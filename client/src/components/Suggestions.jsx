import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import Vide from './Vide.jsx';
import HorsLigne from './HorsLigne.jsx';
import { GrilleFantome } from './Fantomes.jsx';
import { useEnLigne } from '../reseau.js';

// Section « Parce que tu as aimé… » : recommandations TMDB agrégées depuis
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
  const byKey = new Map(items.map((i) => [`${i.mediaType}-${i.id}`, i]));

  // Films et séries mélangés dans une seule grille : le tirage les alterne déjà.
  const enLigne = useEnLigne();
  const body = suggestionsLoading ? (
    <GrilleFantome />
  ) : suggestions.length === 0 && !enLigne ? (
    <HorsLigne onRetry={onRefreshSuggestions} />
  ) : suggestions.length === 0 ? (
    <Vide
      icone="star"
      titre="Pas encore de suggestion"
      texte="Marque des titres comme vus ou en cours, et note-les : les idées viendront de là."
    />
  ) : (
    <div className="grid">
      {suggestions.map((item, i) => {
        const key = `${item.mediaType}-${item.id}`;
        const followed = byKey.get(key);
        return (
          <div
            className="rail__item rise"
            key={key}
            style={{ animationDelay: `${Math.min(i % 12, 8) * 30}ms` }}
          >
            <MovieCard item={item} isFollowed={!!followed} status={followed?.status} {...cardProps} />
          </div>
        );
      })}
    </div>
  );

  const actualiser = (enBas) => (
    <button
      className="btn btn--ghost tonight__refresh"
      onClick={() => {
        // Depuis le pied de liste, on remonte : la nouvelle liste commence en haut.
        if (enBas) window.scrollTo({ top: 0, behavior: 'smooth' });
        onRefreshSuggestions();
      }}
      disabled={suggestionsLoading}
    >
      <Icon name="refresh" size={14} />
      Actualiser
    </button>
  );

  return (
    <section className={embedded ? 'tonight__section' : 'tonight'}>
      <header className="sec__head">
        <div className="sec__txt">
          <h3 className="sec__title">Parce que tu as aimé…</h3>
          <p className="sec__sub">Choisis d'après ce que tu as vu et noté</p>
        </div>
        {actualiser(false)}
      </header>
      {body}
      {/* Même bouton en pied de liste : on n'a pas à remonter pour relancer. */}
      {!suggestionsLoading && suggestions.length > 0 && (
        <div className="suggestions__foot">{actualiser(true)}</div>
      )}
    </section>
  );
}

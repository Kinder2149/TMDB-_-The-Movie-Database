import MovieCard from './MovieCard.jsx';
import { isUpcoming, formatReleaseDate } from '../status.js';

// Onglet « Sorties à venir » : titres suivis (statut à voir) pas encore
// sortis. Purement dérivé de la date à l'affichage — dès que la date de
// sortie est dépassée, le titre repasse tout seul dans « À voir » classique.
export default function Upcoming({ items, cardProps }) {
  const upcoming = items
    .filter((i) => (i.status || 'a_voir') === 'a_voir' && isUpcoming(i))
    .sort((a, b) => (a.releaseDate < b.releaseDate ? -1 : 1));

  const films = upcoming.filter((i) => i.mediaType === 'movie');
  const series = upcoming.filter((i) => i.mediaType === 'tv');

  const grid = (list) => (
    <div className="grid">
      {list.map((item) => (
        <div key={`${item.mediaType}-${item.id}`} className="upcoming-item">
          <MovieCard item={item} isFollowed={true} status={item.status} {...cardProps} />
          {item.releaseDate && (
            <p className="upcoming-item__date">
              Sortie prévue le {formatReleaseDate(item.releaseDate)}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="tonight">
      <h2 className="tonight__hero">Sorties à venir</h2>
      <p className="tonight__sub">
        Les films et séries que tu suis mais qui ne sont pas encore sortis.
      </p>

      {upcoming.length === 0 && (
        <p className="hint">
          Rien pour l'instant — ajoute un titre pas encore sorti pour le voir apparaître ici.
        </p>
      )}

      {films.length > 0 && (
        <section className="tonight__section">
          <h3 className="tonight__title">Films</h3>
          {grid(films)}
        </section>
      )}

      {series.length > 0 && (
        <section className="tonight__section">
          <h3 className="tonight__title">Séries</h3>
          {grid(series)}
        </section>
      )}
    </div>
  );
}

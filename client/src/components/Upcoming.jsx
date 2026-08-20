import MovieCard from './MovieCard.jsx';
import { isUpcoming, formatReleaseDate } from '../status.js';

// Section « Pas encore sorti » : titres suivis (statut à voir) dont la date de
// sortie est dans le futur. Purement dérivé de la date à l'affichage — dès que
// la date est dépassée, le titre repasse tout seul dans « À voir » classique.
// Affichée à l'intérieur de « Ce soir » (embedded), plus d'onglet dédié.
export default function Upcoming({ items, cardProps, embedded = false }) {
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
              Sortie le {formatReleaseDate(item.releaseDate)}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  // Repliée dans « Ce soir » : on n'affiche rien tant qu'il n'y a rien à annoncer.
  if (embedded && upcoming.length === 0) return null;

  const body = (
    <>
      {films.length > 0 && (
        <section className="media-section">
          <h4 className="subhead">Films</h4>
          {grid(films)}
        </section>
      )}
      {series.length > 0 && (
        <section className="media-section">
          <h4 className="subhead">Séries</h4>
          {grid(series)}
        </section>
      )}
    </>
  );

  if (embedded) {
    return (
      <section className="tonight__section">
        <h3 className="tonight__title">Pas encore sorti</h3>
        {body}
      </section>
    );
  }

  return (
    <div className="tonight">
      <h2 className="tonight__hero">Pas encore sorti</h2>
      <p className="tonight__sub">
        Les films et séries que tu suis mais qui ne sont pas encore sortis.
      </p>
      {upcoming.length === 0 && (
        <p className="hint">
          Rien pour l'instant — ajoute un titre pas encore sorti pour le voir apparaître ici.
        </p>
      )}
      {body}
    </div>
  );
}

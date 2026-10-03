import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import { isUpcoming, formatReleaseDate } from '../status.js';

// « Pas encore sorti » : titres suivis (statut à voir) dont la date de sortie est dans le
// futur. Une ligne repliée (le compte et la prochaine date) qui se déplie en grille.
// Purement dérivé de la date à l'affichage — dès que la date est dépassée, le titre repasse
// tout seul dans « À voir ».
export default function Upcoming({ items, cardProps, ouvert, onToggle }) {
  const upcoming = items
    .filter((i) => (i.status || 'a_voir') === 'a_voir' && isUpcoming(i))
    .sort((a, b) => (a.releaseDate < b.releaseDate ? -1 : 1));

  if (upcoming.length === 0) return null;

  const films = upcoming.filter((i) => i.mediaType === 'movie');
  const series = upcoming.filter((i) => i.mediaType === 'tv');
  const prochaine = upcoming.find((i) => i.releaseDate)?.releaseDate;

  const grid = (list) => (
    <div className="grid">
      {list.map((item) => (
        <div key={`${item.mediaType}-${item.id}`} className="upcoming-item">
          <MovieCard item={item} isFollowed={true} status={item.status} {...cardProps} />
          {item.releaseDate && (
            <p className="upcoming-item__date">Sortie le {formatReleaseDate(item.releaseDate)}</p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <section className="sec">
      <button className="panel panel--ligne" onClick={onToggle} aria-expanded={ouvert}>
        <span className="panel--ligne__ico">
          <Icon name="calendar" size={20} />
        </span>
        <span className="panel--ligne__txt">
          <strong>Pas encore sorti</strong>
          <span>
            {upcoming.length} {upcoming.length > 1 ? 'titres' : 'titre'}
            {prochaine ? ` · prochaine sortie le ${formatReleaseDate(prochaine)}` : ''}
          </span>
        </span>
        <span className={`panel--ligne__fleche ${ouvert ? 'on' : ''}`}>
          <Icon name="chevron" size={18} />
        </span>
      </button>
      {ouvert && (
        <div className="upcoming__corps">
          {films.length > 0 && (
            <div className="media-section">
              <h4 className="subhead">Films</h4>
              {grid(films)}
            </div>
          )}
          {series.length > 0 && (
            <div className="media-section">
              <h4 className="subhead">Séries</h4>
              {grid(series)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

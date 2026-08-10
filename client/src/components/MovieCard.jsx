import { STATUSES, STATUS_LABEL } from '../status.js';

export default function MovieCard({
  item,
  isFollowed,
  status,
  onToggleFollow,
  onSetStatus,
  onOpenDetail,
}) {
  const isMovie = item.mediaType === 'movie';
  const typeLabel = isMovie ? 'film' : 'série';
  const current = status || 'a_voir';

  return (
    <article className="card">
      <button
        type="button"
        className="card__open"
        onClick={() => onOpenDetail(item)}
        title="Voir la fiche"
      >
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={item.title} loading="lazy" />
        ) : (
          <div className="card__no-poster">Pas d'affiche</div>
        )}
      </button>
      <div className="card__body">
        <h2 className="card__title">{item.title}</h2>
        <p className="card__meta">
          <span className="card__type">{typeLabel}</span>
          {item.year && <span> · {item.year}</span>}
        </p>

        {item.reason && (
          <p className="why">
            Parce que tu as aimé <b>{item.reason}</b>
          </p>
        )}

        {/* Statut. Film : choix libre. Série : dérivé (abandon via la fiche). */}
        {isFollowed &&
          (isMovie ? (
            <select
              className={`card__status status--${current}`}
              value={current}
              onChange={(e) => onSetStatus(item, e.target.value)}
              aria-label="Statut"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`status-badge status--${current}`}>
              {STATUS_LABEL[current]}
            </span>
          ))}

        <button
          type="button"
          className={`card__follow ${isFollowed ? 'is-followed' : ''}`}
          onClick={() => onToggleFollow(item)}
          title={isFollowed ? 'Cliquer pour retirer du suivi' : 'Ajouter à mon suivi'}
        >
          {isFollowed ? '✓ Ajouté' : '+ Ajouter'}
        </button>
      </div>
    </article>
  );
}

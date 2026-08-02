export default function MovieCard({
  item,
  isFollowed,
  watchStatus,
  onToggleFollow,
  onToggleWatched,
  onOpenSeries,
}) {
  const isMovie = item.mediaType === 'movie';
  const isWatched = watchStatus === 'vu';
  const typeLabel = isMovie ? 'film' : 'série';

  return (
    <article className="card">
      {item.posterUrl ? (
        <img src={item.posterUrl} alt={item.title} loading="lazy" />
      ) : (
        <div className="card__no-poster">Pas d'affiche</div>
      )}
      <div className="card__body">
        <h2 className="card__title">{item.title}</h2>
        <p className="card__meta">
          <span className="card__type">{typeLabel}</span>
          {item.year && <span> · {item.year}</span>}
        </p>

        {/* Film suivi : marquage vu / à voir (tranche 3). */}
        {isFollowed && isMovie && (
          <button
            type="button"
            className={`card__watched ${isWatched ? 'is-watched' : ''}`}
            onClick={() => onToggleWatched(item)}
          >
            {isWatched ? '✓ Vu' : 'Marquer vu'}
          </button>
        )}

        {/* Série suivie : accès aux épisodes (tranche 3). */}
        {isFollowed && !isMovie && (
          <button
            type="button"
            className="card__episodes"
            onClick={() => onOpenSeries(item)}
          >
            Épisodes
          </button>
        )}

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

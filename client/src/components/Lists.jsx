import MovieCard from './MovieCard.jsx';

// Deux listes auto-remplies à partir du classement calculé par le back.
export default function Lists({
  items,
  onToggleFollow,
  onToggleWatched,
  onOpenSeries,
}) {
  const aVoir = items.filter((i) => i.listStatus === 'a_voir');
  const vuEnCours = items.filter((i) => i.listStatus === 'vu_encours');

  const renderGrid = (list) =>
    list.length === 0 ? (
      <p className="hint">Liste vide.</p>
    ) : (
      <section className="grid">
        {list.map((item) => (
          <MovieCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            isFollowed={true}
            watchStatus={item.status}
            onToggleFollow={onToggleFollow}
            onToggleWatched={onToggleWatched}
            onOpenSeries={onOpenSeries}
          />
        ))}
      </section>
    );

  return (
    <div className="lists">
      <h2 className="lists__title">À voir</h2>
      {renderGrid(aVoir)}
      <h2 className="lists__title">Vu / En cours</h2>
      {renderGrid(vuEnCours)}
    </div>
  );
}

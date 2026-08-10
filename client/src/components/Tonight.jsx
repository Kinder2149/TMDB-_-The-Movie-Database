import { useState, useEffect } from 'react';
import MovieCard from './MovieCard.jsx';
import { getProgress } from '../api.js';

// Page « Quoi regarder ce soir ? » : reprendre les séries en cours,
// puis à voir (films / séries), puis suggestions.
export default function Tonight({ items, cardProps }) {
  const enCours = items.filter((i) => i.mediaType === 'tv' && i.status === 'en_cours');
  const aVoirFilms = items.filter((i) => i.mediaType === 'movie' && i.status === 'a_voir');
  const aVoirSeries = items.filter((i) => i.mediaType === 'tv' && i.status === 'a_voir');

  // Prochain épisode de chaque série en cours.
  const [progress, setProgress] = useState({});
  const ids = enCours.map((s) => s.id).join(',');
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      enCours.map((s) =>
        getProgress(s.id)
          .then((p) => [s.id, p])
          .catch(() => [s.id, null])
      )
    ).then((entries) => {
      if (!cancelled) setProgress(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

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

  const nothing =
    enCours.length === 0 && aVoirFilms.length === 0 && aVoirSeries.length === 0;

  return (
    <div className="tonight">
      <h2 className="tonight__hero">Quoi regarder ce soir ?</h2>
      <p className="tonight__sub">
        Reprends une série commencée, pioche dans ta liste « à voir », ou
        laisse-toi guider.
      </p>

      {nothing && (
        <p className="hint">
          Ajoute des films et séries à ton suivi pour voir apparaître ici quoi
          regarder.
        </p>
      )}

      {enCours.length > 0 && (
        <section className="tonight__section">
          <h3 className="tonight__title">Reprendre — séries en cours</h3>
          <div className="resume-row">
            {enCours.map((s) => {
              const p = progress[s.id];
              return (
                <div className="resume" key={s.id}>
                  <button
                    className="resume__poster"
                    onClick={() => cardProps.onOpenDetail(s)}
                    title="Ouvrir la fiche"
                  >
                    {s.posterUrl ? (
                      <img src={s.posterUrl} alt={s.title} />
                    ) : (
                      <div className="resume__noposter">—</div>
                    )}
                  </button>
                  <div className="resume__info">
                    <span className="resume__title">{s.title}</span>
                    <span className="resume__next">
                      {p == null
                        ? 'Chargement…'
                        : p.next
                        ? `Prochain : S${p.next.season}E${String(
                            p.next.episode
                          ).padStart(2, '0')} — ${p.next.name}`
                        : 'À jour ✓'}
                    </span>
                    <button
                      className="btn btn--primary resume__btn"
                      onClick={() => cardProps.onOpenDetail(s)}
                    >
                      ▸ Reprendre
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {aVoirFilms.length > 0 && (
        <section className="tonight__section">
          <h3 className="tonight__title">À voir — Films</h3>
          {grid(aVoirFilms)}
        </section>
      )}

      {aVoirSeries.length > 0 && (
        <section className="tonight__section">
          <h3 className="tonight__title">À voir — Séries</h3>
          {grid(aVoirSeries)}
        </section>
      )}
    </div>
  );
}

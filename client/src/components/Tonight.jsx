import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import Upcoming from './Upcoming.jsx';
import Suggestions from './Suggestions.jsx';
import { getProgress } from '../api.js';

// Page « Quoi regarder ce soir ? », en deux sous-onglets :
//   - « En attente »  : ce qui est déjà dans le suivi et reste à regarder
//                       (séries en cours, pas encore sorti, à voir) ;
//   - « Suggestions » : les recommandations calculées par l'application.
// Les deux sous-onglets restent montés en permanence : chacun garde ainsi son
// propre état de scroll, qu'on restaure au changement de sous-onglet.
// Ils ne s'empilent pas dans la navigation : le retour d'Android remonte
// directement à l'onglet précédent, sans les faire défiler un par un.
export default function Tonight({
  items,
  cardProps,
  suggestions,
  suggestionsLoading,
  onRefreshSuggestions,
  subTab,
  onSubTab,
}) {
  // Position de lecture de chaque sous-onglet (la page entière défile).
  const scrollPos = useRef({ attente: 0, suggestions: 0 });

  function switchTo(next) {
    if (next === subTab) return;
    scrollPos.current[subTab] = window.scrollY;
    onSubTab(next);
  }

  useLayoutEffect(() => {
    window.scrollTo(0, scrollPos.current[subTab] || 0);
  }, [subTab]);

  // Balayage horizontal d'un sous-onglet à l'autre. On ignore les gestes
  // surtout verticaux : ils appartiennent au défilement de la page.
  const touch = useRef(null);
  const swipe = {
    onTouchStart: (e) => {
      const t = e.touches[0];
      touch.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e) => {
      if (!touch.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.current.x;
      const dy = t.clientY - touch.current.y;
      touch.current = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      switchTo(dx < 0 ? 'suggestions' : 'attente');
    },
  };

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
    <div className="tonight" {...swipe}>
      <h2 className="tonight__hero">Quoi regarder ce soir ?</h2>
      <p className="tonight__sub">
        Reprends une série commencée, pioche dans ta liste « à voir », ou
        laisse-toi guider.
      </p>

      <div className="seg subtabs" role="tablist" aria-label="Quoi regarder ce soir">
        {[
          ['attente', 'En attente'],
          ['suggestions', 'Suggestions'],
        ].map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={subTab === v}
            className={subTab === v ? 'on' : ''}
            onClick={() => switchTo(v)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`pane ${subTab === 'attente' ? '' : 'pane--hidden'}`} role="tabpanel">
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
                        : 'À jour'}
                    </span>
                    <button
                      className="btn btn--primary resume__btn"
                      onClick={() => cardProps.onOpenDetail(s)}
                    >
                      <Icon name="play" size={14} />
                      Reprendre
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Upcoming items={items} cardProps={cardProps} embedded />

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

      <div
        className={`pane ${subTab === 'suggestions' ? '' : 'pane--hidden'}`}
        role="tabpanel"
      >
        <Suggestions
          items={items}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
          onRefreshSuggestions={onRefreshSuggestions}
          cardProps={cardProps}
          embedded
        />
      </div>
    </div>
  );
}

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import Upcoming from './Upcoming.jsx';
import Suggestions from './Suggestions.jsx';
import Bloc from './Bloc.jsx';
import { getProgress } from '../api.js';
import { isUpcoming } from '../status.js';

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
  // Blocs repliés, retenus d'un lancement à l'autre : replier « Pas encore
  // sorti » une fois doit valoir pour les fois suivantes.
  const [replies, setReplies] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('tonight-replies') || '[]'));
    } catch {
      return new Set();
    }
  });

  function basculeBloc(cle) {
    setReplies((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) next.delete(cle);
      else next.add(cle);
      try {
        localStorage.setItem('tonight-replies', JSON.stringify([...next]));
      } catch {
        /* stockage indisponible : le pli vaut pour la session */
      }
      return next;
    });
  }

  const blocProps = (cle) => ({
    ouvert: !replies.has(cle),
    onToggle: () => basculeBloc(cle),
  });

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

  // « À voir » ne montre que ce qu'on peut regarder ce soir : les titres pas
  // encore sortis en sont écartés, ils ont leur propre section « Pas encore
  // sorti » juste au-dessus. Sans ce filtre le même film apparaissait deux
  // fois sur la page. Même règle que dans « Mes listes ».
  const aVoir = items.filter((i) => i.status === 'a_voir' && !isUpcoming(i));
  const aVoirFilms = aVoir.filter((i) => i.mediaType === 'movie');
  const aVoirSeries = aVoir.filter((i) => i.mediaType === 'tv');

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

  // « Reprendre » ne montre que ce qu'on peut vraiment reprendre : une série
  // où l'on est à jour n'a pas d'épisode suivant, elle sort donc de la
  // section. Elle reste « En cours » dans « Mes listes » — elle n'est pas
  // finie, il n'y a simplement rien à regarder ce soir.
  // Tant que la progression n'est pas connue (chargement, ou erreur réseau),
  // on garde la série affichée plutôt que de la faire disparaître.
  const aReprendre = enCours.filter((s) => {
    const p = progress[s.id];
    return p == null || !!p.next;
  });

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

  // Le message « ton suivi est vide » ne doit pas s'afficher au-dessus d'une
  // section « Pas encore sorti » qui, elle, a bien quelque chose à montrer.
  const aDesSorties = items.some((i) => (i.status || 'a_voir') === 'a_voir' && isUpcoming(i));
  const nothing =
    aReprendre.length === 0 &&
    aVoirFilms.length === 0 &&
    aVoirSeries.length === 0 &&
    !aDesSorties;

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

      {aReprendre.length > 0 && (
        <Bloc
          titre="Reprendre"
          couleur="var(--encours)"
          compte={aReprendre.length}
          {...blocProps('reprendre')}
        >
          <div className="resume-row">
            {aReprendre.map((s) => {
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
                      {p?.next
                        ? `Prochain : S${p.next.season}E${String(
                            p.next.episode
                          ).padStart(2, '0')} — ${p.next.name}`
                        : 'Chargement…'}
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
        </Bloc>
      )}

      <Upcoming
        items={items}
        cardProps={cardProps}
        embedded
        blocProps={blocProps('sorties')}
      />

      {aVoir.length > 0 && (
        <Bloc
          titre="À voir"
          couleur="var(--avoir)"
          compte={aVoir.length}
          {...blocProps('avoir')}
        >
          {aVoirFilms.length > 0 && (
            <section className="media-section">
              <h4 className="subhead">
                Films <span className="subhead__count">{aVoirFilms.length}</span>
              </h4>
              {grid(aVoirFilms)}
            </section>
          )}
          {aVoirSeries.length > 0 && (
            <section className="media-section">
              <h4 className="subhead">
                Séries <span className="subhead__count">{aVoirSeries.length}</span>
              </h4>
              {grid(aVoirSeries)}
            </section>
          )}
        </Bloc>
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

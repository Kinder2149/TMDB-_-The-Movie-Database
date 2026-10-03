import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import Upcoming from './Upcoming.jsx';
import Suggestions from './Suggestions.jsx';
import Rubriques from './Rubriques.jsx';
import Hero from './Hero.jsx';
import Vide from './Vide.jsx';
import VueRayon from './VueRayon.jsx';
import { getProgress } from '../api.js';
import { isUpcoming, libelleProchain } from '../status.js';
import { ideeDuSoir, depuisLibelle, aujourdhui } from '../idee.js';

// Page « Quoi regarder ce soir ? », en deux sous-onglets :
//   - « En attente »  : ce qui est déjà dans le suivi et reste à regarder
//                       (séries en cours, pas encore sorti, à voir) ;
//   - « Découverte »  : les recommandations calculées d'après ce qu'on a vu ;
//   - « Suggestion »  : Tendances, Nouveautés, À venir (catalogue TMDB).
// Les trois sous-onglets restent montés en permanence : chacun garde ainsi son
// propre état de scroll, qu'on restaure au changement de sous-onglet.
// Ils ne s'empilent pas dans la navigation : le retour d'Android remonte
// directement à l'onglet précédent, sans les faire défiler un par un.
const SOUS_ONGLETS = [
  ['attente', 'En attente'],
  ['decouverte', 'Découverte'],
  ['suggestion', 'Suggestion'],
];

export default function Tonight({
  items,
  cardProps,
  suggestions,
  suggestionsLoading,
  onRefreshSuggestions,
  suivi,
  dejaChezMoi,
  catalogLang,
  subTab,
  onSubTab,
  onSearch,
  profileId,
}) {
  // « Pas encore sorti » part replié : rien à y regarder ce soir. On retient s'il a été ouvert.
  const [sortiesOuvert, setSortiesOuvert] = useState(() => {
    try {
      return localStorage.getItem('tonight-sorties-ouvert') === '1';
    } catch {
      return false;
    }
  });
  function basculeSorties() {
    setSortiesOuvert((o) => {
      try {
        localStorage.setItem('tonight-sorties-ouvert', o ? '0' : '1');
      } catch {
        /* stockage indisponible : le pli vaut pour la session */
      }
      return !o;
    });
  }

  const [toutVoir, setToutVoir] = useState(false);

  // Position de lecture de chaque sous-onglet (la page entière défile).
  const scrollPos = useRef({ attente: 0, decouverte: 0, suggestion: 0 });

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
      const i = SOUS_ONGLETS.findIndex(([v]) => v === subTab);
      const suivant = SOUS_ONGLETS[i + (dx < 0 ? 1 : -1)];
      if (suivant) switchTo(suivant[0]);
    },
  };

  const enCours = items.filter((i) => i.mediaType === 'tv' && i.status === 'en_cours');

  // « À voir » ne montre que ce qu'on peut regarder ce soir : les titres pas
  // encore sortis en sont écartés, ils ont leur propre section « Pas encore
  // sorti » en bas de page. Sans ce filtre le même film apparaissait deux
  // fois sur la page. Même règle que dans « Mes listes ».
  const aVoir = items.filter((i) => i.status === 'a_voir' && !isUpcoming(i));

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

  // Idée du soir : tirée au sort une fois par jour (profil + date), « Autre idée » passe à la
  // suivante. Le rang est gardé sur le téléphone : relancer l'application garde la même idée.
  const date = aujourdhui();
  const cleRang = `idee:${profileId}:${date}`;
  const [rang, setRang] = useState(() => {
    try {
      return Number(localStorage.getItem(cleRang)) || 0;
    } catch {
      return 0;
    }
  });
  const idee = ideeDuSoir(items, { profileId, date, rang });
  function autreIdee() {
    const suivant = rang + 1;
    setRang(suivant);
    try {
      localStorage.setItem(cleRang, String(suivant));
    } catch {
      /* stockage indisponible : l'idée change pour la session */
    }
  }

  const depuis = idee ? depuisLibelle(idee.addedAt) : null;
  const sousIdee = idee
    ? [
        idee.mediaType === 'movie' ? 'Film' : 'Série',
        idee.year,
        depuis && (depuis.startsWith('depuis') ? `dans ta liste ${depuis}` : depuis),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const aDesSorties = items.some((i) => (i.status || 'a_voir') === 'a_voir' && isUpcoming(i));
  const nothing = aReprendre.length === 0 && aVoir.length === 0 && !aDesSorties;

  const lotAVoir = async (media) =>
    media === 'all' ? aVoir : aVoir.filter((i) => i.mediaType === media);

  return (
    <div className="tonight" {...swipe}>
      <header className="page-head">
        <h2>Quoi regarder ce soir ?</h2>
        <p>Reprends une série, pioche dans ta liste, ou laisse-toi guider.</p>
      </header>

      <div className="seg subtabs" role="tablist" aria-label="Quoi regarder ce soir">
        {SOUS_ONGLETS.map(([v, label]) => (
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
          <Vide
            icone="film"
            titre="Ta bibliothèque est vide"
            texte="Ajoute des films et des séries à ton suivi : ce qu'il reste à regarder apparaîtra ici."
            action={{ label: 'Chercher un titre', onClick: onSearch }}
          />
        )}

        {idee && (
          <Hero fond={idee.posterUrl} titre={idee.title} kicker="Idée du soir" sous={sousIdee}>
            <button className="btn btn--primary" onClick={() => cardProps.onOpenDetail(idee)}>
              Voir la fiche
            </button>
            {aVoir.length > 1 && (
              <button className="btn btn--voile" onClick={autreIdee}>
                <Icon name="refresh" size={14} />
                Autre idée
              </button>
            )}
          </Hero>
        )}

        {aReprendre.length > 0 && (
          <section className="sec">
            <header className="sec__head">
              <div className="sec__txt">
                <h3 className="sec__title">Reprendre</h3>
                <p className="sec__sub">Les séries que tu as commencées</p>
              </div>
            </header>
            <div className="rail" role="list">
              {aReprendre.map((s, i) => {
                const p = progress[s.id];
                const prochain = libelleProchain(p?.next);
                const part =
                  p && p.aired > 0 ? Math.min(100, Math.round((p.watched / p.aired) * 100)) : 0;
                return (
                  <button
                    className="rail__item resume rise"
                    role="listitem"
                    key={s.id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    onClick={() => cardProps.onOpenDetail(s)}
                    title="Ouvrir la fiche"
                  >
                    <span className="resume__poster">
                      {s.posterUrl ? (
                        <img src={s.posterUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="resume__noposter">—</span>
                      )}
                      {p && (
                        <span className="resume__barre" aria-hidden="true">
                          <span style={{ width: `${part}%` }} />
                        </span>
                      )}
                      <span className="resume__play" aria-hidden="true">
                        <Icon name="play" size={16} />
                      </span>
                    </span>
                    <span className="resume__title">{s.title}</span>
                    {prochain ? (
                      <span className="resume__next">{prochain.titre}</span>
                    ) : (
                      <span className="skeleton skeleton--line" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {aVoir.length > 0 && (
          <section className="sec">
            <header className="sec__head">
              <div className="sec__txt">
                <h3 className="sec__title">À voir ce soir</h3>
                <p className="sec__sub">
                  {aVoir.length} {aVoir.length > 1 ? 'titres déjà sortis' : 'titre déjà sorti'}
                </p>
              </div>
              {aVoir.length > 6 && (
                <button className="sec__all" onClick={() => setToutVoir(true)}>
                  Tout voir
                  <Icon name="chevron" size={14} />
                </button>
              )}
            </header>
            <div className="rail" role="list">
              {aVoir.slice(0, 16).map((item, i) => (
                <div
                  className="rail__item rise"
                  role="listitem"
                  key={`${item.mediaType}-${item.id}`}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <MovieCard item={item} isFollowed={true} status={item.status} {...cardProps} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* En dernier : ce qui n'est pas encore sorti ne se regarde pas ce soir. */}
        <Upcoming
          items={items}
          cardProps={cardProps}
          ouvert={sortiesOuvert}
          onToggle={basculeSorties}
        />
      </div>

      <div
        className={`pane ${subTab === 'decouverte' ? '' : 'pane--hidden'}`}
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

      <div
        className={`pane ${subTab === 'suggestion' ? '' : 'pane--hidden'}`}
        role="tabpanel"
      >
        <Rubriques
          suivi={suivi}
          dejaChezMoi={dejaChezMoi}
          cardProps={cardProps}
          resetKey={catalogLang}
        />
      </div>
    
      {toutVoir && (
        <VueRayon
          titre="À voir ce soir"
          sous="Ce qui est déjà sorti dans ta liste « à voir »."
          lot={lotAVoir}
          pagine={false}
          suivi={suivi}
          dejaChezMoi={() => false}
          cardProps={cardProps}
          onClose={() => setToutVoir(false)}
        />
      )}
    </div>
  );
}

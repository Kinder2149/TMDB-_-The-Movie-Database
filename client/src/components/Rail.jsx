import { useEffect, useRef, useState } from 'react';
import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import { RangeeFantome } from './Fantomes.jsx';

const keyOf = (item) => `${item.mediaType}-${item.id}`;
const MAX = 16;

// Une rangée d'affiches qui défile à l'horizontale, avec son titre : le bloc de base de
// « Découvrir ». Elle ne charge ses titres que lorsqu'elle approche de l'écran (une
// douzaine de rangées ne doivent pas faire douze appels dès l'ouverture), affiche des
// affiches fantômes pendant l'attente, et disparaît si, une fois ce que tu as déjà retiré,
// il ne reste rien à proposer.
//
// `charger()` rend la liste des titres ; `deps` la relance (plateformes, langue…).
export default function Rail({
  titre,
  sous,
  charger,
  deps = [],
  onToutVoir,
  suivi,
  dejaChezMoi,
  cardProps,
  legende,
}) {
  const racine = useRef(null);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState(null); // null = en attente
  const seq = useRef(0);

  // Déclenche le chargement à l'approche de l'écran, une seule fois.
  useEffect(() => {
    if (visible || !racine.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    obs.observe(racine.current);
    // Filet : si l'observateur tarde (vue mise en veille, WebView capricieuse), on regarde
    // soi-même, une fois, si la rangée est déjà à portée.
    const filet = setTimeout(() => {
      const r = racine.current?.getBoundingClientRect();
      if (r && r.top < window.innerHeight + 300) {
        setVisible(true);
        obs.disconnect();
      }
    }, 800);
    return () => {
      clearTimeout(filet);
      obs.disconnect();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const moi = ++seq.current;
    setItems(null);
    charger()
      .then((r) => moi === seq.current && setItems(r || []))
      .catch(() => moi === seq.current && setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ...deps]);

  const visibles = (items || []).filter((r) => !dejaChezMoi(r)).slice(0, MAX);
  if (items && visibles.length === 0) return <span ref={racine} />; // rien à proposer : on s'efface

  return (
    <section className="sec rail-sec" ref={racine}>
      <header className="sec__head">
        <div className="sec__txt">
          <h3 className="sec__title">{titre}</h3>
          {sous && <p className="sec__sub">{sous}</p>}
        </div>
        {onToutVoir && items && (
          <button className="sec__all" onClick={onToutVoir}>
            Tout voir
            <Icon name="chevron" size={14} />
          </button>
        )}
      </header>

      {!items && <RangeeFantome />}
      {items && (
      <div className="rail" role="list">
        {visibles.map((item, i) => (
          <div
            className="rail__item rise"
            role="listitem"
            key={keyOf(item)}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <MovieCard
              item={item}
              isFollowed={suivi.has(keyOf(item))}
              status={suivi.get(keyOf(item))?.status}
              {...cardProps}
            />
            {legende?.(item) && <span className="rail__legende">{legende(item)}</span>}
          </div>
        ))}
        {/* Dernière case : même geste que le bouton du titre, au bout du doigt. */}
        {onToutVoir && items && visibles.length >= 8 && (
          <button className="rail__plus" onClick={onToutVoir} aria-label={`Tout voir : ${titre}`}>
            <Icon name="chevron" size={22} />
            <span>Tout voir</span>
          </button>
        )}
      </div>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import MovieCard from './MovieCard.jsx';
import Vide from './Vide.jsx';
import HorsLigne from './HorsLigne.jsx';
import { GrilleFantome } from './Fantomes.jsx';
import { useEnLigne } from '../reseau.js';

const keyOf = (item) => `${item.mediaType}-${item.id}`;

// « Tout voir » d'une rangée de Découvrir : la grille complète du rayon, avec le filtre
// Films / Séries et « Voir plus ». S'ouvre par-dessus la page, comme les autres écrans.
// `lot(media, page)` rend les titres d'une page ; `pagine` dit s'il y en a d'autres.
export default function VueRayon({ titre, sous, lot, pagine, suivi, dejaChezMoi, cardProps, legende, onClose }) {
  const [media, setMedia] = useState('all');
  const [liste, setListe] = useState([]);
  const [page, setPage] = useState(0);
  const [plus, setPlus] = useState(pagine);
  const [charge, setCharge] = useState(true);
  const seq = useRef(0);
  const enLigne = useEnLigne();

  async function charger(ajouter) {
    const moi = ++seq.current;
    setCharge(true);
    try {
      const depuis = ajouter ? page + 1 : 1;
      // Trois pages d'un coup : une fois masqué ce qu'on a déjà, une page seule en laisse
      // parfois une poignée.
      const lots = await Promise.all(
        (pagine ? [depuis, depuis + 1, depuis + 2] : [1]).map((p) => lot(media, p).catch(() => []))
      );
      if (moi !== seq.current) return;
      setPage(depuis + 2);
      setPlus(pagine && lots[lots.length - 1].length > 0);
      setListe((prev) => {
        const base = ajouter ? prev : [];
        const vus = new Set(base.map(keyOf));
        return [...base, ...lots.flat().filter((r) => !vus.has(keyOf(r)) && vus.add(keyOf(r)))];
      });
    } finally {
      if (moi === seq.current) setCharge(false);
    }
  }

  useEffect(() => {
    setListe([]);
    charger(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  const visibles = liste.filter((r) => !dejaChezMoi(r));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>{titre}</h2>
        </header>

        <div className="detail-pad vue-rayon">
          {sous && <p className="vue-rayon__sous">{sous}</p>}
          <div className="seg seg--sm">
            {[
              ['all', 'Tout'],
              ['movie', 'Films'],
              ['tv', 'Séries'],
            ].map(([v, label]) => (
              <button key={v} className={media === v ? 'on' : ''} onClick={() => setMedia(v)}>
                {label}
              </button>
            ))}
          </div>

          {charge && visibles.length === 0 && <GrilleFantome />}
          {!charge && visibles.length === 0 && !enLigne && <HorsLigne onRetry={() => charger(false)} />}
          {!charge && visibles.length === 0 && enLigne && (
            <Vide icone="film" titre="Rien de nouveau" texte="Rien à te proposer ici pour le moment." />
          )}
          <div className="grid">
            {visibles.map((item, i) => (
              <div
                className="rail__item rise"
                key={keyOf(item)}
                style={{ animationDelay: `${Math.min(i % 12, 8) * 30}ms` }}
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
          </div>
          {plus && visibles.length > 0 && (
            <div className="voirplus">
              <button className="btn btn--ghost" disabled={charge} onClick={() => charger(true)}>
                Voir plus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

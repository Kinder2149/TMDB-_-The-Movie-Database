import { useEffect, useMemo, useState } from 'react';
import Rail from './Rail.jsx';
import HorsLigne from './HorsLigne.jsx';
import { useEnLigne } from '../reseau.js';
import VueRayon from './VueRayon.jsx';
import Icon from './Icon.jsx';
import {
  getMoods,
  discoverMood,
  getRecommendations,
  getPlateformes,
  getAmis,
  getRecommandationsAmis,
  cartesDe,
} from '../api.js';

// Onglet « Découvrir » : une succession de rangées d'affiches, façon catalogue.
//   - « Chez tes amis »            ce qu'ils ont aimé et que tu n'as pas ;
//   - « Parce que tu as aimé… »    les recommandations de tes meilleurs titres ;
//   - les sélections               pépites cachées, soirée courte, classiques, l'année ;
//   - les thèmes                   super-héros, braquage, halloween, romance.
// Chaque rangée a son « Tout voir » (la grille complète). Le filtre « Sur mes plateformes »
// restreint les rangées à ce qu'on peut regarder chez soi ; le choix est retenu.
const keyOf = (item) => `${item.mediaType}-${item.id}`;
const CLE_PLATEFORMES = 'decouvrir-plateformes';
const NB_COMME = 2; // rangées « Parce que tu as aimé » : les deux meilleurs titres

function lirePlateformes() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_PLATEFORMES) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const filtrer = (liste, media) => (media === 'all' ? liste : liste.filter((r) => r.mediaType === media));

// Les titres d'un rayon. `page` ne sert qu'aux rayons TMDB paginés (sélections, thèmes).
async function titresDe(rayon, { media = 'all', page = 1, plateformes = [] } = {}) {
  if (rayon.type === 'amis') {
    const refs = await getRecommandationsAmis();
    const cartes = await cartesDe(filtrer(refs, media).slice(0, 60));
    const parCle = new Map(refs.map((r) => [keyOf(r), r.amis]));
    return cartes.map((c) => ({ ...c, amis: parCle.get(keyOf(c)) }));
  }
  if (rayon.type === 'comme') {
    return filtrer(await getRecommendations(rayon.mediaType, rayon.tmdbId), media);
  }
  return discoverMood({
    mood: rayon.key,
    movie: media !== 'tv',
    tv: media !== 'movie',
    page,
    plateformes,
  });
}

const legendeAmis = (item) =>
  item.amis
    ? item.amis
        .slice(0, 2)
        .map((a) => (a.rating ? `${a.pseudo} ★${a.rating}` : a.pseudo))
        .join(' · ') + (item.amis.length > 2 ? ` +${item.amis.length - 2}` : '')
    : null;

export default function Decouvrir({ items, suivi, dejaChezMoi, cardProps, resetKey }) {
  const enLigne = useEnLigne();
  const [essai, setEssai] = useState(0); // « Réessayer » : on remonte les rangées
  const [moods, setMoods] = useState([]);
  const [plateformes, setPlateformes] = useState([]); // proposées
  const [mesPlateformes, setMesPlateformes] = useState(lirePlateformes);
  const [filtreOuvert, setFiltreOuvert] = useState(false);
  const [nbAmis, setNbAmis] = useState(0);
  const [ouvert, setOuvert] = useState(null); // rayon affiché en grille

  useEffect(() => {
    getMoods().then(setMoods).catch(() => {});
    getPlateformes().then(setPlateformes).catch(() => {});
    getAmis().then((a) => setNbAmis(a.length)).catch(() => {});
  }, [resetKey]);

  // Les titres qu'on a le plus aimés : les mieux notés d'abord, puis ceux vus.
  const sources = useMemo(
    () =>
      items
        .filter((i) => (i.rating ?? 0) >= 4 || i.status === 'vu')
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, NB_COMME),
    [items]
  );

  // Chaque rayon a une clé unique (`cle`) ; le reste dépend de son type.
  const rayons = [
    nbAmis > 0 && {
      cle: 'amis',
      type: 'amis',
      titre: 'Chez tes amis',
      sous: 'Ce qu’ils ont aimé et que tu n’as pas vu',
    },
    ...sources.map((s) => ({
      cle: `comme:${keyOf(s)}`,
      type: 'comme',
      mediaType: s.mediaType,
      tmdbId: s.id,
      titre: `Comme ${s.title}`,
      sous: 'Parce que tu as aimé ce titre',
    })),
    // Les sélections (note, durée, époque) d'abord, puis les thèmes.
    ...moods.filter((m) => m.groupe === 'selection'),
    ...moods.filter((m) => m.groupe !== 'selection'),
  ]
    .filter(Boolean)
    .map((r) => (r.type ? r : { cle: r.key, type: 'mood', key: r.key, titre: r.name }));

  function basculePlateforme(id) {
    setMesPlateformes((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      try {
        localStorage.setItem(CLE_PLATEFORMES, JSON.stringify(next));
      } catch {
        /* stockage indisponible : le choix vaut pour la séance */
      }
      return next;
    });
  }

  const commun = { suivi, dejaChezMoi, cardProps };

  return (
    <>
      <header className="page-head">
        <h2>Découvrir</h2>
        <p>Des idées pour ta prochaine soirée, choisies pour toi.</p>
      </header>

      {plateformes.length > 0 && (
        <div className="filtre-plateformes">
          <button
            className={`chip ${mesPlateformes.length > 0 ? 'on' : ''}`}
            aria-expanded={filtreOuvert}
            onClick={() => setFiltreOuvert((o) => !o)}
          >
            <Icon name="play" size={12} />
            {mesPlateformes.length > 0
              ? `Sur mes plateformes · ${mesPlateformes.length}`
              : 'Sur mes plateformes'}
          </button>
          {filtreOuvert && (
            <div className="chips-scroll">
              {plateformes.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${mesPlateformes.includes(p.id) ? 'on' : ''}`}
                  aria-pressed={mesPlateformes.includes(p.id)}
                  onClick={() => basculePlateforme(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!enLigne && (
        <HorsLigne onRetry={() => setEssai((n) => n + 1)} />
      )}

      {enLigne && rayons.map((r) => (
        <Rail
          key={`${r.cle}:${essai}`}
          titre={r.titre}
          sous={r.sous}
          deps={[r.type === 'mood' ? mesPlateformes.join(',') : '', resetKey]}
          charger={() => titresDe(r, { plateformes: r.type === 'mood' ? mesPlateformes : [] })}
          onToutVoir={() => setOuvert(r)}
          legende={r.type === 'amis' ? legendeAmis : undefined}
          {...commun}
        />
      ))}

      {enLigne && rayons.length === 0 && <div className="skeleton skeleton--bloc" aria-hidden="true" />}

      {ouvert && (
        <VueRayon
          titre={ouvert.titre}
          sous={ouvert.sous}
          pagine={ouvert.type === 'mood'}
          lot={(media, page) =>
            titresDe(ouvert, {
              media,
              page,
              plateformes: ouvert.type === 'mood' ? mesPlateformes : [],
            })
          }
          legende={ouvert.type === 'amis' ? legendeAmis : undefined}
          onClose={() => setOuvert(null)}
          {...commun}
        />
      )}
    </>
  );
}

import Icon from './Icon.jsx';
import { formatDuree } from '../status.js';

// En-tête d'une fiche : image de fond, flèche de retour, affiche, titre et pastilles.
// Trois états : chargement (formes fantômes), complet, et hors connexion — là, on garde
// ce que le suivi sait déjà (titre, année, affiche) pour que la fiche ne soit jamais vide.
export default function FicheEntete({ item, info, isSeries, enChargement, onClose }) {
  const titre = info?.title || item.title;
  const affiche = info?.posterUrl || item.posterUrl;
  const annee = info?.year || item.year;

  const pastilles = [`${isSeries ? 'Série' : 'Film'}${annee ? ` · ${annee}` : ''}`];
  if (!isSeries && formatDuree(info?.runtime)) pastilles.push(formatDuree(info.runtime));
  if (isSeries && info?.seasonCount) {
    pastilles.push(`${info.seasonCount} saison${info.seasonCount > 1 ? 's' : ''}`);
  }
  (info?.genres || []).slice(0, 2).forEach((g) => pastilles.push(g));

  return (
    <>
      <div className="fiche__barre">
        <button className="fiche__retour" onClick={onClose} aria-label="Retour">
          <Icon name="back" size={22} />
        </button>
      </div>

      <div
        className={`fiche__fond ${enChargement ? 'skeleton' : ''}`}
        style={info?.backdropUrl ? { backgroundImage: `url(${info.backdropUrl})` } : undefined}
      />

      <div className="fiche__id">
        {affiche ? (
          <img className="fiche__affiche" src={affiche} alt="" />
        ) : enChargement ? (
          <div className="fiche__affiche skeleton" aria-hidden="true" />
        ) : (
          <div className="fiche__affiche fiche__affiche--vide">
            <Icon name="film" size={28} />
          </div>
        )}
        <div className="fiche__qui">
          <h1 className="fiche__titre">{titre}</h1>
          {!enChargement && (
            <div className="fiche__metas">
              {pastilles.map((p) => (
                <span className="meta" key={p}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

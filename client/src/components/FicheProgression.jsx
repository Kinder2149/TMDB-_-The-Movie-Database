import Icon from './Icon.jsx';
import { libelleProchain } from '../status.js';

// Où j'en suis dans une série : un anneau (vus / diffusés) et la carte du prochain épisode
// avec son bouton. La progression se lit sur les épisodes *diffusés* — les épisodes annoncés
// mais pas sortis sont dits à part, pour ne pas faire croire à du retard.
export default function FicheProgression({ progress, diffuses, aVenir, pct, busy, onMarquer }) {
  if (!progress) {
    return <div className="skeleton skeleton--bloc fiche__progres-attente" aria-hidden="true" />;
  }

  const prochain = libelleProchain(progress.next);
  return (
    <>
      <div className="panel fiche__progres">
        <div
          className="anneau"
          style={{ '--p': pct }}
          role="img"
          aria-label={`${progress.watched} épisodes vus sur ${diffuses}`}
        >
          <b>
            {progress.watched}
            <span>/{diffuses}</span>
          </b>
        </div>
        <div className="fiche__prochain">
          {prochain ? (
            <>
              <p className="eyebrow">Prochain épisode</p>
              <p className="fiche__prochain-titre">{prochain.titre}</p>
              {prochain.diffuse && <p className="panel__note">{prochain.diffuse}</p>}
            </>
          ) : diffuses === 0 ? (
            <>
              <p className="eyebrow">Prochain épisode</p>
              <p className="fiche__prochain-titre">Pas encore diffusée</p>
              <p className="panel__note">Aucun épisode n’est encore sorti.</p>
            </>
          ) : (
            <>
              <p className="eyebrow">Prochain épisode</p>
              <p className="fiche__prochain-titre">À jour</p>
              <p className="panel__note">Tu as vu tout ce qui est sorti.</p>
            </>
          )}
        </div>
      </div>

      {prochain && (
        <button className="btn btn--primary btn--wide" onClick={onMarquer} disabled={busy}>
          <Icon name="check" size={16} />
          {prochain.bouton}
        </button>
      )}

      {aVenir > 0 && (
        <p className="panel__note fiche__avenir">
          {aVenir === 1
            ? '1 épisode annoncé, pas encore diffusé.'
            : `${aVenir} épisodes annoncés, pas encore diffusés.`}
        </p>
      )}
    </>
  );
}

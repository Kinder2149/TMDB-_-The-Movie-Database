import { useRef } from 'react';
import Icon from './Icon.jsx';
import { STATUS_LABEL } from '../status.js';

// Une affiche dans une grille. Volontairement dépouillée : l'affiche, le titre,
// l'année. Le suivi se fait par la pastille posée sur l'affiche, le statut se
// lit au liseré de couleur en bas de l'affiche. Les gros boutons pleine largeur
// d'avant faisaient tenir 2 titres par écran de téléphone au lieu de 9 ; tout
// ce qui demande un choix (changer de statut, cocher des épisodes) vit dans la
// fiche, qu'on ouvre en touchant l'affiche.
export default function MovieCard({
  item,
  isFollowed,
  status,
  onToggleFollow,
  onOpenDetail,
  onLongPress,
}) {
  const typeLabel = item.mediaType === 'movie' ? 'Film' : 'Série';
  const current = status || 'a_voir';

  // Appui long sur l'affiche : ouvre le menu des statuts (voir StatusMenu).
  // L'appui court garde son rôle — ouvrir la fiche. Le geste est posé ici,
  // sur la carte partagée, donc il fonctionne partout où un titre est affiché.
  const timer = useRef(null);
  const fired = useRef(false); // un appui long ne doit pas ouvrir la fiche ensuite
  const start = useRef(null);

  function trigger() {
    fired.current = true;
    // Petite vibration : sans elle, rien ne dit que l'appui a été assez long.
    navigator.vibrate?.(15);
    onLongPress?.(item);
  }

  function cancel() {
    clearTimeout(timer.current);
    timer.current = null;
  }

  const press = {
    onPointerDown: (e) => {
      if (e.button === 2) return; // clic droit : géré par onContextMenu
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(trigger, 500);
    },
    // Un doigt qui glisse fait défiler la page : ce n'est pas un appui long.
    onPointerMove: (e) => {
      if (!timer.current || !start.current) return;
      const moved =
        Math.abs(e.clientX - start.current.x) > 10 ||
        Math.abs(e.clientY - start.current.y) > 10;
      if (moved) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e) => {
      // Android affiche sinon son propre menu « ouvrir l'image… » par-dessus.
      e.preventDefault();
      if (!fired.current) trigger();
    },
  };

  return (
    <article className="card">
      <div className="card__poster">
        <button
          type="button"
          className="card__open"
          {...press}
          onClick={() => {
            if (fired.current) {
              fired.current = false;
              return;
            }
            onOpenDetail(item);
          }}
          title="Voir la fiche"
        >
          {item.posterUrl ? (
            <img src={item.posterUrl} alt={item.title} loading="lazy" />
          ) : (
            <div className="card__no-poster">Pas d'affiche</div>
          )}
          {isFollowed && (
            <span
              className={`card__stripe status--${current}`}
              title={STATUS_LABEL[current]}
            />
          )}
        </button>

        <button
          type="button"
          className={`card__add ${isFollowed ? 'is-followed' : ''}`}
          onClick={() => onToggleFollow(item)}
          aria-label={isFollowed ? 'Retirer de mon suivi' : 'Ajouter à mon suivi'}
          title={
            isFollowed
              ? `${STATUS_LABEL[current]} — toucher pour retirer du suivi`
              : 'Ajouter à mon suivi'
          }
        >
          <Icon name={isFollowed ? 'check' : 'plus'} size={16} />
        </button>
      </div>

      <h2 className="card__title">{item.title}</h2>
      <p className="card__meta">
        {typeLabel}
        {item.year && ` · ${item.year}`}
      </p>

      {item.reason && (
        <p className="why">
          Parce que tu as aimé <b>{item.reason}</b>
        </p>
      )}
    </article>
  );
}

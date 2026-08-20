import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { STATUSES, STATUS_LABEL } from '../status.js';

// Menu de statuts ouvert par un appui long sur une affiche, n'importe où dans
// l'application. Il évite d'ouvrir la fiche complète juste pour faire passer un
// titre de « à voir » à « vu » : le statut s'applique immédiatement et le menu
// se referme. Le statut actuel est coché.
export default function StatusMenu({ item, status, isFollowed, onPick, onRemove, onClose }) {
  // Échap ferme le menu (utile au clavier / sur PC).
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = isFollowed ? status || 'a_voir' : null;

  return (
    <div className="overlay overlay--bottom" onClick={onClose}>
      <div
        className="menu"
        role="dialog"
        aria-label={`Statut de ${item.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="menu__title">{item.title}</p>

        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={`menu__line ${current === s.value ? 'is-current' : ''}`}
            onClick={() => onPick(item, s.value)}
          >
            <span className={`menu__dot status--${s.value}`} aria-hidden="true" />
            <span>{s.label}</span>
            {current === s.value && <Icon name="check" size={16} />}
          </button>
        ))}

        <button
          className="menu__line menu__line--danger"
          onClick={() => (isFollowed ? onRemove(item) : onClose())}
          disabled={!isFollowed}
        >
          <span>Retirer de mon suivi</span>
        </button>
      </div>
    </div>
  );
}

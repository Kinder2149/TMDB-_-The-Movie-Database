import Icon from './Icon.jsx';
import { STATUSES, STATUS_LABEL } from '../status.js';

// Où j'en suis avec ce titre.
//  - pas suivi : un seul gros bouton, « Ajouter à mon suivi » ;
//  - film suivi : les 4 statuts, on choisit ;
//  - série suivie : le statut se calcule d'après les épisodes cochés (on ne le choisit pas) ;
//    seul « Abandonner » est manuel, et « Reprendre le suivi » en sort.
export default function FicheStatut({ isSeries, isFollowed, current, onPick, onAjouter }) {
  if (!isFollowed) {
    return (
      <button className="btn btn--primary btn--wide" onClick={onAjouter}>
        <Icon name="plus" size={16} />
        Ajouter à mon suivi
      </button>
    );
  }

  if (!isSeries) {
    return (
      <div className="statuspick" role="group" aria-label="Statut">
        {STATUSES.map((st) => (
          <button
            key={st.value}
            className={`statuspick__btn status--${st.value} ${current === st.value ? 'on' : ''}`}
            aria-pressed={current === st.value}
            onClick={() => onPick(st.value)}
          >
            {st.label}
          </button>
        ))}
      </div>
    );
  }

  const abandonne = current === 'abandonne';
  return (
    <div className="fiche__statut">
      <div className="fiche__statut-lib">
        <span className={`pastille status--${current}`}>
          <span className="led" />
          {STATUS_LABEL[current]}
        </span>
        {!abandonne && <span className="fiche__statut-note">calculé d’après tes épisodes vus</span>}
      </div>
      <button
        className="chip"
        onClick={() => onPick(abandonne ? 'a_voir' : 'abandonne')}
      >
        {abandonne ? 'Reprendre le suivi' : 'Abandonner'}
      </button>
    </div>
  );
}

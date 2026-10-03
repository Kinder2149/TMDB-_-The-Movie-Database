// Dates de visionnage d'un film ou d'un épisode : une ligne par visionnage,
// chacune avec sa date modifiable. Rien n'est obligatoire — sans date connue,
// on propose simplement d'en ajouter une.
// `liste` arrive du plus récent au plus ancien : la dernière ligne est donc
// le 1er visionnage.
import Icon from './Icon.jsx';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function rang(i, total) {
  if (total === 1) return 'Visionnage';
  return i === total - 1 ? '1er visionnage' : `Visionnage ${total - i}`;
}

export default function Visionnages({ liste, onChangeDate, onRemove, onAdd }) {
  return (
    <div className="visionnages">
      {liste.length === 0 && (
        <p className="hint hint--small">Date du 1er visionnage : non renseignée.</p>
      )}
      <ul className="visionnage-liste">
        {liste.map((v, i) => (
          <li key={v.id}>
            <span className="visionnage__rang">{rang(i, liste.length)}</span>
            <input
              type="date"
              className="visionnage__date"
              value={v.date}
              max={aujourdhui()}
              aria-label="Date du visionnage"
              onChange={(e) => e.target.value && onChangeDate(v.id, e.target.value)}
            />
            <button
              type="button"
              aria-label="Retirer ce visionnage"
              title="Retirer ce visionnage"
              onClick={() => onRemove(v.id)}
            >
              <Icon name="trash" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <label className="visionnage__ajout">
        <Icon name="plus" size={13} />
        <span>{liste.length === 0 ? 'Saisir la date' : 'Ajouter une date'}</span>
        <input
          type="date"
          max={aujourdhui()}
          aria-label="Ajouter un visionnage à une date"
          value=""
          onChange={(e) => e.target.value && onAdd(e.target.value)}
        />
      </label>
    </div>
  );
}

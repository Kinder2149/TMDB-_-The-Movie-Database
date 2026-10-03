import Icon from './Icon.jsx';

// État vide : une icône, une phrase, une consigne, et si possible la suite à donner.
// `action` = { label, onClick }.
export default function Vide({ icone = 'film', titre, texte, action }) {
  return (
    <div className="vide">
      <span className="vide__ico">
        <Icon name={icone} size={28} />
      </span>
      <p className="vide__titre">{titre}</p>
      {texte && <p className="vide__texte">{texte}</p>}
      {action && (
        <button className="btn btn--primary vide__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

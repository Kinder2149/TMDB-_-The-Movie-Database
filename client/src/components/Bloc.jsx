import Icon from './Icon.jsx';

// Bloc dépliable de la page « Ce soir ».
//
// Les titres de section étaient de simples lignes de texte : en défilant, on ne
// voyait pas qu'on changeait de bloc. Chaque bloc porte maintenant une barre
// pleine largeur, teintée de sa propre couleur, avec son compte et une flèche
// pour le replier.
//
// La barre reste toujours visible, repliée comme dépliée : c'est elle qui
// donne le repère. Replier ne cache que le contenu.
export default function Bloc({ titre, couleur, compte, ouvert, onToggle, children }) {
  return (
    <section className="bloc" style={{ '--bloc-c': couleur }}>
      <button
        className="bloc__head"
        onClick={onToggle}
        aria-expanded={ouvert}
        aria-label={`${titre} — ${ouvert ? 'replier' : 'déplier'}`}
      >
        <span className="bloc__titre">{titre}</span>
        <span className="bloc__compte">{compte}</span>
        <span className={`bloc__fleche ${ouvert ? 'on' : ''}`}>
          <Icon name="chevron" size={18} />
        </span>
      </button>
      {ouvert && <div className="bloc__corps">{children}</div>}
    </section>
  );
}

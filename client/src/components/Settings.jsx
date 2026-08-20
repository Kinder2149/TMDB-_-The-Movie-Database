import Icon from './Icon.jsx';
import ProfileSelector from './ProfileSelector.jsx';

// Écran « Réglages ». Regroupe tout ce qui n'est pas du contenu : profils,
// thème, sauvegarde, à propos. Avant, ces contrôles occupaient en permanence
// le haut de l'écran ; ils ne servent qu'occasionnellement.
export default function Settings({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  theme,
  onToggleTheme,
  catalogLangLabel,
  onOpenLanguage,
  onOpenBackup,
  onOpenAbout,
  suiviCount,
}) {
  return (
    <div className="settings">
      <h2 className="settings__title">Réglages</h2>

      <p className="settings__group">Profil</p>
      <div className="settings__card">
        <div className="settings__line">
          <Icon name="user" size={20} className="settings__ico" />
          <span>Profil actif</span>
          <span className="settings__value">
            <ProfileSelector
              profiles={profiles}
              activeId={activeProfile}
              onSelect={onSelectProfile}
              onCreate={onCreateProfile}
              onRename={onRenameProfile}
            />
          </span>
        </div>
      </div>

      <p className="settings__group">Affichage</p>
      <div className="settings__card">
        <button className="settings__line settings__line--btn" onClick={onToggleTheme}>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={20} className="settings__ico" />
          <span>Thème</span>
          <span className="settings__value">
            {theme === 'dark' ? 'Sombre' : 'Clair'}
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </div>

      <p className="settings__group">Catalogue</p>
      <div className="settings__card">
        <button className="settings__line settings__line--btn" onClick={onOpenLanguage}>
          <Icon name="film" size={20} className="settings__ico" />
          <span>Langue du catalogue</span>
          <span className="settings__value">
            {catalogLangLabel}
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </div>

      <p className="settings__group">Mes données</p>
      <div className="settings__card">
        <button className="settings__line settings__line--btn" onClick={onOpenBackup}>
          <Icon name="save" size={20} className="settings__ico" />
          <span>Sauvegarder / restaurer</span>
          <span className="settings__value">
            <Icon name="chevron" size={14} />
          </span>
        </button>
        <div className="settings__line">
          <Icon name="chart" size={20} className="settings__ico" />
          <span>Titres suivis</span>
          <span className="settings__value">{suiviCount}</span>
        </div>
      </div>

      <p className="settings__group">À propos</p>
      <div className="settings__card">
        <button className="settings__line settings__line--btn" onClick={onOpenAbout}>
          <Icon name="info" size={20} className="settings__ico" />
          <span>Sources et mentions légales</span>
          <span className="settings__value">
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </div>
    </div>
  );
}

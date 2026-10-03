import Icon from './Icon.jsx';
import { useState } from 'react';
import Avatar from './Avatar.jsx';
import { CHOIX_THEME } from '../theme.js';

// Écran « Réglages ». Regroupe tout ce qui n'est pas du contenu : profils,
// thème, sauvegarde, à propos. Avant, ces contrôles occupaient en permanence
// le haut de l'écran ; ils ne servent qu'occasionnellement.
export default function Settings({
  profiles,
  activeProfile,
  onOpenProfiles,
  choixTheme,
  onChoixTheme,
  catalogLangLabel,
  onOpenLanguage,
  onOpenBackup,
  onOpenNotifications,
  onOpenAbout,
  onOpenStats,
  onOpenPartage,
  onOpenAmis,
  partageDisponible,
  partageActif,
  suiviCount,
}) {
  const actif = profiles.find((p) => p.id === activeProfile);
  const [themeOuvert, setThemeOuvert] = useState(false);
  const libelleTheme = CHOIX_THEME.find(([v]) => v === choixTheme)?.[1];

  return (
    <div className="settings">
      <h2 className="settings__title">Réglages</h2>

      <p className="settings__group">Profil</p>
      <div className="settings__card">
        <button className="settings__line settings__line--btn" onClick={onOpenProfiles}>
          <Icon name="user" size={20} className="settings__ico" />
          <span>Mes profils</span>
          <span className="settings__value">
            <Avatar name={actif?.name} value={actif?.avatar} size={24} />
            {actif?.name || '—'}
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </div>

      {partageDisponible && (
        <>
        <p className="settings__group">Amis</p>
        <div className="settings__card">
          <button className="settings__line settings__line--btn" onClick={onOpenPartage}>
            <Icon name="user" size={20} className="settings__ico" />
            <span>Profil partagé</span>
            <span className="settings__value">
              {partageActif ? 'Actif' : 'Désactivé'}
              <Icon name="chevron" size={14} />
            </span>
          </button>
          <button className="settings__line settings__line--btn" onClick={onOpenAmis}>
            <Icon name="user" size={20} className="settings__ico" />
            <span>Mes amis</span>
            <span className="settings__value">
              <Icon name="chevron" size={14} />
            </span>
          </button>
        </div>
        </>
      )}

      <p className="settings__group">Affichage</p>
      <div className="settings__card">
        <button
          className="settings__line settings__line--btn"
          onClick={() => setThemeOuvert((o) => !o)}
          aria-expanded={themeOuvert}
        >
          <Icon name={choixTheme === 'dark' ? 'moon' : 'sun'} size={20} className="settings__ico" />
          <span>Thème</span>
          <span className="settings__value">
            {libelleTheme}
            <Icon name="chevron" size={14} />
          </span>
        </button>
        {themeOuvert && (
          <div className="choix-theme" role="radiogroup" aria-label="Thème">
            {CHOIX_THEME.map(([v, label, aide]) => (
              <button
                key={v}
                role="radio"
                aria-checked={choixTheme === v}
                className={`choix-theme__ligne ${choixTheme === v ? 'on' : ''}`}
                onClick={() => onChoixTheme(v)}
              >
                <span className="choix-theme__txt">
                  <b>{label}</b>
                  {aide && <small>{aide}</small>}
                </span>
                {choixTheme === v && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        )}
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

      <p className="settings__group">Notifications</p>
      <div className="settings__card">
        <button className="settings__line settings__line--btn" onClick={onOpenNotifications}>
          <Icon name="bell" size={20} className="settings__ico" />
          <span>Notifications de sortie</span>
          <span className="settings__value">
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
        <button className="settings__line settings__line--btn" onClick={onOpenStats}>
          <Icon name="chart" size={20} className="settings__ico" />
          <span>Statistiques</span>
          <span className="settings__value">
            {suiviCount} titres
            <Icon name="chevron" size={14} />
          </span>
        </button>
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

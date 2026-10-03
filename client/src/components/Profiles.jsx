import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Avatar, {
  AVATAR_COLORS,
  AVATAR_SYMBOLS,
  couleurCss,
  estPhoto,
  formatAvatar,
  initiale,
  parseAvatar,
  photoDepuisFichier,
} from './Avatar.jsx';

// Écran « Mes profils ». Remplace le menu déroulant des réglages : choisir,
// créer, renommer, habiller et **supprimer** un profil se font maintenant au
// même endroit, avec ce que chaque profil contient sous les yeux.
//
// La suppression est la seule action irréversible de l'application : elle
// annonce d'abord ce qu'elle emporte (titres, épisodes, listes) et demande une
// confirmation explicite. Le dernier profil ne peut pas être supprimé.
export default function Profiles({
  profiles,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onSetAvatar,
  onCountData,
  onDelete,
  onClose,
}) {
  const [habille, setHabille] = useState(null); // profil dont on choisit l'avatar
  const [aSupprimer, setASupprimer] = useState(null); // { profil, contenu }
  const [erreur, setErreur] = useState('');

  async function demandeSuppression(profil) {
    setErreur('');
    try {
      setASupprimer({ profil, contenu: await onCountData(profil.id) });
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function confirmeSuppression() {
    const profil = aSupprimer.profil;
    setASupprimer(null);
    try {
      await onDelete(profil.id);
    } catch (e) {
      setErreur(e.message);
    }
  }

  function creer() {
    const nom = window.prompt('Nom du nouveau profil ?');
    if (nom && nom.trim()) onCreate(nom.trim());
  }

  function renommer(profil) {
    const nom = window.prompt('Nouveau nom du profil ?', profil.name);
    if (nom && nom.trim()) onRename(profil.id, nom.trim());
  }

  const dernier = profiles.length <= 1;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>Mes profils</h2>
        </header>

        <div className="detail-pad">
          <p className="panel__note">
            Chaque profil a son propre suivi : ses titres, ses épisodes vus, ses
            listes et ses notes.
          </p>
          {erreur && <p className="message message--erreur">{erreur}</p>}
        </div>

        <ul className="profil-list">
          {profiles.map((p) => (
            <li key={p.id} className={`profil ${p.id === activeId ? 'on' : ''}`}>
              <button
                className="profil__main"
                onClick={() => onSelect(p.id)}
                aria-label={`Utiliser le profil ${p.name}`}
              >
                <Avatar name={p.name} value={p.avatar} size={44} />
                <span className="profil__id">
                  <span className="profil__nom">{p.name}</span>
                  {p.titres != null && (
                    <span className="profil__n">
                      {p.titres} titre{p.titres > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                {p.id === activeId && (
                  <span className="profil__actif">
                    <Icon name="check" size={14} />
                    Actif
                  </span>
                )}
              </button>

              <div className="profil__actions">
                <button
                  className="chip-toggle"
                  onClick={() => setHabille(habille === p.id ? null : p.id)}
                >
                  Avatar
                </button>
                <button className="chip-toggle" onClick={() => renommer(p)}>
                  Renommer
                </button>
                <button
                  className="chip-toggle chip-toggle--danger"
                  onClick={() => demandeSuppression(p)}
                  disabled={dernier}
                  title={
                    dernier
                      ? "C'est le seul profil : il ne peut pas être supprimé."
                      : 'Supprimer ce profil et tout son contenu'
                  }
                >
                  Supprimer
                </button>
              </div>

              {habille === p.id && (
                <ChoixAvatar
                  profil={p}
                  onChoisir={(valeur) => onSetAvatar(p.id, valeur)}
                  onErreur={setErreur}
                />
              )}
            </li>
          ))}
        </ul>

        <div className="detail-pad">
          <button className="btn btn--primary btn--wide" onClick={creer}>
            <Icon name="plus" size={16} />
            Nouveau profil
          </button>
        </div>

        {aSupprimer && (
          <div className="overlay overlay--confirm" onClick={() => setASupprimer(null)}>
            <div className="confirm" onClick={(e) => e.stopPropagation()}>
              <h3>Supprimer « {aSupprimer.profil.name} » ?</h3>
              <p>
                Cette suppression emporte définitivement, sur cet appareil :
              </p>
              <ul className="confirm__list">
                <li>{aSupprimer.contenu.titres} titre(s) suivi(s), avec leurs notes</li>
                <li>{aSupprimer.contenu.episodes} épisode(s) coché(s)</li>
                <li>{aSupprimer.contenu.listes} liste(s) personnalisée(s)</li>
              </ul>
              <p className="hint">
                Sa sauvegarde dans ton Drive sera retirée à la prochaine
                sauvegarde : le profil ne reviendra pas en restaurant.
              </p>
              <div className="confirm__actions">
                <button className="btn btn--ghost" onClick={() => setASupprimer(null)}>
                  Annuler
                </button>
                <button className="btn btn--danger" onClick={confirmeSuppression}>
                  Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Choix de l'avatar : une couleur, puis un symbole. Chaque clic enregistre
// aussitôt — il n'y a rien à valider.
function ChoixAvatar({ profil, onChoisir, onErreur }) {
  const { couleur, symbole } = parseAvatar(profil.avatar);
  const photo = estPhoto(profil.avatar);
  const champFichier = useRef(null);

  // La galerie s'ouvre par le champ fichier du système : pas de composant
  // supplémentaire à embarquer, et surtout **aucune permission à demander** —
  // c'est Android qui montre le sélecteur et ne donne que l'image choisie.
  async function choisirPhoto(event) {
    const fichier = event.target.files?.[0];
    event.target.value = ''; // pouvoir rechoisir la même image ensuite
    if (!fichier) return;
    try {
      onChoisir(await photoDepuisFichier(fichier));
    } catch (e) {
      onErreur(e.message);
    }
  }

  return (
    <div className="avatar-pick">
      <p className="avatar-pick__label">Photo</p>
      <div className="avatar-pick__row">
        <button className="chip-toggle" onClick={() => champFichier.current?.click()}>
          {photo ? 'Changer de photo' : 'Choisir dans ma galerie'}
        </button>
        {photo && (
          <button
            className="chip-toggle chip-toggle--danger"
            onClick={() => onChoisir(formatAvatar(couleur, symbole))}
          >
            Retirer la photo
          </button>
        )}
        <input
          ref={champFichier}
          className="avatar-pick__fichier"
          type="file"
          accept="image/*"
          onChange={choisirPhoto}
        />
      </div>

      {/* Couleur et symbole restent choisis même sous une photo : ils
          reprennent la main dès qu'on la retire. */}
      <p className="avatar-pick__label">Couleur</p>
      <div className="avatar-pick__row">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c.key}
            className={`avatar-pick__col ${c.key === couleur ? 'on' : ''}`}
            style={{ background: c.css }}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChoisir(formatAvatar(c.key, symbole))}
          />
        ))}
      </div>

      <p className="avatar-pick__label">Symbole</p>
      <div className="avatar-pick__row">
        {AVATAR_SYMBOLS.map((s) => (
          <button
            key={s.key}
            className={`avatar-pick__sym ${s.key === symbole ? 'on' : ''}`}
            style={s.key === symbole ? { background: couleurCss(couleur) } : undefined}
            aria-label={s.label}
            title={s.label}
            onClick={() => onChoisir(formatAvatar(couleur, s.key))}
          >
            {s.key === 'initiale' ? initiale(profil.name) : <Icon name={s.key} size={18} />}
          </button>
        ))}
      </div>
    </div>
  );
}

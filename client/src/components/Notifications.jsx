import { useEffect, useState } from 'react';
import { hasPermission, requestPermission, envoyerNotificationTest } from '../notifications.js';
import Icon from './Icon.jsx';

// Écran « Notifications ». À cette étape, sert seulement à activer
// l'autorisation Android et à vérifier qu'une notification arrive bien —
// la programmation à partir des vraies dates de sortie vient ensuite.
export default function Notifications({ onClose }) {
  const [accordee, setAccordee] = useState(null); // null = pas encore su
  const [erreur, setErreur] = useState('');
  const [envoyee, setEnvoyee] = useState(false);

  useEffect(() => {
    hasPermission()
      .then(setAccordee)
      .catch(() => setAccordee(false));
  }, []);

  async function activer() {
    setErreur('');
    try {
      setAccordee(await requestPermission());
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function tester() {
    setErreur('');
    setEnvoyee(false);
    try {
      await envoyerNotificationTest();
      setEnvoyee(true);
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>Notifications</h2>
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
        </header>

        <div className="detail-pad about">
          <section className="panel">
            <p className="panel__texte">
              Être prévenu quand un film que tu suis sort au cinéma, quand une série suivie diffuse
              un nouvel épisode, ou quand une nouvelle saison est annoncée.
            </p>

            {accordee === null && <div className="skeleton skeleton--line" aria-hidden="true" />}

            {accordee === false && (
              <>
                <p className="panel__note">
                  L'autorisation d'afficher des notifications n'est pas encore accordée.
                </p>
                <button className="btn btn--primary btn--wide" onClick={activer}>
                  Activer les notifications
                </button>
              </>
            )}

            {accordee === true && (
              <>
                <p className="message message--ok">
                  <Icon name="check" size={14} /> Autorisation accordée.
                </p>
                <button className="btn btn--ghost btn--wide notif__test" onClick={tester}>
                  Envoyer une notification de test
                </button>
                {envoyee && <p className="panel__note">Elle doit apparaître tout de suite dans la barre du haut de ton téléphone.</p>}
              </>
            )}

            {erreur && <p className="message message--erreur">{erreur}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

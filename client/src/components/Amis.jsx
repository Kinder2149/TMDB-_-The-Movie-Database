import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import FicheAmi from './FicheAmi.jsx';
import { getAmis, ajouterAmi } from '../api.js';

// Écran « Mes amis » : ajouter quelqu'un avec son code, retrouver ceux qu'on suit.
// Le suivi est à sens unique : l'ami n'est pas prévenu et n'a rien à accepter. La
// liste reste sur ce téléphone (et dans la sauvegarde).
export default function Amis({ onClose, onSurcouche, cardProps, suivi }) {
  const [amis, setAmis] = useState(undefined); // undefined = chargement
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ouvert, setOuvert] = useState(null); // code de l'ami dont on lit la fiche

  const charger = () =>
    getAmis()
      .then(setAmis)
      .catch(() => setAmis([]));
  useEffect(() => {
    charger();
  }, []);

  // La fiche d'un ami couvre l'écran : le bouton retour d'Android doit la fermer,
  // pas toute la liste. On le signale à l'application, qui tient la chaîne des retours.
  useEffect(() => {
    onSurcouche?.(ouvert ? { fermer: () => setOuvert(null) } : null);
    return () => onSurcouche?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    setOccupe(true);
    try {
      const ami = await ajouterAmi(code);
      setCode('');
      await charger();
      setOuvert(ami.code);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  }

  if (ouvert) {
    return (
      <FicheAmi
        code={ouvert}
        cardProps={cardProps}
        suivi={suivi}
        onRetire={() => {
          setOuvert(null);
          charger();
        }}
        onClose={() => {
          setOuvert(null);
          charger();
        }}
      />
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>Mes amis</h2>
        </header>

        <div className="detail-pad amis">
          <section className="panel">
            <h3 className="panel__title">Ajouter un ami</h3>
            <p className="panel__note">
              Entre son code ami pour voir ses listes et t'inspirer. Il n'est pas prévenu, et rien
              ne change pour lui.
            </p>
            <form className="amis__ajout" onSubmit={ajouter}>
              <input
                type="text"
                className="field__input"
                value={code}
                placeholder="K7F2-M9QX-3DTB"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Code ami"
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="btn btn--primary" disabled={occupe || !code.trim()}>
                {occupe ? '…' : 'Ajouter'}
              </button>
            </form>
            {erreur && <p className="message message--erreur">{erreur}</p>}
          </section>

          {amis === undefined && <div className="skeleton skeleton--bloc" aria-hidden="true" />}

          {amis?.length === 0 && (
            <div className="vide">
              <span className="vide__ico">
                <Icon name="user" size={28} />
              </span>
              <p className="vide__titre">Aucun ami pour l'instant</p>
              <p className="vide__texte">Demande son code à quelqu'un, il se trouve dans Réglages › Profil partagé.</p>
            </div>
          )}

          {amis?.length > 0 && (
            <section className="panel panel--liste">
              {amis.map((a) => (
                <button key={a.code} className="ligne-ami" onClick={() => setOuvert(a.code)}>
                  <Avatar name={a.pseudo} value={a.avatar} size={40} />
                  <span className="ligne-ami__nom">
                    {a.pseudo}
                    {a.disparu ? <small>Fiche indisponible</small> : null}
                  </span>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

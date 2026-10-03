import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Icon from './Icon.jsx';
import {
  getPartage,
  activerPartage,
  retrouverPartage,
  desactiverPartage,
  changerPseudoPartage,
  setStatutPartagePrive,
  mettreAJourPartage,
  partageDisponible,
  formaterCode,
  PSEUDO_MAX,
} from '../api.js';
import { STATUSES } from '../status.js';

// Écran « Profil partagé » (amis par code) — PLAN_V2.md, point 4 bis.
// Facultatif : tant qu'on n'active rien, rien ne quitte le téléphone. Une fois
// actif, les amis qui ont ton code voient ton pseudo, tes titres vus avec leurs
// étoiles et tes listes — sauf celles marquées privées. Jamais tes avis écrits.
export default function Partage({ profileName, onClose, onChanged }) {
  const [partage, setPartage] = useState(undefined); // undefined = chargement
  const [pseudo, setPseudo] = useState(profileName || '');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [recuperation, setRecuperation] = useState(false);
  const [retrouver, setRetrouver] = useState(false);
  const [codeAmi, setCodeAmi] = useState('');
  const [cleSaisie, setCleSaisie] = useState('');

  useEffect(() => {
    getPartage()
      .then((p) => {
        setPartage(p);
        if (p) setPseudo(p.pseudo);
      })
      .catch(() => setPartage(null));
  }, []);

  async function agir(fn, message = '') {
    setErreur('');
    setInfo('');
    setOccupe(true);
    try {
      const res = await fn();
      setPartage(await getPartage());
      onChanged?.();
      if (res?.tronque) {
        setInfo('Ta fiche dépasse le plafond (5 000 titres, 50 listes) : le plus ancien est laissé de côté.');
      } else if (message) setInfo(message);
      return res;
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  }

  async function copier(texte, message) {
    try {
      await navigator.clipboard.writeText(texte);
      setInfo(message);
    } catch {
      setInfo(texte); // pas de presse-papier : au moins le texte est lisible
    }
  }

  async function partager() {
    const texte = `Rejoins-moi sur Vault Watch ! Mon code ami : ${formaterCode(partage.code)}`;
    // Sur le téléphone : la feuille de partage d'Android, par le plugin natif. Dans un
    // navigateur : celle du navigateur si elle existe, sinon on copie le message.
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ text: texte });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: texte });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return;
    }
    copier(texte, 'Message copié.');
  }

  function arreter() {
    if (
      window.confirm(
        'Arrêter le partage ? Ta fiche est supprimée du serveur et ton code ne fonctionnera plus. ' +
          'Tes données sur le téléphone ne changent pas.'
      )
    ) {
      agir(desactiverPartage, 'Partage arrêté, ta fiche a été supprimée.');
    }
  }

  const actif = !!partage?.actif;
  const statutPrive = (v) => partage?.statutsPrives.includes(v);
  const cleAffichee = partage ? partage.cle.match(/.{1,4}/g).join('-') : '';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>Profil partagé</h2>
        </header>

        <div className="detail-pad partage">
          {!partageDisponible() && (
            <p className="empty">Le partage n'est pas disponible dans cette version.</p>
          )}

          {partageDisponible() && partage === undefined && (
            <div className="skeleton skeleton--bloc" aria-hidden="true" />
          )}

          {partageDisponible() && partage !== undefined && !actif && (
            <>
              <section className="panel">
                <h3 className="panel__title">Partage ton profil avec tes proches</h3>
                <p className="panel__texte">
                  Un code ami suffit : ils voient tes listes et s'en inspirent, tu vois les leurs.
                  Aucun compte à créer.
                </p>
                <ul className="check-list">
                  <li className="check-list__ok">
                    <Icon name="check" size={16} />
                    <span>Ton pseudo, ton avatar, tes titres avec leurs étoiles, tes listes</span>
                  </li>
                  <li className="check-list__ok">
                    <Icon name="check" size={16} />
                    <span>Tu gardes privée n'importe quelle liste</span>
                  </li>
                  <li className="check-list__non">
                    <Icon name="close" size={16} />
                    <span>Jamais tes avis écrits, ni tes dates de visionnage</span>
                  </li>
                </ul>
                <p className="panel__note">
                  Tant que tu n'actives rien, <b>rien ne quitte ton téléphone</b>.
                </p>
              </section>

              <section className="panel">
                <label className="field">
                  <span className="field__label">Ton pseudo</span>
                  <input
                    type="text"
                    value={pseudo}
                    maxLength={PSEUDO_MAX}
                    onChange={(e) => setPseudo(e.target.value)}
                  />
                </label>
                <button
                  className="btn btn--primary btn--wide"
                  disabled={occupe}
                  onClick={() =>
                    agir(() => activerPartage(pseudo), 'Partage activé. Voici ton code ami.')
                  }
                >
                  {occupe ? 'Activation…' : 'Activer le partage'}
                </button>
              </section>

              <button className="lien" onClick={() => setRetrouver(!retrouver)}>
                J'avais déjà un code ami (nouveau téléphone, réinstallation)
              </button>
              {retrouver && (
                <section className="panel">
                  <p className="panel__note">
                    Si tu as restauré ta sauvegarde Drive, tout est déjà là. Sinon, saisis ton code
                    ami et ton code de récupération : ta fiche en ligne sera remplacée par le
                    contenu de ce téléphone.
                  </p>
                  <label className="field">
                    <span className="field__label">Code ami</span>
                    <input
                      type="text"
                      value={codeAmi}
                      placeholder="K7F2-M9QX-3DTB"
                      autoCapitalize="characters"
                      autoComplete="off"
                      onChange={(e) => setCodeAmi(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Code de récupération</span>
                    <input
                      type="text"
                      value={cleSaisie}
                      placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                      autoCapitalize="characters"
                      autoComplete="off"
                      onChange={(e) => setCleSaisie(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn--ghost btn--wide"
                    disabled={occupe || !codeAmi.trim() || !cleSaisie.trim()}
                    onClick={() =>
                      agir(() => retrouverPartage(codeAmi, cleSaisie), 'Fiche retrouvée.')
                    }
                  >
                    Retrouver ma fiche
                  </button>
                </section>
              )}
            </>
          )}

          {partageDisponible() && actif && (
            <>
              <section className="panel panel--accent panel--centre">
                <p className="eyebrow">Ton code ami</p>
                <p className="partage__code">{formaterCode(partage.code)}</p>
                <div className="boutons-duo">
                  <button className="btn btn--primary" onClick={partager}>
                    <Icon name="plus" size={15} />
                    Partager
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => copier(formaterCode(partage.code), 'Code copié.')}
                  >
                    Copier
                  </button>
                </div>
              </section>

              <section className="panel">
                <label className="field">
                  <span className="field__label">Ton pseudo</span>
                  <input
                    type="text"
                    value={pseudo}
                    maxLength={PSEUDO_MAX}
                    onChange={(e) => setPseudo(e.target.value)}
                  />
                </label>
                {pseudo.trim() !== partage.pseudo && (
                  <button
                    className="btn btn--ghost btn--wide"
                    disabled={occupe}
                    onClick={() => agir(() => changerPseudoPartage(pseudo), 'Pseudo mis à jour.')}
                  >
                    Enregistrer le pseudo
                  </button>
                )}
              </section>

              <section className="panel panel--liste">
                <div className="panel__entete">
                  <h3 className="panel__title">Ce que tes amis voient</h3>
                  <p className="panel__note">
                    Désactive ce que tu veux garder pour toi. Les listes que tu crées se règlent
                    dans « Mes listes ».
                  </p>
                </div>
                {STATUSES.map((s) => (
                  <label key={s.value} className="ligne-switch">
                    <span>{s.label}</span>
                    <input
                      type="checkbox"
                      className="switch"
                      role="switch"
                      checked={!statutPrive(s.value)}
                      disabled={occupe}
                      onChange={(e) => agir(() => setStatutPartagePrive(s.value, !e.target.checked))}
                    />
                  </label>
                ))}
              </section>

              <section className="panel">
                <button
                  className="btn btn--ghost btn--wide"
                  disabled={occupe}
                  onClick={() => agir(mettreAJourPartage, 'Fiche mise à jour.')}
                >
                  <Icon name="refresh" size={15} />
                  {occupe ? 'Envoi…' : 'Mettre à jour maintenant'}
                </button>
                <p className="panel__note panel__note--centre">
                  Elle se met aussi à jour toute seule quand tu quittes l'application.
                </p>
              </section>

              <section className="panel">
                <h3 className="panel__title">Code de récupération</h3>
                <p className="panel__note">
                  Si tu perds ou changes de téléphone, il permet de retrouver ta fiche et ton code
                  ami. Il est aussi gardé dans ta sauvegarde Drive. Note-le, ne le montre à
                  personne.
                </p>
                {recuperation ? (
                  <>
                    <p className="partage__code partage__code--cle">{cleAffichee}</p>
                    <button
                      className="btn btn--ghost btn--wide"
                      onClick={() => copier(cleAffichee, 'Code copié.')}
                    >
                      Copier
                    </button>
                  </>
                ) : (
                  <button className="btn btn--ghost btn--wide" onClick={() => setRecuperation(true)}>
                    Afficher mon code de récupération
                  </button>
                )}
              </section>

              <button className="btn btn--danger-ghost btn--wide" disabled={occupe} onClick={arreter}>
                Arrêter le partage et supprimer ma fiche
              </button>
            </>
          )}

          {info && <p className="message message--ok">{info}</p>}
          {erreur && <p className="message message--erreur">{erreur}</p>}
        </div>
      </div>
    </div>
  );
}

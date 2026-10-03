import Icon from './Icon.jsx';
import { useState, useRef } from 'react';
import {
  exportProfile,
  importProfile,
  validateBackup,
  describeBackup,
  toLetterboxdCsv,
  backupToDrive,
  listCloudBackups,
  restoreFromDrive,
  ConflitSauvegarde,
  resumerSauvegardeDrive,
  lastCloudBackup,
  dernierEssaiAutomatique,
  sauvegardeAutoActive,
  reglerSauvegardeAuto,
  hasPendingChanges,
  forgetCloudState,
  cloudRestoreSuggestions,
} from '../backup.js';
import { saveTextFile, readTextFile, backupFileName } from '../files.js';
import {
  connect as connectGoogle,
  disconnect as disconnectGoogle,
  getAccount as getGoogleAccount,
  getAccessToken as getGoogleAccessToken,
  dernierModeAutorisation,
  isConfigured as googleConfigured,
  isSupported as googleSupported,
} from '../google.js';

// Écran « Sauvegarde » (tranche 4, PLAN_ANDROID).
// Sans serveur, c'est le seul filet de sécurité : on l'assume dans le ton.

// « 22 août à 12:47 » plutôt qu'une date technique : cette ligne existe pour
// que l'utilisateur sache d'un coup d'œil où il en est.
const dateLisible = (d) =>
  d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
// Traduit le résultat brut de la dernière tentative automatique.
function texteEssaiAuto(essai) {
  if (!essai) return 'aucune tentative pour l’instant.';
  const quand = essai.quand ? dateLisible(new Date(essai.quand)) : '';
  if (essai.fait) return `réussie${quand ? ` le ${quand}` : ''}.`;
  const raisons = {
    'rien-a-sauvegarder': 'rien de nouveau à envoyer',
    desactivee: 'sauvegarde automatique désactivée',
    'autorisation-indisponible':
      'Google n’a pas renouvelé l’autorisation sans écran — à refaire à la main',
    conflit:
      'un autre appareil a modifié la sauvegarde Drive — rien n’a été écrasé, à trancher à la main',
    'deja-en-cours': 'un envoi était déjà en cours',
    echec: `échec${essai.message ? ` : ${essai.message}` : ''}`,
  };
  return `${raisons[essai.raison] || essai.raison}${quand ? ` (${quand})` : ''}.`;
}

export default function Backup({ profileId, profileName, onRestored, onClose }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // Sauvegarde ouverte, en attente de confirmation : on n'écrase jamais sans
  // avoir montré ce qui va être écrit.
  const [pending, setPending] = useState(null);
  const fileInput = useRef(null);
  // Compte Google : facultatif, lu au stockage local, jamais demandé au
  // démarrage de l'application.
  const [account, setAccount] = useState(getGoogleAccount);
  const [lastBackup, setLastBackup] = useState(lastCloudBackup);
  const [pendingChanges, setPendingChanges] = useState(hasPendingChanges);
  // Contenu du Drive lu, en attente de confirmation avant d'écraser le local.
  const [cloudPending, setCloudPending] = useState(null);
  // Un autre appareil a écrit dans le Drive : rien n'est parti, on demande.
  const [conflit, setConflit] = useState(null);
  // Ce qu'a donné la dernière tentative automatique. Sans cette ligne, une
  // sauvegarde qui échoue en silence reste indiagnosticable : le téléphone
  // n'est pas sous nos yeux.
  const [essaiAuto] = useState(dernierEssaiAutomatique);
  const [autoActive, setAutoActive] = useState(sauvegardeAutoActive);

  function reset() {
    setNote('');
    setError('');
  }

  async function handleConnect() {
    reset();
    setBusy('google');
    try {
      const connected = await connectGoogle();
      if (!connected) return; // l'utilisateur a annulé
      setAccount(connected);
      setNote(`Connecté en tant que ${connected.email || connected.displayName}.`);

      // Appareil neuf : plutôt que de laisser l'utilisateur chercher comment
      // récupérer son suivi, on va voir tout de suite si son Drive en contient
      // un — l'autorisation vient d'être accordée, elle est encore valable.
      const jeton = await getGoogleAccessToken({ interactive: false });
      if (!jeton) return;
      const proposables = await cloudRestoreSuggestions(jeton);
      if (proposables.length > 0) {
        setCloudPending({ jeton, sauvegardes: proposables, spontane: true });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function handleDisconnect() {
    reset();
    setBusy('google');
    try {
      await disconnectGoogle();
      forgetCloudState();
      setAccount(null);
      setLastBackup(null);
      setPendingChanges(false);
      setNote('Compte Google déconnecté. La sauvegarde reste dans ton Drive.');
    } finally {
      setBusy('');
    }
  }

  // Envoi dans le Drive, déclenché par un geste de l'utilisateur.
  //
  // On dit ensuite **comment** l'autorisation a été obtenue : c'est ce qui
  // permet de constater, sur son propre téléphone, que le renouvellement se
  // fait bien sans écran Google — la condition d'une sauvegarde automatique.
  async function handleCloudBackup() {
    reset();
    setBusy('cloud');
    try {
      const jeton = await getGoogleAccessToken();
      if (!jeton) return; // autorisation refusée ou annulée
      const { profils } = await backupToDrive(jeton);
      setConflit(null);
      setLastBackup(lastCloudBackup());
      setPendingChanges(false);
      const mode = {
        memoire: 'autorisation déjà valide',
        silencieux: 'autorisation renouvelée sans écran Google',
        ecran: 'Google a demandé de confirmer le compte',
      }[dernierModeAutorisation()];
      setNote(
        `Sauvegarde envoyée dans ton Drive (${profils} profil${
          profils > 1 ? 's' : ''
        })${mode ? ` — ${mode}.` : '.'}`
      );
    } catch (e) {
      if (e instanceof ConflitSauvegarde) await presenterConflit(e.conflits);
      else setError(e.message);
    } finally {
      setBusy('');
    }
  }

  // Montre ce que contient le Drive avant de demander de choisir.
  async function presenterConflit(conflits) {
    const jeton = await getGoogleAccessToken();
    const detail = await Promise.all(
      conflits.map(async (c) => {
        try {
          return { ...c, resume: await resumerSauvegardeDrive(jeton, c.fileId) };
        } catch {
          return c;
        }
      })
    );
    setConflit({ jeton, conflits: detail });
  }

  // « Garder ce téléphone » : choix explicite d'écraser le Drive.
  async function garderCeTelephone() {
    setBusy('cloud');
    setError('');
    try {
      await backupToDrive(conflit.jeton, { ecraser: true });
      setConflit(null);
      setLastBackup(lastCloudBackup());
      setPendingChanges(false);
      setNote('Le Drive a été remplacé par le contenu de ce téléphone.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  // « Reprendre le Drive » : ce téléphone est remplacé, puis le reste part normalement.
  async function reprendreLeDrive() {
    setBusy('cloud');
    setError('');
    try {
      const id = await restoreFromDrive(conflit.jeton, conflit.conflits);
      await backupToDrive(conflit.jeton);
      setConflit(null);
      setLastBackup(lastCloudBackup());
      setPendingChanges(false);
      setNote('Ce téléphone a repris la version du Drive.');
      if (id) onRestored(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  // Va voir ce que contient le Drive avant de proposer quoi que ce soit :
  // on n'écrase jamais sans avoir montré ce qui va être écrit.
  async function handleCloudLookup() {
    reset();
    setBusy('cloud');
    try {
      const jeton = await getGoogleAccessToken();
      if (!jeton) return;
      const trouvees = await listCloudBackups(jeton);
      if (trouvees.length === 0) {
        setNote('Aucune sauvegarde dans ton Drive pour le moment.');
        return;
      }
      setCloudPending({ jeton, sauvegardes: trouvees });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function confirmCloudRestore() {
    setBusy('cloud');
    setError('');
    try {
      const id = await restoreFromDrive(cloudPending.jeton, cloudPending.sauvegardes);
      setCloudPending(null);
      setPendingChanges(false);
      setNote('Sauvegarde restaurée depuis ton Drive.');
      if (id) onRestored(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function handleExport() {
    reset();
    setBusy('export');
    try {
      const data = await exportProfile(profileId);
      const message = await saveTextFile(
        backupFileName(profileName, 'json'),
        JSON.stringify(data, null, 2)
      );
      setNote(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function handleCsv() {
    reset();
    setBusy('csv');
    try {
      const data = await exportProfile(profileId);
      const { csv, films, series } = toLetterboxdCsv(data.suivi, data.visionnages);
      if (films === 0) {
        setError("Aucun film à exporter (ce format n'accepte pas les séries).");
        return;
      }
      const message = await saveTextFile(
        backupFileName(profileName, 'csv'),
        csv,
        'text/csv'
      );
      setNote(
        series > 0
          ? `${message} ${films} film(s) exporté(s). ${series} série(s) écartée(s) : ce format n'accepte que les films.`
          : `${message} ${films} film(s) exporté(s).`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function handleFileChosen(event) {
    reset();
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de rechoisir le même fichier
    if (!file) return;
    setBusy('lecture');
    try {
      const texte = await readTextFile(file);
      const data = validateBackup(JSON.parse(texte));
      setPending({ data, resume: describeBackup(data) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function confirmRestore() {
    setBusy('restauration');
    setError('');
    try {
      const id = await importProfile(pending.data);
      setPending(null);
      setNote('Sauvegarde restaurée.');
      onRestored(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>Sauvegarde</h2>
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
        </header>

        <div className="detail-pad about">
          <p className="message message--attention">
            Tes données ne vivent que sur cet appareil. Sans sauvegarde, les perdre
            est définitif.
          </p>

          <section className="panel">
          <h3 className="panel__title">Sauvegarde cloud</h3>
          {!googleSupported() ? (
            <p>
              La connexion Google n’est disponible que dans l’application
              installée sur le téléphone.
            </p>
          ) : !googleConfigured() ? (
            <p className="about__warn">
              Connexion Google pas encore configurée sur cette version.
            </p>
          ) : account ? (
            <>
              <p>
                Connecté en tant que <strong>{account.email || account.displayName}</strong>.
                Ta sauvegarde va dans un dossier privé de ton propre Google
                Drive, invisible et réservé à cette application.
              </p>
              <p className={pendingChanges ? 'about__warn' : undefined}>
                Dernière sauvegarde :{' '}
                <strong>{lastBackup ? dateLisible(lastBackup) : 'jamais'}</strong>
                {pendingChanges && ' — des modifications ne sont pas encore sauvegardées.'}
              </p>
              <div className="reglage-auto">
                <div className="reglage-auto__texte">
                  <strong>Sauvegarde automatique</strong>
                  <span className="hint">
                    {autoActive
                      ? 'Envoyée toute seule quand tu quittes l’application, s’il y a du nouveau. Jamais d’écran Google.'
                      : 'Désactivée : rien ne part sans le bouton ci-dessous.'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  className="switch"
                  role="switch"
                  aria-label="Sauvegarde automatique"
                  checked={autoActive}
                  onChange={() => {
                    const suivant = !autoActive;
                    reglerSauvegardeAuto(suivant);
                    setAutoActive(suivant);
                  }}
                />
              </div>
              {autoActive && (
                <p className="hint">Dernière tentative : {texteEssaiAuto(essaiAuto)}</p>
              )}
              <div className="backup__actions">
                <button className="btn" onClick={handleCloudBackup} disabled={!!busy}>
                  {busy === 'cloud' ? 'En cours…' : 'Sauvegarder maintenant'}
                </button>
                <button className="btn" onClick={handleCloudLookup} disabled={!!busy}>
                  Restaurer depuis Drive…
                </button>
              </div>

              {conflit && (
                <div className="backup__confirm">
                  <p>
                    <strong>Un autre appareil a modifié ta sauvegarde Drive</strong> depuis la
                    dernière fois. Rien n'a été écrasé. Que veux-tu garder ?
                  </p>
                  <ul>
                    {conflit.conflits.map((c) => (
                      <li key={c.fileId}>
                        « {c.profileName} » — sur le Drive :{' '}
                        {c.modifiedAt ? dateLisible(c.modifiedAt) : 'date inconnue'}
                        {c.resume &&
                          `, ${c.resume.titres} titre(s), ${c.resume.episodes} épisode(s) vu(s)`}
                      </li>
                    ))}
                  </ul>
                  <div className="backup__actions">
                    <button className="btn" onClick={reprendreLeDrive} disabled={!!busy}>
                      Reprendre la version du Drive
                    </button>
                    <button className="btn btn--danger" onClick={garderCeTelephone} disabled={!!busy}>
                      Garder ce téléphone
                    </button>
                    <button className="btn" onClick={() => setConflit(null)} disabled={!!busy}>
                      Décider plus tard
                    </button>
                  </div>
                </div>
              )}

              {cloudPending && (
                <div className="backup__confirm">
                  <p>
                    {cloudPending.spontane
                      ? 'Une sauvegarde t’attend dans ton Drive. Veux-tu récupérer ton suivi ?'
                      : `${cloudPending.sauvegardes.length} profil(s) trouvé(s) dans ton Drive :`}
                  </p>
                  <ul>
                    {cloudPending.sauvegardes.map((s) => (
                      <li key={s.fileId}>
                        « {s.profileName} » —{' '}
                        {s.modifiedAt ? dateLisible(s.modifiedAt) : 'date inconnue'}
                      </li>
                    ))}
                  </ul>
                  <p>
                    {cloudPending.spontane
                      ? "Rien de ce qui se trouve sur cet appareil ne sera perdu : ces profils y sont absents ou vides."
                      : 'Leur contenu sur cet appareil sera remplacé par celui du Drive.'}
                  </p>
                  <div className="backup__actions">
                    <button
                      className={cloudPending.spontane ? 'btn' : 'btn btn--danger'}
                      onClick={confirmCloudRestore}
                      disabled={!!busy}
                    >
                      {busy === 'cloud'
                        ? 'Restauration…'
                        : cloudPending.spontane
                        ? 'Récupérer mon suivi'
                        : 'Remplacer et restaurer'}
                    </button>
                    <button
                      className="btn"
                      onClick={() => setCloudPending(null)}
                      disabled={!!busy}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              <button className="btn btn--ghost btn--wide backup__deconnexion" onClick={handleDisconnect} disabled={!!busy}>
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <p>
                Facultatif. Relie un compte Google pour retrouver ton suivi sur
                un autre appareil. Tes données restent dans <strong>ton</strong>{' '}
                Drive : elles ne passent par aucun serveur.
              </p>
              <button className="btn btn--primary btn--wide" onClick={handleConnect} disabled={!!busy}>
                {busy === 'google' ? 'Connexion…' : 'Se connecter avec Google'}
              </button>
            </>
          )}
          </section>

          <section className="panel">
          <h3 className="panel__title">Sauvegarder</h3>
          <p>
            Enregistre tout le profil « {profileName} » : titres suivis, épisodes
            vus et listes.
          </p>
          <button className="btn btn--ghost btn--wide" onClick={handleExport} disabled={!!busy}>
            {busy === 'export' ? 'Préparation…' : 'Enregistrer une sauvegarde'}
          </button>
          </section>

          <section className="panel">
          <h3 className="panel__title">Restaurer</h3>
          <p>
            Recharge une sauvegarde. Le contenu du profil sera{' '}
            <strong>remplacé</strong> par celui du fichier.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChosen}
            hidden
          />
          <button
            className="btn btn--ghost btn--wide"
            onClick={() => fileInput.current?.click()}
            disabled={!!busy}
          >
            {busy === 'lecture' ? 'Lecture…' : 'Choisir une sauvegarde…'}
          </button>

          {pending && (
            <div className="backup__confirm">
              <p>
                Sauvegarde du <strong>{pending.resume.date || 'date inconnue'}</strong> —
                profil « {pending.resume.profil} » : {pending.resume.titres} titre(s),{' '}
                {pending.resume.episodes} épisode(s) vu(s), {pending.resume.listes}{' '}
                liste(s).
              </p>
              <div className="backup__actions">
                <button className="btn btn--danger" onClick={confirmRestore} disabled={!!busy}>
                  {busy === 'restauration' ? 'Restauration…' : 'Remplacer et restaurer'}
                </button>
                <button className="btn" onClick={() => setPending(null)} disabled={!!busy}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          </section>

          <section className="panel">
          <h3 className="panel__title">Exporter vers un autre service</h3>
          <p>
            Fichier CSV lisible par Letterboxd et Trakt.{' '}
            <span className="about__warn">Films uniquement</span> — ces services
            n'importent pas les séries.
          </p>
          <button className="btn btn--ghost btn--wide" onClick={handleCsv} disabled={!!busy}>
            {busy === 'csv' ? 'Préparation…' : 'Exporter les films (CSV)'}
          </button>
          </section>

          {note && <p className="message message--ok">{note}</p>}
          {error && <p className="message message--erreur">{error}</p>}
        </div>
      </div>
    </div>
  );
}

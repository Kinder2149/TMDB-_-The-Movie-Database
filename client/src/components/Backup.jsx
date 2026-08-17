import { useState, useRef } from 'react';
import {
  exportProfile,
  importProfile,
  validateBackup,
  describeBackup,
  toLetterboxdCsv,
} from '../backup.js';
import { saveTextFile, readTextFile, backupFileName } from '../files.js';

// Écran « Sauvegarde » (tranche 4, PLAN_ANDROID).
// Sans serveur, c'est le seul filet de sécurité : on l'assume dans le ton.
export default function Backup({ profileId, profileName, onRestored, onClose }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // Sauvegarde ouverte, en attente de confirmation : on n'écrase jamais sans
  // avoir montré ce qui va être écrit.
  const [pending, setPending] = useState(null);
  const fileInput = useRef(null);

  function reset() {
    setNote('');
    setError('');
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
      const { csv, films, series } = toLetterboxdCsv(data.suivi);
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
          <button className="sheet__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="detail-pad about">
          <p className="about__warn">
            Vos données ne vivent que sur cet appareil. Sans sauvegarde, les perdre
            est définitif.
          </p>

          <h3 className="about__title">Sauvegarder</h3>
          <p>
            Enregistre tout le profil « {profileName} » : titres suivis, épisodes
            vus et listes.
          </p>
          <button className="btn" onClick={handleExport} disabled={!!busy}>
            {busy === 'export' ? 'Préparation…' : 'Enregistrer une sauvegarde'}
          </button>

          <h3 className="about__title">Restaurer</h3>
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
            className="btn"
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

          <h3 className="about__title">Exporter vers un autre service</h3>
          <p>
            Fichier CSV lisible par Letterboxd et Trakt.{' '}
            <span className="about__warn">Films uniquement</span> — ces services
            n'importent pas les séries.
          </p>
          <button className="btn" onClick={handleCsv} disabled={!!busy}>
            {busy === 'csv' ? 'Préparation…' : 'Exporter les films (CSV)'}
          </button>

          {note && <p className="backup__note">{note}</p>}
          {error && <p className="backup__error">{error}</p>}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import Icon from './Icon.jsx';
import { LANGUAGES } from '../lang.js';

// Choix de la langue du catalogue, dans ses deux usages :
//   - `welcome` : premier lancement, plein écran, avant d'entrer dans l'app ;
//   - sinon     : feuille ouverte depuis les réglages.
//
// Au changement, toutes les fiches enregistrées sont re-téléchargées en une
// passe. L'écran est bloquant pendant l'opération : la moitié des affiches
// dans une langue et l'autre moitié dans l'autre serait plus déroutant qu'une
// attente de quelques secondes avec une barre de progression.
export default function CatalogLanguage({
  current,
  onApply, // (langue, onProgress) => { total, done, failed }
  onClose, // absent en mode bienvenue : on ne peut pas passer sans choisir
  welcome = false,
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // langue en cours d'application

  async function choose(value) {
    if (busy) return;
    setBusy(true);
    setError('');
    setFailed(0);
    setPending(value);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await onApply(value, setProgress);
      if (res.failed > 0) {
        setFailed(res.failed);
        setError(
          `${res.failed} fiche(s) n'ont pas pu être mises à jour (connexion interrompue ?). Tes statuts et tes listes sont intacts.`
        );
        return; // on laisse l'écran ouvert pour proposer de réessayer
      }
      onClose?.();
    } catch (e) {
      setError(e.message || 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  const body = (
    <>
      <p className="lang__note">
        Langue des titres, synopsis, genres et affiches. La langue de
        l'application, elle, reste le français.
      </p>

      <div className="lang__choices">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            className={`lang__choice ${current === l.value ? 'is-current' : ''}`}
            onClick={() => choose(l.value)}
            disabled={busy}
          >
            <span>{l.label}</span>
            {current === l.value && <Icon name="check" size={16} />}
          </button>
        ))}
      </div>

      {busy && (
        <div className="lang__progress">
          <p className="hint">
            {progress?.total
              ? `Mise à jour des fiches… ${progress.done} / ${progress.total}`
              : 'Préparation…'}
          </p>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="hint">
            Tes statuts, tes épisodes vus et tes listes ne sont pas touchés.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {failed > 0 && !busy && (
        <div className="lang__retry">
          <button className="btn btn--primary" onClick={() => choose(pending)}>
            Réessayer
          </button>
          {onClose && (
            <button className="btn btn--ghost" onClick={onClose}>
              Plus tard
            </button>
          )}
        </div>
      )}
    </>
  );

  if (welcome) {
    return (
      <div className="welcome">
        <h1 className="welcome__title">Bienvenue</h1>
        <p className="welcome__sub">
          Dans quelle langue veux-tu voir les films et les séries ?
        </p>
        {body}
      </div>
    );
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button
            className="sheet__back"
            onClick={onClose}
            disabled={busy}
            aria-label="Retour"
          >
            <Icon name="back" size={22} />
          </button>
          <h2>Langue du catalogue</h2>
        </header>
        <div className="section">{body}</div>
      </div>
    </div>
  );
}

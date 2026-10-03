import { useState } from 'react';
import Icon from './Icon.jsx';
import { titreCorrespond } from '../status.js';

// « Ajouter des titres » à une liste, depuis ce qu'on suit déjà.
//
// Avant, remplir une liste demandait d'ouvrir la fiche de chaque titre, un par
// un. Ici toute la bibliothèque est posée à plat : on coche ce qu'on veut, on
// valide une fois. Les titres déjà dans la liste sont affichés cochés et
// désactivés — on ne peut ni les ajouter deux fois, ni les retirer d'ici (ça se
// fait depuis la liste elle-même).
export default function AddToListe({ liste, items, dejaDedans, onValider, onClose }) {
  const [choisis, setChoisis] = useState(() => new Set());
  const [recherche, setRecherche] = useState('');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [enCours, setEnCours] = useState(false);

  const presents = new Set(dejaDedans.map((i) => `${i.mediaType}-${i.id}`));

  const visibles = items
    .filter((i) => mediaFilter === 'all' || i.mediaType === mediaFilter)
    .filter((i) => titreCorrespond(i.title, recherche))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  function bascule(item) {
    const key = `${item.mediaType}-${item.id}`;
    if (presents.has(key)) return;
    setChoisis((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Tout cocher ne porte que sur ce qui est affiché : c'est le sens attendu
  // quand on a filtré sur « Films » ou tapé une recherche.
  function toutCocher() {
    const ajoutables = visibles.filter((i) => !presents.has(`${i.mediaType}-${i.id}`));
    const tousCoches = ajoutables.every((i) => choisis.has(`${i.mediaType}-${i.id}`));
    setChoisis((prev) => {
      const next = new Set(prev);
      for (const i of ajoutables) {
        const key = `${i.mediaType}-${i.id}`;
        if (tousCoches) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  async function valider() {
    setEnCours(true);
    try {
      await onValider(items.filter((i) => choisis.has(`${i.mediaType}-${i.id}`)));
      onClose();
    } finally {
      setEnCours(false);
    }
  }

  const ajoutablesVisibles = visibles.filter(
    (i) => !presents.has(`${i.mediaType}-${i.id}`)
  );
  const tousCoches =
    ajoutablesVisibles.length > 0 &&
    ajoutablesVisibles.every((i) => choisis.has(`${i.mediaType}-${i.id}`));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>Ajouter à « {liste.name} »</h2>
        </header>

        <div className="detail-pad">
          <div className="search-bar">
            <span className="search-bar__icon" aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              value={recherche}
              placeholder="Filtrer par titre…"
              aria-label="Filtrer par titre"
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <div className="seg seg--sm">
            {[
              { value: 'all', label: 'Tout' },
              { value: 'movie', label: 'Films' },
              { value: 'tv', label: 'Séries' },
            ].map((f) => (
              <button
                key={f.value}
                className={mediaFilter === f.value ? 'on' : ''}
                onClick={() => setMediaFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            className="chip-toggle"
            onClick={toutCocher}
            disabled={ajoutablesVisibles.length === 0}
          >
            {tousCoches ? 'Tout décocher' : 'Tout cocher'}
            {` (${ajoutablesVisibles.length})`}
          </button>
        </div>

        {visibles.length === 0 ? (
          <p className="hint detail-pad">
            {items.length === 0
              ? "Ta bibliothèque est vide : ajoute d'abord des titres à ton suivi."
              : 'Aucun titre ne correspond à ce filtre.'}
          </p>
        ) : (
          <ul className="pick-list">
            {visibles.map((item) => {
              const key = `${item.mediaType}-${item.id}`;
              const dedans = presents.has(key);
              const coche = dedans || choisis.has(key);
              return (
                <li key={key}>
                  <button
                    className={`pick ${coche ? 'on' : ''}`}
                    onClick={() => bascule(item)}
                    disabled={dedans}
                    title={dedans ? 'Déjà dans la liste' : undefined}
                  >
                    <span className={`pick__box ${coche ? 'on' : ''}`}>
                      {coche && <Icon name="check" size={13} />}
                    </span>
                    {item.posterUrl ? (
                      <img className="pick__poster" src={item.posterUrl} alt="" />
                    ) : (
                      <span className="pick__poster pick__poster--vide">—</span>
                    )}
                    <span className="pick__info">
                      <span className="pick__titre">{item.title}</span>
                      <span className="pick__sous">
                        {item.mediaType === 'movie' ? 'Film' : 'Série'}
                        {item.year && ` · ${item.year}`}
                        {dedans && ' · déjà dans la liste'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Barre de validation collée en bas : le choix se fait en défilant,
            le bouton ne doit pas partir hors de l'écran. */}
        <div className="pick-bar">
          <span className="pick-bar__compte">
            {choisis.size === 0
              ? 'Aucun titre sélectionné'
              : `${choisis.size} titre${choisis.size > 1 ? 's' : ''} sélectionné${
                  choisis.size > 1 ? 's' : ''
                }`}
          </span>
          <button
            className="btn btn--primary"
            onClick={valider}
            disabled={choisis.size === 0 || enCours}
          >
            {enCours ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

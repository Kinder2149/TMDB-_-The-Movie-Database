import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import MovieCard from './MovieCard.jsx';
import { ouvrirAmi, retirerAmi, cartesDe } from '../api.js';
import { STATUSES } from '../status.js';

const PAR_LOT = 30;
const keyOf = (item) => `${item.mediaType}-${item.id}`;
const nomStatut = (v) => STATUSES.find((s) => s.value === v)?.label || v;
const etoiles = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// La fiche d'un ami : son pseudo, puis un onglet par liste qu'il a rendue publique.
// Chaque titre est une carte normale — le « + » l'ajoute à ton propre suivi, et
// l'affiche porte déjà ton statut si tu l'as. Les étoiles sont les siennes.
export default function FicheAmi({ code, cardProps, suivi, onClose, onRetire }) {
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState('');
  const [liste, setListe] = useState(0);
  const [nb, setNb] = useState(PAR_LOT);
  const [cartes, setCartes] = useState([]);
  const [chargement, setChargement] = useState(false);

  function charger(force = false) {
    setErreur('');
    return ouvrirAmi(code, { force })
      .then(setFiche)
      .catch((e) => setErreur(e.message));
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const courante = fiche?.listes?.[liste];
  const visibles = courante?.items.slice(0, nb) || [];

  // Les affiches arrivent par lots : on ne demande à TMDB que ce qui est à l'écran.
  useEffect(() => {
    let annule = false;
    if (!visibles.length) {
      setCartes([]);
      return undefined;
    }
    setChargement(true);
    cartesDe(visibles)
      .then((c) => !annule && setCartes(c))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiche, liste, nb]);

  async function retirer() {
    if (window.confirm(`Ne plus suivre ${fiche?.pseudo || 'cet ami'} ?`)) {
      await retirerAmi(code);
      onRetire();
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>{fiche?.pseudo || 'Ami'}</h2>
        </header>

        <div className="detail-pad ami">
          {!fiche && !erreur && <div className="skeleton skeleton--bloc" aria-hidden="true" />}
          {erreur && <p className="message message--erreur">{erreur}</p>}

          {fiche && (
            <>
              <section className="panel ami__profil">
                <Avatar name={fiche.pseudo} value={fiche.avatar} size={60} />
                <div>
                  <p className="ami__pseudo">{fiche.pseudo}</p>
                  <p className="panel__note">
                    {fiche.disparu
                      ? 'Cette fiche n’existe plus (supprimée, ou code changé).'
                      : `${fiche.nbTitres} titres partagés${
                          fiche.maj
                            ? ` · mis à jour le ${new Date(fiche.maj).toLocaleDateString('fr-FR')}`
                            : ''
                        }`}
                    {fiche.horsLigne ? ' · hors connexion' : ''}
                  </p>
                </div>
              </section>

              {!fiche.disparu && (
                <>
                  {fiche.listes.length === 0 && (
                    <div className="vide">
                      <p className="vide__titre">Rien de partagé pour l'instant</p>
                      <p className="vide__texte">Cet ami n'a rien rendu public.</p>
                    </div>
                  )}
                  <div className="chips-scroll chips-scroll--page" role="group" aria-label="Listes">
                    {fiche.listes.map((l, i) => (
                      <button
                        key={`${l.kind}-${l.nom}-${i}`}
                        className={`chip ${liste === i ? 'on' : ''}`}
                        aria-pressed={liste === i}
                        onClick={() => {
                          setListe(i);
                          setNb(PAR_LOT);
                        }}
                      >
                        {l.kind === 'statut' ? nomStatut(l.nom) : l.nom}{' '}
                        <b className="chip__count">{l.items.length}</b>
                      </button>
                    ))}
                  </div>

                  {chargement && cartes.length === 0 && (
                    <div className="grid" aria-hidden="true">
                      {Array.from({ length: Math.min(visibles.length, 9) }, (_, i) => (
                        <div key={i}>
                          <div className="skeleton skeleton--poster" />
                          <div className="skeleton skeleton--line" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid">
                    {cartes.map((item, i) => (
                      <div
                        className="rail__item rise"
                        key={keyOf(item)}
                        style={{ animationDelay: `${Math.min(i % 12, 8) * 30}ms` }}
                      >
                        <MovieCard
                          item={item}
                          isFollowed={suivi.has(keyOf(item))}
                          status={suivi.get(keyOf(item))?.status}
                          {...cardProps}
                        />
                        {item.rating ? (
                          <span className="ami__etoiles" title={`${item.rating} sur 5`}>
                            {etoiles(item.rating)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {courante && courante.items.length > nb && (
                    <div className="voirplus">
                      <button className="btn btn--ghost" onClick={() => setNb(nb + PAR_LOT)}>
                        Voir plus
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="ami__actions">
                <button className="btn btn--ghost btn--wide" onClick={() => charger(true)}>
                  <Icon name="refresh" size={15} />
                  Actualiser
                </button>
                <button className="btn btn--danger-ghost btn--wide" onClick={retirer}>
                  Ne plus suivre cet ami
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

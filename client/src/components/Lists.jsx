import { useState, useEffect } from 'react';
import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import AddToListe from './AddToListe.jsx';
import Filtres from './Filtres.jsx';
import Vide from './Vide.jsx';
import { GrilleFantome } from './Fantomes.jsx';
import { STATUSES, isUpcoming, titreCorrespond, resumeBiblio } from '../status.js';
import { getListeItems } from '../api.js';
import {
  TRIS_BIBLIO,
  FILTRES_BIBLIO_VIDES,
  filtresBiblioActifs,
  appliquerFiltresBiblio,
} from '../filtres.js';

// Mes listes. Les 4 statuts en grille, les listes créées à la main en dessous :
// avant, tout était mélangé dans une barre latérale pensée pour un écran de PC.
export default function Lists({
  items,
  listes,
  onCreateListe,
  onDeleteListe,
  onSetPrive,
  partageActif,
  onAddManyToListe,
  onSurcouche,
  filtres, // tri et filtres, gardés par l'application le temps de la séance
  onFiltres,
  genres = [], // [{ key, name }] : tous les genres de l'application
  onToggleFollow,
  onSetStatus,
  onOpenDetail,
  onLongPress,
  onOpenStats,
  onSearch,
}) {
  const [selected, setSelected] = useState({ type: 'status', value: 'a_voir' });
  const [listItems, setListItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [mediaFilter, setMediaFilter] = useState('all');
  const [ajoutOuvert, setAjoutOuvert] = useState(false); // ajout en masse
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  // Recherche dans toute la bibliothèque, quels que soient le statut ou la
  // liste sélectionnés : on cherche un titre qu'on a, pas un rayon.
  const [recherche, setRecherche] = useState('');
  const cherche = recherche.trim().length > 0;

  // Charger les éléments quand une liste perso est sélectionnée.
  function chargeListe(id) {
    setLoadingItems(true);
    return getListeItems(id)
      .then(setListItems)
      .catch(() => setListItems([]))
      .finally(() => setLoadingItems(false));
  }

  useEffect(() => {
    if (selected.type !== 'liste') return;
    chargeListe(selected.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // L'écran d'ajout couvre toute la page : le bouton retour d'Android doit le
  // fermer, pas changer d'onglet. On signale donc son ouverture à l'application,
  // qui tient la chaîne des retours.
  useEffect(() => {
    onSurcouche?.(ajoutOuvert ? { fermer: () => setAjoutOuvert(false) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajoutOuvert]);

  // Si la liste sélectionnée disparaît (suppression), revenir aux statuts.
  useEffect(() => {
    if (selected.type === 'liste' && !listes.some((l) => l.id === selected.value)) {
      setSelected({ type: 'status', value: 'a_voir' });
    }
  }, [listes, selected]);

  // Les titres pas encore sortis vivent dans l'onglet « Sorties à venir »,
  // pas dans « À voir » (ils y reviennent automatiquement une fois sortis).
  const statusCount = (v) =>
    items.filter((i) => (i.status || 'a_voir') === v && !(v === 'a_voir' && isUpcoming(i)))
      .length;

  const mainItems = cherche
    ? items
        .filter((i) => titreCorrespond(i.title, recherche))
        .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    : selected.type === 'status'
      ? items.filter(
          (i) =>
            (i.status || 'a_voir') === selected.value &&
            !(selected.value === 'a_voir' && isUpcoming(i))
        )
      : listItems;

  const selectedListe =
    selected.type === 'liste' ? listes.find((l) => l.id === selected.value) : null;
  const title = cherche
    ? 'Dans ma bibliothèque'
    : selected.type === 'status'
      ? STATUSES.find((s) => s.value === selected.value).label
      : selectedListe?.name || '';

  const duType =
    mediaFilter === 'all' ? mainItems : mainItems.filter((i) => i.mediaType === mediaFilter);
  // Pendant une recherche on retrouve un titre précis : le tri reste A → Z et les
  // filtres se mettent de côté. Ils reprennent, intacts, quand on efface le champ.
  const filteredItems = cherche ? duType : appliquerFiltresBiblio(duType, filtres);

  // Seuls les genres qu'on a vraiment dans la bibliothèque sont proposés :
  // une puce « Western » qui ne ramène rien ne sert à rien.
  const genresPresents = genres.filter((g) =>
    items.some((i) => (i.genres || '').split(',').includes(g.key))
  );

  const films = filteredItems.filter((i) => i.mediaType === 'movie');
  const series = filteredItems.filter((i) => i.mediaType === 'tv');

  const renderGrid = (list) => (
    <div className="grid">
      {list.map((item) => (
        <MovieCard
          key={`${item.mediaType}-${item.id}`}
          item={item}
          isFollowed={true}
          status={item.status}
          onToggleFollow={onToggleFollow}
          onSetStatus={onSetStatus}
          onOpenDetail={onOpenDetail}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );

  async function handleNewListe() {
    const name = window.prompt('Nom de la nouvelle liste ?');
    if (!name || !name.trim()) return;
    const created = await onCreateListe(name.trim());
    if (created) setSelected({ type: 'liste', value: created.id });
  }

  const resume = resumeBiblio(items);
  const bibliothequeVide = items.length === 0 && listes.length === 0;

  const videLigne = cherche
    ? {
        icone: 'search',
        titre: 'Aucun résultat',
        texte: `Aucun titre « ${recherche.trim()} » dans ta bibliothèque.`,
      }
    : mainItems.length > 0
      ? { icone: 'film', titre: 'Aucun résultat', texte: 'Aucun titre ne correspond à ce filtre.' }
      : selected.type === 'liste'
        ? { icone: 'lists', titre: 'Cette liste est vide', texte: 'Ajoute-y des titres avec le bouton « Ajouter ».' }
        : { icone: 'film', titre: 'Rien ici pour l’instant', texte: 'Les titres que tu mets dans ce statut apparaîtront ici.' };

  return (
    <div className="lists">
      <header className="page-head">
        <h2>Mes listes</h2>
        <p>
          {items.length === 0
            ? 'Ta bibliothèque est vide pour l’instant.'
            : `${items.length} titre${items.length > 1 ? 's' : ''} dans ta bibliothèque`}
        </p>
      </header>

      {bibliothequeVide ? (
        <Vide
          icone="lists"
          titre="Ta bibliothèque est vide"
          texte="Cherche un film ou une série et ajoute-le à ton suivi : tes listes se remplissent ici."
          action={onSearch ? { label: 'Chercher un titre', onClick: onSearch } : undefined}
        />
      ) : (
        <>
          {/* Trois chiffres : toucher le bandeau ouvre les Statistiques. */}
          <button className="bandeau-chiffres" onClick={onOpenStats} aria-label="Ouvrir les statistiques">
            <span className="bandeau-chiffres__case">
              <b>{resume.titres}</b>
              <span>titres</span>
            </span>
            <span className="bandeau-chiffres__case">
              <b>{resume.vus}</b>
              <span>vus</span>
            </span>
            <span className="bandeau-chiffres__case">
              <b>{resume.noteMoyenne != null ? `${resume.noteMoyenne} ★` : '—'}</b>
              <span>note moyenne</span>
            </span>
            <span className="bandeau-chiffres__fleche" aria-hidden="true">
              <Icon name="chevron" size={18} />
            </span>
          </button>

          <div className="search-bar lists__search">
            <span className="search-bar__icon" aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              value={recherche}
              placeholder="Chercher dans mes titres…"
              aria-label="Chercher dans mes titres"
              onChange={(e) => setRecherche(e.target.value)}
            />
            {cherche && (
              <button
                className="lists__search-clear"
                onClick={() => setRecherche('')}
                aria-label="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </div>

          {/* Pendant une recherche, statuts et listes s'effacent : les résultats
              viennent juste sous le champ, sans avoir à défiler. */}
          {!cherche && (
            <>
              <p className="lists__group">Où j'en suis</p>
              <div className="lists__statuses">
                {STATUSES.map((s) => {
                  const n = statusCount(s.value);
                  const part = items.length ? Math.round((n / items.length) * 100) : 0;
                  return (
                    <button
                      key={s.value}
                      className={`statbtn tuile status--${s.value} ${
                        selected.type === 'status' && selected.value === s.value ? 'on' : ''
                      }`}
                      onClick={() => setSelected({ type: 'status', value: s.value })}
                    >
                      <span className="tuile__haut">
                        <span className="statbtn__led"></span>
                        <span className="tuile__label">{s.label}</span>
                        <b>{n}</b>
                      </span>
                      <span className="tuile__jauge" aria-hidden="true">
                        <span style={{ width: `${part}%` }} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <section className="sec sec--listes">
                <header className="sec__head">
                  <div className="sec__txt">
                    <h3 className="sec__title">Listes personnalisées</h3>
                  </div>
                </header>
                <div className="rail rail--listes" role="list">
                  {listes.map((l) => (
                    <button
                      key={l.id}
                      role="listitem"
                      className={`liste-carte ${
                        selected.type === 'liste' && selected.value === l.id ? 'on' : ''
                      }`}
                      onClick={() => setSelected({ type: 'liste', value: l.id })}
                    >
                      <span className="mosaique" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) =>
                          l.covers?.[i] ? (
                            <img key={i} src={l.covers[i]} alt="" loading="lazy" />
                          ) : (
                            <span key={i} className="mosaique__vide" />
                          )
                        )}
                      </span>
                      <span className="liste-carte__nom">{l.name}</span>
                      <span className="liste-carte__n">
                        {l.count} titre{l.count > 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                  <button role="listitem" className="liste-carte liste-carte--new" onClick={handleNewListe}>
                    <span className="liste-carte__plus">
                      <Icon name="plus" size={26} />
                    </span>
                    <span className="liste-carte__nom">Nouvelle liste</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {/* Une seule rangée d'outils : le filtre Films / Séries à gauche, « Filtres » à droite. */}
          <div className="toolbar">
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
            {!cherche && (
              <button
                className={`chip chip--filtres ${filtresOuverts || filtresBiblioActifs(filtres) ? 'on' : ''}`}
                aria-expanded={filtresOuverts}
                onClick={() => setFiltresOuverts((o) => !o)}
              >
                Filtres
                {filtresBiblioActifs(filtres) && (
                  <span className="filtres-bar__dot" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          {!cherche && filtresOuverts && (
            <Filtres
              filtres={filtres}
              onChange={onFiltres}
              tris={TRIS_BIBLIO}
              avecNote
              genres={genresPresents}
              vides={FILTRES_BIBLIO_VIDES}
              actifs={filtresBiblioActifs}
            />
          )}

          {selectedListe && !cherche ? (
            <section className="panel panel--liste">
              <div className="panel__entete">
                <h3 className="panel__title">{selectedListe.name}</h3>
                <p className="panel__note">
                  {filteredItems.length} titre{filteredItems.length > 1 ? 's' : ''}
                </p>
              </div>
              {partageActif && (
                <label className="ligne-switch">
                  <span>Visible par tes amis</span>
                  <input
                    type="checkbox"
                    className="switch"
                    role="switch"
                    checked={!selectedListe.prive}
                    onChange={() => onSetPrive(selectedListe.id, !selectedListe.prive)}
                  />
                </label>
              )}
              <div className="liste-actions">
                <button className="btn btn--ghost" onClick={() => setAjoutOuvert(true)}>
                  <Icon name="plus" size={14} />
                  Ajouter
                </button>
                <button
                  className="btn btn--danger-ghost"
                  onClick={() => {
                    if (window.confirm(`Supprimer la liste « ${selectedListe.name} » ?`)) {
                      onDeleteListe(selectedListe.id);
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>
            </section>
          ) : (
            <div className="sechead">
              <h3>{title}</h3>
              <span className="sechead__count">{filteredItems.length}</span>
            </div>
          )}

          {loadingItems ? (
            <GrilleFantome />
          ) : filteredItems.length === 0 ? (
            <Vide {...videLigne} />
          ) : (
            <>
              {films.length > 0 && (
                <section className="media-section">
                  <h4 className="subhead">
                    Films <span className="subhead__count">{films.length}</span>
                  </h4>
                  {renderGrid(films)}
                </section>
              )}
              {series.length > 0 && (
                <section className="media-section">
                  <h4 className="subhead">
                    Séries <span className="subhead__count">{series.length}</span>
                  </h4>
                  {renderGrid(series)}
                </section>
              )}
            </>
          )}
        </>
      )}

      {ajoutOuvert && selectedListe && (
        <AddToListe
          liste={selectedListe}
          items={items}
          dejaDedans={listItems}
          onValider={async (choisis) => {
            await onAddManyToListe(selectedListe.id, choisis);
            await chargeListe(selectedListe.id);
          }}
          onClose={() => setAjoutOuvert(false)}
        />
      )}
    </div>
  );
}
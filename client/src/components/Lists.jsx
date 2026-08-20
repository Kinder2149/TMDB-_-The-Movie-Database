import { useState, useEffect } from 'react';
import MovieCard from './MovieCard.jsx';
import Icon from './Icon.jsx';
import { STATUSES, isUpcoming } from '../status.js';
import { getListeItems } from '../api.js';

// Mes listes. Les 4 statuts en grille, les listes créées à la main en dessous :
// avant, tout était mélangé dans une barre latérale pensée pour un écran de PC.
export default function Lists({
  items,
  listes,
  onCreateListe,
  onDeleteListe,
  onToggleFollow,
  onSetStatus,
  onOpenDetail,
  onLongPress,
}) {
  const [selected, setSelected] = useState({ type: 'status', value: 'a_voir' });
  const [listItems, setListItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [mediaFilter, setMediaFilter] = useState('all');

  // Charger les éléments quand une liste perso est sélectionnée.
  useEffect(() => {
    if (selected.type !== 'liste') return;
    setLoadingItems(true);
    getListeItems(selected.value)
      .then(setListItems)
      .catch(() => setListItems([]))
      .finally(() => setLoadingItems(false));
  }, [selected]);

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

  const mainItems =
    selected.type === 'status'
      ? items.filter(
          (i) =>
            (i.status || 'a_voir') === selected.value &&
            !(selected.value === 'a_voir' && isUpcoming(i))
        )
      : listItems;

  const selectedListe =
    selected.type === 'liste' ? listes.find((l) => l.id === selected.value) : null;
  const title =
    selected.type === 'status'
      ? STATUSES.find((s) => s.value === selected.value).label
      : selectedListe?.name || '';

  const filteredItems =
    mediaFilter === 'all' ? mainItems : mainItems.filter((i) => i.mediaType === mediaFilter);

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

  return (
    <div className="lists">
      {/* Où j'en suis : les 4 statuts, avec leur compteur. */}
      <p className="lists__group">Où j'en suis</p>
      <div className="lists__statuses">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={`statbtn status--${s.value} ${
              selected.type === 'status' && selected.value === s.value ? 'on' : ''
            }`}
            onClick={() => setSelected({ type: 'status', value: s.value })}
          >
            <span className="statbtn__led"></span>
            {s.label}
            <b>{statusCount(s.value)}</b>
          </button>
        ))}
      </div>

      {/* Listes créées à la main. */}
      <p className="lists__group">Mes listes</p>
      <div className="lists__chips">
        {listes.length === 0 && <span className="hint">Aucune liste pour l'instant.</span>}
        {listes.map((l) => (
          <button
            key={l.id}
            className={`chip ${
              selected.type === 'liste' && selected.value === l.id ? 'on' : ''
            }`}
            onClick={() => setSelected({ type: 'liste', value: l.id })}
          >
            {l.name} <b className="chip__count">{l.count}</b>
          </button>
        ))}
        <button className="chip chip--new" onClick={handleNewListe}>
          <Icon name="plus" size={14} />
          Nouvelle
        </button>
      </div>

      <div className="seg">
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

      <div className="sechead">
        <h3>{title}</h3>
        <span className="sechead__count">{filteredItems.length}</span>
        {selectedListe && (
          <button
            className="lists__delete"
            onClick={() => {
              if (window.confirm(`Supprimer la liste « ${selectedListe.name} » ?`)) {
                onDeleteListe(selectedListe.id);
              }
            }}
          >
            Supprimer
          </button>
        )}
      </div>

      {loadingItems ? (
        <p className="hint">Chargement…</p>
      ) : filteredItems.length === 0 ? (
        <p className="hint">
          {mainItems.length === 0
              ? 'Rien ici pour le moment.'
              : 'Aucun résultat pour ce filtre.'}
        </p>
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
    </div>
  );
}

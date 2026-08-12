import { useState, useEffect } from 'react';
import MovieCard from './MovieCard.jsx';
import { STATUSES, isUpcoming } from '../status.js';
import { getListeItems } from '../api.js';

// Mes listes : barre latérale (statuts + listes perso) + contenu à droite.
export default function Lists({
  items,
  listes,
  onCreateListe,
  onDeleteListe,
  onToggleFollow,
  onSetStatus,
  onOpenDetail,
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
    <div className="lists-rail">
      <aside className="rail">
        <div className="rail__group">Statuts</div>
        <ul className="rail__list">
          {STATUSES.map((s) => (
            <li
              key={s.value}
              className={
                selected.type === 'status' && selected.value === s.value ? 'active' : ''
              }
              onClick={() => setSelected({ type: 'status', value: s.value })}
            >
              <span className={`led status--${s.value}`}></span>
              {s.label}
              <span className="rail__count">{statusCount(s.value)}</span>
            </li>
          ))}
        </ul>

        <div className="rail__group">Mes listes</div>
        <ul className="rail__list">
          {listes.length === 0 && <li className="rail__empty">Aucune liste</li>}
          {listes.map((l) => (
            <li
              key={l.id}
              className={
                selected.type === 'liste' && selected.value === l.id ? 'active' : ''
              }
              onClick={() => setSelected({ type: 'liste', value: l.id })}
            >
              🎬 {l.name}
              <span className="rail__count">{l.count}</span>
            </li>
          ))}
        </ul>
        <button className="rail__add" onClick={handleNewListe}>
          + Nouvelle liste
        </button>
      </aside>

      <div className="lists-main">
        <div className="lists-main__head">
          <h2 className="lists__title">
            {title} <span className="lists__count">{filteredItems.length}</span>
          </h2>
          <div className="media-filter">
            {[
              { value: 'all', label: 'Tout' },
              { value: 'movie', label: 'Films' },
              { value: 'tv', label: 'Séries' },
            ].map((f) => (
              <button
                key={f.value}
                className={`media-filter__btn ${mediaFilter === f.value ? 'active' : ''}`}
                onClick={() => setMediaFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {selectedListe && (
            <button
              className="btn btn--ghost"
              onClick={() => {
                if (window.confirm(`Supprimer la liste « ${selectedListe.name} » ?`)) {
                  onDeleteListe(selectedListe.id);
                }
              }}
            >
              Supprimer la liste
            </button>
          )}
        </div>

        {loadingItems ? (
          <p className="hint">Chargement…</p>
        ) : filteredItems.length === 0 ? (
          <p className="hint">{mainItems.length === 0 ? 'Liste vide.' : 'Aucun résultat pour ce filtre.'}</p>
        ) : (
          <>
            {films.length > 0 && (
              <section className="media-section">
                <h3 className="subhead">
                  Films <span className="subhead__count">{films.length}</span>
                </h3>
                {renderGrid(films)}
              </section>
            )}
            {series.length > 0 && (
              <section className="media-section">
                <h3 className="subhead">
                  Séries <span className="subhead__count">{series.length}</span>
                </h3>
                {renderGrid(series)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

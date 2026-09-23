import {
  PERIODES,
  TRIS,
  FILTRES_VIDES,
  filtresActifs,
  NOTES_BIBLIO,
} from '../filtres.js';

// Panneau de filtres : période, tri et, selon l'écran, plateformes (« Explorer »,
// où TMDB sait les appliquer) ou filtre de note (« Mes listes »). Il ne garde
// aucun état : tout vit chez le parent, qui refait la liste quand les filtres
// changent.
//
// Par défaut il sert la recherche. « Mes listes » lui passe ses propres tris,
// son propre état de départ et le filtre de note.
export default function Filtres({
  filtres,
  onChange,
  plateformes = [],
  avecPlateformes = false, // choix des plateformes (Explorer)
  indicationPlateforme = false, // dit où choisir une plateforme (Titre, Acteur)
  tris = TRIS,
  avecNote = false, // filtre « Ma note » (Mes listes)
  vides = FILTRES_VIDES,
  actifs = filtresActifs,
}) {
  const maj = (patch) => onChange({ ...filtres, ...patch });

  function basculePlateforme(id) {
    const deja = filtres.plateformes.includes(id);
    maj({
      plateformes: deja
        ? filtres.plateformes.filter((p) => p !== id)
        : [...filtres.plateformes, id],
    });
  }

  return (
    <div className="filtres" role="group" aria-label="Filtres">
      {avecPlateformes && (
        <div className="filtres__groupe">
          <span className="filtres__label">Plateforme</span>
          <div className="filtres__chips">
            {plateformes.length === 0 && <span className="hint">Chargement…</span>}
            {plateformes.map((p) => (
              <button
                key={p.id}
                className={`chip ${filtres.plateformes.includes(p.id) ? 'on' : ''}`}
                aria-pressed={filtres.plateformes.includes(p.id)}
                onClick={() => basculePlateforme(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {!avecPlateformes && indicationPlateforme && (
        <p className="hint hint--small">
          La plateforme se choisit dans « Explorer » : ici, on filtre les résultats affichés.
        </p>
      )}

      <div className="filtres__groupe">
        <span className="filtres__label">Année</span>
        <div className="filtres__chips">
          {PERIODES.map((p) => (
            <button
              key={p.key}
              className={`chip ${filtres.periode === p.key ? 'on' : ''}`}
              aria-pressed={filtres.periode === p.key}
              onClick={() => maj({ periode: filtres.periode === p.key ? null : p.key })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {avecNote && (
        <div className="filtres__groupe">
          <span className="filtres__label">Ma note</span>
          <div className="filtres__chips">
            {NOTES_BIBLIO.map((n) => (
              <button
                key={n.key}
                className={`chip ${filtres.note === n.key ? 'on' : ''}`}
                aria-pressed={filtres.note === n.key}
                onClick={() => maj({ note: filtres.note === n.key ? null : n.key })}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filtres__groupe">
        <span className="filtres__label">Trier par</span>
        <div className="filtres__chips">
          {tris.map((t) => (
            <button
              key={t.key}
              className={`chip ${filtres.tri === t.key ? 'on' : ''}`}
              aria-pressed={filtres.tri === t.key}
              onClick={() => maj({ tri: t.key })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {actifs(filtres) && (
        <button className="btn btn--ghost filtres__reset" onClick={() => onChange(vides)}>
          Réinitialiser
        </button>
      )}
    </div>
  );
}

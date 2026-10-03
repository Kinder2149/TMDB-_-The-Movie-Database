import Icon from './Icon.jsx';
import Visionnages from './Visionnages.jsx';

// Les saisons d'une série : une ligne par saison (coche ronde, nom, vus / diffusés), qui se
// déplie sur ses épisodes. La coche de la saison la marque vue sans l'ouvrir. Tout l'état
// et les appels restent dans Detail : ici, seulement l'affichage.
export default function FicheSaisons({
  seasons,
  expanded,
  episodes,
  loadingEpisodes,
  busy,
  serieVue,
  allWatched,
  visionnagesParEpisode,
  episodeDates,
  saisonVue,
  onOpenSeason,
  onToggleSaison,
  onToggleSerie,
  onToggleWholeSeason,
  onRevoirSaison,
  onToggleEpisode,
  onRevoirEpisode,
  onToggleDates,
  onRetirerVisionnage,
  onChangeDate,
  onAjouterDate,
}) {
  return (
    <>
      <section className="sec">
        <header className="sec__head">
          <div className="sec__txt">
            <h3 className="sec__title">Saisons</h3>
          </div>
        </header>

        <ul className="panel panel--liste saisons">
          {seasons.map((s) => {
            const ouverte = expanded === s.seasonNumber;
            const vue = saisonVue(s);
            return (
              <li key={s.seasonNumber} className="saison">
                <div className="saison__ligne">
                  <button
                    className={`coche-ronde ${vue ? 'on' : ''}`}
                    disabled={busy}
                    aria-label={vue ? 'Décocher la saison' : 'Marquer la saison vue'}
                    aria-pressed={vue}
                    onClick={(e) => onToggleSaison(s, e)}
                  >
                    <Icon name="check" size={15} />
                  </button>
                  <button
                    className="saison__ouvrir"
                    aria-expanded={ouverte}
                    onClick={() => onOpenSeason(s.seasonNumber)}
                  >
                    <span className="saison__nom">
                      {s.name}
                      <small>
                        {s.watched} / {s.aired} épisodes
                      </small>
                    </span>
                    <Icon name="chevron" size={16} className={`saison__fleche ${ouverte ? 'on' : ''}`} />
                  </button>
                </div>

                {ouverte && (
                  <div className="saison__corps">
                    {loadingEpisodes ? (
                      <div className="saison__attente" aria-hidden="true">
                        {[0, 1, 2].map((i) => (
                          <div className="skeleton skeleton--line" key={i} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <ul className="episodes">
                          {episodes.map((ep) => {
                            const vus = visionnagesParEpisode.get(`${expanded}-${ep.episodeNumber}`) || [];
                            const id = `ep-${expanded}-${ep.episodeNumber}`;
                            const datesOuvertes = episodeDates === ep.episodeNumber;
                            return (
                              <li key={ep.episodeNumber} className="ep">
                                <label className="ep__lib" htmlFor={id}>
                                  <span className="ep__num">
                                    E{String(ep.episodeNumber).padStart(2, '0')}
                                  </span>
                                  <span className="ep__nom">{ep.name}</span>
                                </label>
                                {ep.watched && (
                                  <span className="ep__journal">
                                    <button
                                      type="button"
                                      className="mini"
                                      title="J'ai revu cet épisode"
                                      aria-label="J'ai revu cet épisode"
                                      onClick={() => onRevoirEpisode(expanded, ep.episodeNumber)}
                                    >
                                      <Icon name="refresh" size={14} />
                                      {vus.length > 1 && <span>×{vus.length}</span>}
                                    </button>
                                    <button
                                      type="button"
                                      className={`mini ${datesOuvertes ? 'on' : ''}`}
                                      title="Dates de visionnage"
                                      aria-label="Dates de visionnage"
                                      aria-expanded={datesOuvertes}
                                      onClick={() => onToggleDates(ep.episodeNumber)}
                                    >
                                      <Icon name="calendar" size={14} />
                                    </button>
                                    {vus.length > 0 && (
                                      <button
                                        type="button"
                                        className="mini mini--retirer"
                                        title="Retirer le dernier visionnage"
                                        aria-label="Retirer le dernier visionnage"
                                        onClick={() => onRetirerVisionnage(vus[0].id)}
                                      >
                                        <Icon name="trash" size={14} />
                                      </button>
                                    )}
                                  </span>
                                )}
                                <input
                                  id={id}
                                  type="checkbox"
                                  className="coche"
                                  checked={ep.watched}
                                  onChange={() => onToggleEpisode(ep)}
                                />
                                {ep.watched && datesOuvertes && (
                                  <Visionnages
                                    liste={vus}
                                    onChangeDate={onChangeDate}
                                    onRemove={onRetirerVisionnage}
                                    onAdd={(date) =>
                                      onAjouterDate({ season: expanded, episode: ep.episodeNumber }, date)
                                    }
                                  />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <div className="saison__actions">
                          <button className="chip on" onClick={onToggleWholeSeason}>
                            {allWatched ? 'Décocher la saison' : 'Cocher la saison'}
                          </button>
                          {allWatched && (
                            <button className="chip" onClick={onRevoirSaison} disabled={busy}>
                              <Icon name="refresh" size={14} />
                              J’ai revu la saison
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sec">
        <button className="btn btn--ghost btn--wide" onClick={onToggleSerie} disabled={busy}>
          <Icon name="check" size={16} />
          {serieVue ? 'Je n’ai pas vu cette série' : 'J’ai vu toute la série'}
        </button>
      </section>
    </>
  );
}

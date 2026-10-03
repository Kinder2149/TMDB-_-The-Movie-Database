import { useState, useEffect } from 'react';
import Icon from './Icon.jsx';
import { getStats, completeRuntimes } from '../api.js';
import { STATUSES } from '../status.js';

// Écran « Statistiques ».
//
// Le temps passé demande la durée de chaque titre, que TMDB ne donne qu'à
// l'unité. On la récupère **ici**, à la première ouverture de l'écran, avec une
// barre d'avancement — pas au démarrage de l'application, qui n'a aucune raison
// d'attendre pour un écran qu'on n'ouvrira peut-être jamais. Une fois les
// durées enregistrées, l'écran s'ouvre instantanément et sans réseau.

// « 3 j 4 h 20 min » plutôt que « 4580 minutes » : un nombre de minutes à
// quatre chiffres ne veut rien dire pour personne.
export function formatDuree(minutes) {
  if (!minutes) return '0 min';
  const jours = Math.floor(minutes / 1440);
  const heures = Math.floor((minutes % 1440) / 60);
  const min = minutes % 60;
  const bouts = [];
  if (jours) bouts.push(`${jours} j`);
  if (heures) bouts.push(`${heures} h`);
  if (min && !jours) bouts.push(`${min} min`);
  return bouts.join(' ') || '0 min';
}

export default function Stats({ genres = [], onClose }) {
  const [stats, setStats] = useState(null);
  const [avancement, setAvancement] = useState(null); // { done, total }
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;

    (async () => {
      try {
        // Les chiffres qui ne dépendent que de la base s'affichent tout de
        // suite ; les durées arrivent ensuite.
        const premier = await getStats();
        if (annule) return;
        setStats(premier);

        if (premier.enAttenteDeMesure > 0) {
          await completeRuntimes(({ done, total }) => {
            if (!annule) setAvancement({ done, total });
          });
          if (annule) return;
          setStats(await getStats());
        }
      } catch (e) {
        if (!annule) setErreur(e.message);
      } finally {
        if (!annule) setAvancement(null);
      }
    })();

    return () => {
      annule = true;
    };
  }, []);

  // Noms des genres : la liste unique films + séries de l'application, par clé.
  const nomDe = new Map(genres.map((g) => [g.key, g.name]));
  const genresTop = (stats?.parGenre || []).map((g) => ({ ...g, name: nomDe.get(g.key) || g.key }));

  const chargement = avancement && avancement.total > 0;
  const pct = chargement ? Math.round((avancement.done / avancement.total) * 100) : 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <button className="sheet__back" onClick={onClose} aria-label="Retour">
            <Icon name="back" size={22} />
          </button>
          <h2>Statistiques</h2>
        </header>

        {erreur && <p className="message message--erreur detail-pad">{erreur}</p>}

        <div className="detail-pad stats">
          {chargement && (
            <div className="panel">
              <div className="progress__bar">
                <div className="progress__fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="panel__note">
                Récupération des durées… {avancement.done} / {avancement.total}
              </p>
            </div>
          )}

          {!stats ? (
            <>
              <div className="skeleton skeleton--bloc" aria-hidden="true" />
              <div className="skeleton skeleton--bloc" aria-hidden="true" />
            </>
          ) : (
            <>
              <section className="panel">
                <h3 className="panel__title">Temps passé</h3>
                <div className="stat-grid">
                  <StatCase valeur={formatDuree(stats.minutesTotal)} label="Au total" fort />
                  <StatCase valeur={formatDuree(stats.minutesFilms)} label="En films" />
                  <StatCase valeur={formatDuree(stats.minutesSeries)} label="En séries" />
                </div>
                {stats.sansDuree > 0 && (
                  <p className="panel__note stats__note">
                    {stats.sansDuree} titre(s) dont TMDB ignore la durée ne sont pas comptés : le
                    total réel est un peu plus élevé.
                  </p>
                )}
              </section>

              <section className="panel">
                <h3 className="panel__title">Ma bibliothèque</h3>
                <div className="stat-grid">
                  <StatCase valeur={stats.titres} label="Titres suivis" fort />
                  <StatCase valeur={stats.films} label="Films" />
                  <StatCase valeur={stats.series} label="Séries" />
                  <StatCase valeur={stats.filmsVus} label="Films vus" />
                  <StatCase valeur={stats.episodesVus} label="Épisodes vus" />
                </div>
              </section>

              <section className="panel">
                <h3 className="panel__title">Où j'en suis</h3>
                <ul className="stat-lignes">
                  {STATUSES.map((st) => (
                    <li key={st.value} className={`stat-ligne status--${st.value}`}>
                      <span className="stat-ligne__led" />
                      <span className="stat-ligne__label">{st.label}</span>
                      <b>{stats.parStatut[st.value]}</b>
                    </li>
                  ))}
                </ul>
              </section>

              {genresTop.length > 0 && (
                <section className="panel">
                  <h3 className="panel__title">
                    Genres les plus regardés <span className="pastille-nouveau">Nouveau</span>
                  </h3>
                  <ul className="stat-barres">
                    {genresTop.map((g) => (
                      <li key={g.key}>
                        <span className="stat-barres__nom">{g.name}</span>
                        <span className="stat-barres__piste" aria-hidden="true">
                          <span style={{ width: `${Math.round((g.n / genresTop[0].n) * 100)}%` }} />
                        </span>
                        <b>{g.n}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="panel__note stats__note">
                    Compte les titres vus ou en cours dont le genre est connu.
                  </p>
                </section>
              )}

              <section className="panel">
                <h3 className="panel__title">Mes notes</h3>
                {stats.notes === 0 ? (
                  <p className="panel__note">
                    Aucun titre noté pour l'instant. Les étoiles se donnent depuis la fiche d'un
                    titre.
                  </p>
                ) : (
                  <div className="stat-grid">
                    <StatCase valeur={`${stats.noteMoyenne} / 5`} label="Note moyenne" fort />
                    <StatCase valeur={stats.notes} label="Titres notés" />
                  </div>
                )}
              </section>

              <p className="hint">
                Les durées viennent de TMDB. Pour une série, le temps est estimé à partir de la
                durée d'un épisode moyen.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCase({ valeur, label, fort = false }) {
  return (
    <div className={`stat-case ${fort ? 'stat-case--fort' : ''}`}>
      <span className="stat-case__valeur">{valeur}</span>
      <span className="stat-case__label">{label}</span>
    </div>
  );
}

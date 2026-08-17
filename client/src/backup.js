// Couche Logique — sauvegarde, restauration et export (tranche 4, PLAN_ANDROID).
//
// Sans serveur, tout vit sur l'appareil : perdre l'appareil sans sauvegarde,
// c'est perdre son suivi. Ce fichier est donc ce qui rend le « tout en local »
// tenable, pas une commodité.
//
// La sauvegarde s'appuie sur l'**UUID portable** du profil : restaurer réécrit
// le profil portant le même identifiant. Exporter, réinstaller, restaurer rend
// donc exactement l'état d'origine — c'est précisément ce pour quoi cet UUID
// avait été choisi (voir PROJET_CONTEXTE.md).

import { query, run, runMany } from './db.js';

export const BACKUP_FORMAT = 'suivi-films-series';
export const BACKUP_VERSION = 1;

// --- Sauvegarde complète ---

// Renvoie l'intégralité d'un profil sous forme d'objet (profil, suivi,
// épisodes vus, listes et leur contenu).
export async function exportProfile(profileId) {
  const [profil] = await query('SELECT id, name FROM profiles WHERE id = ?', [profileId]);
  if (!profil) throw new Error('Profil introuvable.');

  const suivi = await query(
    `SELECT tmdb_id AS tmdbId, media_type AS mediaType, title, year,
            release_date AS releaseDate, poster_url AS posterUrl, status,
            added_at AS addedAt
     FROM suivi WHERE profile_id = ? ORDER BY added_at`,
    [profileId]
  );

  const episodesVus = await query(
    `SELECT series_id AS seriesId, season_number AS season,
            episode_number AS episode, marked_at AS markedAt
     FROM episodes_vus WHERE profile_id = ?
     ORDER BY series_id, season_number, episode_number`,
    [profileId]
  );

  const listesRows = await query(
    'SELECT id, name, created_at AS createdAt FROM listes WHERE profile_id = ? ORDER BY created_at',
    [profileId]
  );
  const listes = [];
  for (const l of listesRows) {
    const items = await query(
      `SELECT tmdb_id AS tmdbId, media_type AS mediaType, added_at AS addedAt
       FROM liste_items WHERE liste_id = ? AND profile_id = ? ORDER BY added_at`,
      [l.id, profileId]
    );
    // Les listes s'exportent par leur *nom*, pas par leur numéro local : deux
    // appareils n'attribuent pas les mêmes numéros.
    listes.push({ name: l.name, createdAt: l.createdAt, items });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: { id: profil.id, name: profil.name },
    suivi,
    episodesVus,
    listes,
  };
}

// Vérifie qu'un fichier ouvert est bien une sauvegarde exploitable, avant de
// toucher quoi que ce soit en base.
export function validateBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('Fichier illisible.');
  if (data.format !== BACKUP_FORMAT) {
    throw new Error("Ce fichier n'est pas une sauvegarde de cette application.");
  }
  if (data.version > BACKUP_VERSION) {
    throw new Error(
      'Cette sauvegarde vient d\'une version plus récente de l\'application.'
    );
  }
  if (!data.profile?.id || !data.profile?.name) throw new Error('Profil absent du fichier.');
  if (!Array.isArray(data.suivi)) throw new Error('Suivi absent du fichier.');
  return data;
}

// Résumé lisible avant restauration : on annonce ce qui va être écrit.
export function describeBackup(data) {
  return {
    profil: data.profile.name,
    titres: data.suivi.length,
    episodes: (data.episodesVus || []).length,
    listes: (data.listes || []).length,
    date: data.exportedAt ? data.exportedAt.slice(0, 10) : null,
  };
}

// --- Restauration ---

// Réécrit le profil portant l'identifiant de la sauvegarde : son contenu est
// remplacé, pas fusionné (une restauration doit rendre l'état exact du fichier).
// Renvoie l'id du profil restauré, à activer ensuite dans l'UI.
export async function importProfile(data) {
  validateBackup(data);
  const { id, name } = data.profile;

  const existe = (await query('SELECT id FROM profiles WHERE id = ?', [id])).length > 0;
  if (existe) {
    await run('UPDATE profiles SET name = ? WHERE id = ?', [name, id]);
    // Les suppressions en cascade emportent listes, éléments et épisodes.
    await run('DELETE FROM suivi WHERE profile_id = ?', [id]);
    await run('DELETE FROM episodes_vus WHERE profile_id = ?', [id]);
    await run('DELETE FROM listes WHERE profile_id = ?', [id]);
  } else {
    await run('INSERT INTO profiles (id, name) VALUES (?, ?)', [id, name]);
  }

  if (data.suivi.length > 0) {
    await runMany(
      data.suivi.map((s) => ({
        sql: `INSERT OR REPLACE INTO suivi
                (profile_id, tmdb_id, media_type, title, year, release_date,
                 poster_url, status, added_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
        params: [
          id,
          s.tmdbId,
          s.mediaType,
          s.title,
          s.year ?? null,
          s.releaseDate ?? null,
          s.posterUrl ?? null,
          s.status || 'a_voir',
          s.addedAt ?? null,
        ],
      }))
    );
  }

  const episodes = data.episodesVus || [];
  if (episodes.length > 0) {
    await runMany(
      episodes.map((e) => ({
        sql: `INSERT OR REPLACE INTO episodes_vus
                (profile_id, series_id, season_number, episode_number, marked_at)
              VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`,
        params: [id, e.seriesId, e.season, e.episode, e.markedAt ?? null],
      }))
    );
  }

  for (const l of data.listes || []) {
    const { lastId } = await run(
      `INSERT INTO listes (profile_id, name, created_at)
       VALUES (?, ?, COALESCE(?, datetime('now')))`,
      [id, l.name, l.createdAt ?? null]
    );
    const items = (l.items || []).filter((it) =>
      // Un élément de liste doit exister dans le suivi (contrainte de la base).
      data.suivi.some((s) => s.tmdbId === it.tmdbId && s.mediaType === it.mediaType)
    );
    if (items.length > 0) {
      await runMany(
        items.map((it) => ({
          sql: `INSERT OR IGNORE INTO liste_items
                  (liste_id, profile_id, tmdb_id, media_type, added_at)
                VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`,
          params: [lastId, id, it.tmdbId, it.mediaType, it.addedAt ?? null],
        }))
      );
    }
  }

  return id;
}

// --- Export vers d'autres plateformes ---

const CSV_STATUS_VU = new Set(['vu']);

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Export au format CSV que Letterboxd et Trakt savent importer.
// Letterboxd n'accepte que des **films** : les séries sont écartées, et on
// l'annonce à l'utilisateur plutôt que de les perdre en silence.
export function toLetterboxdCsv(suivi) {
  const films = suivi.filter((s) => s.mediaType === 'movie');
  const lignes = [['Title', 'Year', 'tmdbID', 'WatchedDate'].join(',')];
  for (const f of films) {
    lignes.push(
      [
        csvCell(f.title),
        csvCell(f.year),
        csvCell(f.tmdbId),
        // Letterboxd attend une date de visionnage : on ne la connaît pas,
        // on ne fournit donc que celle des titres marqués « vu ».
        csvCell(CSV_STATUS_VU.has(f.status) ? (f.addedAt || '').slice(0, 10) : ''),
      ].join(',')
    );
  }
  return { csv: lignes.join('\n'), films: films.length, series: suivi.length - films.length };
}

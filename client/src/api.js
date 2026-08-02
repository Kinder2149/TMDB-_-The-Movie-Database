// Seul point de contact entre l'UI et le back. L'UI ne connaît que /api.
export async function searchTitles(query) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'La recherche a échoué.');
  }
  const data = await response.json();
  return data.results;
}

// Récupère la liste du suivi (pour marquer les résultats déjà ajoutés).
export async function getSuivi() {
  const response = await fetch('/api/suivi');
  if (!response.ok) throw new Error('Impossible de charger le suivi.');
  const data = await response.json();
  return data.items;
}

export async function addToSuivi(item) {
  const response = await fetch('/api/suivi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error("L'ajout au suivi a échoué.");
}

export async function removeFromSuivi(mediaType, id) {
  const response = await fetch(`/api/suivi/${mediaType}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Le retrait du suivi a échoué.');
}

// Change l'état d'un film : status = 'vu' ou 'a_voir'.
export async function setWatched(mediaType, id, status) {
  const response = await fetch(`/api/suivi/${mediaType}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Le changement de statut a échoué.');
}

// --- Séries : saisons et épisodes ---

export async function getSeasons(seriesId) {
  const response = await fetch(`/api/tv/${seriesId}/seasons`);
  if (!response.ok) throw new Error('Impossible de charger les saisons.');
  return (await response.json()).seasons;
}

export async function getSeasonEpisodes(seriesId, season) {
  const response = await fetch(`/api/tv/${seriesId}/season/${season}`);
  if (!response.ok) throw new Error('Impossible de charger les épisodes.');
  return (await response.json()).episodes;
}

// Progression d'une série : { total, watched, next }.
export async function getProgress(seriesId) {
  const response = await fetch(`/api/tv/${seriesId}/progress`);
  if (!response.ok) throw new Error('Impossible de charger la progression.');
  return response.json();
}

export async function markEpisode(seriesId, season, episode) {
  const response = await fetch(
    `/api/tv/${seriesId}/season/${season}/episode/${episode}`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error("Le marquage de l'épisode a échoué.");
}

export async function unmarkEpisode(seriesId, season, episode) {
  const response = await fetch(
    `/api/tv/${seriesId}/season/${season}/episode/${episode}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error("Le retrait de l'épisode a échoué.");
}

export async function markWholeSeason(seriesId, season, episodeNumbers) {
  const response = await fetch(`/api/tv/${seriesId}/season/${season}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episodes: episodeNumbers }),
  });
  if (!response.ok) throw new Error('Le marquage de la saison a échoué.');
}

export async function unmarkWholeSeason(seriesId, season) {
  const response = await fetch(`/api/tv/${seriesId}/season/${season}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Le retrait de la saison a échoué.');
}

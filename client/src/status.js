// Les 4 statuts du suivi, dans l'ordre d'affichage des listes.
export const STATUSES = [
  { value: 'a_voir', label: 'À voir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'vu', label: 'Vu' },
  { value: 'abandonne', label: 'Abandonné' },
];

export const STATUS_LABEL = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label])
);

// Statut d'une série déduit de sa progression (hors « abandonné », manuel).
export function deriveSeriesStatus(progress) {
  if (!progress || progress.watched === 0) return 'a_voir';
  if (progress.total && progress.watched >= progress.total) return 'vu';
  return 'en_cours';
}

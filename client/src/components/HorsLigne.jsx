import Vide from './Vide.jsx';

// « Pas de connexion » : le catalogue (TMDB) a besoin du réseau, ton suivi non.
export default function HorsLigne({ onRetry, texte }) {
  return (
    <Vide
      icone="offline"
      titre="Pas de connexion"
      texte={texte || 'Le catalogue a besoin d’internet. Ton suivi, lui, reste disponible.'}
      action={onRetry ? { label: 'Réessayer', onClick: onRetry } : undefined}
    />
  );
}

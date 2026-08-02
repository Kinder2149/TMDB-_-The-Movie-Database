# STACK_STANDARD — Suivi Films & Séries (V1)

Stack figée pour la V1. Toute déviation doit être signalée et validée avant d'être codée.

## Couche UI
- **React + Vite**.
- Responsive, pensé mobile-first, doit s'afficher correctement sur PC et téléphone.
- Installable sur l'écran d'accueil du mobile (PWA) : optionnel en V1, ne pas prioriser.

## Couche Logique
- **Node.js + Express**.
- API REST simple entre l'UI et les données.
- C'est aussi cette couche qui appelle l'API TMDB (la clé TMDB ne doit jamais être exposée côté UI).

## Couche Données
- **SQLite** en V1 : un simple fichier local, aucun serveur de base de données à lancer.
- Stocke uniquement le suivi de l'utilisateur (ce qui est ajouté, l'état vu/pas vu par épisode, les listes). Les métadonnées viennent de TMDB, pas de la base.
- **PostgreSQL prévu en V2** (mise en ligne) — non installé en V1.
- Écart assumé : on n'utilise pas PostgreSQL en V1 malgré l'habitude, pour rester local et simple.

## Source externe
- **API TMDB**, paramètre langue `fr-FR`.
- Clé API stockée dans un fichier `.env` (jamais dans le code, jamais côté UI).

## Exécution
- Tout tourne sur un seul PC, en local.
- Le projet doit pouvoir se lancer localement et être testé manuellement dans un navigateur.

## Règles
- 3 couches strictes, jamais mélangées.
- Maximum 20 modules/services.
- Aucune dépendance superflue, aucune structure anticipée « pour le futur ».
- Ne rien construire hors du périmètre V1 défini dans PROJET_CONTEXTE.md.

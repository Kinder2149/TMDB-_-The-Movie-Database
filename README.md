# Suivi Films & Séries

Application personnelle de suivi de films et séries (usage local).
Voir `PROJET_CONTEXTE.md` (vision, périmètre) et `STACK_STANDARD.md` (stack figée).

## Architecture (3 couches)

- `client/` — **UI** : React + Vite.
- `server/` — **Logique** : Node + Express (interroge l'API TMDB).
- `server/data/suivi.sqlite` — **Données** : base SQLite locale (fichier).

L'UI ne parle qu'au back (`/api/...`). La clé TMDB reste côté back, jamais dans l'UI.

## Prérequis

- Node.js 18 ou plus.
- Une clé API TMDB (gratuite) : https://www.themoviedb.org/settings/api
  (récupérer la **clé API (v3 auth)**).

## Installation (une seule fois)

```bash
cd server
npm install
cd ../client
npm install
```

Puis, dans `server/`, copier `.env.example` en `.env` et y coller la clé TMDB :

```
TMDB_API_KEY=votre_cle_ici
PORT=3001
```

## Lancer l'application (deux terminaux)

Terminal 1 — le back :

```bash
cd server
npm run dev
```

Terminal 2 — l'UI :

```bash
cd client
npm run dev
```

Ouvrir ensuite l'adresse affichée par Vite (par défaut http://localhost:5173).

## Périmètre (V1 complète)

La boucle V1 est en place :

1. **Rechercher** un film ou une série (TMDB, en français).
2. **Ajouter / retirer** un titre de son suivi.
3. **Marquer vu / à voir** : film binaire ; série = cocher les épisodes saison par
   saison (avec « cocher toute la saison »).
4. **Progression** d'une série (vus / total) et **prochain épisode à voir**.
5. **Deux listes** auto-remplies : « À voir » et « Vu / En cours ».

Hors périmètre V1 (voir `PROJET_CONTEXTE.md`) : calendrier des sorties, notes/avis,
statistiques, notifications, comptes utilisateurs, fonctions sociales.
V2 (non commencée) : mise en ligne, comptes, migration PostgreSQL.

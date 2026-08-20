# Graph Report - V:/DEV/PROJETS/applications_web/TMDB _ The Movie Database  (2026-08-02)

## Corpus Check
- Corpus is ~4,188 words - fits in a single context window. You may not need a graph.

## Summary
- 77 nodes · 77 edges · 19 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API client (appels au back)|API client (appels au back)]]
- [[_COMMUNITY_UI, TMDB & contrats de données|UI, TMDB & contrats de données]]
- [[_COMMUNITY_Périmètre & couche Données|Périmètre & couche Données]]
- [[_COMMUNITY_Dépôt épisodes vus|Dépôt épisodes vus]]
- [[_COMMUNITY_Dépôt suivi|Dépôt suivi]]
- [[_COMMUNITY_Service TMDB|Service TMDB]]
- [[_COMMUNITY_Architecture 3 couches|Architecture 3 couches]]
- [[_COMMUNITY_Composant App|Composant App]]
- [[_COMMUNITY_Base SQLite (connexion)|Base SQLite (connexion)]]
- [[_COMMUNITY_Composant Listes|Composant Listes]]
- [[_COMMUNITY_Composant Carte|Composant Carte]]
- [[_COMMUNITY_Composant Recherche|Composant Recherche]]
- [[_COMMUNITY_Composant Détail série|Composant Détail série]]
- [[_COMMUNITY_Config Vite|Config Vite]]
- [[_COMMUNITY_Point d'entrée UI|Point d'entrée UI]]
- [[_COMMUNITY_Point d'entrée back|Point d'entrée back]]
- [[_COMMUNITY_Route recherche|Route recherche]]
- [[_COMMUNITY_Route séries|Route séries]]
- [[_COMMUNITY_Route suivi|Route suivi]]

## God Nodes (most connected - your core abstractions)
1. `Client API module (api.js)` - 7 edges
2. `TMDB service` - 7 edges
3. `SQLite database layer` - 7 edges
4. `Suivi repository` - 6 edges
5. `Series route (/api/tv)` - 5 edges
6. `tmdbGet()` - 4 edges
7. `Episodes repository` - 4 edges
8. `Media item shape (id/mediaType/title/year/posterUrl)` - 4 edges
9. `PROJET_CONTEXTE (Suivi Films & Séries)` - 4 edges
10. `Vite dev proxy (/api -> back)` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Series route (/api/tv)` --implements--> `Boucle V1 (chercher, ajouter, marquer, progression, listes)`  [INFERRED]
  server/src/routes/series.js → PROJET_CONTEXTE.md
- `Suivi repository` --implements--> `Deux listes (À voir / Vu-En cours)`  [INFERRED]
  server/src/db/suivi.repo.js → PROJET_CONTEXTE.md
- `V1 local, un seul PC, aucun compte` --rationale_for--> `SQLite database layer`  [INFERRED]
  PROJET_CONTEXTE.md → server/src/db/database.js
- `SQLite database layer` --conceptually_related_to--> `V2 (en ligne, comptes, PostgreSQL) — non construit`  [INFERRED]
  server/src/db/database.js → PROJET_CONTEXTE.md
- `TMDB seule source (streaming n'expose pas les données)` --rationale_for--> `TMDB service`  [EXTRACTED]
  PROJET_CONTEXTE.md → server/src/services/tmdb.js

## Hyperedges (group relationships)
- **Architecture 3 couches UI/Logique/Données** — app_component, index_server, database_sqlite [EXTRACTED 0.90]
- **Flux suivi : recherche -> ajout -> marquer vu -> deux listes** — route_search, route_suivi, repo_suivi, concept_deux_listes, app_component [INFERRED 0.80]
- **Suivi épisodes série : saisons -> cocher épisodes -> progression/prochain** — seriesdetail_component, route_series, service_tmdb, repo_episodes, shape_progress [INFERRED 0.80]

## Communities

### Community 0 - "API client (appels au back)"
Cohesion: 0.15
Nodes (0): 

### Community 1 - "UI, TMDB & contrats de données"
Cohesion: 0.23
Nodes (12): Client API module (api.js), App root component, Masquer saison 0 et saisons vides, Stocker seulement ce que TMDB ne redonne pas à volonté, TMDB seule source (streaming n'expose pas les données), Search route (/api/search), Series route (/api/tv), SeriesDetail component (+4 more)

### Community 2 - "Périmètre & couche Données"
Cohesion: 0.25
Nodes (11): Boucle V1 (chercher, ajouter, marquer, progression, listes), Deux listes (À voir / Vu-En cours), V2 (en ligne, comptes, PostgreSQL) — non construit, PROJET_CONTEXTE (Suivi Films & Séries), SQLite database layer, V1 local, un seul PC, aucun compte, Episodes repository, Suivi repository (+3 more)

### Community 3 - "Dépôt épisodes vus"
Cohesion: 0.33
Nodes (0): 

### Community 4 - "Dépôt suivi"
Cohesion: 0.4
Nodes (0): 

### Community 5 - "Service TMDB"
Cohesion: 0.7
Nodes (4): getEpisodes(), getSeasons(), searchMulti(), tmdbGet()

### Community 6 - "Architecture 3 couches"
Cohesion: 0.4
Nodes (5): Architecture 3 couches (UI/Logique/Données), Express server entrypoint, Clé TMDB reste côté back, jamais côté UI, Aucune structure créée pour le futur, Vite dev proxy (/api -> back)

### Community 7 - "Composant App"
Cohesion: 0.67
Nodes (0): 

### Community 8 - "Base SQLite (connexion)"
Cohesion: 0.67
Nodes (0): 

### Community 9 - "Composant Listes"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Composant Carte"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Composant Recherche"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Composant Détail série"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Config Vite"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Point d'entrée UI"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Point d'entrée back"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Route recherche"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Route séries"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Route suivi"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **4 isolated node(s):** `TMDB external API`, `V1 local, un seul PC, aucun compte`, `Aucune structure créée pour le futur`, `Masquer saison 0 et saisons vides`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Composant Listes`** (2 nodes): `Lists.jsx`, `Lists()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Composant Carte`** (2 nodes): `MovieCard.jsx`, `MovieCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Composant Recherche`** (2 nodes): `SearchBar.jsx`, `SearchBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Composant Détail série`** (2 nodes): `SeriesDetail.jsx`, `SeriesDetail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Config Vite`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Point d'entrée UI`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Point d'entrée back`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route recherche`** (1 nodes): `search.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route séries`** (1 nodes): `series.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route suivi`** (1 nodes): `suivi.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TMDB service` connect `UI, TMDB & contrats de données` to `Architecture 3 couches`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Series route (/api/tv)` connect `UI, TMDB & contrats de données` to `Périmètre & couche Données`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Client API module (api.js)` connect `UI, TMDB & contrats de données` to `Périmètre & couche Données`, `Architecture 3 couches`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Client API module (api.js)` (e.g. with `Vite dev proxy (/api -> back)` and `Media item shape (id/mediaType/title/year/posterUrl)`) actually correct?**
  _`Client API module (api.js)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `SQLite database layer` (e.g. with `V1 local, un seul PC, aucun compte` and `V2 (en ligne, comptes, PostgreSQL) — non construit`) actually correct?**
  _`SQLite database layer` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Suivi repository` (e.g. with `Media item shape (id/mediaType/title/year/posterUrl)` and `Deux listes (À voir / Vu-En cours)`) actually correct?**
  _`Suivi repository` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `TMDB external API`, `V1 local, un seul PC, aucun compte`, `Aucune structure créée pour le futur` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
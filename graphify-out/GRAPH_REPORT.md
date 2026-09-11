# Graph Report - .  (2026-09-11)

## Corpus Check
- 70 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 322 nodes · 421 edges · 64 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Porte API (api.js)|Porte API (api.js)]]
- [[_COMMUNITY_Règles métier (store.js)|Règles métier (store.js)]]
- [[_COMMUNITY_Sauvegarde (backup.js)|Sauvegarde (backup.js)]]
- [[_COMMUNITY_Catalogue TMDB|Catalogue TMDB]]
- [[_COMMUNITY_Connexion Google Drive|Connexion Google Drive]]
- [[_COMMUNITY_Base embarquée (db.js)|Base embarquée (db.js)]]
- [[_COMMUNITY_Serveur  listes (archivé)|Serveur : listes (archivé)]]
- [[_COMMUNITY_Avatars de profil|Avatars de profil]]
- [[_COMMUNITY_Serveur  base (archivé)|Serveur : base (archivé)]]
- [[_COMMUNITY_Langue du catalogue|Langue du catalogue]]
- [[_COMMUNITY_Tests  stockage simulé|Tests : stockage simulé]]
- [[_COMMUNITY_Serveur  épisodes (archivé)|Serveur : épisodes (archivé)]]
- [[_COMMUNITY_Serveur  profils (archivé)|Serveur : profils (archivé)]]
- [[_COMMUNITY_Serveur  suivi (archivé)|Serveur : suivi (archivé)]]
- [[_COMMUNITY_Autorisation Drive Android|Autorisation Drive Android]]
- [[_COMMUNITY_Écran Sauvegarde|Écran Sauvegarde]]
- [[_COMMUNITY_Écran Statistiques|Écran Statistiques]]
- [[_COMMUNITY_Fichiers locaux|Fichiers locaux]]
- [[_COMMUNITY_Statuts et dates|Statuts et dates]]
- [[_COMMUNITY_configuration.test.js|configuration.test.js]]
- [[_COMMUNITY_MainActivity.java|MainActivity.java]]
- [[_COMMUNITY_ExampleUnitTest.java|ExampleUnitTest.java]]
- [[_COMMUNITY_App.jsx|App.jsx]]
- [[_COMMUNITY_Profiles.jsx|Profiles.jsx]]
- [[_COMMUNITY_store.test.js|store.test.js]]
- [[_COMMUNITY_idb-keyval.js|idb-keyval.js]]
- [[_COMMUNITY_exporter-vers-app.js|exporter-vers-app.js]]
- [[_COMMUNITY_About.jsx|About.jsx]]
- [[_COMMUNITY_AddToListe.jsx|AddToListe.jsx]]
- [[_COMMUNITY_Bloc.jsx|Bloc.jsx]]
- [[_COMMUNITY_CatalogLanguage.jsx|CatalogLanguage.jsx]]
- [[_COMMUNITY_Detail.jsx|Detail.jsx]]
- [[_COMMUNITY_Icon.jsx|Icon.jsx]]
- [[_COMMUNITY_Lists.jsx|Lists.jsx]]
- [[_COMMUNITY_MovieCard.jsx|MovieCard.jsx]]
- [[_COMMUNITY_SearchBar.jsx|SearchBar.jsx]]
- [[_COMMUNITY_Settings.jsx|Settings.jsx]]
- [[_COMMUNITY_StatusMenu.jsx|StatusMenu.jsx]]
- [[_COMMUNITY_Suggestions.jsx|Suggestions.jsx]]
- [[_COMMUNITY_Tonight.jsx|Tonight.jsx]]
- [[_COMMUNITY_Upcoming.jsx|Upcoming.jsx]]
- [[_COMMUNITY_backup.test.js|backup.test.js]]
- [[_COMMUNITY_cloud.test.js|cloud.test.js]]
- [[_COMMUNITY_vitest.config.js|vitest.config.js]]
- [[_COMMUNITY_requireProfile.js|requireProfile.js]]
- [[_COMMUNITY_sw.js|sw.js]]
- [[_COMMUNITY_main.jsx|main.jsx]]
- [[_COMMUNITY_cloud.auto.test.js|cloud.auto.test.js]]
- [[_COMMUNITY_db.test.js|db.test.js]]
- [[_COMMUNITY_reglages.test.js|reglages.test.js]]
- [[_COMMUNITY_tmdb.live.test.js|tmdb.live.test.js]]
- [[_COMMUNITY_capacitor.js|capacitor.js]]
- [[_COMMUNITY_sqljs.js|sqljs.js]]
- [[_COMMUNITY_vite.config.js|vite.config.js]]
- [[_COMMUNITY_vitest.services.config.js|vitest.services.config.js]]
- [[_COMMUNITY_index.js|index.js]]
- [[_COMMUNITY_browse.js|browse.js]]
- [[_COMMUNITY_details.js|details.js]]
- [[_COMMUNITY_listes.js|listes.js]]
- [[_COMMUNITY_profiles.js|profiles.js]]
- [[_COMMUNITY_search.js|search.js]]
- [[_COMMUNITY_series.js|series.js]]
- [[_COMMUNITY_suggestions.js|suggestions.js]]
- [[_COMMUNITY_suivi.js|suivi.js]]

## God Nodes (most connected - your core abstractions)
1. `requireProfile()` - 26 edges
2. `ecriture()` - 20 edges
3. `tmdbGet()` - 15 edges
4. `getAccessToken()` - 8 edges
5. `writeLocal()` - 7 edges
6. `prevenir()` - 6 edges
7. `backupToDrive()` - 6 edges
8. `ensureInitialized()` - 6 edges
9. `connect()` - 6 edges
10. `readLocal()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `chargeStructure()` --calls--> `tmdbGet()`  [EXTRACTED]
  client\src\tmdb.js → server\src\services\tmdb.js
- `getCollection()` --calls--> `tmdbGet()`  [EXTRACTED]
  client\src\tmdb.js → server\src\services\tmdb.js
- `getRuntime()` --calls--> `tmdbGet()`  [EXTRACTED]
  client\src\tmdb.js → server\src\services\tmdb.js
- `getCardInfo()` --calls--> `tmdbGet()`  [EXTRACTED]
  client\src\tmdb.js → server\src\services\tmdb.js
- `getEpisodes()` --calls--> `memo()`  [EXTRACTED]
  server\src\services\tmdb.js → client\src\tmdb.js

## Communities

### Community 0 - "Porte API (api.js)"
Cohesion: 0.08
Nodes (31): addToListe(), addToSuivi(), createListe(), createProfile(), deleteListe(), deleteProfile(), ecriture(), getItemListes() (+23 more)

### Community 1 - "Règles métier (store.js)"
Cohesion: 0.06
Nodes (21): addToListe(), addToSuivi(), airedOnly(), backfillReleaseDates(), countAired(), countPendingLanguage(), deleteProfile(), getProgress() (+13 more)

### Community 2 - "Sauvegarde (backup.js)"
Cohesion: 0.17
Nodes (22): backupToDrive(), cloudFileName(), cloudRestoreSuggestions(), csvCell(), dernierEssaiAutomatique(), exportProfile(), forgetCloudState(), hasPendingChanges() (+14 more)

### Community 3 - "Catalogue TMDB"
Cohesion: 0.23
Nodes (19): chargeStructure(), dateDeSortieRegionale(), discoverByGenre(), getCardInfo(), getCollection(), getDetails(), getEpisodes(), getGenres() (+11 more)

### Community 4 - "Connexion Google Drive"
Cohesion: 0.21
Nodes (18): connect(), disconnect(), downloadDriveFile(), driveFetch(), ensureInitialized(), forgetAccount(), getAccessToken(), getAccount() (+10 more)

### Community 5 - "Base embarquée (db.js)"
Cohesion: 0.36
Nodes (7): addColumnIfMissing(), ensureDefaultProfile(), initDb(), migrateSchema(), query(), run(), runMany()

### Community 6 - "Serveur : listes (archivé)"
Cohesion: 0.22
Nodes (0): 

### Community 7 - "Avatars de profil"
Cohesion: 0.39
Nodes (5): Avatar(), couleurCss(), estPhoto(), initiale(), parseAvatar()

### Community 8 - "Serveur : base (archivé)"
Cohesion: 0.52
Nodes (5): columnExists(), ensureDefaultProfile(), initDb(), migrateToProfiles(), tableExists()

### Community 9 - "Langue du catalogue"
Cohesion: 0.33
Nodes (0): 

### Community 10 - "Tests : stockage simulé"
Cohesion: 0.33
Nodes (1): MemoryStorage

### Community 11 - "Serveur : épisodes (archivé)"
Cohesion: 0.33
Nodes (0): 

### Community 12 - "Serveur : profils (archivé)"
Cohesion: 0.4
Nodes (0): 

### Community 13 - "Serveur : suivi (archivé)"
Cohesion: 0.4
Nodes (0): 

### Community 14 - "Autorisation Drive Android"
Cohesion: 0.67
Nodes (1): DriveAuthPlugin

### Community 15 - "Écran Sauvegarde"
Cohesion: 1.0
Nodes (3): Backup(), dateLisible(), texteEssaiAuto()

### Community 16 - "Écran Statistiques"
Cohesion: 0.67
Nodes (2): formatDuree(), Stats()

### Community 17 - "Fichiers locaux"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Statuts et dates"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "configuration.test.js"
Cohesion: 0.67
Nodes (2): chemin(), lire()

### Community 20 - "MainActivity.java"
Cohesion: 0.67
Nodes (1): MainActivity

### Community 21 - "ExampleUnitTest.java"
Cohesion: 0.67
Nodes (1): ExampleUnitTest

### Community 22 - "App.jsx"
Cohesion: 1.0
Nodes (2): App(), keyOf()

### Community 23 - "Profiles.jsx"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "store.test.js"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "idb-keyval.js"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "exporter-vers-app.js"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "About.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "AddToListe.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Bloc.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "CatalogLanguage.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Detail.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Icon.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Lists.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "MovieCard.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "SearchBar.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Settings.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "StatusMenu.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Suggestions.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Tonight.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Upcoming.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "backup.test.js"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "cloud.test.js"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "vitest.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "requireProfile.js"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "sw.js"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "main.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "cloud.auto.test.js"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "db.test.js"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "reglages.test.js"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "tmdb.live.test.js"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "capacitor.js"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "sqljs.js"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "vite.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "vitest.services.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "index.js"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "browse.js"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "details.js"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "listes.js"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "profiles.js"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "search.js"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "series.js"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "suggestions.js"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "suivi.js"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `About.jsx`** (2 nodes): `About()`, `About.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AddToListe.jsx`** (2 nodes): `AddToListe()`, `AddToListe.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bloc.jsx`** (2 nodes): `Bloc()`, `Bloc.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CatalogLanguage.jsx`** (2 nodes): `CatalogLanguage()`, `CatalogLanguage.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Detail.jsx`** (2 nodes): `Detail.jsx`, `Detail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Icon.jsx`** (2 nodes): `Icon.jsx`, `Icon()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lists.jsx`** (2 nodes): `Lists.jsx`, `Lists()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MovieCard.jsx`** (2 nodes): `MovieCard.jsx`, `MovieCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SearchBar.jsx`** (2 nodes): `SearchBar.jsx`, `SearchBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Settings.jsx`** (2 nodes): `Settings.jsx`, `Settings()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `StatusMenu.jsx`** (2 nodes): `StatusMenu.jsx`, `StatusMenu()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Suggestions.jsx`** (2 nodes): `Suggestions.jsx`, `Suggestions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tonight.jsx`** (2 nodes): `Tonight.jsx`, `Tonight()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Upcoming.jsx`** (2 nodes): `Upcoming.jsx`, `Upcoming()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `backup.test.js`** (2 nodes): `remplirProfil()`, `backup.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cloud.test.js`** (2 nodes): `cloud.test.js`, `creerFauxDrive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `vitest.config.js`** (2 nodes): `vitest.config.js`, `ici()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `requireProfile.js`** (2 nodes): `requireProfile()`, `requireProfile.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `sw.js`** (1 nodes): `sw.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `main.jsx`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cloud.auto.test.js`** (1 nodes): `cloud.auto.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `db.test.js`** (1 nodes): `db.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `reglages.test.js`** (1 nodes): `reglages.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `tmdb.live.test.js`** (1 nodes): `tmdb.live.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `capacitor.js`** (1 nodes): `capacitor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `sqljs.js`** (1 nodes): `sqljs.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `vite.config.js`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `vitest.services.config.js`** (1 nodes): `vitest.services.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `index.js`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `browse.js`** (1 nodes): `browse.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `details.js`** (1 nodes): `details.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `listes.js`** (1 nodes): `listes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `profiles.js`** (1 nodes): `profiles.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `search.js`** (1 nodes): `search.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `series.js`** (1 nodes): `series.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `suggestions.js`** (1 nodes): `suggestions.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `suivi.js`** (1 nodes): `suivi.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Porte API (api.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Règles métier (store.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
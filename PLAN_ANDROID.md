# PLAN ANDROID — Suivi Films & Séries

> Cadrage du passage en **application Android autonome**, publiée sur le Play Store.
> Écrit après la V2 bouclée (voir `PLAN_V2.md`). Complète `PROJET_CONTEXTE.md` (vision)
> et `STACK_STANDARD.md` (stack).

## But
Transformer l'application web (client + serveur local) en **application Android autonome** :
tout embarqué dans le téléphone, **aucun serveur**, aucun hébergement, aucun abonnement.

**Décision de cadrage (2026-08-17)** : l'application Android devient l'**usage unique**.
La version PC n'est plus maintenue ; les données existantes sont récupérées une fois
(tranche 4). Ce chantier **remplace** « mise en ligne » comme prochaine étape du projet.

## Pourquoi c'est faisable

Le serveur actuel ne fait que deux choses, et aucune ne nécessite de rester en ligne :
1. **Relayer les appels vers TMDB** (`server/src/services/tmdb.js`)
2. **Tenir une base SQLite locale** (`server/src/db/`)

Aucun traitement partagé entre utilisateurs, aucune donnée qui doive vivre ailleurs
que sur l'appareil. Les deux briques déménagent dans le téléphone.

## Le point d'appui : `client/src/api.js`

Ce fichier porte en tête : *« Seul point de contact entre l'UI et le back. L'UI ne connaît que /api. »*

C'est la totalité de la surface à réécrire : **30 fonctions**. Les 12 composants d'écran
ignorent l'existence d'un serveur — la refonte visuelle V2, les 4 statuts, les listes
personnalisées et la page « Ce soir » ne sont **pas touchés**.

Sur ~3 200 lignes de code, ~900 changent de côté :

| Ce qui bouge | Destination | Difficulté |
|---|---|---|
| Appel TMDB (`tmdb.js`, 290 l.) | Embarqué, quasi tel quel | Facile |
| Base locale (`server/src/db/`, 430 l.) | SQLite du téléphone, **mêmes tables** | Moyen |
| Règles métier (progression, prochain épisode, suggestions) | Embarquées, telles quelles | Facile |
| Contrôle du profil (`requireProfile.js`) | Disparaît (plus de requêtes à contrôler) | Gratuit |

**Seule vraie difficulté technique** : sur PC la base répond instantanément, sur téléphone
avec un léger délai. Il faut donc attendre chaque lecture — mais les 30 fonctions de
`api.js` savent déjà attendre (elles attendaient le serveur). Ce changement **s'arrête à
la frontière de `api.js`** et ne remonte jamais aux écrans.

**Simplification acquise** : le code de migration de `database.js` (rattraper les bases
d'avant les profils) disparaît — chaque installation part d'une base neuve.

## Vérifications faites au cadrage (2026-08-17)

- **CORS TMDB** : l'API renvoie `Access-Control-Allow-Origin: *` → appels directs depuis
  l'application autorisés, aucun relais nécessaire. *(vérifié)*
- **Conditions TMDB** : la distribution publique d'une application est **autorisée**. La
  ligne n'est pas « personnel vs public » mais **non-commercial vs commercial**. *(vérifié
  sur les conditions officielles)*
- **Limites de débit** : les limites journalières ont été supprimées en décembre 2019.
  Reste ~40 requêtes/seconde, jamais atteignable pour cet usage. *(vérifié)*
- **Clé API embarquée** : extractible de l'application, mais n'expose ni les données ni
  aucun budget. Pire cas : une erreur temporaire. **Risque accepté, pas de relais.**

## Tranches (une à la fois, testée avant la suivante)

### 1. Le catalogue en direct ✅ terminé (2026-08-17)
L'application interroge TMDB directement : recherche, tendances, genres, acteurs, fiches,
saisons, épisodes.
**Testable** : lancer l'app **sans démarrer le serveur** — la recherche fonctionne.

- `server/src/services/tmdb.js` → `client/src/tmdb.js` (déplacé, factorisé : les 5 listes
  de catalogue partagent désormais un seul formateur `toCardItem`).
- 7 fonctions de `api.js` rebranchées : `searchTitles`, `getTrending`, `searchByActor`,
  `getGenres`, `discoverGenre`, `getDetails`, `getSeasons`. **Aucune signature modifiée,
  aucun écran touché.**
- Clé dans `client/.env` (`VITE_TMDB_API_KEY`), ignorée par git ; `client/.env.example` fourni.
- **Vérifié serveur Express arrêté** : tendances, recherche titre, mode acteur, mode genre,
  fiche série complète (casting, streaming FR, mention JustWatch).
- Reste sur `/api` jusqu'à la tranche 2 : profils, suivi, listes, épisodes cochés,
  progression, suggestions. **Ces écrans sont donc en erreur tant que la tranche 2 n'est
  pas faite** — c'est attendu, pas un bug.

### 2. Les données dans l'appareil ✅ terminé (2026-08-17)
Profils, suivi, épisodes cochés, listes personnalisées passent sur la base embarquée.
Le serveur n'est plus utilisé du tout.
**Testable** : ajouter un film, cocher un épisode, fermer, rouvrir — tout est là.
⚠️ Tranche sensible : c'est ici qu'une erreur silencieuse ferait perdre du suivi.

- `server/src/db/database.js` → `client/src/db.js` (couche **Données**) : **schéma identique**,
  mêmes tables, mêmes clés, mêmes cascades. Le code de migration disparaît (base neuve).
- `server/src/db/*.repo.js` + `server/src/routes/*` → `client/src/store.js` (couche
  **Logique**) : requêtes SQL reprises telles quelles, emballage HTTP supprimé.
- `client/src/api.js` reste la couche **UI** : les 30 signatures sont inchangées.
  → les 3 couches du projet sont préservées (UI / Logique / Données).
- `requireProfile.js` supprimé de fait : plus de requêtes à contrôler.

**Décision moteur (2026-08-17)** — deux moteurs derrière une seule porte
(`query` / `run` / `runMany`), **même SQL des deux côtés** :
- téléphone : SQLite natif via `@capacitor-community/sqlite` ;
- PC : `sql.js` (le même SQLite compilé pour navigateur), rangé dans le stockage local.

> Le mode navigateur officiel du plugin (`jeep-sqlite`) a été essayé et **abandonné** :
> son composant ne s'initialise pas sous Vite (`componentOnReady()` ne répond jamais).
> `sql.js` est le moteur que ce composant enveloppe — on l'utilise directement.
> Capacitor est donc installé dès la tranche 2, en avance sur le plan initial :
> construire un stockage provisoire pour le remplacer ensuite aurait fait deux fois
> le travail risqué.

**Vérifié, aucun serveur en marche** : profil par défaut créé (UUID), ajout au suivi,
**persistance après rechargement**, 4 statuts comptés, liste personnalisée créée,
saison entière cochée (10 ép.), progression **10/44 + prochain S2E01**, suggestions
personnalisées, écran « Ce soir », statut de série recalculé à l'ouverture de la fiche.

⚠️ **Non encore vérifié : le chemin téléphone.** Tout ci-dessus est validé sur le moteur
PC. Le SQLite natif ne peut être testé qu'une fois la coquille Android en place — c'est
le premier point à contrôler en tranche 3.

### 3. La vraie application Android ✅ terminé (2026-08-17)
Emballage Capacitor : nom, icône, écran de démarrage, et écran « À propos » portant la
mention TMDB obligatoire.
**Testable** : installer l'app sur le téléphone et s'en servir réellement.

- `client/capacitor.config.json` : identifiant `com.kinder.suivifilmsseries`,
  nom « Suivi Films & Séries ». Projet Android dans `client/android/`.
- **Icône et écran de démarrage entièrement vectoriels**, repris de
  `client/public/icon.svg` (projecteur doré, direction visuelle V2) : nets à toutes
  les tailles, aucune image à régénérer. Les PNG du gabarit Capacitor sont supprimés.
- Nouvel écran **« À propos »** (`client/src/components/About.jsx`), ouvert par le
  bouton ⓘ de l'en-tête : rappelle que les données restent sur l'appareil, invite à
  la sauvegarde, et porte l'**attribution TMDB complète** — phrase exacte **et logo
  officiel** (`client/public/tmdb-logo.svg`, récupéré sur
  themoviedb.org/about/logos-attribution), affiché petit comme leurs conditions
  l'exigent. **L'obligation d'attribution est donc entièrement remplie.**

**✅ Le point en suspens de la tranche 2 est levé** : APK construit (13,4 Mo), installé
sur émulateur Android (API 36.1). Vérifié à l'écran : catalogue TMDB, profil par défaut
créé dans le **SQLite natif**, ajout au suivi, puis **arrêt forcé de l'application et
relance → le titre suivi est toujours là**. La base embarquée fonctionne sur appareil.

**Construire l'APK** (le SDK Android et le JDK d'Android Studio sont déjà sur le poste) :
```
npm run build --prefix client
npx --prefix client cap sync android
cd client/android && ./gradlew assembleDebug
```

### 4. Sauvegarde, export, récupération ✅ terminé (2026-08-17)
Rendu obligatoire par le « tout en local » :
- sauvegarde complète + restauration,
- export CSV compatible **Letterboxd / Trakt**,
- **récupération du suivi actuel du PC** vers l'application.

**Testable** : exporter, désinstaller, réinstaller, restaurer — tout est retrouvé.

- `client/src/backup.js` (couche **Logique**) : export/restauration d'un profil, contrôle
  du fichier, résumé lisible, conversion CSV.
- `client/src/files.js` (couche **Données**) : sortir un fichier. Deux chemins, comme
  pour la base — téléchargement sur PC, écriture + partage sur Android (un WebView ne
  sait pas « télécharger »).
- `client/src/components/Backup.jsx` : écran **« Sauvegarde »**, bouton ⭳ de l'en-tête.
- `server/exporter-vers-app.js` : outil à usage unique qui lit `server/data/suivi.sqlite`
  et écrit un fichier au format de l'application.

**La restauration s'appuie sur l'UUID portable du profil** : elle réécrit le profil
portant le même identifiant. Exporter → réinstaller → restaurer rend donc exactement
l'état d'origine. C'est la justification d'origine de ce choix (`PROJET_CONTEXTE.md`),
enfin utilisée.

**Garde-fou** : une restauration **remplace** le contenu du profil. L'écran affiche
d'abord un résumé de ce qui va être écrit (date, profil, nombre de titres, d'épisodes
et de listes) et attend une confirmation explicite.

**Vérifié sur les vraies données de Kinder** (432 titres, 4109 épisodes vus) :
- export depuis la base du PC → restauration dans l'app : **432 titres et 4109 épisodes
  retrouvés**, répartition des statuts identique (91 à voir, 291 vus, 40 abandonnés,
  10 en cours) ;
- **aller-retour export → restauration → export : résultat identique** ;
- parcours réel dans l'écran (choix du fichier → résumé → confirmation) ;
- CSV : 280 films exportés, 152 séries écartées et **annoncées** à l'utilisateur.

> Les 432 titres donnent 90 en « À voir » à l'écran et non 91 : le 91ᵉ n'est pas encore
> sorti et part dans l'onglet « Sorties à venir ». Comportement voulu, aucune perte.

**Puis vérifié sur l'appareil** (émulateur API 36.1, installation neuve) : sélecteur de
fichiers Android filtré sur `.json`, résumé, confirmation, **restauration des 432 titres
et 4109 épisodes** (90 / 10 / 291 / 40 à l'écran, identiques au PC), et **export ouvrant
le partage Android** vers Drive / Gmail / Quick Share.

**Deux défauts trouvés sur l'appareil et corrigés :**
1. *Lenteur* — la restauration prenait **plus d'une minute**. La couche native écrivait
   les 4541 lignes **hors transaction**, donc validées une par une. Transaction activée :
   **moins de 6 secondes**.
2. *Bouton illisible* — le symbole ⭳ (U+2B73) est absent des polices Android et
   s'affichait en carré vide. Remplacé par l'emoji 💾.

> Aucun des deux ne se voyait sur PC : ils justifient à eux seuls de tester sur appareil
> plutôt que de se fier au navigateur.

⚠️ **Les fichiers de sauvegarde contiennent des données personnelles** : `suivi-*.json`
et `suivi-*.csv` sont exclus du dépôt (`.gitignore`).

### 5. La publication
Compte développeur (25 $ une fois), signature, fiche Play Store, politique de
confidentialité, puis la phase de **test fermé imposée par Google (12 testeurs,
14 jours consécutifs)** pour un compte personnel récent.
**Testable** : l'application est installable depuis le Play Store.

> Tranches 1 à 3 = cœur technique. Tranche 4 = courte mais indispensable.
> Tranche 5 = administratif, c'est là que le délai Google pèse.

## Décisions figées

- **Aucun serveur, aucun hébergement.** La clé TMDB est embarquée, risque accepté.
- **Aucune monétisation** : ni app payante, ni abonnement, ni publicité. Franchir cette
  ligne imposerait la licence commerciale TMDB (149 $/mois).
- **Mention TMDB obligatoire** dans l'app : logo TMDB moins en évidence que le nôtre, et
  la phrase *« This application uses TMDB and the TMDB APIs but is not endorsed, certified,
  or otherwise approved by TMDB. »*
- **Ne jamais masquer l'identité de l'application** auprès de l'API (interdit par TMDB).
- **Le code serveur n'est pas supprimé** : il reste dans le dépôt comme base d'une
  éventuelle mise en ligne future (`PLAN_V2.md`). Mis de côté, pas jeté.
- **Les données personnelles restent sur l'appareil.** L'UUID portable des profils, choisi
  à l'origine pour la mise en ligne, sert ici à la sauvegarde/restauration.
- **Les données du PC sont récupérées une seule fois** (tranche 4), puis la version PC
  n'est plus maintenue.

## Hors périmètre (noté, pas construit)
- Synchronisation entre plusieurs appareils (impliquerait un serveur).
- Comptes utilisateurs, fonctions sociales.
- Version iOS / App Store.
- Notifications de nouvel épisode.

## Risque assumé
Sans serveur, **une perte du téléphone sans sauvegarde = perte du suivi**. C'est
précisément ce que la tranche 4 couvre — elle ne peut pas être reportée.

## Prochaine étape
Tranche 5 — la publication. **Plus de code à écrire** : compte développeur, signature de
l'application, fiche Play Store, politique de confidentialité, puis la phase de test
fermé imposée par Google (12 testeurs, 14 jours). C'est là que le délai pèse.

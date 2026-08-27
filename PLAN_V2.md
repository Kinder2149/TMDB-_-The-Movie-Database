# PLAN V2 — Suivi Films & Séries

> Cadrage de la V2, écrit après la V1 bouclée. Sert de cible avant tout découpage
> en tranches. Complète `PROJET_CONTEXTE.md` (vision) et `STACK_STANDARD.md` (stack).

## But de la V2
Enrichir l'application (design + fonctionnalités) puis, plus tard, la mettre en ligne
pour quelques proches. Deux axes **séparés** :
- **Peaufinage** (design + fonctions ci-dessous) — se fait **en local, sur SQLite**.
- **Mise en ligne** (hébergement + comptes + PostgreSQL) — **chantier ultérieur**, non traité ici.

## Point de départ (déjà en place)
- **V1 complète et validée** : chercher → ajouter → marquer vu / cocher épisodes → progression & prochain épisode → deux listes auto.
- **Profils locaux** (déjà mergés) : plusieurs profils sur le même PC, chacun son suivi.
  Identité = **UUID portable**, conçue pour se rattacher à un compte en ligne en V2
  **sans re-migration**. Le back exige le profil actif via l'en-tête `X-Profile-Id` ;
  en V2 cet id viendra d'un compte connecté — seule cette lecture changera.
  → **C'est la fondation de la future mise en ligne.**

## Direction visuelle — VALIDÉE
Maquette de référence : maquette V2 (4 écrans, thèmes clair + sombre).
- Ambiance « salle de cinéma » : fond sombre profond, accent **doré** (projecteur).
- Titres en serif, interface en sans-serif.
- **4 statuts distincts, chacun sa couleur** : À voir (bleu), En cours (violet), Vu (vert), Abandonné (gris).
- Navigation : **Recherche · Ce soir · Mes listes** (profil accessible dans l'en-tête).

## Écrans cibles
1. **Recherche** — instantanée (au fil de la frappe), filtres Films / Séries / Par acteur / Par genre.
2. **Fiche détail** (générique film ou série) — affiche, synopsis, acteurs, bande-annonce, **disponibilité streaming FR** (via TMDB/JustWatch, mention obligatoire), et pour une série la progression + les saisons.
3. **Mes listes** — 4 statuts distincts **+ listes personnalisées créées par l'utilisateur**.
4. **Quoi regarder ce soir ?** — entonnoir de décision : **Reprendre** (séries en cours + prochain épisode) → **À voir** (films et séries séparés) → **Suggestions personnalisées**.

## Chantiers V2 (à faire une tranche à la fois, testée avant la suivante)
1. **Refonte visuelle** ✅ terminé — thème clair/sombre appliqué (palette dorée, titres serif), navigation et cartes à jour dans `styles.css`/`App.jsx`.
2. **Page détail riche** ✅ terminé — `append_to_response=credits,videos,watch/providers` côté serveur (`tmdb.js`), `Detail.jsx` affiche cast, bande-annonce, streaming FR, progression/saisons pour les séries.
3. **Listes approfondies** ✅ terminé — 4 statuts (`status.js`) + listes personnalisées avec table dédiée (`listes.repo.js`/`listes.js`), UI dans `Lists.jsx`.
4. **Recherche affinée** ✅ terminé — recherche instantanée (debounce), mode acteur (`/search/person`), mode genre (`/discover`), pagination.
5. **Suggestions** ✅ terminé — `suggestions.js` agrège `/recommendations` depuis les items « vu »/« en cours » du profil. Décision (2026-08-10) : `/recommendations` seul suffit, `/similar` n'est pas ajouté.
6. **Page « Quoi regarder ce soir ? »** ✅ terminé — `Tonight.jsx` assemble réellement Reprendre (prochain épisode) + À voir (films/séries séparés) + Suggestions, pas un stub.

**Constat (2026-08-10)** : les 6 chantiers étaient en réalité déjà largement construits au moment du commit `a224865` (« V2 : refonte visuelle, fiche détail, 4 statuts + listes custom, page Ce soir ») — le travail a été mené en parallèle plutôt qu'une tranche testée à la fois comme prévu.

## Correctifs d'usage (2026-08-26) — issus des retours de Kinder
Cinq points remontés après la mise en service, traités une tranche à la fois :
1. **Retour Android** ✅ — l'écoute était réinstallée à chaque changement d'écran, or sa
   pose est asynchrone : les écoutes périmées s'accumulaient et l'une d'elles, figée sur
   l'accueil, quittait l'application. Posée une seule fois désormais (`App.jsx`).
2. **« Ce soir » nettoyé** ✅ — les titres pas encore sortis n'apparaissent plus à la fois
   dans « Pas encore sorti » et dans « À voir » (`Tonight.jsx`, même règle que `Lists.jsx`).
2bis. **Dates de sortie manquantes** ✅ — le filtre de 2 ne suffisait pas : la colonne
   `release_date` n'a été ajoutée au suivi que le 12/08/2026, et les titres enregistrés
   avant sont restés sans date. Sans date, impossible de savoir qu'un film n'est pas sorti
   (`Avatar 4`/`5` revenaient dans « À voir »). Rattrapage silencieux au lancement
   (`store.backfillReleaseDates`), qui ne touche que les lignes sans date.
3. **Séries à jour** ✅ — le nombre d'épisodes annoncé par TMDB inclut les épisodes non
   diffusés. La progression distingue maintenant `total` (annoncés) et `aired` (sortis,
   déduits de `last_episode_to_air`), et « Reprendre » ne montre que les séries ayant
   réellement un prochain épisode.
4. **Raccourcis « déjà vu »** ✅ — bouton « J'ai vu toute la série » et coche par saison
   depuis la ligne, sans déplier. Ne cochent que les épisodes **diffusés** : une série en
   cours devient « à jour », pas « terminée ».
5. **Note personnelle** ✅ — étoiles (1 à 5) **et** avis écrit, deux champs indépendants
   sur la ligne de suivi (`note`, `rating`), enregistrés automatiquement. Emportés par la
   sauvegarde (**format v2**) et par l'export CSV Letterboxd.

6. **Fiche réordonnée** ✅ — les saisons et épisodes remontent juste sous les boutons
   d'action, avant le synopsis : c'est l'outil principal, il était tout en bas.
7. **Gestion des profils** ✅ — écran `Profiles.jsx` : choisir, créer, renommer,
   **habiller** (avatar = une couleur + un symbole dessiné, colonne `profiles.avatar`,
   emporté par la sauvegarde) et **supprimer** un profil. La suppression annonce ce
   qu'elle emporte, demande confirmation, refuse le dernier profil et ne touche pas la
   sauvegarde Drive.

8. **Avatar corrigé** ✅ — la pastille dorée du bouton d'en-tête restait visible derrière
   l'avatar (deux ronds superposés) ; le symbole « liste », dessiné aligné à gauche dans
   son carré, était décentré en pastille — retiré du choix.
9. **Ajout groupé à une liste** ✅ — `AddToListe.jsx` : toute la bibliothèque à plat,
   filtres et recherche, choix multiple, une seule validation. Remplir une liste ne
   demande plus d'ouvrir chaque fiche.
10. **Blocs de « Ce soir »** ✅ — `Bloc.jsx` : barre pleine largeur teintée par bloc
   (violet « Reprendre », doré « Pas encore sorti », bleu « À voir »), compte, et flèche
   pour replier. La barre reste visible repliée ; le pli est retenu d'un lancement à
   l'autre. « À voir » réunit Films et Séries en sous-sections — 3 couleurs franches
   valent mieux que 4 nuances, et le code couleur des statuts reste intact.

11. **Avatar en photo** ✅ — la galerie s'ouvre par le champ fichier du système (aucune
   permission à demander) ; l'image est recadrée au centre et réduite à 128 px avant
   d'être rangée, soit ~2 Ko — elle part dans chaque sauvegarde, elle n'a pas le droit
   d'être lourde. Couleur et symbole restent choisis dessous et reprennent la main si la
   photo est retirée.
12. **Statistiques** ✅ — `Stats.jsx` : temps total / films / séries, bibliothèque,
   répartition par statut, note moyenne. La durée de chaque titre (colonne
   `suivi.runtime`) est mesurée **à la première ouverture de l'écran**, avec barre
   d'avancement, jamais au démarrage. Durée d'une série = **médiane** des épisodes d'une
   saison quand TMDB laisse `episode_run_time` vide : le dernier épisode diffusé est
   souvent un final rallongé (Severance : 80 min au lieu de 50, soit +60 %).

## Sauvegarde automatique — tranche 1 (2026-08-27)
**Constat** : le jeton d'écriture Drive ne vit qu'une heure, en mémoire, et ne s'obtenait
que par une reconnexion complète (écran de compte Google systématique). Aucune sauvegarde
ne pouvait donc partir seule. En lisant le composant de connexion, on a trouvé pourquoi :
Google sépare **s'identifier** (écran toujours affiché) et **autoriser** (silencieux une
fois accordé), mais le composant enchaîne les deux et n'expose que le paquet complet.

**Fait** : `client/android/app/src/main/java/.../DriveAuthPlugin.java` — une seule méthode,
qui n'ouvre que l'étape « autoriser » et **n'affiche jamais rien** (si Google réclame un
accord, elle renvoie `needsConsent` et repart sans jeton). Branchée dans `google.js` en
amont du chemin interactif : `getAccessToken()` tente le silencieux d'abord. Sans ce code
natif (ancienne version), l'appel échoue et on retombe exactement sur le comportement
d'avant. L'écran Sauvegarde annonce désormais **comment** l'autorisation a été obtenue —
c'est la preuve à constater sur l'appareil.

**Décision assumée** : c'est la seule pièce du projet écrite spécialement pour Android, et
la seule que la mise au point ne peut pas tester hors téléphone. Aucun impact sur la fiche
Play Store, les permissions ou la politique de confidentialité.

**Tranche 1 validée sur l'appareil (2026-08-27)** : « autorisation renouvelée sans écran
Google » constaté par Kinder.

**Tranche 2 faite** : `backup.sauvegardeAutomatique()` + écoute `appStateChange` dans
`App.jsx`, posée une seule fois (même précaution que le bouton retour). Trois règles :
rien de nouveau → rien ne part ; `interactive: false` → jamais d'écran ; un échec ne
baisse pas le drapeau → le bandeau revient. Tentée en quittant (best effort — Android ne
garantit pas de laisser finir l'envoi) **et** au retour (là, l'envoi a tout son temps),
ainsi qu'avant `exitApp()` sur le bouton retour, sans attendre.

**Correctifs après le premier essai sur l'appareil (2026-08-27)** — deux défauts, dont un
qui rendait la tranche inopérante :
- **Le rattrapage manquait au démarrage.** `appStateChange` ne se déclenche pas sur un
  démarrage à froid, et Android supprime souvent l'application de la mémoire dès qu'on la
  quitte : une sauvegarde coupée en partant n'était donc jamais reprise. Rattrapage ajouté
  au montage, quand un profil est actif.
- **Le bandeau ne suivait pas l'état réel.** `hasPendingChanges()` n'était lu qu'au
  lancement : on pouvait cocher dix épisodes sans être prévenu. `backup.js` expose
  maintenant `surChangementDeSauvegarde()`, appelé par `markChanged()` et à chaque
  sauvegarde réussie.
- **Diagnostic** : `dernierEssaiAutomatique()` garde le résultat de la dernière tentative
  (réussie, autorisation indisponible, échec + message), affiché dans l'écran Sauvegarde.
  Sans ça, un échec silencieux sur téléphone n'est pas diagnosticable.

**Tranche 2 validée sur l'appareil (2026-08-27)** : bandeau disparu tout seul au retour,
« Sauvegarde automatique : réussie ».

**Tranche 3 faite** : interrupteur dans l'écran Sauvegarde
(`sauvegardeAutoActive()` / `reglerSauvegardeAuto()`). On range le **refus**, pas
l'accord : activée par défaut dès qu'un compte est relié — personne ne relie un compte
pour ne pas être sauvegardé, et une installation neuve part donc protégée. L'interrupteur
est relu à **chaque** tentative (le couper agit tout de suite), le bandeau cesse de
promettre un envoi automatique quand il est coupé, et la déconnexion le remet à l'origine.
Le bouton manuel reste en toutes circonstances la garantie.

**Chantier « sauvegarde automatique » terminé.**

## Date de sortie par pays (2026-08-27) ✅
La date affichée est celle du **pays de la langue du catalogue** : Français → France,
English → États-Unis (`TMDB_REGION` dans `lang.js` — pas de réglage de plus, il découle
de la langue).

- **Ne coûte aucun appel supplémentaire** : les dates par pays arrivent dans la même
  requête que la fiche (`append_to_response=release_dates`).
- **Type retenu** : sortie en salle, puis sortie limitée, puis numérique, puis
  avant-première, puis la date mondiale. La salle est la mieux remplie pour la France
  (Dune 2 n'a aucune date numérique FR) et c'est ce que « sorti » veut dire.
- **Piège des ressorties** : on prend la **plus ancienne** date du type retenu, jamais la
  plus récente. Matrix a trois reprises en salle en France en 2026 — prendre la dernière
  ferait passer un film de 1999 pour « pas encore sorti ». Verrouillé par un test réel
  (`tmdb.live.test.js`).
- **L'année ne bouge pas** : Matrix reste « 1999 » même avec une date FR de juin.
- **Limite assumée** : TMDB ne connaît qu'une date de première diffusion par série, sans
  déclinaison par pays. Les séries sont rangées sous `release_region = 'monde'` et sortent
  définitivement des mises à jour de pays.
- **Quand ça se met à jour** : au changement de langue (écran d'avancement existant), et
  au lancement pour tout ce qui n'est pas à jour (`release_region` sert de marqueur, donc
  jamais deux fois le même travail). Un titre ajouté garde la date mondiale jusqu'au
  lancement suivant — corriger tout de suite coûterait un appel par ajout.

## Avant publication Play Store
Faire monter `versionCode` / `versionName` (dépôt sur 3 / 1.2, jamais publié).

Reporté, à cadrer : ~~la **date de sortie française**~~ (fait) (TMDB renvoie la date de sortie
principale, souvent mondiale ou festival — un film peut donc basculer en « sorti » avant
d'être visible en France).

## Décisions figées
- On **relève volontairement** le plafond V1 « 20 modules / rien pour le futur » : il protégeait la V1, la V2 assume plus de modules (proprement).
- On **reste sur TMDB** comme source unique (la clé BetaSeries de Kinder est gardée en réserve, non utilisée).
- Le **streaming** est affiché via TMDB/JustWatch avec la mention d'attribution (pas de lien de lecture direct).
- Tout le peaufinage se fait **en local (SQLite)**. La mise en ligne (comptes + PostgreSQL) viendra après, en s'appuyant sur l'UUID de profil déjà en place.

## Idées pour les versions suivantes (2026-08-27) — à cadrer une par une
> Notées après la publication de la 2.0. **Aucune n'est cadrée** : chaque point demande sa
> propre discussion avant tout code. Aucune n'est commencée — la mission s'est arrêtée à la
> publication de la 2.0 (2026-08-27).

### 1. Bloc « Pas encore sorti » en dernier dans « Ce soir »
Trivial : c'est l'ordre des blocs dans `Tonight.jsx`. À faire au prochain passage.
Question à trancher : le laisser replié par défaut ? Le pli est déjà mémorisé.

### 2. Suggestions redondantes — à diagnostiquer
Le code écarte déjà les doublons exacts (`agg` est indexé par titre) **et** ce qui est
déjà suivi. La redondance ressentie vient donc d'ailleurs. Trois causes plausibles :
- **le classement** : on trie par nombre de graines qui recommandent le titre, donc les
  gros succès ressortent quel que soit le tirage des graines — les mêmes titres reviennent
  à chaque « Actualiser » ;
- **les sagas** : les recommandations TMDB d'un film ramènent ses suites, ce qui remplit la
  liste d'une même franchise ;
- **aucune mémoire** : un titre écarté est reproposé indéfiniment. Il manque un « pas
  intéressé ».
→ Demander à Kinder une capture d'une liste jugée redondante avant de choisir.

### 3. Onglet « Découvrir » dans « Ce soir »
Ce que TMDB permet réellement, du plus générique au plus personnel :
- tendances du jour / de la semaine ; populaires ; mieux notés (**avec un seuil de votes**,
  sinon ce sont des obscurités notées 10/10 par trois personnes) ;
- au cinéma en ce moment / prochainement ;
- top par genre, par année ou par décennie ;
- **« disponible sur mes plateformes »** (`with_watch_providers` + `watch_region`) —
  répond en partie au point 5 sans aucun compte à relier ;
- **compléter une saga** : les collections dont il a déjà vu une partie ;
- **acteurs et réalisateurs récurrents** de son suivi, et leurs autres titres ;
- **angles morts** : genres ou décennies absents de sa bibliothèque (s'appuie sur les
  statistiques déjà calculées) ;
- **selon le temps disponible** : films courts, miniséries.
Les quatre derniers sont les seuls qui ne ressemblent pas à ce que fait déjà tout le monde.

### 4. Voir les autres utilisateurs, parcourir leurs profils
**Dépend entièrement de la mise en ligne** (serveur, comptes, PostgreSQL) — le chantier
déjà identifié plus haut comme « ultérieur ». Ce n'est pas une fonction de plus : c'est le
moment où l'application cesse d'être locale, avec ce que ça implique (hébergement,
authentification, données personnelles partagées, modération, RGPD). À ne cadrer qu'une
fois la décision de mise en ligne prise.

**L'idée de mise en ligne est conservée** (2026-08-27) : elle reste la cible lointaine du
projet, et c'est pour elle que l'UUID portable des profils existe depuis la V1. Elle n'est
pas décidée pour autant, et rien n'est engagé.

### 5. ~~Récupérer l'historique Netflix / Canal+ / Disney+~~ — ABANDONNÉ (2026-08-27)
Aucun de ces services n'expose l'historique d'un compte personnel : pas d'API publique
(Netflix a fermé la sienne en 2014), pas de programme partenaire ouvert à un développeur
individuel. Se connecter à leur place avec les identifiants de l'utilisateur serait interdit
par leurs conditions et casserait à la première refonte de leur site.

**Décision de Kinder : on abandonne.** Ne pas rouvrir le sujet du côté « se connecter à leur
place ». Si le besoin revient un jour, les deux seules voies acceptables sont l'**import
d'un fichier que l'utilisateur exporte lui-même** (Netflix le propose) ou un intermédiaire à
API publique comme **Trakt** — et ce serait un nouveau cadrage, pas la reprise de celui-ci.

> À noter : le rayon « disponible sur mes plateformes » de l'onglet « Découvrir » (point 3)
> couvre une partie du besoin d'origine — filtrer sur Netflix, Disney+ ou Canal+ — **sans
> relier aucun compte**.

## Hors périmètre V2 (noté, pas construit)
- Calendrier des prochaines sorties / notifications de nouvel épisode.
- Notes / avis / statistiques personnelles.
- Fonctions sociales.

## Prochaine étape
Les 6 chantiers sont terminés (voir état réel ci-dessus).

**Décision 2026-08-17** : le chantier suivant n'est **pas** la mise en ligne, mais le passage en
**application Android autonome** (aucun serveur) → voir `PLAN_ANDROID.md`. L'application Android
devient l'usage unique ; la version PC n'est plus maintenue. Le code serveur reste dans le dépôt
comme base d'une mise en ligne éventuelle, non planifiée à ce jour.

## Audit de reprise (2026-08-06)
**Constat :** du travail V2 est **en cours et non commité** — `git status` montre `Detail.jsx`, `Tonight.jsx`, `status.js`, `server/src/db/listes.repo.js`, `server/src/routes/browse.js` ajoutés (non trackés) et `SeriesDetail.jsx` supprimé, plus des modifications sur `App.jsx`, `api.js`, `Lists.jsx`, `MovieCard.jsx`, `SearchBar.jsx`, plusieurs fichiers serveur. Cela correspond visiblement aux chantiers 2 (page détail), 3 (listes) et 6 (« Quoi regarder ce soir ? » — `Tonight.jsx`) amorcés en parallèle, sans qu'aucun ne soit marqué terminé ici. Pas de `CHANGELOG.md` dans le projet pour tracer ce qui a été réellement livré.

**Backlog (reprise) :**
1. Committer ou clarifier l'état du travail en cours avant de reprendre — plusieurs chantiers V2 semblent démarrés en parallèle (Detail, Tonight, listes), contrairement à la règle « une tranche à la fois, testée avant la suivante » énoncée plus haut dans ce fichier.
2. Créer `CHANGELOG.md` — absent malgré un historique de sessions déjà riche (V1 bouclée + début V2).
3. Vérifier que `server/src/db/listes.repo.js` et `browse.js` correspondent bien au chantier 3/4 prévu, et mettre à jour la section « Chantiers V2 » avec leur statut réel (aucun n'est encore marqué ✅).
4. Rafraîchir `graphify-out/` après le prochain commit — le graphe actuel ne reflète pas ces fichiers non commités.

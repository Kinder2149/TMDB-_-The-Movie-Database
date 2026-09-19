# PLAN V2 — Vault Watch

> Cadrage de la V2, écrit après la V1 bouclée. Sert de cible avant tout découpage
> en tranches. Complète `PROJET_CONTEXTE.md` (vision) et la section Décisions figées de PROJET_CONTEXTE.md (stack).

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
Faire monter `versionCode` / `versionName` (publié : 5 / 2.1 ; la prochaine sera 6 / 2.2).

## Décisions figées
- On **relève volontairement** le plafond V1 « 20 modules / rien pour le futur » : il protégeait la V1, la V2 assume plus de modules (proprement).
- On **reste sur TMDB** comme source unique (la clé BetaSeries de Kinder est gardée en réserve, non utilisée).
- Le **streaming** est affiché via TMDB/JustWatch avec la mention d'attribution (pas de lien de lecture direct).
- Tout le peaufinage se fait **en local (SQLite)**. La mise en ligne (comptes + PostgreSQL) viendra après, en s'appuyant sur l'UUID de profil déjà en place.

## Idées pour les versions suivantes (2026-08-27) — à cadrer une par une
> Notées après la publication de la 2.0. **Aucune n'est cadrée** : chaque point demande sa
> propre discussion avant tout code. Aucune n'est commencée — la mission s'est arrêtée à la
> publication de la 2.0 (2026-08-27).
>
> **Points 6 à 11 ajoutés le 2026-09-10** — retours d'usage de Kinder sur l'application publiée.
>
> **Passe du 2026-09-11** : points 1, 6, 7, 8, 9, 10 et 11 **faits**, en attente de l'essai de
> Kinder sur l'appareil (tout est livré d'un bloc, à sa demande). Restent : 2 (attend une capture),
> 3 et 4 (non cadrés).

### 1. Bloc « Pas encore sorti » en dernier dans « Ce soir » ✅ (2026-09-11)
Déplacé en bas de page et **replié au départ** (décision de Kinder). Son ouverture est retenue
sous une clé à part (`sorties-ouvert`), pour ne pas hériter du pli enregistré par la 2.1.

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
**Toujours ouvert (2026-09-11)** : le partage films / séries (point 8) est fait, mais la cause
de la redondance n'est pas tranchée — la capture manque encore.

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

### 6. Masquer les titres déjà en base dans les listes de découverte (2026-09-10) ✅
**Fait (2026-09-11)** — filtrage **dur**, décision de Kinder. Par genre, par acteur et dans les
tendances, ce qui est déjà suivi est masqué, avec la mention « N titres que tu as déjà sont
masqués ». Deux précautions : un titre **ajouté pendant la séance** reste affiché jusqu'au
prochain lancement (sinon il disparaîtrait sous le doigt) ; par genre, les pages TMDB
s'enchaînent seules jusqu'à 12 titres nouveaux (4 pages au plus par appui). Tout est dans
`App.jsx` (`dejaChezMoi`, `runDiscover`).
Dans la recherche **par genre, par acteur/réalisateur et dans les tops**, ne plus afficher les
titres déjà présents dans ma base (suivis, vus, listes). Aujourd'hui `tmdb.js` (`discoverByGenre`,
listes acteur/genre) renvoie tout et `MovieCard` se contente de marquer l'état — les titres connus
occupent donc la place de titres à découvrir.
À trancher avant code : filtrage **dur** (le titre disparaît) ou **repli** (« déjà chez moi »,
repliable) ? Le filtrage dur vide des pages entières côté TMDB (pagination faussée : une page de
20 peut n'en garder que 3) — il faudra sans doute charger la page suivante automatiquement.
La recherche par titre, elle, **garde** les titres déjà en base : on y cherche souvent un titre
précis pour l'ouvrir.

### 7. Bouton « Actualiser » en haut **et** en bas des suggestions (2026-09-10) ✅
**Fait (2026-09-11)** : le bouton du bas remonte aussi en haut de page, où commence la nouvelle liste.
`Suggestions.jsx` n'a qu'un bouton (ligne ~70). Après avoir parcouru la liste jusqu'en bas, il faut
remonter pour retirer. Ajouter le même bouton en pied de liste. Purement UI, aucune logique.

### 8. Suggestions : mélange films / séries instable (2026-09-10) ✅
**Fait (2026-09-11)** — quota explicite, deux fois : graines tirées moitié films / moitié séries
(6 + 6), résultat 15 films + 15 séries. Si un type manque, l'autre comble (`store.moitieMoitie`,
testé).
Retour de Kinder, complète le point 2 : « parfois que des films, parfois que des séries, jamais le
même nombre de chaque quand c'est un mélange ». La composition du tirage n'est pas garantie parce
qu'elle est **héritée des graines** (les titres vus/en cours qui servent de source) et du tri par
nombre de recommandations : si les graines tirées sont des films, le résultat est un bloc de films.
Pistes à cadrer : **quota explicite** (par exemple moitié films / moitié séries, ou deux rayons
séparés « Films suggérés » / « Séries suggérées » comme dans « À voir »), et tirage des graines
équilibré entre les deux types. À traiter avec le point 2 (mêmes titres qui reviennent) : c'est le
même mécanisme de tirage et de tri.

### 9 et 10. Saga dans la fiche ✅ (2026-09-11)
Rangée « nom de la saga » sous le synopsis, dans l'ordre de sortie, le film ouvert marqué
« Ce film » et cadré de doré. Faite de `MovieCard` : état visible (décision de Kinder), pastille
d'ajout et appui long compris. Toucher un autre film ouvre sa fiche (le retour ferme la fiche,
il ne revient pas au film précédent). Données : `getDetails` → `collection`, `getCollection`.

### 9. Sagas : les autres films dans la fiche, dans l'ordre (2026-09-10)
Aujourd'hui **rien** n'existe : `belongs_to_collection` n'est lu nulle part et `Detail.jsx` ignore
les collections. À ajouter dans la fiche d'un film appartenant à une saga : la liste des **autres
films de la saga**, **dans l'ordre** (ordre de sortie ; l'ordre chronologique de fiction n'est pas
dans TMDB, ne pas le promettre), avec le film ouvert **repéré à sa place** dans la suite.
Données : `/movie/{id}` renvoie `belongs_to_collection`, puis `/collection/{id}` donne les parties.
À trancher : afficher aussi l'état de chaque film (vu / suivi / absent) — c'est ce qui rend le rayon
utile pour compléter une saga (rejoint le point 3, « compléter une saga » de l'onglet Découvrir).

### 10. Sagas : le même appui long d'ajout rapide (2026-09-10)
Dans le rayon saga de la fiche, réutiliser **le même** appui long que les grilles
(`MovieCard`, `onLongPress`) pour marquer un film « vu » ou l'ajouter directement, sans ouvrir sa
fiche. Rien de nouveau à inventer : c'est le composant existant, à condition que le rayon saga
soit fait de `MovieCard` et pas d'une liste maison.

### 11. Bug d'affichage après un long défilement par genre (2026-09-10) ✅
**Corrigé (2026-09-11)** — cause reproduite : colonnes en `1fr`, donc un titre fait d'un seul
mot très long élargissait sa colonne et toutes ses affiches. Colonnes en `minmax(0, 1fr)`, titres
coupables n'importe où, et une affiche qui ne charge pas retombe sur « Pas d'affiche ».
Constat d'origine :
Constaté sur l'appareil (capture du 2026-09-10, écran « Suivi » atteint depuis un genre) : après un
défilement long, la grille se **désaligne** — les cartes d'une même rangée ne partent plus de la
même hauteur, la colonne du milieu a des affiches plus hautes que les autres, les titres se
retrouvent décalés d'une ligne à l'autre, et la rangée du haut n'affiche qu'un titre
(« Point Break : Extrême limite ») sans son affiche.
C'est un **bug, pas une idée** : à reproduire et corriger, pas à cadrer.
Piste : `.grid` (`styles.css` ~239) est une grille simple et `.card` est un flex colonne ; l'affiche
a bien `aspect-ratio: 2/3`, donc la hauteur ne devrait pas varier — vérifier ce que devient une
carte étirée à la hauteur de sa rangée quand un titre voisin passe sur deux lignes, et ce que
donnent les images encore en cours de chargement pendant l'ajout de pages (`discoverByGenre` est
paginé). Vérifier aussi si le défilement est conservé au retour sur l'écran.

### 12. Retours du 2026-09-11, au premier essai de l'APK ✅
- **Profils supprimés qui revenaient** : chaque profil a son fichier dans le Drive, et
  « Restaurer » les reprenait tous. Une suppression est maintenant retenue
  (`backup.oublierProfil`) : le profil n'est plus proposé, et son fichier quitte le Drive à
  la sauvegarde suivante. Revient sur la décision du 2026-08-26 (« la suppression ne touche
  pas le Drive »), à la demande de Kinder. On ne retire **que** les profils supprimés, jamais
  ceux simplement absents de l'appareil (un téléphone neuf viderait sinon le Drive).
- **Recherche dans « Mes listes »** : un champ en haut cherche dans toute la bibliothèque,
  sans accents ni majuscules (`status.titreCorrespond`, aussi utilisé par l'ajout groupé).
- **« Tendances du moment »** : 3 pages TMDB d'un coup (~60 titres) au lieu d'une, « Voir
  plus » pour 3 de plus, et le filtre Films / Séries demande les tendances du type choisi.

### 13. Essai du 2026-09-19 — validation dans le navigateur
Passe du 11/09 essayée par Claude Code dans le navigateur intégré, en **largeur téléphone**
(375×812), avec le vrai catalogue TMDB et un suivi de test (30 titres, hors des vraies
données). **Aucun défaut relevé.**
- **Validé à l'écran** : « Pas encore sorti » en dernier, replié au départ, pli retenu après
  rechargement (1) ; grille par genre poussée à 236 cartes — une seule largeur de colonne, une
  seule hauteur d'affiche, aucun débordement (11), avec la mention « N titres que tu as déjà
  sont masqués » et le chargement continu (6) ; suggestions 15 films + 15 séries à chaque
  tirage, aucun titre déjà suivi, bouton en haut et en bas, remontée en haut de page (7, 8) ;
  saga de Matrix Reloaded en ordre de sortie, film ouvert cadré de doré (9) ; recherche de
  « Mes listes » sans accents ni majuscules (12) ; tendances ~60 titres, « Voir plus », filtre
  Films / Séries sans mélange (12) ; suppression de profil avec confirmation, dernier profil
  protégé (12).
- **Reste à confirmer sur le téléphone** (non testable dans un navigateur) : l'appui long sur
  une carte de saga (10), la photo d'avatar depuis la galerie (11), le bouton retour d'Android,
  et « un profil supprimé ne revient pas en restaurant » (12), qui demande le vrai Drive.
- **Constats de confort, non traités** : le sous-titre de la saga chevauche le bord de la bande
  grise ; la liste des genres met côte à côte « Action » et « Action & Adventure »,
  « Science-Fiction » et « Science-Fiction & Fantastique » sans dire lequel vaut pour les films
  ou les séries ; d'un tirage de suggestions à l'autre, 4 à 11 titres sur 30 reviennent
  (point 2, toujours ouvert).

## Hors périmètre V2 (noté, pas construit)
- Calendrier des prochaines sorties (vue par date) / notifications de nouvel épisode.
  *(Le bloc « Pas encore sorti » de « Ce soir » — `Upcoming.jsx` — existe : il liste les
  titres suivis dont la sortie est à venir, sans calendrier ni notification.)*
- Fonctions sociales.
(Notes, avis et statistiques, notés ici à l'origine, ont été construits le 2026-08-26.)

## Prochaine étape
Les 6 chantiers sont terminés (voir état réel ci-dessus).

**Décision 2026-08-17** : le chantier suivant n'est **pas** la mise en ligne, mais le passage en
**application Android autonome** (aucun serveur) → voir `PLAN_ANDROID.md`. L'application Android
devient l'usage unique ; la version PC n'est plus maintenue. Le code serveur reste dans le dépôt
comme base d'une mise en ligne éventuelle, non planifiée à ce jour.

**2026-09-11** : passe de corrections issue des retours du 10 septembre (voir « Idées pour les
versions suivantes »), à essayer sur l'appareil puis à publier en 2.2.

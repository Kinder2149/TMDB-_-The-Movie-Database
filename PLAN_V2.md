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
`versionCode` / `versionName` montés à **6 / 2.2** le 2026-09-19 (publié : 5 / 2.1). Paquet
prêt, publication en attente de l'essai sur téléphone (voir `PLAN_ANDROID.md`).

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

### 4 bis. Amis par code — cadrage FIGÉ le 2026-10-03 (rien n'est codé)
Remplace l'ancienne lecture du point 4 : plus besoin d'une mise en ligne complète (serveur,
PostgreSQL, comptes). Un seul service externe, **Firebase**, pour une seule chose : une
**fiche partagée facultative**. Kinder accepte que cela modifie les décisions figées « aucun
serveur » et « données sur l'appareil » (voir `PROJET_CONTEXTE.md`), à condition de ne pas
casser ce qui est publié sur le Play Store.

**Deux étages séparés (décision de Kinder, 2026-10-03)**
- **Privé** : la sauvegarde reste sur le **Drive de l'utilisateur** (`drive.appdata`).
  L'éditeur n'y a aucun accès. Seule fonction qui demande un compte Google. Inchangée.
- **Public** : la fiche partagée et le code ami vivent sur Firebase, **sans compte** (connexion
  anonyme invisible). Aucun compte Google requis pour les amis.
- Écarté : déplacer la sauvegarde sur Firebase. Il faudrait quand même une identité qui survit
  au téléphone (compte ou code de récupération), la sauvegarde complète serait chez l'éditeur,
  et Cloud Storage exige le forfait payant depuis le 2026-02-03.

**Trois couches par profil**
1. Profil local (privé, inchangé) : nom, avatar, suivi, avis, listes.
2. Fiche partagée (facultative, **par profil**) : pseudo public (peut différer du nom local),
   avatar, ce qui est montré, **code ami** long et impossible à deviner. Désactivée par défaut :
   tant qu'on ne l'active pas, rien ne sort du téléphone.
3. Mes amis (par profil, **stockés sur le téléphone**, inclus dans la sauvegarde) : une liste de
   codes avec pseudo et avatar gardés en mémoire. Le serveur ne garde aucun réseau social.

**Ce qui est partagé** : pseudo, avatar, titres vus avec leurs étoiles, et **toutes les listes**
— les quatre statuts (À voir, En cours, Vu, Abandonné) comme les listes créées à la main — **sauf
celles que l'utilisateur marque « privées »** (décision de Kinder, 2026-10-03 : une fiche
complète, pas un choix liste par liste à l'activation). Le réglage « privée » se fait sur chaque
liste et sur chaque statut. Une liste créée après l'activation est publique par défaut, mais le
choix Publique / Privée est proposé dès sa création, et un résumé « Visible par tes amis : … »
est affiché dans Mon profil. **Jamais** les avis écrits (évite la modération de contenu
d'utilisateurs exigée par Google). Seuls des identifiants TMDB sont envoyés : affiches et textes
viennent de TMDB comme aujourd'hui. Une liste privée n'est jamais envoyée au serveur, pas
seulement masquée : retirer une liste de la fiche l'efface aussi côté serveur à la prochaine
mise à jour. Aucune date n'est partagée : l'ordre des titres (du plus récent au plus ancien)
suffit pour « vu récemment ».

**Fonctionnement** : suivi à sens unique (comme Letterboxd), pas de demande d'ami, pas de
recherche d'inconnus. Fiche mise à jour à la demande ou en quittant l'application, comme la
sauvegarde Drive — pas en direct. Changer de code coupe tous les anciens accès. Règles Firebase :
lecture d'une fiche seulement si on connaît son code, écriture seulement par son propriétaire ;
Play Integrity (App Check) contre les abus. Données hébergées en Europe. Forfait gratuit
(Spark) : pas de carte bancaire, coupure plutôt que facture. Pas de Cloud Functions.

**Réinstallation** : l'identité anonyme disparaît avec l'application. La clé de la fiche est donc
portée par la sauvegarde Drive, ou, pour qui n'a pas Drive, par un **code de récupération**
affiché à l'activation.

**Écrans**
- *Mon profil* (depuis l'avatar) : pseudo et code ami (copier, partager, régénérer), choix de
  partage, « voir ma fiche comme mes amis la voient », liste d'amis, « Supprimer ma fiche
  partagée ».
- *Fiche d'un ami* : avatar, pseudo, compteurs, puis un onglet par liste publique (statuts et
  listes créées), titres vus avec étoiles ;
  repère « déjà dans mon suivi » et bouton « Ajouter à mon À voir ».
- Pas de 5ᵉ onglet : un rayon « Chez tes amis » dans **Découvrir**, la gestion dans Mon profil.

**Play Store, à faire avant la publication de la version qui contient la fonction** (jamais
après : Google détecte Firebase dans le paquet) : questionnaire « Sécurité des données » (collecte
facultative : identifiant, pseudo, titres partagés ; Firebase = prestataire, pas un tiers),
politique de confidentialité (`docs/index.html`), textes de la fiche (« sans compte », « vos
données restent sur votre téléphone » à nuancer), bouton de suppression + adresse web de demande
de suppression.

**Étapes, chacune testée avant la suivante**
1. Projet Firebase séparé (celui de l'écran de consentement Drive n'est pas touché), en Europe,
   règles de sécurité testées hors application.
2. Activer le partage, afficher le code ami.
3. Ajouter un ami, voir sa fiche.
4. « Ajouter à mon À voir » depuis la fiche d'un ami ; rayon « Chez tes amis ».
5. Suppression de la fiche + clé retrouvée via Drive / code de récupération.
6. Dossier Play Store et politique de confidentialité, puis publication.

**Étape 1 — règles de sécurité écrites et testées (2026-10-03)** : `client/firebase/firestore.rules`,
19 tests (`npm run test:regles`, émulateur local sur des ports à part, Java d'Android Studio ;
jamais contre le vrai projet `vault-watch-amis`). Deux enseignements :
- la première structure (une ligne « propriétaire » par code) avait une **faille** — un intrus
  pouvait modifier la ligne et garder la clé déjà enregistrée. Corrigée : une ligne **par
  identifiant** (`proprietaires/{code}/clefs/{uid}`), créable uniquement avec la bonne clé,
  jamais modifiable. Conséquence assumée : après une reprise, l'ancien identifiant garde aussi la
  main (c'est la même personne) ; « régénérer le code » reste le moyen de couper un accès ;
- l'empreinte calculée par les règles est en hexadécimal **majuscule** : l'application doit
  envoyer `cleHash` en minuscules (les règles ramènent le calcul en minuscules). Le mécanisme de
  reprise par clé **fonctionne** : le repli « pas de reprise possible » n'est pas nécessaire.
Règles **publiées dans le vrai projet** par Kinder, puis vérifiées contre lui le 2026-10-03 (8
essais réels avec deux identifiants anonymes : création, lecture par code, parcours interdit, clé
illisible, modification par un tiers refusée, mauvaise clé refusée, reprise avec la bonne clé ;
fiche de test effacée). **Étape 1 terminée.** Reste, avant l'étape 2 : installer `firebase` en
dépendance de l'application (aujourd'hui seulement en développement).

**Étape 2 — activer le partage, code ami : codée et vérifiée (2026-10-03)**
- Nouveaux fichiers : `firebase.js` (porte vers Firebase, chargée seulement à la première
  action de partage), `partage.js` (quoi publier, état local), écran `Partage.jsx` (Réglages >
  « Profil partagé »). Table locale `partage` ; colonne `listes.prive`.
- Vérifié contre le vrai projet depuis l'application : activation, fiche relue par un autre
  identifiant (identifiants et étoiles seulement), un statut passé en privé disparaît du serveur
  aussitôt, « Arrêter le partage » supprime la fiche. 260 tests (dont 18 pour le partage).
- La fiche se met à jour en quittant / en revenant dans l'application (même déclencheur que la
  sauvegarde Drive), seulement si elle a changé, sans jamais rien afficher.
- **Sauvegarde passée en version 4** (code ami, clé, listes privées). Conséquence assumée : la
  version 2.1 déjà publiée refusera de restaurer une sauvegarde 4 plutôt que de perdre la clé.
- Supprimer un profil partagé retire d'abord sa fiche en ligne (réseau requis).
- À essayer sur le téléphone : bouton « Partager » (feuille d'Android), copie du code, et la
  clé bien présente dans la sauvegarde Drive. Pas encore codé : ajouter un ami (étape 3).

**Étape 3 — ajouter un ami, voir sa fiche : codée et vérifiée (2026-10-03)**
- Réglages > « Mes amis » : champ de code (tolère minuscules, tirets, espaces), liste des amis,
  fiche d'un ami avec un onglet par liste publique (statuts nommés en clair), ses étoiles sous
  chaque affiche, le « + » qui l'ajoute à ton suivi. Suivre un ami ne demande pas d'avoir activé
  son propre partage.
- Table locale `amis` ; la sauvegarde emporte code, pseudo et avatar (pas la copie des fiches).
  Copie de la fiche gardée une heure, gardée aussi hors connexion (signalé). Une fiche supprimée
  est signalée sans effacer l'ami. Maximum 100 amis ; son propre code est refusé.
- Les fiches viennent d'autres utilisateurs : tout est validé au décodage (forme exacte des
  titres, textes tronqués, positions existantes) ; testé avec une fiche hostile.
- Titres et affiches viennent de TMDB, par lots de 30 puis « Voir plus ».
- **Modifié le 2026-10-03 (demande de Kinder, après essai)** : un avatar en **photo** part dans la fiche sous forme
  d'une **miniature de 48 px** (JPEG, ~2 Ko, plafond 4 000 caractères ; la photo d'origine ne part jamais). Règle Firebase
  `avatar <= 4000` (**à déployer**) ; côté lecture, seuls « couleur:symbole » et une miniature JPEG sont acceptés. Avant :
  les amis voyaient l'initiale. **Avant publication Play Store** : la politique de confidentialité et le questionnaire
  doivent mentionner cette miniature. Les amis doivent avoir la nouvelle version pour voir la photo des autres.
- Vérifié contre le vrai projet : ajout par code, fiche affichée avec de vrais titres, ajout au
  suivi, ouverture d'une affiche par-dessus. Reprise d'une fiche par la clé après « changement
  d'identifiant » confirmée en réel. 279 tests.
- Reste : étape 4 (« Ajouter à mon À voir » déjà là via le « + » ; rayon « Chez tes amis » dans
  Découvrir), étape 5 (clé retrouvée via Drive / code de récupération saisi), étape 6 (Play).

**Étapes 4, 5 et 6 (2026-10-03)**
- *Étape 4* — rayon « Chez tes amis » dans Découvrir (« Pour toi ») : ce que tes amis ont noté
  4-5 étoiles ou vu sans noter, classé par nombre d'amis puis par notes, ce que tu as déjà est
  masqué, avec « Camille ★5 » sous l'affiche. Le « + » de la carte sert d'« ajouter à mon À voir ».
- *Étape 5* — retrouver sa fiche : automatique si la sauvegarde Drive est restaurée (elle porte
  la clé) ; sinon « J'avais déjà un code ami » dans Profil partagé (code ami + code de
  récupération), vérifié contre la fiche en ligne avant d'écrire quoi que ce soit.
- *Étape 6* — dossier Play Store et politique de confidentialité **rédigés, pas publiés**
  (`PLAN_ANDROID.md` > « Dossier Play Store de la version amis », `docs/index.html`).
- **Interrupteur de compilation** : le partage est éteint dans tout build publiable
  (`VITE_PARTAGE=1` requis, présent seulement dans `.env.development`). La 2.2 déjà préparée peut
  donc partir sans toucher au questionnaire ; les amis sortent dans une version suivante.

### Refonte visuelle — PLAN COMPLET (2026-10-03)
Retour de Kinder sur Découvrir (« moche, pas uniforme, bâclé ») élargi à tout le front. Maquette
de référence : canvas « Vault Watch — proposition design », 30 écrans clair/sombre
(https://claude.ai/artifact/7zWsa4mVaDFnkEx6Fy44Qd, privé). Ce plan est la version vérifiée contre
le code : tout ce que la maquette montre est soit une donnée qui existe, soit une règle écrite
ici, soit retiré.

#### 0. État réel
- **Phase 1 codée et vérifiée (293 tests)** : échelles communes (`--s-*`, `--t-*`, `--r-*`,
  `--ease`), blocs (`.page-head`, `.sec`, `.rail`, `.chips-scroll`, `.panel`, `.field`, `.switch`,
  `.skeleton`, `.vide`, `.message`), Découvrir en rangées (`Rail.jsx`, `VueRayon.jsx`), « Reprendre »
  en rangée, en-têtes de page, Profil partagé / Amis / Fiche d'un ami en blocs, flèche de retour à
  gauche, loupe en vraie icône, plus de clavier forcé à la Recherche.
- **M2 à M7 codées le 2026-10-03** (voir le tableau de suivi plus bas) ; reste l'essai de Kinder sur téléphone avec l'APK
  de fin de série, puis la clôture du chantier.

#### 1. Principes
1. **Identité conservée** (crème, doré, titres serif, couleurs de statut). Évolution, pas refonte.
2. **Une hiérarchie** : H1 titre de page, H2 titre de section, H3 étiquette en petites capitales.
3. **Rien d'inventé** : chaque élément affiché a sa donnée (§2) ou sa règle écrite.
4. **Pas d'impasse** : chaque écran a une sortie évidente et chaque fonction est à ≤ 2 gestes (§3).
5. **Quatre états par écran** : chargé, en chargement (affiches fantômes), vide, hors connexion.
6. **Le mouvement sert** : apparition douce, retour tactile, transitions d'écran — jamais décoratif ;
   coupé par `prefers-reduced-motion`.
7. **Accessible** : cibles ≥ 44 px (le visuel peut rester à 34 px, la zone tactile s'étend),
   contraste ≥ 4,5:1 vérifié en clair ET en sombre, texte ≥ 12 px, vrais `<button>`.

#### 2. Audit de vérité : maquette contre code
| Élément | Source réelle | Verdict |
|---|---|---|
| Accueil Recherche : Tendances seules | décision du 2026-10-03 (Nouveautés / À venir → Ce soir › Suggestion) | **Maquette v1 se trompait** (remettait 3 rangées) — corrigée |
| Mes listes : titres · vus · note moyenne | `getStats` (base locale, instantané) | OK |
| Mes listes : « 312 h regardées » | exige les durées, mesurées par le réseau à la 1re ouverture de Statistiques | **Retiré** de Mes listes, reste dans Statistiques |
| Mosaïque 2×2 des listes | `suivi.poster_url` des 4 premiers titres | OK (1 requête groupée à écrire) |
| Tuiles de statut + jauge | `parStatut` / nombre de titres | OK |
| Statistiques (temps total / films / séries ; bibliothèque ; répartition ; note) | `getStats` + `completeRuntimes` | OK, conservés tels quels |
| Statistiques : « Genres les plus regardés » | colonne `genres` (créée le 2026-10-03, remplie au lancement) | **Nouveauté**, signalée « Nouveau » ; ne compte que les titres dont le genre est connu |
| Ce soir : « idée du soir » | **aucune règle n'existait** | Règle écrite §4.2 |
| « dans ta liste depuis 3 semaines » | `suivi.added_at` existe mais `listSuivi` ne le renvoie pas | À ajouter au SELECT, sinon mention retirée |
| Reprendre : barre de progression sur l'affiche | `getProgress` : watched / aired | OK |
| Reprendre / fiche série : « S2E04 · titre » | `progress.next.{season,episode,name}` | OK |
| Fiche série : « diffusé le … » | `progress.next` n'a pas la date ; les épisodes l'ont (`airDate`) | À ajouter à `next` (1 champ) |
| Fiche série : « 47 min · sorti il y a 3 jours » | durée d'épisode non disponible par épisode | **Retiré** |
| Fiche série : choix de statut à 4 boutons | **faux** : le statut d'une série est dérivé de la progression ; seul « Abandonné » est manuel (`statusDisabled`) | **Maquette corrigée** : pastille de statut calculé + bouton « Abandonner » |
| « Tu seras prévenu » (nouvelle saison) | dépend de l'autorisation et du cycle de notifications | **Retiré** ; reste le badge `releaseBadge` |
| Fiche : « Casting » | l'application dit « Têtes d'affiche » | Renommé |
| Fiche film : « Dans le même esprit » | existe (recommandations TMDB) | Ajouté à la maquette |
| Fiche : « Où le regarder » | `providers` FR : abonnement, location + achat, logos w45 | OK (logos réels à la place des lettres) |
| Découvrir : bannière « À la une » | `toCardItem` ne garde ni le fond d'écran (`backdrop_path`) ni… | Possible : ajouter `backdropUrl` ; **phase 7, facultatif** |
| Découvrir : avatars d'amis + « Mes amis » | `listerAmis` (pseudo, avatar) | OK |
| Thème « Automatique » | aujourd'hui 2 états (bascule clair/sombre, sombre par défaut) | À faire : 3 états |
| Bandeau « pas encore sauvegardé », menu d'appui long, conflit Drive, écran de bienvenue | existent dans le code | **Ajoutés à la maquette** pour être restylés |
| États vide / hors connexion / chargement | `Chargement…` en texte (13 fois), aucun état vide illustré | À généraliser (composants `.vide`, `.skeleton`) |
| « vous » / « tu » | Suggestions disait « vous » | Corrigé en « tu » ; relecture de tous les textes en phase 6 |
| Homonymie « Découverte » (sous-onglet de Ce soir) / « Découvrir » (onglet) | décision de Kinder (2026-10-03) | **Gardée**, mais chacun a un sous-titre qui dit ce qu'il est (§4.2, §4.4) |

#### 3. Carte de navigation (qui mène où)
- **Barre du bas** : Recherche · Ce soir · Mes listes · Découvrir. **Avatar** (en haut) → Réglages.
- **Réglages** → Mes profils · Profil partagé · Mes amis · Thème · Langue · Notifications ·
  Sauvegarder / restaurer · Statistiques · Sources et mentions légales.
- **Chemins ajoutés** (avant : 3 niveaux de profondeur) : *Mes listes → bandeau de chiffres →
  Statistiques* ; *Découvrir → rangée d'avatars → Mes amis* ; *bandeau « pas sauvegardé » →
  Sauvegarder* (existe) ; *état vide → Recherche* ; *carte « idée du soir » → fiche*.
- **Toute affiche** → fiche du titre, qui revient à l'écran d'où l'on vient (déjà géré :
  `ficheOrigine`, superpositions). **Appui long** sur une affiche → menu des statuts.
- **Bouton retour d'Android** : fiche d'un titre > fiche d'un ami > écran superposé > onglet précédent
  > Recherche > quitter. Ordre déjà codé dans `backRef` ; chaque nouvel écran superposé s'y inscrit.
- Aucune impasse : tout écran superposé a une flèche de retour à gauche et un retour Android.

#### 4. Spécification écran par écran
**4.1 Recherche** — champ (sans clavier forcé) · sélecteur Titre / Acteur / Explorer · *Accueil
(champ vide)* : « Tendances » en grille 3 colonnes, filtre Tout / Films / Séries (compact), « Voir
plus » (3 pages d'un coup, titres déjà suivis masqués) · *Résultats* : filtres Année / Trier par,
titres déjà suivis visibles (pastille + liseré) · *Explorer* : genres en puces défilantes, filtre
Films / Séries, mention « N titres que tu as déjà sont masqués ». États : chargement (affiches
fantômes), aucun résultat, hors connexion (bloc `.vide` + « Réessayer »).

**4.2 Ce soir** (sous-titre : « Reprends une série, pioche dans ta liste, ou laisse-toi guider »)
- *En attente* : **idée du soir** (carte) · **Reprendre** (rangée, barre de progression, épisode
  suivant) · **À voir ce soir** (rangée, titres déjà sortis) · **Pas encore sorti** (ligne repliée,
  compte + prochaine date). Vide : « Ta bibliothèque est vide » + bouton vers la Recherche.
- *Règle de l'idée du soir* : parmi les titres « À voir » **déjà sortis**, un seul, tiré par une
  graine = (profil + date du jour) → stable toute la journée, identique après relance ; « Autre idée »
  passe au suivant dans le même tirage (jamais deux fois le même dans la journée tant qu'il en
  reste). Aucune idée s'il n'y a rien « à voir » → la carte disparaît. Elle n'ouvre pas de lecture :
  « Voir la fiche ». (Les séries à reprendre ont déjà leur rangée : elles ne sont pas proposées ici.)
- *Découverte* (sous-titre « Parce que tu as aimé… ») : mélange films / séries d'après tes titres
  notés ou vus, bouton Actualiser — logique actuelle conservée, présentation en grille.
- *Suggestion* : Tendances / Nouveautés / À venir (puces défilantes) + grille — comme décidé.
- Bandeau de sauvegarde (si modifications non envoyées) sous la barre d'application, fermable.

**4.3 Mes listes** — en-tête (compte de titres) · bandeau de 3 chiffres (titres, vus, note moyenne ;
touche → Statistiques) · recherche dans la bibliothèque · 4 tuiles de statut avec jauge · « Listes
personnalisées » (cartes à mosaïque + « Nouvelle liste ») · outils (Films / Séries, Filtres) · grille
par Films / Séries. *Une liste* : titre + compte, interrupteur « Visible par tes amis » (si le
partage est actif), Ajouter, Supprimer. Vide : bloc `.vide` par statut (« Rien ici pour l'instant »).

**4.4 Découvrir** (sous-titre « Des idées pour ta prochaine soirée, choisies pour toi ») — rangée
« Chez tes amis » (légende « Camille ★5 », ce que tu n'as pas déjà) · « Comme [titre] » ×2 ·
sélections (Pépites cachées, Soirée courte, Grands classiques, Le meilleur de l'année) · thèmes ·
filtre « Sur mes plateformes » + rangée d'avatars d'amis → Mes amis · chaque rangée a « Tout voir »
(grille complète, Films / Séries, « Voir plus »). Rangées chargées à l'approche de l'écran, une
rangée vide disparaît. États : fantômes, hors connexion, « Rien de neuf chez tes amis ».
*Facultatif (phase 7)* : bannière « À la une » = premier titre de « Le meilleur de l'année » avec son
fond d'écran.

**4.5 Fiche film** — fond d'écran + affiche · titre, année, durée, genres · statut (4 boutons) ·
note en étoiles + bande-annonce · où le regarder · synopsis (replié, « Lire la suite ») · têtes
d'affiche · **Mes visionnages** (dates modifiables, « J'ai revu », ajout d'une date) · mon avis ·
dans le même esprit · saga · mes listes.

**4.6 Fiche série** — mêmes en-têtes · **statut calculé** + « Abandonner » · anneau de progression
(vus / diffusés) + **prochain épisode** (numéro, titre, date) + bouton « Marquer … comme vu » ·
badge de sortie (`releaseBadge`) · saisons dépliables (coche ronde par épisode, ×N, calendrier des
dates, « J'ai revu la saison ») · « J'ai vu toute la série » · synopsis · têtes d'affiche · même
esprit · mes listes.

**4.7 Partage, amis** — comme codés en phase 1 (blocs, interrupteurs, états vides, fiche d'un ami).

**4.8 Réglages et sous-écrans** — cartes groupées (Profil · Amis · Affichage · Notifications · Mes
données · À propos) ; Thème à 3 états ; Mes profils (liste, profil actif coché, renommer / avatar /
supprimer, nombre de titres) ; Statistiques (§2) ; Sauvegarder / restaurer (état du compte, dernier
envoi, interrupteur automatique, boutons, **écran de conflit** à 2 versions, confirmations) ;
Notifications ; À propos (mention TMDB obligatoire, intacte) ; **Bienvenue** (langue + « restaurer
une sauvegarde »).

#### 5. Système (déjà posé en phase 1, à compléter)
- Tokens : espacement 4-8-12-16-24-36, texte 12-14-16-20-26, arrondis 8-14-pilule, mouvement 220 ms.
- Composants à ajouter : `Vide` (icône + titre + consigne + action), `Hero`, `Anneau` (progression),
  `Switch` (déjà en CSS), `Tuile` (statut + jauge), `Mosaique` (liste), `Bandeau`.
- Remplacer tous les `Chargement…` texte par des fantômes (13 occurrences).
- Zone tactile ≥ 44 px pour `.seg--sm` et les puces (pseudo-élément), sans grossir le visuel.

#### 6. Missions — cadrage technique (VALIDÉ par Kinder le 2026-10-03, ordre figé)

**Suivi** (à tenir à jour à la fin de chaque mission : case, date, version de l'APK essayée)
| Mission | Contenu | Statut |
|---|---|---|
| M1 | Fondations + Découvrir + écrans de partage | ✅ codée et vérifiée (2026-10-03) |
| M2 | Fiches film et série | ✅ validée par Kinder (2026-10-03) |
| M3 | Ce soir | ✅ codée et vérifiée (2026-10-03) — à essayer sur téléphone |
| M4 | Mes listes + Statistiques | ✅ codée et vérifiée (2026-10-03) — APK à essayer sur téléphone |
| M5 | Recherche + états partout | ✅ codée et vérifiée (2026-10-03) |
| M6 | Réglages et données | ✅ codée et vérifiée (2026-10-03) |
| M7 | Dynamique | ✅ codée (2026-10-03) — bannière « À la une » non faite (facultative) |
Règle : **une mission à la fois**, essayée sur téléphone par Kinder avant la suivante. Une mission
n'est « finie » que si toutes ses cases du « Critère de fin » sont cochées.

**Protocole commun à chaque mission** (dans cet ordre)
1. Relire la mission ci-dessous et la ou les planches de la maquette (lien en tête de section).
2. Coder en modifiant l'existant avant d'en créer ; 3 couches (UI / logique / données) ; la logique
   nouvelle va dans un module pur testable (`client/src/*.js`), l'écran dans `components/`.
3. `cd client && npx vitest run` (293 tests verts au départ, jamais moins) puis `npx vite build`.
4. Vérifier à l'écran, largeur téléphone (390 px), **avec une base remplie** (voir « Données de
   démonstration » plus bas) : états plein, vide, chargement, hors connexion.
5. **Vérifier sur le moteur Android réel** : `VITE_PARTAGE=1 npx vite build`, `npx cap sync android`,
   `cd android && ./gradlew.bat assembleDebug` (avec `JAVA_HOME` = `C:/Program Files/Android/Android
   Studio/jbr`), APK → `apk-test/vault-watch-test-amis.apk`. L'émulateur Android déjà lancé sert à
   un autre projet de Kinder (« Le_comptoir ») : **ne rien y installer sans lui demander**.
6. Mettre à jour : tableau de suivi ci-dessus, `CHANGELOG.md`, et si une décision change,
   `PROJET_CONTEXTE.md`. Ne pas commiter sans demande.
7. **S'arrêter**, donner l'APK à Kinder, attendre sa validation avant la mission suivante.

**Pièges déjà rencontrés (à ne pas refaire)**
- **Aucun commentaire SQL (`--`) ni point-virgule/apostrophe dans le schéma de `db.js`** : le moteur
  SQLite du téléphone s'y étrangle (« execute: not an error (code 0) ») et l'application ne démarre
  plus ; le navigateur ne le voit pas. Gardé par `tests/schema-telephone.test.js`.
- Entiers de 13 chiffres (millisecondes) en base : utiliser des secondes.
- Après un `vite build` ou un changement d'`.env`, **redémarrer le serveur de développement**
  (`preview_stop` puis `preview_start`) : sinon deux copies de React (« Invalid hook call »).
- Dans l'outil de commande, une *here-document* bash contenant des apostrophes échoue : écrire les
  scripts avec l'outil Write puis les lancer.
- Les captures du panneau navigateur sont instables (délai, image en 4 tuiles) : la tuile en haut à
  gauche est fidèle ; sinon relancer, et s'appuyer sur `javascript_tool` (mesures, texte, états).
- `IntersectionObserver` peut ne pas se déclencher dans ce panneau : `Rail.jsx` a un filet.
- Interrupteur du partage : `VITE_PARTAGE=1` (présent seulement dans `.env.development`) ; ne pas
  l'ajouter à `.env.production` (voir « Dossier Play Store »).

**Données de démonstration** (navigateur, base locale vide au départ) : dans la console de la page,
`const api = await import('/src/api.js')` puis `getRubrique({rubrique:'tendances',mediaType:'all',page:1})`
→ `addToSuivi`, `setStatus`, `setNote`, `createListe`, `addToListe`. Prévoir : ≥ 30 titres, les 4
statuts, des étoiles, 2 listes, une série en cours (cocher des épisodes), un ami (publier une fiche de test avec un petit script
Node qui utilise `firebase` — format dans `client/firebase/tests/fiches.rules.test.js` — puis la
supprimer ; code ami à 12 caractères sans 0/O/1/I).

---
**M2 — Fiches film et série** · planches : *Fiche · Film*, *Fiche · Série*, *Fiche série · sombre*
- *Objectif* : la fiche (écran le plus ouvert) devient lisible d'un coup d'œil : où j'en suis, quoi
  faire ensuite.
- *Données* : `store.getProgress` → `next` gagne `airDate` (`firstUnwatched.airDate`) ; test dans
  `tests/store.test.js` (« next porte la date de diffusion »). Rien d'autre en base.
- *Découpage* : `Detail.jsx` (920 lignes) garde l'état et les appels ; extraire le rendu en
  composants de présentation `FicheEntete.jsx` (fond + affiche + titre + métas), `FicheStatut.jsx`,
  `FicheProgression.jsx` (anneau + prochain épisode + bouton), `FicheSaisons.jsx`. Aucun changement
  de signature dans `api.js`.
- *Film* : statut à 4 boutons (inchangé) · étoiles + bande-annonce · « Où le regarder » (logos
  réels `providers`, abonnement puis location/achat) · synopsis replié à 4 lignes + « Lire la
  suite » · têtes d'affiche (ronds, photo ou initiale) · `Visionnages.jsx` · avis · « Dans le même
  esprit » et saga en `.rail` · mes listes.
- *Série* : **statut calculé** = `current` (jamais 4 boutons) + bouton « Abandonner » ; si abandonné :
  « Reprendre le suivi » (`pickStatus` → `deriveSeriesStatus`) — conserver `statusDisabled`. Anneau
  = `watched / aired` (`--p` en %, `conic-gradient`). Carte « Prochain épisode » : `S{n}E{nn} · nom`,
  « Diffusé le … » ; bouton « Marquer SxEy comme vu » → `markEpisode` puis `refreshProgress` et
  rechargement des épisodes. `next === null` : « À jour » (+ nombre d'épisodes annoncés à part,
  logique `aVenir` existante). Badge `releaseBadge` conservé. Saisons dépliables : coche ronde,
  ×N, calendrier, « J'ai revu la saison », « J'ai vu toute la série ».
- *États* : chargement = fond + affiche fantômes ; hors connexion (`info` null) = données du suivi
  (titre, année, affiche) + `.vide` « Détails indisponibles » + Réessayer ; titre non suivi : le statut
  devient « Ajouter à mon suivi » (bouton principal).
- *Tests* : `next.airDate` ; helper pur `libelleProchain(next)` dans `status.js` (+ tests) ;
  vérification à l'écran sur : film non suivi, film vu, série en cours, série à jour, série
  abandonnée, série à venir.
- *Critère de fin* : ☐ tests verts ☐ 6 cas vérifiés ☐ clair et sombre ☐ moteur Android ☐ retour
  Android ferme la fiche ☐ aucun style `.section h4` orphelin.

**M3 — Ce soir** · planches : *Ce soir · En attente*, *· Suggestion*, *Bandeau de sauvegarde*, *États*
- *Objectif* : une page qui répond à « qu'est-ce que je regarde ce soir ? ».
- *Données* : `listSuivi` renvoie aussi `s.added_at AS addedAt`.
- *Logique pure* (nouveau `client/src/idee.js`, **à tester**) : `ideeDuSoir(items, { profileId, date, rang })`
  — candidats = `status === 'a_voir' && !isUpcoming(item)` ; mélange déterministe (PRNG type
  mulberry32 amorcé par un hachage de `${profileId}|${date}`), l'élément `rang % candidats.length` ;
  `null` si aucun candidat. Rang mémorisé dans `localStorage` (`idee:${profileId}:${date}`) :
  « Autre idée » l'incrémente, relancer l'application garde la même idée. Aussi `depuisLibelle(addedAt, now)`
  (« depuis 3 semaines », « depuis hier », « depuis 2 mois »).
- *Écran* : `Hero.jsx` (fond = affiche floutée et assombrie, repli dégradé par teinte du titre ;
  kicker, titre, sous-titre, 2 boutons) · « Reprendre » en `.rail` avec barre `watched/aired` sur
  l'affiche (`progress` déjà chargé dans `Tonight`) · « À voir ce soir » en `.rail` + « Tout voir »
  (réutiliser `VueRayon` avec `pagine={false}`) · « Pas encore sorti » = ligne `.panel` (compte +
  prochaine date) qui déplie `Upcoming` · « Découverte » en grille `.rail__item rise` · « Suggestion »
  = `Rubriques` avec `chips-scroll`. Bandeau de sauvegarde (`.rappel`) restylé en `.panel.accent`.
- *États* : bibliothèque vide → `Vide` avec bouton « Chercher un titre » (nouvelle prop `onSearch`
  = `goTo('search')`) ; rien « à voir » → pas de héros ; seulement des titres à venir → ligne
  « Pas encore sorti » seule.
- *Tests* : `tests/idee.test.js` — même idée le même jour, idée différente un autre jour, « Autre
  idée » parcourt tous les candidats sans répétition puis boucle, exclut à venir / en cours / vu,
  `null` si vide, `depuisLibelle` (hier, 3 semaines, 2 mois).
- *Critère de fin* : ☑ tests (308) ☑ 4 cas de bibliothèque (vide, que du « à voir », que du « à venir », riche)
  ☑ clair/sombre ☐ moteur Android (APK construit, à essayer par Kinder) ☑ « Reprendre » ouvre la fiche ☑ plus de `Chargement…` ici.
- *Écarts constatés* : `Bloc.jsx` (barres repliables) supprimé, remplacé par des sections `.sec` ; « Pas encore sorti » est
  une ligne `.panel--ligne` ; « Tout voir » de « À voir ce soir » n'apparaît qu'au-delà de 6 titres ; « Autre idée »
  n'apparaît que s'il y a plus d'un candidat ; « Suggestion » : les puces de rubrique défilent (`chips-scroll`).
  La carte « idée » dit « dans ta liste depuis… » ou « ajouté aujourd'hui ».

**M4 — Mes listes + Statistiques** · planches : *Mes listes*, *Mes listes · une liste*, *Statistiques*
- *Données* : `listListes` renvoie `covers` (jusqu'à 4 affiches) via sous-requête
  `(SELECT group_concat(poster_url, '|') FROM (SELECT s.poster_url … ORDER BY li.added_at DESC LIMIT 4))`
  — **sans commentaire SQL** ; découper sur `|` côté JS. `getStats` renvoie aussi
  `parGenre: [{ key, n }]` (top 5 sur les titres « vu » et « en cours », `genres` CSV ignoré si vide ou
  NULL) ; noms via `getGenres`.
- *Écran* : en-tête de page + bandeau de 3 chiffres (`getStats`: `titres`, `parStatut.vu`,
  `noteMoyenne` ; touche → `onOpenStats`) · recherche · 4 `Tuile` (compte + jauge `n / titres`,
  sélection = comportement actuel) · « Listes personnalisées » : `.rail` de cartes à mosaïque 2×2
  (`Mosaique`) + carte « Nouvelle liste » · outils sur une ligne (`.toolbar`, déjà posée) · grille.
  Une liste : titre + compte, `.panel.flush` avec interrupteur « Visible par tes amis » (seulement si
  `partageActif`), Ajouter, Supprimer. `Filtres.jsx` : genres en `chips-scroll`.
- *Statistiques* : mêmes sections qu'aujourd'hui (temps passé, bibliothèque, répartition, note) en
  blocs `.panel` + « Genres les plus regardés » (pastille « Nouveau » ; masqué si aucun genre connu).
  Conserver la barre « Récupération des durées… ».
- *Tests* : `listListes.covers` (0, 2, 5 titres ; ordre), `getStats.parGenre` (CSV, vides, NULL,
  plafond 5) dans `tests/listes.test.js` / `store.test.js`.
- *Critère de fin* : ☑ tests (313) ☑ liste vide / 1 titre / 10 titres ☑ bibliothèque vide (composant `Vide`) ☑ clair/sombre ☐
  moteur Android (la sous-requête `group_concat` passe : APK construit, à essayer par Kinder) ☑ Statistiques atteignable en 1 geste.
- *Écarts constatés* : le bandeau de 3 chiffres est calculé sur les titres déjà chargés (`resumeBiblio`, instantané),
  pas par `getStats` ; `Chargement…` de la liste remplacé par des fantômes ; l'interrupteur « Visible par tes amis »
  n'apparaît que si le partage est actif (non vérifié à l'écran : profil non activé en démonstration).

**M5 — Recherche + états partout** · planches : *Recherche · accueil / résultats / Explorer*, *États*
- *Composants* : `Vide.jsx` (`icone`, `titre`, `texte`, `action`) et `Fantomes.jsx` (`Poster` et `Ligne`
  réutilisables : grille, rangée) ; remplacer **les 13** `Chargement…` (`grep -rn "Chargement" src`).
- *Recherche* : accueil = « Tendances » en grille (`Rubriques` avec une seule rubrique), filtre
  `seg--sm`, « Voir plus » ; résultats : en-tête « Résultats N » ; panneau `Filtres` en `.panel` ;
  Explorer : genres en `chips-scroll` ; mention « N titres déjà suivis masqués ».
- *Hors connexion* : les erreurs réseau des appels TMDB (`Rubriques`, `Decouvrir`, recherche,
  fiches) basculent un état local `horsLigne` → `Vide` « Pas de connexion » + « Réessayer ».
- *Cibles tactiles* : règle CSS générale (pseudo-élément `::after` ±6 px) pour `.seg--sm button`,
  `.chip`, `.sec__all` ; vérifier qu'aucune cible ne mesure < 44 px de zone.
- *Critère de fin* : ☑ `grep Chargement` = 0 (hors messages d'envoi) ☑ hors connexion simulé
  (`fetch` en échec + `navigator.onLine` à faux : Recherche, Découvrir, Suggestion, Découverte) ☑ clair/sombre ☐ moteur
  Android (APK en fin de série) ☑ clavier jamais forcé.
- *Écarts constatés* : composants `Fantomes.jsx` (grille, rangée, puces), `HorsLigne.jsx` ; `reseau.js` (test) détecte
  l'absence de réseau ; la fiche d'un titre garde son propre état hors connexion (M2). Zones tactiles : `.seg--sm`,
  `.chip`, `.sec__all` ≥ 44 px mesurées.

**M6 — Réglages et données** · planches : *Réglages*, *Mes profils*, *Sauvegarde*, *Conflit Drive*,
*Notifications*, *À propos*, *Premier lancement*, *Réglages · sombre*
- *Thème 3 états* : nouveau `client/src/theme.js` — `lireChoix()` (`'auto'` si rien en mémoire),
  `resoudre(choix, systemeSombre)`, `appliquer(choix)` (pose `data-theme`, écoute
  `matchMedia('(prefers-color-scheme: dark)')` quand `auto`) ; `main.jsx` l'appelle ; Réglages :
  ligne « Thème » qui ouvre 3 choix (Automatique, Clair, Sombre). Tests purs de `resoudre`.
- *Restyle seulement, aucune logique touchée* pour `Backup.jsx` (554 lignes), `Profiles.jsx`,
  `Notifications.jsx`, `About.jsx`, `CatalogLanguage.jsx` : classes/markup vers `.panel`, `.row`,
  `.switch`, `.message`, `.btn`. Les tests `cloud.*.test.js`, `backup.test.js` restent verts sans
  modification. Écran de conflit : 2 versions côte à côte (Drive / ce téléphone) + 3 boutons.
- *Bienvenue* : lien « J'ai déjà une sauvegarde — la restaurer » → ouvre Sauvegarde (le profil par
  défaut existe : `ensureDefaultProfile`).
- *Textes* : relecture « tu » partout (`grep -rn "vous\|votre" src`), `À propos` intact (mention TMDB).
- *Critère de fin* : ☑ tests (dont `cloud.*`, sans modification) ☑ thème Auto : test unitaire du suivi en direct (l'émulation du panneau
  n'envoie pas l'événement : à confirmer sur téléphone) ☐ Drive : connexion, sauvegarde, restauration, conflit toujours
  fonctionnels (Kinder, sur téléphone) ☑ clair/sombre ☐ moteur Android (APK de fin de série).
- *Écarts constatés* : l'écran de conflit Drive garde sa logique ; il est restylé en bloc (la version « ce téléphone » n'a pas de
  résumé chiffré, donc pas de colonnes côte à côte : rien d'inventé). L'interrupteur de sauvegarde automatique est un vrai
  `.switch`. « Mes profils » affiche le nombre de titres (`listProfiles`). Messages passés au tutoiement (sauf l'erreur Google
  « Reconnectez-vous », figée par un test `cloud`). Bienvenue : lien « J'ai déjà une sauvegarde ».

**M7 — Dynamique** · planches : toutes, en sombre et clair
- *Transition d'onglet* : le contenu de la vue est enveloppé d'un `div` à clé `view` avec
  `.view-enter` (fondu + glissement 6 px, 180 ms) — pas rejouée au changement de sous-onglet ;
  coupée par `prefers-reduced-motion`.
- *Retour tactile* généralisé (`.settings__line--btn:active`, `.tile:active`, `.ligne-ami:active`,
  `.statuspick__btn:active`) ; vibration 10 ms sur « Marquer vu » et changement de statut
  (`navigator.vibrate?.(10)`).
- *Facultatif — bannière « À la une »* (Découvrir) : `toCardItem` gagne `backdropUrl`
  (`w780`, `backdrop_path`) ; premier titre de « Le meilleur de l'année » avec son fond, note et
  nombre de votes ; chargée seulement si visible. Si le rendu pèse sur un vrai téléphone : abandonner.
- *Critère de fin* : ☐ aucune saccade (essai de Kinder sur téléphone) ☑ `prefers-reduced-motion`
  respecté (règle globale existante) ☑ tests (320) ☐ moteur Android (APK de fin de série) ☑ plan et documentation mis à jour ;
  **chantier clos après l'essai de Kinder**.
- *Écarts constatés* : bannière « À la une » non faite (facultative, et son poids sur un vrai téléphone ne peut pas être jugé ici).
  Vibration de 10 ms (`tactile.js`) sur « Marquer vu », « Marquer le prochain », saison entière et changement de statut.

#### 7. Risques et garde-fous
- **Performance** : rangées chargées à l'approche de l'écran, images `loading="lazy"`, jamais plus
  de ~12 appels TMDB à l'ouverture de Découvrir ; fond d'écran (phase 7) chargé seulement si visible.
- **Régressions** : les 293 tests existants restent verts ; chaque règle nouvelle a ses tests.
- **Base** : aucune migration nécessaire (les colonnes utiles existent) ; si une est ajoutée, pas de
  commentaire SQL dans le schéma.
- **Cohérence Play Store** : rien dans cette refonte ne change les données collectées ; le partage
  reste derrière son interrupteur de compilation.
- **Lisibilité** : contrastes à vérifier en sombre sur les petits textes (`--muted`, légendes).

#### 8. Points validés par Kinder (2026-10-03) — figés
1. « Idée du soir » selon la règle §4.2. 2. Statistiques accessibles depuis Mes listes. 3. Rangée
d'avatars d'amis dans Découvrir. 4. Thème « Automatique ». 5. « Découverte » (Ce soir) et « Découvrir »
(onglet) gardés malgré l'homonymie, avec sous-titres explicites. 6. Bannière « À la une » en M7
seulement, facultative. **Ordre des missions : M2 → M7, une à la fois.**

**Trois points tranchés le 2026-10-03**
- *Reprise après réinstallation* : clé secrète tirée au hasard à l'activation, gardée sur le
  téléphone et dans la sauvegarde Drive, montrée une fois comme **code de récupération**. Le
  serveur ne garde que son empreinte publique ; la clé elle-même est rangée dans une zone
  illisible que seules les règles consultent. Sans clé ni Drive : nouvelle fiche, nouveau code.
  **À vérifier à l'étape 1** dans l'émulateur (fonction d'empreinte des règles Firebase) ; repli
  si elle manque : pas de reprise possible.
- *Taille* : plafond de **5 000 titres distincts** et **50 listes**, pseudo de 24 caractères,
  aucune date. Un titre présent dans plusieurs listes n'est envoyé qu'une fois (les listes
  pointent vers lui).
- *Code ami* : 12 caractères en 3 blocs de 4 (`K7F2-M9QX-3DTB`), sans caractères ambigus (0/O,
  1/I), saisie insensible à la casse, ~10¹⁸ combinaisons. Parcourir les fiches est interdit
  par les règles ; donné via la feuille de partage d'Android (pas de lien cliquable).
- Garde-fous : 100 amis par profil au maximum ; une fiche ami n'est relue qu'à l'ouverture de
  l'écran et au plus une fois par heure (copie gardée sur le téléphone).

**À trancher au moment du codage** : l'emplacement exact du réglage « privée » dans l'écran
d'une liste, et la liste des statuts privés par défaut (aucun).

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
  grise ; la liste des genres mettait côte à côte « Action » et « Action & Adventure »,
  « Science-Fiction » et « Science-Fiction & Fantastique » (**traité au point 14**) ; d'un tirage de suggestions à l'autre, 4 à 11 titres sur 30 reviennent
  (point 2, toujours ouvert).

### 14. Genres unifiés films + séries (2026-09-19) ✅
**Retour de Kinder** : en parcourant les genres avec le filtre Films ou Séries, certains ne
marchaient que pour l'un des deux. Cause : TMDB n'a pas la même liste de genres côté films
et côté séries (« Action » + « Aventure » contre « Action & Adventure » ; « Horreur »,
« Romance », « Histoire », « Musique » n'existent que pour les films ; « Kids », « News »,
« Reality » restaient en anglais). L'écran affichait les 27 et grisait ceux qui ne marchaient pas.

**Fait** : une **liste unique de 12 genres**, valable pour les deux (`GENRES` dans `tmdb.js`) —
Action & Aventure, Animation, Comédie, Crime, Documentaire, Drame, Famille & Enfants,
Science-Fiction & Fantastique, Mystère & Thriller, Guerre & Politique, Western, et
**Histoire & Époques**. Chaque entrée sait quoi demander pour un film et pour une série ; les
genres TMDB voisins s'additionnent (« au choix parmi »). Plus aucun bouton grisé, plus de nom
anglais ; les noms suivent la langue du catalogue.
- **Retirés volontairement** (choix de Kinder, pour garder une liste uniforme) : Horreur,
  Romance, Histoire (TMDB), Musique, Téléfilm, Talk, News, Reality, Soap. On retrouve ces titres
  par la recherche par titre.
- **« Histoire & Époques »** (ajout de Kinder : antiquité, vikings, moyen âge…) : TMDB n'a
  pas ce genre côté séries. Reconstitué par **mots-clés** (vikings, moyen âge, Rome, Grèce,
  Égypte, empire romain, Renaissance, drame historique). Côté séries on écarte l'animation :
  le mot-clé « medieval » ramène sinon des animés fantastiques (Re:ZERO, Frieren). Le mot-clé
  « period drama » est écarté : il mettait Mad Men et La Petite Maison dans la prairie
  devant Vikings et Rome. Le genre « Histoire » de TMDB pour les films, lui, est surtout fait
  de biographies et de guerres du XXe siècle : ce n'est pas ce que l'entrée promet.
- **Validé à l'écran** (largeur téléphone, vrai catalogue) : 12 genres sur 12 renvoient des
  résultats en Films, en Séries et en Tout, sans mélange ; « Histoire & Époques » donne Gladiator,
  Troie, La Momie côté films, Vikings, Spartacus, The Last Kingdom, Les Tudors, Shōgun côté séries.
- **Limite connue** : la liste « Histoire & Époques » reste bornée (~130 séries, ~370 films) ;
  elle dépend des mots-clés que les contributeurs de TMDB ont posés.
- **Tests** : `tests/genres.test.js` (8 tests) — chaque genre vaut pour les deux types, aucune
  des entrées retirées ne revient, l'animation est exclue des séries d'époque seulement.

## Retours utilisateur du 2026-09-21 — plan en 5 missions (FIGÉ le 2026-09-21)

**Liste d'origine, telle que reçue** (rien ne doit se perdre) :
1. Pouvoir voir une série ou un film plusieurs fois (×2, ×3, ×4…).
2. En optionnel, sur la fiche d'un film ou d'un épisode : la date de visionnage. Quand on coche
   un épisode dans « en cours », la date du jour se met automatiquement.
3. Dans la fiche d'un film ou d'une série : afficher en bas les titres similaires, en plus des
   éléments de la même saga.
4. Dans la fiche : le bandeau d'acteurs n'est pas cliquable ; le lier à la recherche des films
   de l'acteur.
5. Recherche : ajouter des filtres d'affichage (plateforme, année, autre) et des tris
   (popularité, récent, pas récent, autre).
6. Accueil de la recherche : l'affichage « Tendance du moment » devient un bouton, avec aussi
   « Nouveautés » et « À venir ».
7. Listes : ajouter aussi le tri et le filtre.
8. Fiche : liens vers les bandes-annonces et vers les plateformes (« je trouve un film, il est
   sur Netflix, je clique et je tombe dessus »).
9. « Packs de mood » (Noël, saga, love, super-héros…) remplis de films et séries ; réfléchir aux
   moods et à la façon de décider ce qu'on met dedans.

**Découpage validé** (une mission à la fois, testée avant la suivante) :
| Mission | Points | Contenu |
|---|---|---|
| **M1 — Fiche enrichie** | 3, 4, 8 (partiel) | acteurs cliquables, titres similaires, bande-annonce toujours présente |
| **M2 — Recherche et accueil** | 5, 6 | filtres et tri, Tendances / Nouveautés / À venir |
| **M3 — Listes** | 7 | tri et filtre (limité par ce qu'on stocke) |
| **M4 — Journal de visionnages** | 1, 2 | revoir ×N + date ; touche base, sauvegarde Drive, CSV, statistiques |
| **M5 — Packs mood** | 9 | règles d'entrée dans un pack à cadrer ; réutilise les filtres de M2 |

Points d'attention notés : M4 est un journal (un visionnage = une date), pas un compteur ; M3 :
genre et plateforme ne sont pas stockés dans le suivi ; M5 recoupe l'onglet « Découvrir » (§3).

### M1 — Fiche enrichie : décisions figées (2026-09-21) — ✅ codée et vérifiée, en attente de la capture de Kinder
**Fait le 2026-09-21** : 5 tests (`tests/fiche.test.js`), 154 tests verts au total ; parcours
vérifié dans un navigateur en largeur téléphone avec le vrai catalogue (Resident Evil → acteur
Austin Abrams → sa filmographie → « Retour à la fiche » ; 12 titres « Dans le même esprit »
ouvrables). Un défaut trouvé et corrigé en route : la barre de recherche relançait une
recherche vide au changement de mode et effaçait la filmographie (`acteurParFiche` dans
`App.jsx`). Reste à confirmer sur l'appareil : le retour Android depuis la filmographie.
- **D1 — Acteur cliquable.** Le clic ouvre Recherche en mode acteur, sur la filmographie
  (films + séries) de cet acteur, **par identifiant TMDB** (pas par nom : homonymes). Casting
  de 8 à 12 noms. Le retour ramène à la fiche d'origine.
- **D2 — « Dans le même esprit ».** Recommandations TMDB (source déjà utilisée par les
  suggestions), en bas de la fiche après le casting ; cartes identiques à la saga (liseré
  d'état, pastille d'ajout, appui long) ; les titres déjà suivis **restent affichés**. La
  saga reste à sa place. Ajuste la décision du 2026-08-10 sans créer de seconde source.
- **D3 — Liens plateformes / JustWatch : ABANDONNÉ (Kinder, 2026-09-21).** Aucun bouton ni
  logo cliquable vers les plateformes. « Où le voir en France » reste informatif, mention
  JustWatch / TMDB conservée. Ne pas rouvrir sans demande de Kinder.
- **D4 — Bande-annonce.** Le bouton actuel reste ; sans vidéo TMDB, il devient « Chercher la
  bande-annonce » (recherche YouTube « titre + année + bande-annonce »).
- **Hors M1** : aucun changement de base ni de sauvegarde, pas de lecteur vidéo intégré.
- **Critère de validation (Kinder, 2026-09-21)** : « Sur la fiche d'un film ou d'une série, je
  touche un acteur et je vois ses films et séries. En bas de la fiche, je vois « Dans le même
  esprit » avec des titres que je peux ouvrir ou ajouter. Un titre sans bande-annonce a quand
  même un bouton qui me mène à sa recherche YouTube. »
- **Cadrage technique (phase 5)** — fichiers touchés :
  - `tmdb.js` : casting à 12 avec l'identifiant TMDB de chaque acteur ; `getActorFilmography(id)`
    (même filmographie que la recherche par nom, factorisée) ; `urlRechercheBandeAnnonce()` +
    repli quand TMDB n'a pas de vidéo.
  - `api.js` : deux portes (`getActorFilmography`, `getRecommendations`).
  - `Detail.jsx` : acteurs cliquables, bloc « Dans le même esprit », libellé du bouton.
  - `App.jsx` : ouvrir un acteur = onglet Recherche en mode acteur ; mémoire de la fiche
    d'origine, retour Android et bouton « Retour à la fiche ».
  - `styles.css` : acteur = bouton, rangée de similaires.
  - `tests/fiche.test.js` : lien de recherche de bande-annonce, casting avec identifiants.

### M2 — Recherche et accueil : décisions figées (2026-09-21)
M1 validée par Kinder le 2026-09-21.
- **D1 — Le mode « Genre » devient « Explorer ».** Le genre y devient facultatif : sans genre,
  la découverte porte sur tout le catalogue, par popularité, avec les filtres seuls.
- **D2 — Filtres dans « Explorer »** (bouton « Filtres », panneau, point quand un filtre est
  actif, bouton « Réinitialiser ») : **Plateforme** (principales de la région du catalogue,
  plusieurs au choix), **Année** (Cette année, 2020s, 2010s, 2000s, 90s, Avant 1990),
  **Tri** (Popularité par défaut, Plus récent = déjà sorti seulement, Plus ancien, Mieux notés
  = avec un minimum de votes).
- **D3 — Titre et Acteur : Année et Tri seulement**, appliqués aux résultats déjà affichés
  (TMDB ne filtre pas la recherche par titre). Pas de plateforme dans ces deux modes ; le
  panneau le dit.
- **D4 — Accueil : boutons Tendances / Nouveautés / À venir** (Tendances par défaut), avec le
  filtre Tout / Films / Séries, sans filtres plateforme ni année. Nouveautés = sorties des
  60 derniers jours ; À venir = sorties dans les 90 jours ; les deux par popularité. Les titres
  déjà suivis restent masqués, comme pour les tendances.
- **Hors M2** : pas de mémorisation des filtres d'une fois sur l'autre, pas d'onglet
  « Découvrir » distinct, aucun changement de base ni de sauvegarde.
- **Critère de validation (Kinder, 2026-09-21)** : « Sur l'accueil de la recherche, je touche
  Nouveautés puis À venir et la liste change à chaque fois. Dans Explorer, sans choisir de
  genre, je choisis une plateforme et une période (2010s), et je vois des titres de cette
  plateforme sortis à cette période. Je change le tri en Plus récent, puis en Mieux notés, et
  l'ordre change. Dans Acteur, je filtre par année et je trie sans relancer la recherche. »
- **Cadrage technique (phase 5)** — fichiers touchés : `filtres.js` (nouveau, logique pure :
  périodes, tris, filtre/tri d'une liste affichée) ; `tmdb.js` (filtres envoyés à `discover`,
  fusion films + séries selon le tri, `getPlateformes`, `getRubrique`) ; `api.js` (3 portes) ;
  `components/Filtres.jsx` (nouveau, panneau) ; `App.jsx` (mode Explorer, rubriques de
  l'accueil, filtres) ; `styles.css` ; `tests/recherche.test.js`.
- **Fait le 2026-09-21** ✅ codée et vérifiée, en attente de la capture de Kinder : 21 tests
  (`tests/recherche.test.js`), 175 tests verts au total ; parcours vérifié dans un navigateur
  en largeur téléphone avec le vrai catalogue (3 rubriques → 3 listes différentes ; Explorer
  sans genre + Netflix + 2010s → séries de 2011 à 2018 ; Plus récent → 2019 en tête ; Plus
  ancien → 2010 ; Mieux notés → autre ordre ; Réinitialiser ; Acteur « Tom Hanks » + 90s + tris
  sans aucun nouvel appel TMDB).
- **Écarts avec le cadrage, décidés en route** : (1) « Plateforme » ne se limite pas à
  l'abonnement : la liste de TMDB contient des boutiques (Apple TV Store, Google Play…) qui
  n'auraient jamais rien donné en abonnement seul ; on filtre donc sur « disponible chez elle ».
  (2) Sans genre, les talk-shows, journaux et télé-réalité sont écartés côté séries (un talk-show
  de 1962 remontait en tête). (3) Retoucher le genre déjà choisi le retire ; retoucher
  « Explorer » ne vide plus l'écran. (4) Les filtres sont remis à zéro quand on change de mode.
- **Limites connues** : la liste des plateformes est celle de TMDB (« JustWatch TV », « INA
  madelen » y figurent) ; dans Titre, le filtre d'année ne porte que sur les ~20 résultats de
  TMDB. Reste à confirmer sur l'appareil : le geste au doigt sur les chips de filtres.

### M3 — Listes : tri et filtre — décisions figées (2026-09-21)
M2 validée par Kinder le 2026-09-21.
- **D1 — Tri** : Ajouté récemment (défaut, ordre actuel ; dans une liste perso = ajouté à cette
  liste), Titre A → Z, Sortie la plus récente, Sortie la plus ancienne, Ma note (non-notés à la
  fin). Films toujours groupés au-dessus des Séries ; le tri joue dans chaque groupe.
- **D2 — Filtres** : **Année** (mêmes périodes que la recherche, sur la date de sortie) et
  **Ma note** (Toutes / 4 étoiles et plus / Pas encore noté). Tout / Films / Séries inchangé.
  Les compteurs des statuts restent les totaux réels, indifférents aux filtres.
- **D3 — Genre et plateforme : PAS dans M3, reportés (noté pour plus tard).** Le genre demande
  une colonne en base (migration, sauvegarde, rattrapage réseau de tous les titres déjà suivis)
  sur une base que M4 va modifier ; la plateforme change avec le temps, la stocker serait faux.
  Si le besoin revient : genre en colonne remplie à l'ajout + rattrapage au lancement, comme
  `backfillReleaseDates`.
- **D4 — Présentation** : bouton « Filtres » (point quand actif) et panneau identiques à la
  recherche, avec « Réinitialiser ». Pendant une recherche dans la bibliothèque, le panneau
  disparaît et le tri reste A → Z. Tri et filtres gardés **pour la séance** (on les retrouve en
  changeant de statut, de liste ou d'onglet), jamais enregistrés d'une session à l'autre.
- **Hors M3** : aucun changement de base ni de sauvegarde, pas de genre ni de plateforme, pas de
  tri par durée.
- **Critère de validation (Kinder, 2026-09-21)** : « Dans Mes listes, en Vu, je trie par Titre
  A → Z puis par Ma note et l'ordre change. Je filtre 2010s et il ne reste que des titres de
  cette période. Je filtre 4 étoiles et plus et il ne reste que mes titres bien notés. Je change
  de statut : le tri reste. Je touche Réinitialiser : tout revient comme avant. »
- **Cadrage technique (phase 5)** — fichiers touchés : `filtres.js` (tris et filtres de la
  bibliothèque, logique pure) ; `components/Filtres.jsx` (rendu réutilisable : tris, filtre de
  note, indication plateforme facultatifs) ; `components/Lists.jsx` ; `App.jsx` (état gardé
  pour la séance) ; `styles.css` ; `tests/listes.test.js`. Pas de changement dans `store.js` :
  « Ajouté récemment » est l'ordre déjà reçu de la base (le tri le conserve tel quel).

- **Fait le 2026-09-21** ✅ codée et vérifiée, en attente de la capture de Kinder : 13 tests
  (`tests/listes.test.js`), 188 tests verts au total ; parcours vérifié dans un navigateur en
  largeur téléphone sur une bibliothèque de 16 titres réels (7 « Vu » notés) : Titre A → Z, Ma
  note (égalités dans l'ordre reçu, non-notés à la fin), 2010s → Toy Story 3, Toy Story 4,
  Sully ; « 4 étoiles et plus » → 5 titres ; changement de statut → tri et filtres conservés
  (compteurs des statuts inchangés : 9 / 0 / 7 / 0) ; retour d'onglet → état conservé ;
  recherche dans la bibliothèque → panneau caché, ordre A → Z, filtres intacts après effacement ;
  Réinitialiser → ordre d'origine, point éteint.
- **Comportement à connaître** : un filtre de note dans « À voir » ne montre rien tant qu'on n'a
  rien noté — c'est voulu, un titre pas vu n'a en général pas de note (le message « Aucun
  résultat pour ce filtre » s'affiche).
- **Reporté** : genre et plateforme dans « Mes listes » (D3).

### M4 — Journal de visionnages : codée et vérifiée (2026-09-23)
M3 validée par Kinder. **Tranche sensible** (comme la tranche 2 de `PLAN_ANDROID.md`) : c'est la
première mission de cette série qui touche la base, la sauvegarde et l'export — une erreur ici
abîmerait des données réelles, pas seulement un affichage. Cadrage écrit avant tout code, décisions
validées par Kinder, code fait ensuite.
- **Ce que ça couvre** : points 1 et 2 de la liste d'origine — revoir un titre plusieurs fois, et
  la date de visionnage.
- **D1 — Un journal, pas un compteur.** Aujourd'hui `suivi.status = 'vu'` ne dit qu'un booléen.
  Revoir une série suppose de garder **une ligne par visionnage** (date, et pour une série
  laquelle regardée — tout ou en partie ?), pas juste un nombre : un nombre ne permettrait pas
  de répondre plus tard à « la dernière fois, c'était quand ? ». Nouvelle table proposée,
  `visionnages` (`profile_id, tmdb_id, media_type, date`), à côté de `suivi` — pas dedans : une
  colonne compteur casserait la distinction visionnage/statut le jour où on voudrait le détail.
- **D2 — Date automatique, un geste pour ajouter un visionnage de plus.** Cocher un épisode pose
  la date du jour (point 2) ; un bouton sur la fiche (« Je l'ai revu ») ajoute un visionnage à la
  date du jour, modifiable ensuite. Aucune saisie obligatoire : la fonction reste facultative,
  comme demandé.
- **D3 — Décision de Kinder (2026-09-23) : par épisode.** Un revisionnage se pose au niveau de
  l'épisode (série) ou du film, pas seulement du titre : revoir S2E01 précisément, pas juste
  « revu la série ». C'est l'option la plus fidèle à la demande, et la plus lourde à construire
  (table, écran, sauvegarde, CSV, statistiques en quadruple) — assumé.
- **Ce qui a été fait** :
  - `db.js` : table `visionnages` (`profile_id, tmdb_id, media_type, season_number, episode_number,
    date`) — vide pour un film, remplis pour une série. `CREATE TABLE IF NOT EXISTS` dans le
    schéma existant : pas de migration spéciale, les bases déjà installées la reçoivent au
    prochain lancement, sans toucher à leurs données.
  - `store.js` : `addVisionnage`, `listVisionnages`, `deleteVisionnage`. Posé automatiquement à la
    date du jour par `markEpisode` (un épisode réellement nouveau, pas un double clic) et par
    `setStatus` (un film qui **devient** « Vu », pas qui y reste) ; les raccourcis en bloc
    (`markWholeSeason`, `markSeriesWatched`) ne posent un visionnage que pour les épisodes
    qui n'étaient pas déjà cochés — recocher une saison déjà vue n'en rajoute aucun.
  - `backup.js` : `BACKUP_VERSION` passe à 3, le journal est exporté et restauré comme le reste
    (remplacé, pas fusionné) ; une sauvegarde d'avant M4 (sans journal) se restaure sans erreur.
    Export CSV Letterboxd : la date de visionnage vient désormais du **dernier** visionnage réel
    quand il y en a un, sinon retombe sur la date d'ajout comme avant.
  - `Detail.jsx` : bouton « J'ai revu ce film » (compte + date du dernier) ; par épisode déjà
    coché, une pastille ↻ discrète (avec « ×N » au-delà d'une fois) qui ajoute un visionnage sans
    toucher à la case ni tout redéplier.
  - **`Stats.jsx` non touché, décision assumée** : « temps passé » continue de compter les titres
    et épisodes distincts, pas les revisionnages — un film revu deux fois ne double pas le total.
    C'est le choix le plus prudent (celui qui ne change pas un chiffre déjà affiché) ; à revoir si
    Kinder préfère l'inverse.
- **Hors M4** : pas de rappel ni de suggestion basée sur « ça fait longtemps » — cadré au point 9
  (packs), pas ici.
- **Critère de validation (à essayer par Kinder)** : « Je marque un film « Vu », la fiche affiche
  la date. Je touche « J'ai revu ce film » : le compte passe à 2. Sur une série, je coche un
  épisode : une pastille ↻ apparaît dessus ; je la touche, elle affiche « ×2 », la case reste
  cochée. »
- **Fait le 2026-09-23** ✅ codée et vérifiée, en attente de l'essai de Kinder : 16 tests
  (`tests/visionnages.test.js`), 211 tests verts au total. Parcours vérifié dans un navigateur en
  largeur téléphone avec le vrai catalogue : Matrix Reloaded marqué « Vu » → « Vu le [date] »
  affiché tout de suite ; Resident Evil (série), E01 coché → pastille ↻ sans compteur ; touchée
  une fois → « ↻ ×2 », case toujours cochée, autres épisodes intacts.
- **Défaut trouvé et corrigé en route** : le compte affiché sur la fiche ne se mettait pas à jour
  tout de suite après avoir marqué « Vu » (visible seulement après avoir touché « J'ai revu » une
  fois, ou rouvert la fiche) — l'effet qui charge le journal ne dépendait pas du statut. Corrigé
  (`status` ajouté aux dépendances côté film ; le rechargement du journal déplacé dans
  `refreshProgress` côté épisode, déjà appelée par les quatre actions de cochage).
- **Retour de Kinder, sur l'appareil (2026-09-23)** : « je ne vois pas le nombre de fois que j'ai
  vu un film si je l'ai vu plusieurs fois et je ne peux pas revenir en arrière ». Le simple texte
  (« Vu N fois, la dernière le… ») ne suffisait pas et rien ne permettait de corriger un clic de
  trop — ni sur un film, ni sur un épisode.
- **Corrigé (2026-09-23)** : la fiche d'un film affiche désormais un **historique**, une ligne par
  visionnage avec sa date et une corbeille pour la retirer (le visionnage posé par erreur, pas
  forcément le plus ancien — chaque ligne est indépendante). Sur un épisode déjà coché, la pastille
  ↻ (ajouter un visionnage) est accompagnée d'une corbeille dès qu'il y en a un, pour retirer le
  dernier posé sans décocher l'épisode.
- **Vérifié dans un navigateur en largeur téléphone** : Matrix avec 3 visionnages (dont un posé à
  la date du jour) affiche « Vu 3 fois » et les 3 lignes ; retirer celle du jour ramène le journal
  à 2 lignes, vérifié par lecture directe de la base.
- **Reste à confirmer sur l'appareil** : rien de spécifique à M4 au-delà des gestes déjà en
  attente (appui long, photo d'avatar, bouton retour, restauration Drive).

### M5 — Packs de mood : décisions figées (2026-09-23)
Couvre le point 9. Dépend de M2 (réutilise les filtres et `GENRES` de `tmdb.js`) ; peut se faire
avant ou après M4, aucune des deux ne dépend de l'autre.

- **D1 — Voie retenue : mots-clés TMDB (voie 2), comme « Histoire & Époques ».** Écartées : la
  voie « genre seul » (ne couvre pas Noël ni le braquage) et la voie « recherche Explorer
  sauvegardée » (répond à un autre besoin — mes recherches à moi — pas à des rayons éditorialisés
  prêts à l'emploi, qui est la demande d'origine).
- **D2 — 4 moods retenus pour le lancement, chacun vérifié sur le vrai catalogue TMDB avant
  d'être choisi** (2026-09-23) :

  | Mood | Films | Séries |
  |---|---|---|
  | Super-héros | mots-clés `superhero` (9715) + `based on comic` (9717) | mêmes mots-clés |
  | Braquage | mot-clé `heist` (10051) | mot-clé `heist` (10051) |
  | Halloween | genre Horreur (27) | mot-clé `horror` (315058) — TMDB n'a pas de genre Horreur côté séries |
  | Romance | genre Romance (10749) | *(pas de mood série — voir D3)* |

  Testés et écartés du lancement, tous les deux pour la même raison : le nettoyage qu'ils
  demanderaient dépasse celui d'un mood ordinaire (comme « Histoire & Époques » en son temps) —
  reportés, pas abandonnés :
  - **Noël** : le mot-clé `christmas` seul est pollué (toute scène de Noël dans n'importe quel
    film le déclenche — Harry Potter, Iron Man 3 remontaient). **Genre Famille (10751) + mot-clé
    `christmas` (207317)** donne une liste propre côté films (Le Grinch, Maman j'ai raté l'avion,
    La vie est belle). Côté séries, même filtre : 19 résultats, presque tous des séries
    scandinaves obscures — pas assez pour un rayon présentable.
  - **Love pour les séries** : TMDB n'a pas de genre Romance côté séries. Le mot-clé `romance`
    seul mélange animes et séries dramatiques sans rapport (Better Call Saul, This is Us) —
    demanderait le même travail d'exclusions que « Histoire & Époques » (écarter l'Animation,
    poser un seuil de votes), non fait à ce stade.
- **D3 — Romance et Halloween en « Tout » seulement** (pas de filtre Films/Séries séparé pour
  Romance, faute d'équivalent série ; Halloween marche pour les deux, il garde le filtre normal).
- **Saga : PAS un mood, décision assumée.** Ce n'est pas un classement TMDB (genre ou mot-clé) :
  c'est déjà couvert par la fiche d'un film (rayon « Saga », fait en M1-avant). En faire un pack
  de découverte demanderait de choisir *quelles* sagas mettre en avant, ce qui est un autre
  sujet. Retiré du périmètre M5.
- **Recoupe l'onglet « Découvrir »** noté dans « Ce qui reste ouvert » de `PROJET_CONTEXTE.md` —
  M5 en couvre une partie (rayons par thème) ; le reste (compléter une saga, angles morts,
  disponible sur mes plateformes) reste noté là, non cadré.
- **Présentation, revue le 2026-09-23** : d'abord posés à côté de Tendances / Nouveautés / À venir
  dans l'accueil de la recherche (voir plus bas) — **retiré de là à la demande de Kinder**, qui
  préfère un onglet séparé. Voir « Onglet Découvrir » ci-dessous.
- **Hors M5** : pas de mood personnalisé (créer son propre pack), pas de mémoire de mood
  préféré, pas de mélange de plusieurs moods à la fois.
- **Critère de validation (à essayer par Kinder)** : « Dans l'accueil de la recherche, je touche
  Super-héros et je vois des films et séries de super-héros reconnus. Je touche Braquage,
  Halloween, Romance : chacun donne une liste cohérente avec son thème, sans titre qui n'a rien
  à voir. »
- **Cadrage technique (phase 5)** — fichiers touchés : `tmdb.js` (table `MOODS`, sur le modèle de
  `GENRES` ; fonction `discoverByMood`) ; `api.js` (`getMoods`, `discoverMood`) ; `App.jsx`
  (moods ajoutés à la rangée de rubriques de l'accueil, chargés par la même fonction
  `chargerAccueil` que Tendances/Nouveautés/À venir) ; `tests/moods.test.js`.

- **Fait le 2026-09-23** ✅ codée et vérifiée, en attente de l'essai de Kinder : 6 tests
  (`tests/moods.test.js`), 194 tests verts au total. Parcours vérifié dans un navigateur en
  largeur téléphone avec le vrai catalogue : les 4 boutons apparaissent à côté de Tendances /
  Nouveautés / À venir ; Super-héros donne Avengers, The Boys, Arrow, Flash ; Romance (Tout)
  donne Titanic, Forrest Gump, aucune série (comme prévu) ; Halloween en Séries donne
  Supernatural, American Horror Story, Stranger Things.
- **Écart avec le cadrage, corrigé en route** : deux des quatre moods, vérifiés à l'origine sans
  aller au-delà de la première page TMDB, se sont révélés moins propres une fois les 3 pages
  chargées d'un coup (comme le reste de l'accueil) :
  - **Romance** n'avait pas de seuil de votes : sur 60 titres, les films confidentiels
    noyaient Titanic et Forrest Gump. Seuil ajouté (`vote_count.gte=200`, comme le tri « Mieux
    notés » d'Explorer).
  - **Halloween côté séries** ne renvoyait **rien du tout** : TMDB n'a pas de genre Horreur pour
    les séries (seulement pour les films). Remplacé par le mot-clé `horror`, avec un seuil de
    votes — propre (Supernatural, Stranger Things).
- **Reste à confirmer sur l'appareil** : rien de spécifique aux moods — mêmes gestes que le
  reste de l'accueil, déjà couverts par l'essai téléphone en attente.

#### Onglet Découvrir — demande de Kinder (2026-09-23), faite
Après l'essai sur téléphone, Kinder demande de sortir les moods de l'accueil de la recherche et
d'en faire un onglet à part : « les paramètres en haut avec le profil, dans les onglets en bas on
va remplacer l'onglet Réglages par Découvrir et mettre notamment le mood dedans ».
- **Réglages** : déjà accessible depuis l'avatar en haut à droite (`goTo('settings')` sur
  l'en-tête) — rien à changer côté accès ; c'est la ligne « Réglages » du bas qui disparaît,
  devenue redondante.
- **Nouvel onglet Découvrir**, en bas à la place de Réglages (icône boussole) : les 4 moods,
  « Choisis un rayon ci-dessus » tant qu'aucun n'est choisi, puis le filtre Tout/Films/Séries et
  la grille, avec « Voir plus » — même mécanique de pagination que l'accueil de la recherche, mais
  un état et une fonction de chargement séparés (`chargerDecouvrir`, indépendante de
  `chargerAccueil`) : changer de mood dans Découvrir ne touche pas à Tendances/Nouveautés/À venir,
  et inversement.
- **Accueil de la recherche** : revenu à Tendances / Nouveautés / À venir seulement.
- **Vérifié dans un navigateur en largeur téléphone** : accueil de la recherche sans les moods ;
  onglet Découvrir accessible en bas (icône boussole), 4 moods proposés ; Halloween → Supernatural,
  American Horror Story, The Walking Dead, Stranger Things ; filtre Films → 0 série parmi les
  résultats ; Réglages toujours joignable depuis l'avatar.
- **Cadrage technique** : `Icon.jsx` (icônes `compass`, `trash`) ; `App.jsx` (état et fonction
  `chargerDecouvrir` séparés, bloc `view === 'discover'`, tabbar) ; 211 tests toujours verts
  (aucun test dédié à la navigation par onglets, déjà hors du périmètre testé automatiquement).

### M6 — Sauvegarde Drive : deux appareils (cadrage validé et codé le 2026-09-24)

**Validé par Kinder, codé le 2026-09-24** : `backup.js` (versions, `ConflitSauvegarde`), `Backup.jsx` (encadré de conflit), `tests/cloud.conflit.test.js` (8 tests, faux Drive). Non vérifié : Drive réel avec deux appareils.

**Le risque.** Aujourd'hui la sauvegarde écrase le fichier Drive sans regarder s'il a changé. Un
vieux téléphone rouvert après un mois, ou une réinstallation où l'on a refusé la restauration,
peut donc remplacer un suivi récent par un suivi ancien. C'est la seule perte de données encore
possible dans le circuit de sauvegarde (audit du 2026-09-24).

**Option retenue : détecter, ne jamais fusionner, ne jamais écraser sans demander.**
- À chaque envoi, l'appli retient la « version » que Drive a donnée à chaque fichier (sa date de
  modification, fournie par Drive lui-même, donc sans dépendre de l'heure du téléphone).
- Avant d'envoyer, elle compare avec la version qu'elle connaît. Identique : envoi normal.
  Différente : quelqu'un d'autre a écrit depuis — **c'est un conflit**, et rien n'est écrasé.
- **Sauvegarde automatique** : renonce en silence, garde le rappel levé, note « conflit » dans le
  dernier essai. Jamais d'écran surprise.
- **Bouton manuel** : un écran clair avec deux choix — « Garder ce que j'ai sur ce téléphone »
  (écrase le Drive) ou « Reprendre la version du Drive » (remplace le téléphone, avec le résumé
  habituel : titres, épisodes, date). Pas de fusion : la décision « restaurer remplace, ne mélange
  pas » reste vraie.
- Fichier présent sur le Drive mais jamais vu par cet appareil : traité comme un conflit, sauf si
  l'appareil a déjà sauvegardé avant cette mise à jour (sinon tous les utilisateurs actuels
  verraient un faux conflit) : dans ce cas la version du Drive est adoptée en silence, une fois.

**Pourquoi pas une fusion.** Fusionner deux suivis suppose de trancher les suppressions (un titre
retiré ici mais présent là-bas est-il à garder ?). Sans horodatage par ligne, on ferait des
erreurs silencieuses — pire que de demander. Deux appareils qui modifient le même profil en même
temps restent un cas rare pour une appli à usage personnel.

**Fichiers touchés** : `backup.js` (comparaison, versions rangées sur l'appareil), `google.js`
(l'envoi rend déjà la date de modification), `Backup.jsx` (écran de conflit), `App.jsx` (bandeau si
conflit). Tests : conflit détecté, envoi normal, adoption silencieuse des utilisateurs existants,
automatique qui ne demande rien, chacun des deux choix.

**Ce qui reste non vérifiable ici** : le comportement réel de Drive avec deux vrais appareils.

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

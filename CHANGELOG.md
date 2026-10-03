# CHANGELOG — Vault Watch

> Ce qui a changé, version par version. Le détail des décisions vit dans `PLAN_V2.md`,
> `PLAN_ANDROID.md` et `PROJET_CONTEXTE.md`. Écrit le 2026-09-19 à partir de ces fichiers et de
> l'historique de versions.

## Version 2.3 (versionCode 7) — préparée le 2026-10-03, à publier
- Regroupe la refonte visuelle, les amis par code (partage allumé dans la version publiée), les notifications
  corrigées et la miniature d'avatar. Règles Firebase déployées, politique de confidentialité mise à jour.
  Marche à suivre : `PLAN_ANDROID.md`, « Publication de la 2.3 ».

## Retours d'essai de la refonte (2026-10-03)
- **Notifications** : le test (et les vraies notifications de sortie) n'apparaissaient pas, car Android retardait
  l'alarme programmée. Elles s'affichent maintenant tout de suite.
- **Avatar des amis** : une photo d'avatar part dans la fiche en miniature de 48 px (au lieu de rien : les amis
  voyaient un rond doré avec l'initiale). Nécessite de déployer les règles Firebase ; voir `PLAN_V2.md`, point 4 bis.

## Refonte visuelle, M6 et M7 — Réglages, données, mouvement (2026-10-03, codées, à essayer sur téléphone)
- **Thème à trois états** : Automatique (suit le téléphone, y compris quand il change), Clair, Sombre. Un choix
  déjà fait avant reste respecté.
- **Mes profils** en cartes (nombre de titres, profil actif cerclé d'or). **Sauvegarde, Notifications, À propos** en
  blocs ; l'interrupteur de sauvegarde automatique est un vrai interrupteur ; messages de réussite / d'erreur
  homogènes. La mention TMDB de « À propos » est intacte. Aucune logique de sauvegarde, Drive ou profil touchée.
- **Bienvenue** : « J'ai déjà une sauvegarde — la restaurer » ouvre l'écran de sauvegarde.
- **Textes** : tutoiement partout (Sauvegarde, À propos, messages de fichier et de compte Google).
- **Mouvement** : fondu et glissement de 6 px au changement d'onglet (pas rejoué entre sous-onglets), retour
  tactile sur les lignes et tuiles, vibration de 10 ms en marquant « vu » ou en changeant de statut. Coupé si le
  téléphone demande moins d'animations.
- **Pas fait** : la bannière « À la une » de Découvrir (facultative).

## Refonte visuelle, M5 — Recherche et états partout (2026-10-03, codée)
- **Quatre états** : chargement en formes fantômes (plus aucun « Chargement… »), vide expliqué, hors connexion
  (« Pas de connexion » + Réessayer) sur la Recherche, Découvrir, Suggestion et Découverte.
- **Recherche** : en-tête « Résultats N », « Aucun résultat » / « Tu as déjà tout » en messages illustrés ;
  Explorer : les genres défilent sur une ligne.
- **Zones tactiles** : les petits boutons (Tout/Films/Séries, puces, « Tout voir ») ont une zone d'au moins 44 px.
- `reseau.js` (détection du réseau, testé), `Fantomes.jsx`, `HorsLigne.jsx`.

## Refonte visuelle, M4 — Mes listes et Statistiques (2026-10-03, codée, à essayer sur téléphone)
- **Mes listes** : un bandeau de trois chiffres (titres, vus, note moyenne) qui ouvre les Statistiques ; les
  quatre statuts en tuiles avec une jauge ; les listes personnalisées en cartes à mosaïque (4 affiches) avec
  une carte « Nouvelle liste » ; une liste ouverte montre son nom, son compte, « Ajouter », « Supprimer » et
  l'interrupteur « Visible par tes amis » (si le partage est actif) ; les genres du filtre défilent.
- **États vides** : bibliothèque, liste, statut, recherche sans résultat ; formes fantômes au chargement.
- **Statistiques** : mêmes chiffres en blocs, plus « Genres les plus regardés » (top 5 des titres vus ou en
  cours, signalé « Nouveau », masqué s'il n'y a aucun genre connu).
- **Données** : `listListes` renvoie `covers` ; `getStats` renvoie `parGenre` ; `resumeBiblio` (tests).

## Refonte visuelle, M3 — Ce soir (2026-10-03, codée, à essayer sur téléphone)
- **Idée du soir** : une grande carte (affiche floutée en fond) propose un titre « à voir » déjà sorti,
  tiré au sort une fois par jour : la même toute la journée, même après relance. « Autre idée » passe à
  la suivante sans jamais répéter tant qu'il en reste. Elle indique depuis quand le titre attend dans ta
  liste. « Voir la fiche » l'ouvre. Pas de carte s'il n'y a rien « à voir ».
- **Reprendre** : rangée d'affiches avec une barre de progression (vus / diffusés) et l'épisode suivant.
- **À voir ce soir** : rangée + « Tout voir » (grille complète).
- **Pas encore sorti** : une ligne repliée (nombre de titres, prochaine date) qui se déplie.
- **Découverte** : une seule grille films + séries, formes fantômes pendant la recherche ; **Suggestion** : puces défilantes.
- **Bibliothèque vide** : message et bouton « Chercher un titre ». Bandeau « pas encore sauvegardé » restylé.
- **Données** : `listSuivi` renvoie la date d'ajout ; règle de l'idée du soir dans `idee.js` (tests).
- Les barres repliables de couleur (`Bloc`) disparaissent. Plus aucun « Chargement… » dans Ce soir.

## Refonte visuelle, M2 — Fiches film et série (2026-10-03, codée, à essayer sur téléphone)
- **Fiche** : fond d'écran + affiche + titre et pastilles (année, durée ou saisons, genres) ; la
  flèche de retour reste visible quand on fait défiler. `Detail.jsx` garde l'état ; l'affichage
  est dans `FicheEntete`, `FicheStatut`, `FicheProgression`, `FicheSaisons`.
- **Film** : 4 statuts, étoiles + bande-annonce sur une carte, « Où le regarder » avec les vrais
  logos, synopsis replié (« Lire la suite »), têtes d'affiche, « Mes visionnages », avis, « Dans le
  même esprit » et saga en rangées, mes listes.
- **Série** : le statut est **calculé** d'après les épisodes (pastille) ; seul « Abandonner » est
  manuel, « Reprendre le suivi » en sort. Anneau vus / diffusés, carte « Prochain épisode » avec sa
  date de diffusion et un bouton « Marquer SxEy comme vu » (sans ouvrir la saison), « À jour » ou
  « Pas encore diffusée » sinon. Saisons dépliables, coche ronde par épisode.
- **États** : chargement en formes fantômes ; hors connexion, la fiche garde titre et affiche et
  propose « Réessayer » ; titre non suivi : « Ajouter à mon suivi ». « Retirer de mon suivi » est
  en bas de la fiche.
- **Données** : `getProgress().next` porte `airDate` ; `getDetails` renvoie la durée du film et le
  nombre de saisons (déjà dans la réponse TMDB, aucun appel de plus).
- Texte du bouton doré et lien rouge un peu plus foncés (contraste ≥ 4,5 en clair).

## Retours d'essai du 2026-10-03 — codés, vérifiés dans le navigateur en largeur téléphone
- **Dates de visionnage** : chaque visionnage (film ou épisode) a une date qu'on peut
  modifier ; un titre vu avant le journal propose « Saisir la date » (rien d'obligatoire).
  Le 1er visionnage est repéré. Un bouton calendrier sous chaque épisode vu montre ses dates.
- **« J'ai revu toute la saison »** : +1 visionnage sur chaque épisode déjà vu de la saison.
- **Recherche / Ce soir** : la recherche à vide ne garde qu'une vue Tendances. « Ce soir » a
  trois sous-onglets : En attente (inchangé), **Découverte** (l'ancien « Suggestions »),
  **Suggestion** (Tendances / Nouveautés / À venir).
- **Mes listes** : filtre par **genre** (nouvelle colonne `genres`, remplie à l'ajout et
  rattrapée au lancement pour les titres déjà suivis ; incluse dans la sauvegarde).
- **Découvrir** : trois étages — « Pour toi » (Comme [un titre aimé]), « Sélections » (Pépites
  cachées, Soirée courte, Grands classiques, Le meilleur de l'année), « Thèmes » (les 4 packs)
  — et un filtre « Sur mes plateformes » retenu d'un lancement à l'autre.
- **Refonte visuelle validée** (2026-10-03) : missions M2 à M7 cadrées techniquement dans
  `PLAN_V2.md` (protocole, pièges, tests, critères de fin) ; suivi par tableau.
- **Refonte visuelle : plan complet écrit** (`PLAN_V2.md`, « Refonte visuelle — PLAN COMPLET ») et
  maquette de 30 écrans vérifiée contre le code (7 phases, 6 points à valider).
- **Passe de design, phase 1** : Découvrir en rangées d'affiches façon catalogue (« Tout voir »
  pour la grille), en-têtes de page et de section communs, « Reprendre » en rangée, blocs et
  interrupteurs pour Profil partagé / Amis, chargements fantômes, apparitions douces, flèche de
  retour à gauche. Détail et reste à faire : `PLAN_V2.md`.
- **Amis par code — étapes 1 et 2 codées** (cadrage et détail : `PLAN_V2.md`, point 4 bis) :
  règles de sécurité Firebase publiées et testées ; Réglages > « Profil partagé » (code ami,
  code de récupération, statuts et listes privés). Facultatif, désactivé par défaut.
  Étape 3 : Réglages > « Mes amis » (ajouter par code, voir ses listes, ses étoiles, ajouter à
  son suivi).
  Pas de publication Play Store tant que le questionnaire et la politique de confidentialité ne
  sont pas mis à jour.

## Notifications de sortie — codées, restent à valider sur téléphone (figé le 2026-09-27)
Notifier l'utilisateur quand un film suivi sort au cinéma, quand une série suivie diffuse un
nouvel épisode, ou quand une nouvelle saison est annoncée (périmètre : listes, favoris, likes).
Détail des décisions dans `PROJET_CONTEXTE.md`, section « Décisions figées ». Découpée en étapes,
chacune testée avant la suivante :
- **Étape 1 — badge de sortie sur la fiche**, codée et vérifiée à l'écran le 2026-09-27 : une
  fiche suivie affiche « Sort le… », « Sortie annoncée — date inconnue », « Prochain épisode
  le… » ou « Nouvelle saison à venir — date inconnue », selon ce que TMDB sait au moment de
  l'ouverture.
- **Étape 2 — cycle de vérification au lancement**, codée et vérifiée en base le 2026-09-27 :
  deux colonnes ajoutées au suivi (`notif_date`, `notif_en_attente`) ; un cycle, au lancement,
  ne revérifie que les titres « en attente » d'une date, sort du cycle un titre déjà sorti,
  une série terminée, ou un titre marqué « Vu »/« Abandonné ».
- **Étape 3 — activation des notifications**, codée le 2026-09-27 : dépendance
  `@capacitor/local-notifications` ajoutée, nouvel écran Réglages → Notifications (autorisation
  + notification de test).
- **Étape 4 — la vraie notification**, codée et vérifiée en base le 2026-09-27 : à chaque
  lancement, après le cycle, les titres « en attente » dont la date est atteinte sont notifiés
  puis sortent définitivement du cycle. Sans autorisation accordée, rien n'est consommé — le
  titre reste en attente jusqu'à ce que les notifications soient activées.
- **Les 4 étapes du figeage sont codées.** Reste à vérifier sur ton téléphone : l'autorisation
  système, la notification de test (étape 3) et une vraie notification de sortie (étape 4) — ni
  l'une ni l'autre ne peuvent se tester dans le navigateur.

## 2.3 — en préparation (retours d'usage du 2026-09-21, missions M1 à M5 dans `PLAN_V2.md`)
**M1 — Fiche enrichie** (2026-09-21) :
- Fiche d'un film ou d'une série : toucher un acteur ouvre la liste de ses films et séries
  (par son identifiant, pas par son nom), avec « Retour à la fiche ». Casting de 8 à 12 noms.
- Fiche : bloc « Dans le même esprit » en bas, avec les mêmes cartes que la saga.
- Fiche : sans bande-annonce chez TMDB, le bouton devient « Chercher la bande-annonce » et
  ouvre la recherche YouTube. Liens vers les plateformes : abandonnés (décision de Kinder).

**M2 — Recherche et accueil** (2026-09-21) :
- Accueil de la recherche : trois boutons « Tendances / Nouveautés / À venir » à la place du
  titre fixe. Nouveautés = sorties des 60 derniers jours, À venir = celles des 90 jours qui viennent.
- Le mode « Genre » devient « Explorer » : le genre est facultatif, et un bouton « Filtres »
  ouvre plateforme (celles de ta région), année (par période) et tri (Popularité, Plus récent,
  Plus ancien, Mieux notés).
- Recherche par Titre et par Acteur : filtre d'année et tri sur les résultats affichés, sans
  relancer la recherche.

**M3 — Mes listes** (2026-09-21) :
- « Mes listes » : un bouton « Filtres » (même panneau que la recherche) pour trier — Ajouté
  récemment, Titre A → Z, Sortie récente, Sortie ancienne, Ma note — et filtrer par année et
  par note (4 étoiles et plus / pas encore noté). Films et séries restent groupés. Tri et filtres
  sont gardés tant que l'application tourne. Pas de genre ni de plateforme : reporté.

**M1 à M3 validées à l'écran le 2026-09-23** (fiche → acteur → filmographie → retour ; accueil ;
Explorer avec filtres ; Mes listes filtrées), 188 tests verts.

**M5 — Packs de mood, codée et vérifiée le 2026-09-23** (194 tests verts) :
- Super-héros, Braquage, Halloween, Romance (films). Chacun vérifié sur le vrai catalogue.
- Noël et Love-séries reportés (nettoyage supplémentaire nécessaire, comme pour le genre
  Histoire & Époques). Saga retirée du périmètre : déjà couverte par la fiche d'un film.
- **Retour de Kinder après essai sur téléphone : les moods déménagent de l'accueil de la
  recherche vers un nouvel onglet « Découvrir »**, en bas à la place de « Réglages » — Réglages
  reste joignable depuis l'avatar en haut, comme avant.

**M4 — Journal de visionnages, codée et vérifiée le 2026-09-23** (211 tests verts) :
- Fiche d'un film suivi : bouton « J'ai revu ce film », avec le nombre de fois et la date du
  dernier visionnage. Se pose automatiquement à la date du jour la première fois qu'un film
  passe à « Vu ».
- Fiche d'une série : pastille ↻ sur un épisode déjà coché pour le revoir, sans décocher ni
  rouvrir la saison ; affiche « ×N » au-delà d'une fois.
- Sauvegarde (Drive et fichier) : le journal est emporté et restauré (`BACKUP_VERSION` 3) ;
  une sauvegarde plus ancienne se restaure sans erreur, simplement sans journal.
- Export CSV Letterboxd : la date de visionnage vient désormais du dernier visionnage réel
  quand il y en a un.
- `Stats.jsx` inchangé par choix assumé : le temps passé compte les titres vus, pas le nombre
  de fois où ils ont été revus.
- **Retour de Kinder après essai sur téléphone : le compte n'était pas assez visible et rien ne
  permettait de corriger un clic de trop.** Le texte est remplacé par un **historique** (une
  ligne par visionnage, une corbeille pour la retirer) sur la fiche d'un film, et une corbeille
  ajoutée à côté de la pastille ↻ d'un épisode.

**Audit de la sauvegarde Drive, correctifs du 2026-09-24** (213 tests verts) :
- Une modification faite pendant un envoi n'est plus déclarée « sauvegardée » : le rappel reste
  levé et la sauvegarde suivante l'emporte.
- La restauration d'un profil est « tout ou rien » : si l'appli est coupée en route, le profil
  reste exactement comme avant au lieu de rester vide.

**M6 — Deux appareils sur le même Drive, codée le 2026-09-24** (221 tests verts) :
- La sauvegarde ne remplace plus un fichier Drive qu'un autre appareil a modifié depuis la
  dernière fois : elle s'arrête avant d'écrire quoi que ce soit (aucun profil n'est envoyé).
- Sauvegarde automatique : renonce en silence, garde le rappel, note « conflit » dans le dernier essai.
- Bouton manuel : un encadré montre ce que contient le Drive et propose « Reprendre la version du
  Drive », « Garder ce téléphone » ou « Décider plus tard ». Pas de fusion.
- Appareil déjà sauvegardé avant cette version : adopte celle du Drive sans fausse alerte.

## 2.2 — en préparation (pas encore publiée)
Passe de corrections issue des retours d'usage du 2026-09-10, faite le 2026-09-11 et validée à
l'écran dans un navigateur en largeur téléphone le 2026-09-19 (`PLAN_V2.md`, point 13).
- « Ce soir » : « Pas encore sorti » passe en dernier et replié ; bouton « Actualiser » aussi
  en bas des suggestions ; suggestions moitié films, moitié séries.
- Recherche par genre, par acteur et tendances : les titres déjà suivis sont masqués.
- Fiche d'un film : les autres films de sa saga, dans l'ordre de sortie.
- Correction de la grille qui se désalignait après un long défilement par genre.
- Un profil supprimé ne revient plus en restaurant depuis le Drive.
- « Mes listes » : recherche d'un titre dans toute la bibliothèque, sans accents ni majuscules.
- Tendances du moment : environ 60 titres, « Voir plus », filtre Films / Séries.
- Recherche par genre : une liste unique de 12 genres, valable pour les films comme pour les
  séries (fini les boutons grisés et les doublons « Action » / « Action & Adventure »), avec un
  nouveau genre « Histoire & Époques » (antiquité, vikings, moyen âge). Horreur, Romance,
  Histoire (TMDB) et Musique n'y sont plus : TMDB ne les connaît pas pour les séries.
- Sauvegarde automatique d'Android coupée (`allowBackup`) : les données de suivi ne partent
  plus que vers le Drive de l'utilisateur, comme la décision l'exige.
- **À confirmer sur téléphone avant publication** : appui long sur la saga, photo d'avatar,
  bouton retour, restauration Drive.
- Version portée à `versionCode 6` / `versionName 2.2` le 2026-09-19 ; paquet signé prêt, à déposer
  dans la Play Console après l'essai sur téléphone (`PLAN_ANDROID.md`).
- Fichiers d'aide du serveur (`start.bat`, Dockerfile, docker-compose.yml) marqués « inutilisé ».

## 2.1 — publiée le 2026-09-03
Application publiée sous le nom « Vault Watch » (la 2.0 portait l'ancien nom).

## 2.0 — publiée le 2026-08-27
Application Android autonome : plus aucun serveur, catalogue TMDB en direct, suivi dans une base
SQLite embarquée, sauvegarde dans le Drive de l'utilisateur.
- Sauvegarde automatique (renouvellement silencieux de l'autorisation Drive, sauvegarde au départ
  et au retour, interrupteur dans l'écran Sauvegarde).
- Notes (étoiles et avis) et statistiques.
- Profils locaux avec avatar (couleur et symbole, ou photo), création, renommage, suppression.
- Date de sortie selon le pays de la langue du catalogue.
- Ajout groupé à une liste, blocs repliables dans « Ce soir ».
- Abandonné : la connexion aux comptes Netflix, Canal+ et Disney+.

## Avant 2.0 — application web (usage PC)
V1 : chercher, suivre, cocher les épisodes, progression et prochain épisode. V2 : refonte
visuelle, fiche détail riche, 4 statuts et listes personnalisées, page « Ce soir ». La version PC
n'est plus maintenue (décision du 2026-08-17).

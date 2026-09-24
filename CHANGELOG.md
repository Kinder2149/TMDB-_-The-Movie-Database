# CHANGELOG — Vault Watch

> Ce qui a changé, version par version. Le détail des décisions vit dans `PLAN_V2.md`,
> `PLAN_ANDROID.md` et `PROJET_CONTEXTE.md`. Écrit le 2026-09-19 à partir de ces fichiers et de
> l'historique de versions.

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

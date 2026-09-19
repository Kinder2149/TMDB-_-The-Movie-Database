# CHANGELOG — Vault Watch

> Ce qui a changé, version par version. Le détail des décisions vit dans `PLAN_V2.md`,
> `PLAN_ANDROID.md` et `PROJET_CONTEXTE.md`. Écrit le 2026-09-19 à partir de ces fichiers et de
> l'historique de versions.

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
- Version à porter : `versionCode 6` / `versionName 2.2` (publié aujourd'hui : 5 / 2.1).

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

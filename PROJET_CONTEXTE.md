# PROJET_CONTEXTE — Suivi Films & Séries

## But du projet
Application personnelle de suivi de films et séries, en remplacement de TVShowTime (arrêté).
Permet de savoir, pour chaque film ou série, ce qu'on a vu, ce qu'on veut voir, et — pour les séries — d'en suivre la progression épisode par épisode.

## Où en est le projet (2026-08-27)
**Application Android publiée, version 2.0.** Elle tourne entièrement sur le téléphone :
plus aucun serveur, plus aucun back. Le catalogue vient de TMDB en direct, le suivi vit
dans un SQLite embarqué, et la sauvegarde va dans le Google Drive de l'utilisateur.

Le dossier `server/` est conservé dans le dépôt comme base d'une éventuelle mise en ligne
future — il n'est plus utilisé par l'application.

## Utilisateur & horizon
- **Aujourd'hui** : usage personnel, sur téléphone, hors ligne pour le suivi (le réseau ne
  sert qu'au catalogue). Gestion de **profils locaux** : plusieurs profils sur le même
  appareil, sans compte ni mot de passe.
- **Cible gardée, non décidée** : mise en ligne et ouverture à quelques proches. Voir
  « Ce qui reste ouvert ».

## Profils
Le suivi appartient à un **profil** identifié par un **UUID portable** (pas un numéro de
ligne local). Raison : c'est la brique qui permet, le jour d'une mise en ligne, de rattacher
un profil local à un compte en ligne **sans re-migrer ni perdre ses données**. C'est aussi
ce qui fait fonctionner la sauvegarde et la restauration entre appareils.
- Profils locaux, choisis / créés / renommés / **supprimés** depuis l'écran « Mes profils ».
- Chacun a son **avatar** : une couleur et un symbole, ou une photo de la galerie.
- Aucun mot de passe. Les données d'un profil ne quittent l'appareil que par une sauvegarde
  demandée ou automatique, vers le Drive de l'utilisateur.

## Source des données
Les métadonnées (titres, synopsis, casting, saisons, épisodes, affiches, durées, dates de
sortie, disponibilité en streaming) proviennent de l'API **TMDB**, dans la langue choisie.
Les services de streaming n'exposent pas ces données : TMDB est la seule source.

## Périmètre construit
1. **Chercher** un film ou une série : par titre, par acteur, par genre.
2. **Suivre** un titre, avec 4 statuts : à voir, en cours, vu, abandonné.
3. **Marquer vu** : film binaire ; série = épisodes cochés, avec raccourcis « toute la
   saison » et « toute la série » (qui ne cochent que ce qui est **diffusé**).
4. **Progression** d'une série et **prochain épisode**, calculés sur les épisodes réellement
   sortis — pas sur ceux seulement annoncés.
5. **Listes personnalisées**, remplissables en masse depuis la bibliothèque.
6. **Note personnelle** : étoiles et avis écrit.
7. **Statistiques** : temps passé, bibliothèque, répartition, note moyenne.
8. **« Quoi regarder ce soir ? »** : reprendre une série, pas encore sorti, à voir,
   suggestions.
9. **Sauvegarde** : fichier local, export CSV Letterboxd, et Drive de l'utilisateur —
   manuelle ou automatique en quittant l'application.

## Architecture (3 couches, strict)
Tout tient dans `client/`, il n'y a plus de séparation par processus :
- **UI** : les écrans React (`client/src/components/`).
- **Logique** : `store.js` (règles métier), `backup.js` (sauvegarde), `api.js` (porte unique
  entre l'UI et le reste).
- **Données** : `db.js` (SQLite embarqué) et `tmdb.js` (catalogue externe).

Une seule pièce écrite spécialement pour Android : `DriveAuthPlugin.java`, qui renouvelle
l'autorisation Drive sans réafficher l'écran de compte Google.

## Décisions figées
- **Aucun serveur, aucun hébergement.** La clé TMDB est embarquée dans l'application, risque
  accepté et documenté.
- **Aucune monétisation** : ni application payante, ni abonnement, ni publicité. Franchir
  cette ligne imposerait la licence commerciale TMDB.
- **Mention TMDB obligatoire** dans l'application, et ne jamais masquer son identité auprès
  de l'API.
- **Les données personnelles restent sur l'appareil**, sauf sauvegarde demandée par
  l'utilisateur vers **son propre** Drive. L'éditeur n'a aucun accès, aucun serveur, aucune
  copie.
- **Abandonné (2026-08-27) : la connexion aux comptes Netflix, Canal+ et Disney+.** Aucun de
  ces services n'expose l'historique d'un compte personnel, et s'y connecter à la place de
  l'utilisateur serait interdit par leurs conditions autant que fragile. Si le besoin
  revient, la seule voie acceptable est l'**import d'un fichier que l'utilisateur exporte
  lui-même**, ou un intermédiaire à API publique comme Trakt. Ne pas rouvrir le sujet du
  côté « se connecter à leur place ».
- **Le code serveur n'est pas supprimé** : il reste dans le dépôt comme base d'une
  éventuelle mise en ligne. Mis de côté, pas jeté.

## Contraintes projet
- 3 couches uniquement (UI / Logique / Données).
- Maximum 5 fichiers de documentation : `PROJET_CONTEXTE.md`, `PLAN_V2.md`,
  `PLAN_ANDROID.md`, `README.md`, `STACK_STANDARD.md`.
- Aucune structure créée « pour le futur ».
- Le plafond V1 « 20 modules » a été volontairement relevé pour la V2 (voir `PLAN_V2.md`).

## Ce qui reste ouvert
- **La mise en ligne** — idée conservée, **non décidée**. Elle conditionne tout ce qui est
  social (voir les profils d'autres utilisateurs, partager des listes). Ce n'est pas une
  fonction de plus : c'est le moment où l'application cesse d'être locale, avec hébergement,
  comptes, base PostgreSQL, données partagées, RGPD et modération. À trancher comme une
  décision de projet, pas comme une tranche de développement.
- Les idées de fonctions notées dans `PLAN_V2.md` (onglet « Découvrir », suggestions moins
  redondantes, ordre des blocs), chacune à cadrer séparément.

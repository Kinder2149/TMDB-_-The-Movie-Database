# PROJET_CONTEXTE — Vault Watch

## But du projet
Application personnelle de suivi de films et séries, en remplacement de TVShowTime (arrêté).
Permet de savoir, pour chaque film ou série, ce qu'on a vu, ce qu'on veut voir, et — pour les séries — d'en suivre la progression épisode par épisode.

## Où en est le projet (2026-09-19)
**Application Android publiée sous le nom « Vault Watch », version 2.1** (2026-09-03 — la 2.0 du
2026-08-27 portait l'ancien nom). Une passe de corrections issue des retours du 10 septembre est
faite ; elle a été **validée à l'écran dans un navigateur en largeur téléphone le 2026-09-19**
(aucun défaut). Restent à confirmer sur l'appareil les seuls gestes propres au téléphone
(appui long, photo d'avatar, bouton retour, restauration Drive), puis publication en 2.2 (paquet signé prêt depuis le 2026-09-19).
Elle tourne entièrement sur le téléphone :
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
1. **Chercher** un film ou une série : par titre, par acteur, par genre. Par acteur, par genre
   et dans les tendances, les titres déjà suivis sont masqués.
2. **Suivre** un titre, avec 4 statuts : à voir, en cours, vu, abandonné.
3. **Marquer vu** : film binaire ; série = épisodes cochés, avec raccourcis « toute la
   saison » et « toute la série » (qui ne cochent que ce qui est **diffusé**).
4. **Progression** d'une série et **prochain épisode**, calculés sur les épisodes réellement
   sortis — pas sur ceux seulement annoncés.
5. **Listes personnalisées**, remplissables en masse depuis la bibliothèque.
6. **Note personnelle** : étoiles et avis écrit.
7. **Statistiques** : temps passé, bibliothèque, répartition, note moyenne.
8. **« Quoi regarder ce soir ? »** : reprendre une série, à voir, pas encore sorti (en
   dernier, replié), et suggestions à parts égales films / séries.
9. **Sauvegarde** : fichier local, export CSV Letterboxd, et Drive de l'utilisateur —
   manuelle ou automatique en quittant l'application.
10. **Saga** : dans la fiche d'un film, les autres films de sa saga dans l'ordre de sortie.

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
- **Pas de sauvegarde automatique d'Android (2026-09-19).** Le réglage `allowBackup` est
  coupé : Android ne copie pas la base de suivi vers le compte Google du téléphone. La seule
  voie de sauvegarde est celle vers le Drive de l'utilisateur, déjà en place et validée sur
  l'appareil. Verrouillé par un test (`configuration.test.js`). Prend effet avec la 2.2.
- **Le code serveur n'est pas supprimé** : il reste dans le dépôt comme base d'une
  éventuelle mise en ligne. Mis de côté, pas jeté.
- **Rattachement : socle Application locale React** (D40 de la Révision Outil IA, 2026-09-18), avec l'option sauvegarde vers le Drive de l'utilisateur. L'ancienne stack V1 est archivée dans `_archives\STACK_STANDARD_V1.md`.
- **Notifications de sortie (figé le 2026-09-27).** Notifier l'utilisateur quand un film suivi
  sort au cinéma, quand une série suivie diffuse un nouvel épisode, ou quand une nouvelle saison
  est annoncée. Périmètre : listes, favoris et likes de l'utilisateur.
  1. Si TMDB donne déjà une date connue au moment où l'élément est suivi, une notification
     locale est programmée pour ce jour-là, une seule fois — pas de revérification pour cet
     élément.
  2. Si la date n'est pas encore connue, l'élément passe au statut « en attente » et entre dans
     un cycle de vérification périodique.
  3. Le cycle ne traite que les éléments « en attente » (jamais toute la bibliothèque), tourne au
     maximum une fois par jour, déclenché au lancement de l'application — pas de tâche de fond,
     pas de serveur.
  4. Le cycle corrige aussi une date qui aurait changé (report de sortie) tant que l'élément est
     « en attente ».
  5. Un élément notifié ou marqué « terminé » sort définitivement du cycle.
  6. Compromis accepté : si l'application reste fermée le jour J, la notification part en retard,
     au prochain lancement.
  7. Nouvelle dépendance validée : un plugin de notifications locales Android pour Capacitor
     (ex. `@capacitor/local-notifications`), l'application n'ayant aujourd'hui aucun moyen de
     notifier hors de l'application ouverte.

- **Refonte visuelle (figée le 2026-10-03).** Identité conservée (crème, doré, titres serif) ; une
  hiérarchie de titres, des échelles communes, des blocs communs ; Découvrir en rangées d'affiches ;
  quatre états par écran (chargé, chargement en fantômes, vide, hors connexion). Plan complet,
  maquette (30 écrans) et missions M1 à M7 : `PLAN_V2.md`, « Refonte visuelle — PLAN COMPLET ».
  Une mission à la fois, essayée sur téléphone par Kinder avant la suivante. M1 et M2 validées ; M3 à M7 codées le 2026-10-03 (Kinder teste à la fin de la série, décision du jour) ; chantier clos après son essai sur téléphone.
- **Règle de schéma (2026-10-03).** Aucun commentaire SQL ni apostrophe/point-virgule parasite dans le
  schéma de `db.js` : le moteur SQLite du téléphone s'y étrangle et l'application ne démarre plus.

## Contraintes projet
- 3 couches uniquement (UI / Logique / Données).
- Maximum 5 fichiers de documentation : `PROJET_CONTEXTE.md`, `PLAN_V2.md`,
  `PLAN_ANDROID.md`, `README.md`, `CHANGELOG.md`.
- Aucune structure créée « pour le futur ».
- Le plafond V1 « 20 modules » a été volontairement relevé pour la V2 (voir `PLAN_V2.md`).

## Ce qui reste ouvert
- **Amis par code (codé, embarqué dans la 2.3 le 2026-10-03 ; ex-« cadré, rien de codé »)** : fiche partagée facultative sur
  Firebase, sans compte, sauvegarde privée toujours sur le Drive de l'utilisateur. Si elle est
  construite, elle **modifie** deux décisions figées (« aucun serveur », « données sur
  l'appareil ») — uniquement pour cette fiche facultative — et impose de mettre à jour le
  questionnaire Play Store et la politique de confidentialité *avant* publication. Détail dans
  `PLAN_V2.md`, point 4 bis.
- **La mise en ligne** — idée conservée, **non décidée**. Elle conditionne tout ce qui est
  social (voir les profils d'autres utilisateurs, partager des listes). Ce n'est pas une
  fonction de plus : c'est le moment où l'application cesse d'être locale, avec hébergement,
  comptes, base PostgreSQL, données partagées, RGPD et modération. À trancher comme une
  décision de projet, pas comme une tranche de développement.
- Les idées notées dans `PLAN_V2.md` et pas encore faites : l'onglet « Découvrir » (à cadrer)
  et les suggestions qui reviennent trop souvent (attend une capture de Kinder).
- **Retours d'usage du 2026-09-10** : tous traités le 2026-09-11 et validés à l'écran le
  2026-09-19 (détail dans `PLAN_V2.md`, point 13). **Reste l'essai sur l'appareil** pour les
  gestes propres au téléphone, puis publication en 2.2.

## Décision du 2026-10-03 — la 2.3 publie les amis
Le partage (amis par code) est allumé dans la version publiée (`client/.env.production`). Les deux décisions figées
« aucun serveur » et « données sur l'appareil » sont donc modifiées pour cette seule fiche facultative (Firebase).
L'avatar en photo part en miniature de 48 px. Politique de confidentialité et formulaire Play Store mis en conformité.

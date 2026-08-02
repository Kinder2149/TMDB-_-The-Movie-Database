# PROJET_CONTEXTE — Suivi Films & Séries

## But du projet
Application personnelle de suivi de films et séries, en remplacement de TVShowTime (arrêté).
Permet de savoir, pour chaque film ou série, ce qu'on a vu, ce qu'on veut voir, et — pour les séries — d'en suivre la progression épisode par épisode.

## Utilisateur & horizon
- **V1** : usage personnel, en local. Gestion de **profils locaux** (voir plus bas) :
  plusieurs profils possibles sur le même PC, sans compte ni mot de passe.
- **V2** (plus tard, non construit maintenant) : mise en ligne et ouverture à quelques proches / une petite communauté.

## Profils (déviation validée — voir STACK_STANDARD.md)
Le suivi appartient désormais à un **profil** identifié par un **UUID portable**
(pas un numéro de ligne local). Raison : c'est la brique qui permet, en V2, de
rattacher un profil local à un compte en ligne **sans re-migrer ni perdre ses données**.
- V1 : profils locaux, choisis/créés/renommés depuis l'UI ; aucun mot de passe.
- Les données personnelles restent dans la base locale (`server/data/`, ignorée par git) :
  elles ne partent jamais avec le code partagé.
- Reporté à plus tard : export/import d'un profil (sauvegarde/restauration), suppression
  de profil, rattachement à un vrai compte (auth).

## Source des données
Les métadonnées (titres, années, synopsis, casting, saisons, épisodes, affiches) proviennent de l'API **TMDB** (gratuite), en **français**.
Les services de streaming (Netflix, Disney+, Canal+…) n'exposent pas ces données : TMDB est la seule source.

## Périmètre V1 — la boucle (ce qui est construit)
1. **Chercher** un film ou une série (via TMDB).
2. **L'ajouter** à son suivi.
3. **Marquer vu / pas vu** :
   - Film : vu / à voir (binaire).
   - Série : cocher les épisodes vus, saison par saison.
4. **Voir la progression** d'une série et le **prochain épisode** à regarder.
5. **Deux listes** qui se remplissent automatiquement à partir de ce qui précède : « À voir » et « Vu / En cours ».

## Hors périmètre V1 (noté, PAS construit)
- Calendrier des prochaines sorties d'épisodes
- Notes / avis personnels
- Statistiques de visionnage
- Alertes / notifications de nouvel épisode
- Comptes utilisateurs / connexion
- Toute fonction sociale

## Architecture (3 couches, strict)
- **UI** : le site web (responsive, PC + mobile).
- **Logique** : le back (API).
- **Données** : base locale + TMDB comme source externe.

## Contraintes projet
- Maximum 20 modules/services.
- 3 couches uniquement (UI / Logique / Données).
- Maximum 5 fichiers de documentation.
- Aucune structure créée « pour le futur ».
- V1 : profils locaux (UUID portable), sans compte ni mot de passe.
- V1 : tout tourne sur un seul PC, en local (pas de serveur distant).

## Ce qui change en V2 (référence, non construit en V1)
- Passage en ligne (hébergement + accès depuis l'extérieur).
- Ajout des comptes utilisateurs.
- Migration de la base locale vers PostgreSQL.

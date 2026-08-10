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
1. **Refonte visuelle** — appliquer la direction validée à l'app existante (thème, navigation, cartes).
2. **Page détail riche** — `append_to_response=credits,videos` + `/watch/providers` (streaming FR).
3. **Listes approfondies** — passer de 2 listes auto à **4 statuts** (dont « Abandonné », « En cours » explicite) **+ listes custom** (nouvelle table de listes). Retouche du modèle de données, scopée par profil.
4. **Recherche affinée** — recherche instantanée ; par acteur (`/search/person`) ; par genre (`/discover`).
5. **Suggestions** — `/recommendations` + `/similar` agrégés depuis la liste « Vu » du profil.
6. **Page « Quoi regarder ce soir ? »** — assemble en cours + à voir + suggestions.

## Décisions figées
- On **relève volontairement** le plafond V1 « 20 modules / rien pour le futur » : il protégeait la V1, la V2 assume plus de modules (proprement).
- On **reste sur TMDB** comme source unique (la clé BetaSeries de Kinder est gardée en réserve, non utilisée).
- Le **streaming** est affiché via TMDB/JustWatch avec la mention d'attribution (pas de lien de lecture direct).
- Tout le peaufinage se fait **en local (SQLite)**. La mise en ligne (comptes + PostgreSQL) viendra après, en s'appuyant sur l'UUID de profil déjà en place.

## Hors périmètre V2 (noté, pas construit)
- Calendrier des prochaines sorties / notifications de nouvel épisode.
- Notes / avis / statistiques personnelles.
- Fonctions sociales.

## Prochaine étape
Découper le **chantier 1 (refonte visuelle)** en tranches — c'est le point de départ validé,
car il conditionne où vivront le détail, les listes et les suggestions.

## Audit de reprise (2026-08-06)
**Constat :** du travail V2 est **en cours et non commité** — `git status` montre `Detail.jsx`, `Tonight.jsx`, `status.js`, `server/src/db/listes.repo.js`, `server/src/routes/browse.js` ajoutés (non trackés) et `SeriesDetail.jsx` supprimé, plus des modifications sur `App.jsx`, `api.js`, `Lists.jsx`, `MovieCard.jsx`, `SearchBar.jsx`, plusieurs fichiers serveur. Cela correspond visiblement aux chantiers 2 (page détail), 3 (listes) et 6 (« Quoi regarder ce soir ? » — `Tonight.jsx`) amorcés en parallèle, sans qu'aucun ne soit marqué terminé ici. Pas de `CHANGELOG.md` dans le projet pour tracer ce qui a été réellement livré.

**Backlog (reprise) :**
1. Committer ou clarifier l'état du travail en cours avant de reprendre — plusieurs chantiers V2 semblent démarrés en parallèle (Detail, Tonight, listes), contrairement à la règle « une tranche à la fois, testée avant la suivante » énoncée plus haut dans ce fichier.
2. Créer `CHANGELOG.md` — absent malgré un historique de sessions déjà riche (V1 bouclée + début V2).
3. Vérifier que `server/src/db/listes.repo.js` et `browse.js` correspondent bien au chantier 3/4 prévu, et mettre à jour la section « Chantiers V2 » avec leur statut réel (aucun n'est encore marqué ✅).
4. Rafraîchir `graphify-out/` après le prochain commit — le graphe actuel ne reflète pas ces fichiers non commités.

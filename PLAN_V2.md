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
Les 6 chantiers sont terminés (voir état réel ci-dessus). Place au chantier suivant hors de ce plan
(mise en ligne, ou nouveau besoin à cadrer).

## Audit de reprise (2026-08-06)
**Constat :** du travail V2 est **en cours et non commité** — `git status` montre `Detail.jsx`, `Tonight.jsx`, `status.js`, `server/src/db/listes.repo.js`, `server/src/routes/browse.js` ajoutés (non trackés) et `SeriesDetail.jsx` supprimé, plus des modifications sur `App.jsx`, `api.js`, `Lists.jsx`, `MovieCard.jsx`, `SearchBar.jsx`, plusieurs fichiers serveur. Cela correspond visiblement aux chantiers 2 (page détail), 3 (listes) et 6 (« Quoi regarder ce soir ? » — `Tonight.jsx`) amorcés en parallèle, sans qu'aucun ne soit marqué terminé ici. Pas de `CHANGELOG.md` dans le projet pour tracer ce qui a été réellement livré.

**Backlog (reprise) :**
1. Committer ou clarifier l'état du travail en cours avant de reprendre — plusieurs chantiers V2 semblent démarrés en parallèle (Detail, Tonight, listes), contrairement à la règle « une tranche à la fois, testée avant la suivante » énoncée plus haut dans ce fichier.
2. Créer `CHANGELOG.md` — absent malgré un historique de sessions déjà riche (V1 bouclée + début V2).
3. Vérifier que `server/src/db/listes.repo.js` et `browse.js` correspondent bien au chantier 3/4 prévu, et mettre à jour la section « Chantiers V2 » avec leur statut réel (aucun n'est encore marqué ✅).
4. Rafraîchir `graphify-out/` après le prochain commit — le graphe actuel ne reflète pas ces fichiers non commités.

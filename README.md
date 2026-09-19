# Vault Watch

Application Android de suivi personnel de films et séries. Publiée sur le Play Store
(version 2.0). Voir `PROJET_CONTEXTE.md` (vision, périmètre, décisions figées) et
la section Décisions figées de PROJET_CONTEXTE.md (stack).

## Architecture (3 couches)

Tout vit dans `client/` : l'application est autonome, il n'y a **plus de serveur**.

- **UI** — `client/src/components/` (React + Vite)
- **Logique** — `client/src/store.js` (règles du suivi), `backup.js` (sauvegarde),
  `api.js` (porte unique entre l'UI et le reste)
- **Données** — `client/src/db.js` (SQLite embarqué) et `client/src/tmdb.js` (catalogue TMDB)

Deux moteurs pour la même base, derrière une seule porte : le SQLite natif d'Android sur
téléphone, `sql.js` dans le navigateur pour développer. Le SQL est rigoureusement le même.

Une seule pièce écrite pour Android :
`client/android/app/src/main/java/com/kinder/suivifilmsseries/DriveAuthPlugin.java`.

> `server/` est conservé comme base d'une éventuelle mise en ligne future. **Il n'est plus
> utilisé** et n'a pas besoin d'être lancé.

## Prérequis

- Node.js 18 ou plus.
- Une clé API TMDB (gratuite) : https://www.themoviedb.org/settings/api (clé **v3 auth**).
- Pour construire l'application Android : le SDK Android et le JDK d'Android Studio.

## Installation

```bash
cd client
npm install
```

Puis copier `client/.env.example` en `client/.env` et y coller les clés :

```
VITE_TMDB_API_KEY=votre_cle_ici
VITE_GOOGLE_CLIENT_ID=...   # facultatif : sans lui, pas de sauvegarde Drive
```

## Développer dans le navigateur

```bash
npm run dev --prefix client
```

La base vit alors dans le stockage du navigateur. La connexion Google, elle, n'existe
**que** dans l'application installée : l'écran de sauvegarde cloud le dit et se désactive.

## Construire l'application Android

```bash
npm run build --prefix client
cd client && npx cap sync android
cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug
```

`JAVA_HOME` est nécessaire : le Java installé par défaut sur le poste est trop ancien pour
Gradle. L'APK de test sort dans
`client/android/app/build/outputs/apk/debug/app-debug.apk`.

Pour la version publiable (demande `client/android/signature.properties`, jamais dans le
dépôt) : `./gradlew bundleRelease` →
`client/android/app/build/outputs/bundle/release/app-release.aab`.

## Tests

```bash
npm test --prefix client
```

Tourne hors ligne, en quelques secondes, et couvre :

- **la base embarquée** — schéma réellement créé, suppressions en cascade, migration d'une
  base déjà installée sur un téléphone ;
- **les règles du suivi** — statuts, épisodes, progression et prochain épisode calculés sur
  les épisodes **diffusés**, raccourcis « saison vue » / « série vue », listes
  personnalisées, notes, statistiques, langue et dates de sortie par pays ;
- **les profils** — avatar, contenu annoncé avant suppression, refus de supprimer le
  dernier ;
- **la sauvegarde** — exporter / réinstaller / restaurer doit rendre exactement l'état
  d'origine, sans jamais fusionner ni toucher aux autres profils ;
- **la sauvegarde cloud** — ce que l'application demande au Drive, et ce qu'elle fait de ses
  refus ; **la sauvegarde automatique** — ce qui part tout seul et surtout ce qui ne part
  pas (jamais d'écran Google, un échec ne s'efface jamais en silence) ;
- **le paramétrage** — clés TMDB et Google, identifiants Android, clé de signature, et
  l'assurance qu'aucun secret n'est entré dans le dépôt.

Le test de signature affiche l'**empreinte SHA-1** de la clé : à comparer une fois avec
celle enregistrée dans le client OAuth Android de la console Google Cloud (cette
comparaison-là ne peut pas être automatisée).

Pour vérifier que les services réels répondent (appelle vraiment TMDB) :

```bash
npm run test:services --prefix client
```

Ces tests-là verrouillent des pièges constatés en vrai : la date de sortie française d'un
film qui a connu des ressorties en salle, et le dernier épisode réellement diffusé d'une
série.

## Ce que fait l'application

Chercher (titre, acteur, genre) · suivre avec 4 statuts · cocher les épisodes, à l'unité, par
saison ou d'un coup · voir sa progression et son prochain épisode · listes personnalisées ·
notes et avis · statistiques de visionnage · profils multiples avec avatar · « Quoi regarder
ce soir ? » · sauvegarde locale, export CSV Letterboxd, et sauvegarde dans son propre Google
Drive, manuelle ou automatique.

## Confidentialité

`docs/index.html` est la politique de confidentialité publiée (GitHub Pages), dont l'URL
figure sur la fiche Play Store. **Toute évolution qui change ce que l'application fait des
données doit y être répercutée avant publication.**

---

This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise
approved by TMDB.

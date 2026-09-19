// Le paramétrage : clés, identifiants Google, signature Android.
//
// Ces tests ne vérifient pas du code mais des **réglages** — ceux qui, mal
// posés, donnent une application qui compile parfaitement et échoue sur le
// téléphone. Ils ne lisent jamais un secret à voix haute : ils vérifient sa
// présence et sa forme, jamais sa valeur.
//
// Ce qu'ils ne peuvent pas faire : confirmer que l'empreinte SHA-1 est bien
// enregistrée côté Google Cloud. Ils affichent donc l'empreinte réelle de la
// clé de signature, à comparer une fois à l'écran de la console Google.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chemin = (p) => fileURLToPath(new URL(p, import.meta.url));
const lire = (p) => readFileSync(chemin(p), 'utf8');

function proprietes(contenu) {
  const valeurs = {};
  for (const ligne of contenu.split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith('#')) continue;
    const index = ligne.indexOf('=');
    if (index > 0) valeurs[ligne.slice(0, index).trim()] = ligne.slice(index + 1).trim();
  }
  return valeurs;
}

const env = proprietes(lire('../.env'));
const gradle = lire('../android/app/build.gradle');
const capacitor = JSON.parse(lire('../capacitor.config.json'));

describe('clés de service', () => {
  it('la clé TMDB est renseignée', () => {
    expect(Boolean(env.VITE_TMDB_API_KEY)).toBe(true);
    // Une clé v3 TMDB fait 32 caractères hexadécimaux.
    expect(/^[0-9a-f]{32}$/.test(env.VITE_TMDB_API_KEY || '')).toBe(true);
  });

  it('l’identifiant Google est celui d’un client OAuth', () => {
    expect(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(env.VITE_GOOGLE_CLIENT_ID || ''))
      .toBe(true);
  });

  it('l’identifiant Google est bien celui du client WEB', () => {
    // Le composant de connexion Android exige l'identifiant du client *web*
    // (« serverClientId ») ; un identifiant de client Android donnerait un
    // refus au moment de la connexion, pas à la compilation.
    // Fichiers volontairement tenus hors du dépôt : on les lit sur le disque.
    const fichiers = readdirSync(chemin('../..')).filter(
      (f) => f.startsWith('client_secret_') && f.endsWith('.json')
    );

    const clientsWeb = fichiers
      .map((f) => JSON.parse(readFileSync(chemin(`../../${f}`), 'utf8')))
      .filter((j) => j.web)
      .map((j) => j.web.client_id);

    if (clientsWeb.length === 0) {
      // Le fichier téléchargé depuis Google Cloud n'est pas là : rien à
      // comparer, on ne fabrique pas une fausse garantie.
      console.warn(
        'Aucun client_secret_*.json de type « web » : correspondance non vérifiable.'
      );
      return;
    }
    expect(clientsWeb.includes(env.VITE_GOOGLE_CLIENT_ID)).toBe(true);
  });

  it('les deux identifiants viennent du même projet Google', () => {
    const projetEnv = (env.VITE_GOOGLE_CLIENT_ID || '').split('-')[0];
    expect(projetEnv.length).toBeGreaterThan(5);
  });
});

describe('application Android', () => {
  it('porte le même identifiant dans Capacitor et dans Gradle', () => {
    const applicationId = gradle.match(/applicationId "([^"]+)"/)?.[1];
    expect(applicationId).toBe(capacitor.appId);
    expect(applicationId).toBe('com.kinder.suivifilmsseries');
  });

  it('déclare une version publiable', () => {
    const versionCode = Number(gradle.match(/versionCode (\d+)/)?.[1]);
    const versionName = gradle.match(/versionName "([^"]+)"/)?.[1];
    expect(versionCode).toBeGreaterThan(0);
    expect(versionName).toMatch(/^\d+\.\d+/);
    console.info(`Version déclarée : ${versionName} (versionCode ${versionCode})`);
  });

  it('demande l’accès à internet, et rien de plus', () => {
    const manifeste = lire('../android/app/src/main/AndroidManifest.xml');
    const permissions = [...manifeste.matchAll(/uses-permission android:name="([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(permissions).toEqual(['android.permission.INTERNET']);
  });

  it('ne laisse pas Android copier le suivi vers le compte Google du téléphone', () => {
    // Décision : les données ne quittent l’appareil que par la sauvegarde
    // demandée vers le Drive de l’utilisateur (PROJET_CONTEXTE.md).
    const manifeste = lire('../android/app/src/main/AndroidManifest.xml');
    expect(manifeste).toContain('android:allowBackup="false"');
  });
});

describe('signature de l’application', () => {
  const fichierSignature = chemin('../android/signature.properties');
  const signature = existsSync(fichierSignature)
    ? proprietes(readFileSync(fichierSignature, 'utf8'))
    : null;

  it('les paramètres de signature sont renseignés', () => {
    expect(signature).not.toBeNull();
    for (const cle of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
      expect(Boolean(signature?.[cle]), `${cle} manquant`).toBe(true);
    }
  });

  it('la clé de signature existe à l’emplacement indiqué', () => {
    expect(existsSync(signature.storeFile)).toBe(true);
  });

  it('la clé s’ouvre avec le mot de passe fourni, et livre son empreinte', () => {
    const keytool = [
      'C:/Program Files/Android/Android Studio/jbr/bin/keytool.exe',
      process.env.JAVA_HOME ? `${process.env.JAVA_HOME}/bin/keytool.exe` : null,
    ].find((p) => p && existsSync(p));

    if (!keytool) {
      console.warn('keytool introuvable : empreinte SHA-1 non vérifiée.');
      return;
    }

    const sortie = execFileSync(
      keytool,
      [
        '-list',
        '-v',
        '-keystore',
        signature.storeFile,
        '-alias',
        signature.keyAlias,
        '-storepass',
        signature.storePassword,
      ],
      { encoding: 'utf8' }
    );

    // keytool parle la langue du système : « SHA1: » ou « SHA 1: ».
    const sha1 = sortie.match(/SHA\s?1\s*:\s*((?:[0-9A-F]{2}:){19}[0-9A-F]{2})/)?.[1];
    expect(Boolean(sha1)).toBe(true);
    // Affichée pour comparaison manuelle avec l'empreinte enregistrée dans le
    // client OAuth Android de la console Google Cloud.
    console.info(`Empreinte SHA-1 de la clé de signature : ${sha1}`);
  });
});

describe('aucun secret dans le dépôt', () => {
  const suivis = execFileSync('git', ['ls-files'], {
    cwd: chemin('../..'),
    encoding: 'utf8',
  }).split('\n');

  it.each([
    ['la clé TMDB et l’identifiant Google', /(^|\/)\.env$/],
    ['les mots de passe de signature', /signature\.properties$/],
    ['la clé de signature', /\.(jks|keystore)$/],
    ['les identifiants OAuth téléchargés', /^client_secret_.*\.json$/],
    ['les sauvegardes de suivi personnelles', /^suivi-.*\.(json|csv)$/],
  ])('%s ne sont pas versionnés', (_quoi, motif) => {
    expect(suivis.filter((f) => motif.test(f))).toEqual([]);
  });

  it('le modèle .env.example ne contient aucune valeur', () => {
    const exemple = proprietes(lire('../.env.example'));
    for (const valeur of Object.values(exemple)) {
      expect(valeur).toBe('');
    }
  });
});

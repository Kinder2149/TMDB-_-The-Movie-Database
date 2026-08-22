// Couche externe — le compte Google de l'utilisateur.
//
// Pendant de `tmdb.js` : une porte unique vers un service extérieur, que le
// reste de l'application n'a pas à connaître. Ici, il ne s'agit pas de
// catalogue mais d'**identité** : obtenir de l'utilisateur l'autorisation
// d'écrire dans *son* Drive, pour y déposer sa sauvegarde.
//
// Décision de cadrage (2026-08-22) :
//  - la connexion est **facultative**. L'application démarre et fonctionne
//    exactement comme avant sans compte ; rien ici ne doit être appelé au
//    démarrage ;
//  - l'autorisation demandée est la plus étroite qui existe
//    (`drive.appdata`) : l'application ne voit que le dossier caché qu'elle
//    a elle-même créé dans le Drive de l'utilisateur, jamais ses fichiers.
//    C'est aussi ce qui évite l'audit de sécurité payant de Google ;
//  - aucune donnée ne transite par un serveur : il n'y en a pas.
//
// Ce fichier ne sauvegarde rien : il ne fait qu'obtenir et garder
// l'autorisation. Le dépôt du fichier dans Drive viendra ensuite.

import { Capacitor } from '@capacitor/core';

// Espace applicatif privé du Drive : « voir et gérer les données que
// l'application a créées elle-même ». Portée classée « non sensible » par
// Google — la plus petite qui permette de sauvegarder.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const ACCOUNT_KEY = 'google-account';

// Google donne une autorisation valable une heure. On la considère périmée un
// peu avant, pour ne pas partir en écriture avec un jeton qui expire en route.
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// L'autorisation d'écriture ne vit qu'en mémoire : elle expire, et rien ne
// justifie de l'écrire sur le disque de l'appareil.
let token = null; // { value, expiresAt }
let initialized = null; // promesse d'initialisation, partagée

function plugin() {
  return import('@capawesome/capacitor-google-sign-in');
}

// Le compte n'a de sens que là où l'application est installée : sur PC, le
// composant part en redirection et ne revient pas dans le cadre de dev.
export function isSupported() {
  return Capacitor.getPlatform() !== 'web';
}

// Tant que l'identifiant d'application Google n'est pas renseigné, on
// n'affiche pas un bouton qui ne peut qu'échouer.
export function isConfigured() {
  return !!CLIENT_ID;
}

async function ensureInitialized() {
  if (!isConfigured()) {
    throw new Error(
      'Connexion Google non configurée (VITE_GOOGLE_CLIENT_ID manquant dans client/.env).'
    );
  }
  if (!isSupported()) {
    throw new Error("La connexion Google n'est disponible que sur le téléphone.");
  }
  if (!initialized) {
    initialized = plugin()
      .then(({ GoogleSignIn }) =>
        GoogleSignIn.initialize({ clientId: CLIENT_ID, scopes: [DRIVE_SCOPE] })
      )
      .catch((e) => {
        initialized = null; // un échec ne doit pas condamner les essais suivants
        throw e;
      });
  }
  return initialized;
}

// Le compte connu de l'appareil, ou null. Lu depuis le stockage local : on
// veut pouvoir afficher « connecté en tant que … » sans rien redemander à
// Google au démarrage.
export function getAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function rememberAccount(result) {
  const account = {
    userId: result.userId,
    email: result.email,
    displayName: result.displayName,
    imageUrl: result.imageUrl,
  };
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    /* stockage indisponible : le compte vaut alors pour la session */
  }
  return account;
}

function forgetAccount() {
  token = null;
  try {
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* rien à oublier */
  }
}

function keepToken(result) {
  token = result.accessToken
    ? { value: result.accessToken, expiresAt: Date.now() + TOKEN_LIFETIME_MS }
    : null;
}

// Traduit les échecs du composant en phrases lisibles. Un utilisateur qui
// annule ne doit pas voir un code d'erreur.
function readableError(error) {
  const code = error?.code;
  if (code === 'SIGN_IN_CANCELED') return null; // annulation : pas une erreur
  if (code === 'NO_CREDENTIAL_AVAILABLE') {
    return "Aucun compte Google sur cet appareil. Ajoutez-en un dans les réglages d'Android.";
  }
  if (code === 'PROVIDER_CONFIGURATION_ERROR') {
    return 'Les services Google Play sont absents ou à mettre à jour sur cet appareil.';
  }
  return error?.message || 'La connexion à Google a échoué.';
}

// Connexion demandée par l'utilisateur. Renvoie le compte, ou null s'il a
// annulé (le seul cas où on ne dit rien).
export async function connect() {
  await ensureInitialized();
  const { GoogleSignIn } = await plugin();
  try {
    const result = await GoogleSignIn.signIn();
    keepToken(result);
    return rememberAccount(result);
  } catch (error) {
    const message = readableError(error);
    if (!message) return null;
    throw new Error(message);
  }
}

export async function disconnect() {
  forgetAccount();
  if (!isSupported() || !isConfigured()) return;
  try {
    const { GoogleSignIn } = await plugin();
    await GoogleSignIn.signOut();
  } catch {
    // Le compte est déjà oublié côté application : c'est ce qui compte pour
    // l'utilisateur. Un échec côté Google ne doit pas bloquer l'écran.
  }
}

// L'autorisation d'écrire dans Drive, prête à l'emploi.
//
// Tant qu'elle est valide, elle est rendue telle quelle. Une fois périmée, il
// faut la redemander à Google : l'utilisateur ayant déjà accepté, cela se fait
// normalement sans rien afficher — c'est le point que la mise au point sur
// téléphone doit confirmer.
//
// `interactive: false` renvoie null plutôt que de risquer d'interrompre
// l'utilisateur : c'est ce que devra utiliser la sauvegarde automatique, qui
// se déclenche pendant qu'il fait autre chose.
export async function getAccessToken({ interactive = true } = {}) {
  if (!getAccount()) return null;
  if (token && token.expiresAt > Date.now()) return token.value;
  if (!interactive) return null;
  await ensureInitialized();
  const { GoogleSignIn } = await plugin();
  try {
    const result = await GoogleSignIn.signIn();
    keepToken(result);
    rememberAccount(result);
    if (!token) {
      // Connexion réussie, mais Google n'a pas délivré le droit d'écrire :
      // l'autorisation Drive n'a pas été accordée ou pas demandée.
      throw new Error(
        "Google n'a pas accordé l'accès à Drive : l'autorisation n'a pas été délivrée."
      );
    }
    return token.value;
  } catch (error) {
    const message = readableError(error);
    if (!message) return null;
    throw new Error(message);
  }
}

// Vrai si une autorisation d'écriture est disponible *sans rien redemander*.
// Sert uniquement à l'affichage de l'écran.
export function hasFreshToken() {
  return !!(token && token.expiresAt > Date.now());
}

// --- Le dossier caché de l'application dans le Drive de l'utilisateur ---
//
// `appDataFolder` est un espace que Google réserve à chaque application dans
// le Drive de l'utilisateur : invisible dans son Drive, illisible par les
// autres applications, et compté dans *son* quota — pas dans un quelconque
// hébergement. C'est ce qui permet une sauvegarde en ligne sans serveur.
//
// Constaté à la mise au point du 2026-08-22 : redemander l'autorisation
// réaffiche toujours l'écran de compte Google. Aucune écriture ne part donc
// d'elle-même — c'est l'appel qui décide s'il a le droit de déranger
// l'utilisateur, jamais ce fichier.

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

async function driveFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!response.ok) {
    // Google explique toujours *pourquoi* il refuse. Écraser ce message par un
    // texte générique fait perdre une heure de recherche : on le remonte.
    const brut = await response.text().catch(() => '');
    let raison = '';
    try {
      raison = JSON.parse(brut)?.error?.message || '';
    } catch {
      raison = brut.slice(0, 200);
    }
    if (response.status === 401) {
      throw new Error(
        `Autorisation refusée par Google (401). ${raison || 'Reconnectez-vous.'}`
      );
    }
    if (response.status === 403) {
      throw new Error(`Accès à Drive refusé (403). ${raison}`.trim());
    }
    throw new Error(`Google Drive a refusé la requête (${response.status}). ${raison}`.trim());
  }
  return response;
}

// Les sauvegardes présentes dans le dossier caché, la plus récente d'abord.
export async function listDriveFiles(token) {
  const url =
    `${DRIVE_API}?spaces=appDataFolder&pageSize=100&orderBy=modifiedTime desc` +
    '&fields=files(id,name,modifiedTime,size,appProperties)';
  const response = await driveFetch(url, token);
  const { files } = await response.json();
  return files || [];
}

// Corps « multipart » attendu par Drive : les informations du fichier, puis
// son contenu, dans un seul envoi.
function multipartBody(metadata, contents, boundary) {
  return (
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${contents}\r\n--${boundary}--`
  );
}

// Écrit un fichier dans le dossier caché. `fileId` fourni : on remplace le
// fichier existant (une sauvegarde en écrase la précédente, elle ne s'ajoute
// pas à une pile qui grossirait sans fin).
export async function uploadDriveFile(token, { fileId, name, contents, appProperties }) {
  const boundary = `suivi-${Date.now()}`;
  // Le parent ne se pose qu'à la création : Drive refuse de le voir changer.
  const metadata = fileId
    ? { name, appProperties }
    : { name, appProperties, parents: ['appDataFolder'] };
  const url = fileId
    ? `${DRIVE_UPLOAD}/${fileId}?uploadType=multipart&fields=id,modifiedTime`
    : `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime`;

  const response = await driveFetch(url, token, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartBody(metadata, contents, boundary),
  });
  return response.json();
}

export async function downloadDriveFile(token, fileId) {
  const response = await driveFetch(`${DRIVE_API}/${fileId}?alt=media`, token);
  return response.json();
}

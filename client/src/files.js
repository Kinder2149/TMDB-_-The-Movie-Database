// Couche Données (fichiers) — sortir un fichier de l'application.
//
// Deux chemins, comme pour la base :
//   - PC       : téléchargement classique du navigateur ;
//   - téléphone: le fichier est écrit dans l'espace de l'application, puis
//                proposé au partage (Drive, mail, Fichiers…). Un WebView
//                Android ne sait pas « télécharger » comme un navigateur.

import { Capacitor } from '@capacitor/core';

const isWeb = Capacitor.getPlatform() === 'web';

// Écrit un fichier texte et le remet à l'utilisateur.
// Renvoie une note à afficher (le geste diffère selon l'appareil).
export async function saveTextFile(fileName, contents, mimeType = 'application/json') {
  if (isWeb) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Laisse au navigateur le temps de démarrer le téléchargement.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return `Fichier « ${fileName} » téléchargé.`;
  }

  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  // Cache : espace privé de l'app, aucune permission de stockage à demander.
  await Filesystem.writeFile({
    path: fileName,
    data: contents,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  const { uri } = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });

  await Share.share({
    title: fileName,
    files: [uri],
    dialogTitle: 'Enregistrer la sauvegarde',
  });
  return `Fichier « ${fileName} » prêt : choisissez où l'enregistrer.`;
}

// Lit un fichier choisi par l'utilisateur (<input type="file">).
// Fonctionne à l'identique sur PC et sur Android.
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
}

// Nom de fichier daté, pour ne pas écraser une sauvegarde précédente.
export function backupFileName(profileName, extension = 'json') {
  const date = new Date().toISOString().slice(0, 10);
  const nom = (profileName || 'profil')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `suivi-${nom}-${date}.${extension}`;
}

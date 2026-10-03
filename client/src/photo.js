// Miniature d'une photo d'avatar, pour la fiche partagée avec les amis.
// La photo gardée sur le téléphone fait 128 px ; une fiche n'a pas le droit d'être lourde,
// on la réduit donc à quelques kilo-octets (48 px, JPEG).

export const COTE_MINIATURE = 48;
export const MAX_AVATAR = 4000; // caractères, plafond fixé aussi par les règles Firebase

// `dataUrl` : une image encodée en texte. Rend la miniature, ou '' si elle n'a pas pu être faite.
export function reduirePhoto(dataUrl, cote = COTE_MINIATURE, qualite = 0.6) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = cote;
          canvas.height = cote;
          const ctx = canvas.getContext('2d');
          const c = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - c) / 2, (img.height - c) / 2, c, c, 0, 0, cote, cote);
          resolve(canvas.toDataURL('image/jpeg', qualite));
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    } catch {
      resolve('');
    }
  });
}

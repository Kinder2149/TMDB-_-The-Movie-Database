import Icon from './Icon.jsx';

// Avatar d'un profil : une couleur et un symbole, rien de plus.
//
// Pas de photo à choisir dans la galerie : il faudrait une permission, du
// stockage, et l'image partirait dans chaque sauvegarde. Pas d'émoji non plus
// — leur rendu dépend de la police du téléphone (voir `Icon.jsx`). Une couleur
// et un dessin au trait suffisent à distinguer deux profils d'un coup d'œil, et
// tiennent dans un seul petit texte en base.
//
// Rangé en base sous la forme « couleur:symbole » (ex. « bleu:film »). Une
// valeur vide ou inconnue retombe sur le doré et l'initiale du nom : les
// profils créés avant ce réglage s'affichent donc exactement comme avant.

export const AVATAR_COLORS = [
  { key: 'or', label: 'Doré', css: 'var(--gold)' },
  { key: 'bleu', label: 'Bleu', css: 'var(--avoir)' },
  { key: 'violet', label: 'Violet', css: 'var(--encours)' },
  { key: 'vert', label: 'Vert', css: 'var(--vu)' },
  { key: 'rouge', label: 'Rouge', css: 'var(--danger)' },
  { key: 'gris', label: 'Gris', css: 'var(--abandon)' },
];

export const AVATAR_SYMBOLS = [
  { key: 'initiale', label: 'Initiale' },
  { key: 'user', label: 'Silhouette' },
  { key: 'film', label: 'Pellicule' },
  // Pas de symbole « liste » ici : son dessin est aligné à gauche dans son
  // carré (barres + marque-page), donc décentré une fois mis en pastille.
  { key: 'moon', label: 'Lune' },
  { key: 'play', label: 'Lecture' },
  { key: 'star', label: 'Étoile' },
];

const DEFAUT = { couleur: 'or', symbole: 'initiale' };

// Une photo est rangée dans le même champ que la couleur et le symbole, sous
// forme d'image encodée en texte. On la reconnaît à son début : impossible de
// la confondre avec un « couleur:symbole ».
export const estPhoto = (value) => String(value || '').startsWith('data:image/');

// Côté long de la vignette enregistrée. 128 pixels suffisent largement pour une
// pastille de 44, et l'image pèse alors quelques kilo-octets : elle part dans
// chaque sauvegarde, elle n'a pas le droit d'être lourde.
export const TAILLE_PHOTO = 128;

// Recadre au centre, réduit, et rend l'image en texte. Le fichier d'origine
// (souvent plusieurs méga-octets) n'est jamais conservé.
export function photoDepuisFichier(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const cote = Math.min(img.width, img.height); // carré pris au centre
      const canvas = document.createElement('canvas');
      canvas.width = TAILLE_PHOTO;
      canvas.height = TAILLE_PHOTO;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        (img.width - cote) / 2,
        (img.height - cote) / 2,
        cote,
        cote,
        0,
        0,
        TAILLE_PHOTO,
        TAILLE_PHOTO
      );
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cette image n'a pas pu être lue."));
    };
    img.src = url;
  });
}

export function parseAvatar(value) {
  const [couleur, symbole] = String(value || '').split(':');
  return {
    couleur: AVATAR_COLORS.some((c) => c.key === couleur) ? couleur : DEFAUT.couleur,
    // Un symbole inconnu (retiré depuis, ou fichier de sauvegarde d'une autre
    // version) retombe sur l'initiale plutôt que sur un carré vide.
    symbole: AVATAR_SYMBOLS.some((s) => s.key === symbole) ? symbole : DEFAUT.symbole,
  };
}

export const formatAvatar = (couleur, symbole) => `${couleur}:${symbole}`;

export const couleurCss = (key) =>
  (AVATAR_COLORS.find((c) => c.key === key) || AVATAR_COLORS[0]).css;

export const initiale = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

export default function Avatar({ name, value, size = 32 }) {
  if (estPhoto(value)) {
    return (
      <img
        className="avatar avatar--photo"
        src={value}
        alt=""
        style={{ width: size, height: size }}
      />
    );
  }

  const { couleur, symbole } = parseAvatar(value);
  return (
    <span
      className="avatar"
      style={{
        background: couleurCss(couleur),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden="true"
    >
      {symbole === 'initiale' ? (
        initiale(name)
      ) : (
        <Icon name={symbole} size={Math.round(size * 0.52)} />
      )}
    </span>
  );
}

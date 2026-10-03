// Couche externe — Firebase (fiches partagées, amis par code).
//
// Pendant de `tmdb.js` et `google.js` : une porte unique vers un service
// extérieur, que le reste de l'application n'a pas à connaître. Ici, une seule
// chose : déposer, retirer (et plus tard lire) la **fiche partagée** d'un profil.
//
// Cadrage : PLAN_V2.md, point 4 bis. Rappels qui comptent ici :
//  - c'est **facultatif** : rien n'est appelé au démarrage, la bibliothèque ne
//    se charge qu'à la première action de partage ;
//  - pas de compte : connexion anonyme, invisible. Elle ne se récupère pas après
//    une réinstallation — c'est la clé secrète (voir `firebase/firestore.rules`)
//    qui prouve qu'on est propriétaire d'une fiche ;
//  - les règles de sécurité sont dans `firebase/firestore.rules`, testées par
//    `npm run test:regles`. Les valeurs de configuration ci-dessous sont publiques
//    par nature : la protection vient des règles.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Le partage est **éteint par défaut dans les versions publiables** : il faut à la fois les
// clés Firebase et VITE_PARTAGE=1. Raison : activer la fonction change ce qu'il faut déclarer
// au Play Store (questionnaire « Sécurité des données », politique de confidentialité) ; on ne
// la livre donc qu'en toute connaissance de cause. En développement (`vite`), l'interrupteur
// est allumé par `.env.development`. Pour livrer les amis : le mettre dans `.env.production`.
export function isConfigured() {
  return import.meta.env.VITE_PARTAGE === '1' && !!(cfg.apiKey && cfg.projectId && cfg.appId);
}

let pret = null;

// Charge Firebase, ouvre la connexion anonyme (la même d'un lancement à l'autre :
// la bibliothèque la garde sur l'appareil).
function demarrer() {
  if (!isConfigured()) {
    return Promise.reject(new Error('Le partage n’est pas configuré (clés Firebase manquantes).'));
  }
  if (!pret) {
    pret = (async () => {
      const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = initializeApp(cfg);
      const auth = getAuth(app);
      await auth.authStateReady();
      const user = auth.currentUser || (await signInAnonymously(auth)).user;
      return { db: fs.getFirestore(app), uid: user.uid, fs };
    })().catch((e) => {
      pret = null; // un échec ne doit pas condamner les essais suivants
      throw traduire(e);
    });
  }
  return pret;
}

// Les erreurs de Firebase parlent de codes ; l'écran, lui, parle français.
function traduire(e) {
  const code = e?.code || '';
  if (code.includes('unavailable') || code.includes('network') || code === 'failed-precondition') {
    return new Error('Pas de connexion : réessaie quand le réseau est revenu.');
  }
  if (code.includes('permission-denied')) {
    return new Error('Le serveur a refusé l’opération (fiche ou clé incorrecte).');
  }
  if (code.includes('resource-exhausted')) {
    return new Error('Le service est saturé pour aujourd’hui : réessaie demain.');
  }
  return e instanceof Error ? e : new Error(String(e));
}

const refusee = (e) => (e?.code || '').includes('permission-denied');

// Dépose (ou met à jour) la fiche. `fiche` = tout sauf la date : le serveur la pose.
//  1. Cas courant : on est déjà propriétaire, la mise à jour passe.
//  2. Première fois, ou nouvel appareil après réinstallation : on se déclare
//     propriétaire avec la clé, dans le même lot que la fiche.
export async function publier(code, cle, fiche) {
  const { db, uid, fs } = await demarrer();
  const ref = fs.doc(db, 'fiches', code);
  const donnees = { ...fiche, maj: fs.serverTimestamp() };
  try {
    await fs.setDoc(ref, donnees);
    return;
  } catch (e) {
    if (!refusee(e)) throw traduire(e);
  }
  try {
    const lot = fs.writeBatch(db);
    lot.set(fs.doc(db, 'proprietaires', code, 'clefs', uid), { cle });
    lot.set(ref, donnees);
    await lot.commit();
  } catch (e) {
    throw traduire(e);
  }
}

// Lit la fiche d'un ami à partir de son code. `null` si elle n'existe pas (code faux, ou
// fiche supprimée). Les données viennent d'un autre utilisateur : l'appelant les traite
// comme telles (voir `amis.js`).
export async function lire(code) {
  const { db, fs } = await demarrer();
  try {
    const snap = await fs.getDoc(fs.doc(db, 'fiches', code));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { ...d, maj: d.maj?.toMillis?.() ?? null };
  } catch (e) {
    throw traduire(e);
  }
}

// Retire la fiche du serveur, ainsi que la preuve de propriété de cet appareil.
// Après une réinstallation, on commence par se déclarer propriétaire (clé), faute
// de quoi la suppression serait refusée.
export async function retirer(code, cle) {
  const { db, uid, fs } = await demarrer();
  const supprimer = () => {
    const lot = fs.writeBatch(db);
    lot.delete(fs.doc(db, 'fiches', code));
    lot.delete(fs.doc(db, 'proprietaires', code, 'clefs', uid));
    return lot.commit();
  };
  try {
    await supprimer();
    return;
  } catch (e) {
    if (!refusee(e)) throw traduire(e);
  }
  try {
    await fs.setDoc(fs.doc(db, 'proprietaires', code, 'clefs', uid), { cle });
    await supprimer();
  } catch (e) {
    // Plus de fiche à retirer (déjà supprimée) : rien d'autre à faire.
    const existe = await fs.getDoc(fs.doc(db, 'fiches', code)).then((d) => d.exists(), () => true);
    if (!existe) return;
    throw traduire(e);
  }
}

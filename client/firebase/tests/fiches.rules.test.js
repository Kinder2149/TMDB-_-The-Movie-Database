// Règles de sécurité des fiches partagées, jouées contre l'émulateur Firestore.
// Lancé par `npm run test:regles` (Java et l'émulateur requis) — jamais contre le vrai projet.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const CODE = 'K7F2M9QX3DTB';
const CLE = 'cle-secrete-de-test-0123456789';
const empreinte = (cle) => createHash('sha256').update(cle).digest('hex');

const fiche = (extra = {}) => ({
  v: 1,
  pseudo: 'Léa',
  avatar: 'or:film',
  maj: serverTimestamp(),
  cleHash: empreinte(CLE),
  titres: ['m603:5', 't1396:4'],
  listes: [{ n: 'Vu', k: 'statut', ids: [0, 1] }],
  ...extra,
});

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vault-watch',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
afterAll(() => env.cleanup());

// Une seule connexion par utilisateur et par test : mélanger deux instances Firestore
// dans un même lot est refusé par la bibliothèque.
let connexions = new Map();
beforeEach(async () => {
  await env.clearFirestore();
  connexions = new Map();
});
const db = (uid = '') => {
  if (!connexions.has(uid)) {
    connexions.set(
      uid,
      uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()
    );
  }
  return connexions.get(uid);
};

// Création complète : fiche + propriétaire dans le même lot, comme le fera l'application.
async function creer(uid = 'alice') {
  const b = writeBatch(db(uid));
  b.set(doc(db(uid), 'proprietaires', CODE, 'clefs', uid), { cle: CLE });
  b.set(doc(db(uid), 'fiches', CODE), fiche());
  return b.commit();
}

describe('création', () => {
  it('accepte une miniature d’avatar de quelques kilo-octets', async () => {
    const d = db('alice');
    const b = writeBatch(d);
    b.set(doc(d, 'proprietaires', CODE, 'clefs', 'alice'), { cle: CLE });
    b.set(doc(d, 'fiches', CODE), fiche({ avatar: `data:image/jpeg;base64,${'A'.repeat(3000)}` }));
    await assertSucceeds(b.commit());
  });
  it('un utilisateur connecté crée sa fiche avec sa clé', async () => {
    await assertSucceeds(creer());
  });
  it('sans connexion, rien', async () => {
    const d = db();
    const b = writeBatch(d);
    b.set(doc(d, 'proprietaires', CODE, 'clefs', 'x'), { cle: CLE });
    b.set(doc(d, 'fiches', CODE), fiche());
    await assertFails(b.commit());
  });
  it("refuse une clé qui n'a pas l'empreinte annoncée", async () => {
    const d = db('alice');
    const b = writeBatch(d);
    b.set(doc(d, 'proprietaires', CODE, 'clefs', 'alice'), { cle: 'une-autre-cle-0123456789012' });
    b.set(doc(d, 'fiches', CODE), fiche());
    await assertFails(b.commit());
  });
  it("refuse de se déclarer propriétaire pour quelqu'un d'autre", async () => {
    const d = db('alice');
    const b = writeBatch(d);
    b.set(doc(d, 'proprietaires', CODE, 'clefs', 'bob'), { cle: CLE });
    b.set(doc(d, 'fiches', CODE), fiche());
    await assertFails(b.commit());
  });
  it('refuse un code mal formé (0, O, 1, I, mauvaise longueur)', async () => {
    for (const mauvais of ['K7F2M9QX3DT0', 'K7F2M9QX3DTI', 'K7F2M9QX3DT', 'k7f2m9qx3dtb']) {
      const d = db('alice');
      const b = writeBatch(d);
      b.set(doc(d, 'proprietaires', mauvais, 'clefs', 'alice'), { cle: CLE });
      b.set(doc(d, 'fiches', mauvais), fiche());
      await assertFails(b.commit());
    }
  });
  it('refuse un champ en trop, un pseudo trop long ou vide, trop de listes', async () => {
    for (const extra of [
      { avis: 'texte libre' },
      { pseudo: 'x'.repeat(25) },
      { pseudo: '' },
      { avatar: 'x'.repeat(4001) },
      { listes: Array.from({ length: 51 }, () => ({})) },
      { v: 2 },
    ]) {
      const d = db('alice');
      const b = writeBatch(d);
      b.set(doc(d, 'proprietaires', CODE, 'clefs', 'alice'), { cle: CLE });
      b.set(doc(d, 'fiches', CODE), fiche(extra));
      await assertFails(b.commit());
    }
  });
});

describe('lecture', () => {
  beforeEach(async () => {
    await assertSucceeds(creer());
  });
  it('un autre utilisateur lit la fiche en connaissant le code', async () => {
    await assertSucceeds(getDoc(doc(db('bob'), 'fiches', CODE)));
  });
  it('sans connexion, pas de lecture', async () => {
    await assertFails(getDoc(doc(db(), 'fiches', CODE)));
  });
  it('impossible de parcourir les fiches', async () => {
    await assertFails(getDocs(collection(db('bob'), 'fiches')));
  });
  it('la clé secrète est illisible, même pour le propriétaire', async () => {
    await assertFails(getDoc(doc(db('alice'), 'proprietaires', CODE, 'clefs', 'alice')));
    await assertFails(getDoc(doc(db('bob'), 'proprietaires', CODE, 'clefs', 'alice')));
  });
});

describe('mise à jour et suppression', () => {
  beforeEach(async () => {
    await assertSucceeds(creer());
  });
  it('le propriétaire met sa fiche à jour', async () => {
    await assertSucceeds(
      setDoc(doc(db('alice'), 'fiches', CODE), fiche({ titres: ['m1:3'], listes: [] }))
    );
  });
  it("un autre utilisateur ne peut ni modifier ni supprimer la fiche", async () => {
    await assertFails(setDoc(doc(db('bob'), 'fiches', CODE), fiche({ pseudo: 'Pirate' })));
    await assertFails(deleteDoc(doc(db('bob'), 'fiches', CODE)));
  });
  it("l'empreinte de la clé ne peut pas être changée", async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'fiches', CODE), fiche({ cleHash: empreinte('autre-cle-0123456789012') }))
    );
  });
  it('le propriétaire supprime fiche et clé dans le même lot', async () => {
    const d = db('alice');
    const b = writeBatch(d);
    b.delete(doc(d, 'fiches', CODE));
    b.delete(doc(d, 'proprietaires', CODE, 'clefs', 'alice'));
    await assertSucceeds(b.commit());
  });
});

describe('reprise après réinstallation', () => {
  beforeEach(async () => {
    await assertSucceeds(creer('alice'));
  });
  it('avec la bonne clé, un nouvel utilisateur anonyme reprend la fiche', async () => {
    const neuf = db('alice-apres-reinstallation');
    await assertSucceeds(
      setDoc(doc(neuf, 'proprietaires', CODE, 'clefs', 'alice-apres-reinstallation'), { cle: CLE })
    );
    await assertSucceeds(setDoc(doc(neuf, 'fiches', CODE), fiche({ pseudo: 'Léa (retrouvée)' })));
  });
  it('avec une mauvaise clé, on ne devient pas propriétaire', async () => {
    const intrus = db('mallory');
    await assertFails(
      setDoc(doc(intrus, 'proprietaires', CODE, 'clefs', 'mallory'), { cle: 'devine-0123456789012345' })
    );
    await assertFails(setDoc(doc(intrus, 'fiches', CODE), fiche({ pseudo: 'Pirate' })));
  });
  it("on ne peut pas se déclarer propriétaire au nom d'un autre identifiant", async () => {
    const intrus = db('mallory');
    await assertFails(setDoc(doc(intrus, 'proprietaires', CODE, 'clefs', 'bob'), { cle: CLE }));
  });
  it("la faille d'origine : modifier la ligne du propriétaire sans connaître la clé", async () => {
    const intrus = db('mallory');
    await assertFails(updateDoc(doc(intrus, 'proprietaires', CODE, 'clefs', 'alice'), { cle: CLE }));
    await assertFails(updateDoc(doc(intrus, 'proprietaires', CODE, 'clefs', 'alice'), { uid: 'mallory' }));
    await assertFails(setDoc(doc(intrus, 'fiches', CODE), fiche({ pseudo: 'Pirate' })));
  });
});

describe('le reste est fermé', () => {
  it('aucune autre collection', async () => {
    await assertFails(setDoc(doc(db('alice'), 'autre', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(db('alice'), 'autre', 'x')));
  });
});

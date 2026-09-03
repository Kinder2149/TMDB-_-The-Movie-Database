// Captures d'écran de la fiche Play Store.
//
// Lance l'application dans un Chrome piloté, remplit un profil de démonstration
// avec de vrais titres (le catalogue vient de TMDB), puis photographie cinq
// écrans au format attendu par Google : 1080 × 1920.
//
// Prérequis : le serveur de développement doit tourner (npm run dev).
// Usage     : node scripts/captures-play-store.mjs

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADRESSE = 'http://localhost:5173';
const SORTIE = decodeURIComponent(
  new URL('../../play-store/', import.meta.url).pathname,
).replace(/^\//, '');

// 360 × 640 à l'échelle 3 donne exactement 1080 × 1920.
const ECRAN = { width: 360, height: 640, deviceScaleFactor: 3 };

// Ce qu'on ajoute au suivi pour que les écrans ne soient pas vides.
const A_SUIVRE = ['Ted Lasso', 'The Last of Us', 'Severance', 'Dune', 'Oppenheimer', 'Silo'];

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clique le premier élément dont le texte est exactement `texte`. */
async function cliquerTexte(page, texte, selecteur = 'button, div, li, span') {
  const trouve = await page.evaluate(
    (sel, txt) => {
      const cible = [...document.querySelectorAll(sel)]
        .filter((e) => e.textContent.trim() === txt)
        .pop();
      if (!cible) return false;
      cible.click();
      return true;
    },
    selecteur,
    texte,
  );
  if (!trouve) throw new Error(`Introuvable à l'écran : « ${texte} »`);
  await pause(700);
}

async function photo(page, nom) {
  await pause(1200); // laisser les affiches finir de charger
  await page.screenshot({ path: `${SORTIE}${nom}`, captureBeyondViewport: false });
  console.log(`  ✓ ${nom}`);
}

/** Ajoute un titre au suivi depuis la recherche. */
async function suivre(page, titre) {
  await page.click('input[type="search"], input[placeholder]');
  await page.evaluate(() => {
    const champ = document.querySelector('input[type="search"], input[placeholder]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(champ, '');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.type('input[type="search"], input[placeholder]', titre, { delay: 20 });
  await pause(1800); // recherche TMDB
  const ajoute = await page.evaluate(() => {
    const bouton = document.querySelector('button[aria-label="Ajouter à mon suivi"]');
    if (!bouton) return false;
    bouton.click();
    return true;
  });
  await pause(900);
  console.log(`  ${ajoute ? '+' : '!'} ${titre}`);
}

const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: ECRAN,
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});

try {
  await mkdir(SORTIE, { recursive: true });
  const page = await navigateur.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(ADRESSE, { waitUntil: 'networkidle2' });

  // Premier lancement : choix de la langue du catalogue.
  await pause(1500);
  if (await page.$('input[placeholder]') === null) {
    console.log('Premier lancement — choix de la langue');
    await cliquerTexte(page, 'Français');
    await pause(2500);
  }

  console.log('Remplissage du profil de démonstration');
  for (const titre of A_SUIVRE) await suivre(page, titre);

  // Ted Lasso : première saison vue, pour qu'une série soit « en cours ».
  console.log('Progression sur une série');
  await suivre(page, 'Ted Lasso');
  await page.evaluate(() => document.querySelector('.card__open')?.click());
  await pause(3000);
  await page.evaluate(() => {
    document.querySelector('button[aria-label*="Marquer la saison"]')?.click();
  });
  await pause(2500);
  await page.evaluate(() => document.querySelector('.sheet__back')?.click());
  await pause(1200);

  console.log('Captures');

  // 1 — Recherche
  await cliquerTexte(page, 'Recherche');
  await page.evaluate(() => {
    const champ = document.querySelector('input[placeholder]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(champ, '');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    champ.blur();
  });
  await pause(2500);
  await photo(page, '1-recherche.png');

  // 2 — Fiche d'une série suivie, ouverte sur ses saisons : c'est l'écran qui
  // montre le cœur de l'application (cocher épisode par épisode).
  await page.type('input[placeholder]', 'Ted Lasso', { delay: 20 });
  await pause(2500);
  await page.evaluate(() => document.querySelector('.card__open')?.click());
  await pause(4000);
  await page.evaluate(() => {
    const saisons = document.querySelector('.season, [class*="season"]');
    saisons?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await pause(1500);
  await photo(page, '2-fiche-serie.png');
  await page.evaluate(() => document.querySelector('.sheet__back')?.click());
  await pause(1000);

  // 3 — Quoi regarder ce soir
  await cliquerTexte(page, 'Ce soir');
  await pause(3000);
  await photo(page, '3-quoi-regarder-ce-soir.png');

  // 4 — Suggestions (second onglet du même écran)
  await cliquerTexte(page, 'Suggestions');
  await pause(4000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await pause(1500);
  await photo(page, '4-suggestions.png');

  // 5 — Mes listes
  await cliquerTexte(page, 'Mes listes');
  await pause(2000);

  // Une liste personnalisée, sinon l'écran annonce « Aucune liste pour l'instant ».
  for (const nom of ['Soirée ciné', 'À voir à deux']) {
    page.once('dialog', (fenetre) => fenetre.accept(nom));
    await cliquerTexte(page, 'Nouvelle');
    await pause(1200);
  }
  // Revenir sur « À voir » : une liste fraîchement créée est vide, la
  // bibliothèque montre mieux à quoi sert l'écran.
  await page.evaluate(() => document.querySelector('.statbtn.status--a_voir')?.click());
  await pause(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await pause(1500);
  await photo(page, '5-mes-listes.png');

  console.log(`\nTerminé — ${SORTIE}`);
} finally {
  await navigateur.close();
}

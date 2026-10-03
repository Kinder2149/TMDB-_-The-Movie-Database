// Le schéma doit passer le moteur SQLite du TÉLÉPHONE, pas seulement celui du navigateur.
//
// Le plugin Android découpe le texte du schéma à chaque point-virgule : un commentaire SQL
// (« -- … ») contenant une apostrophe ou un « ; » le casse net, avec l'erreur
// « execute: not an error (code 0) » — et l'application reste bloquée sur l'écran de
// bienvenue. Le navigateur (sql.js) les accepte, donc aucun autre test ne le voit.
// Cela est arrivé une fois (2026-10-03, tables partage et amis) : ce test l'interdit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const schema = source.match(/const SCHEMA = `([\s\S]*?)`;/)?.[1] ?? '';

describe('schéma de la base (moteur du téléphone)', () => {
  it('est bien trouvé dans db.js', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS profiles');
  });

  it('ne contient aucun commentaire SQL', () => {
    expect(schema).not.toMatch(/--/);
    expect(schema).not.toMatch(/\/\*/);
  });

  it('se découpe en instructions complètes, apostrophes équilibrées', () => {
    const instructions = schema.split(';').map((s) => s.trim()).filter(Boolean);
    expect(instructions.length).toBeGreaterThanOrEqual(8);
    for (const sql of instructions) {
      expect(sql).toMatch(/^CREATE (TABLE|INDEX)/);
      expect((sql.match(/'/g) || []).length % 2).toBe(0);
      expect((sql.match(/\(/g) || []).length).toBe((sql.match(/\)/g) || []).length);
    }
  });
});

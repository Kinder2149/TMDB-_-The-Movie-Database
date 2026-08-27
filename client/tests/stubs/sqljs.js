// sql.js — même moteur SQLite, chargé depuis Node. Seule la localisation du
// fichier .wasm change (l'application le sert depuis /assets).
import initSqlJs from 'sql.js/dist/sql-wasm.js';
export default (options = {}) => initSqlJs({});

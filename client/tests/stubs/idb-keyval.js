// Stockage du navigateur, en mémoire. Remis à neuf à chaque test par
// vi.resetModules() : chaque test part d'une base vierge.
const store = new Map();
export const get = async (k) => store.get(k);
export const set = async (k, v) => void store.set(k, v);

// Socle Capacitor absent hors appareil : les tests tournent sur le chemin
// « web » de l'application, celui qui utilise sql.js — le même SQLite.
export const Capacitor = { getPlatform: () => 'web' };

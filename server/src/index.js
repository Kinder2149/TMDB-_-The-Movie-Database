import 'dotenv/config';
import express from 'express';
import { initDb } from './db/database.js';
import { requireProfile } from './middleware/requireProfile.js';
import searchRouter from './routes/search.js';
import suiviRouter from './routes/suivi.js';
import seriesRouter from './routes/series.js';
import profilesRouter from './routes/profiles.js';
import detailsRouter from './routes/details.js';
import listesRouter from './routes/listes.js';
import browseRouter from './routes/browse.js';
import suggestionsRouter from './routes/suggestions.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Couche Données : ouverture de la base locale SQLite (fichier).
initDb();

// Couche Logique : routes de l'API REST.
// La recherche (TMDB) et la gestion des profils ne dépendent pas d'un profil actif.
app.use('/api/search', searchRouter);
app.use('/api/profiles', profilesRouter);
// La fiche détail et la navigation par genre (TMDB) ne dépendent pas d'un profil.
app.use('/api/details', detailsRouter);
app.use('/api/browse', browseRouter);
// Le suivi et les séries sont scopés par profil : requireProfile fournit req.profileId.
app.use('/api/suivi', requireProfile, suiviRouter);
app.use('/api/tv', requireProfile, seriesRouter);
app.use('/api/listes', requireProfile, listesRouter);
app.use('/api/suggestions', requireProfile, suggestionsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Back (API) démarré sur http://localhost:${PORT}`);
});

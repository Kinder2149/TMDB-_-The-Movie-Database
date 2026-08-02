import 'dotenv/config';
import express from 'express';
import { initDb } from './db/database.js';
import { requireProfile } from './middleware/requireProfile.js';
import searchRouter from './routes/search.js';
import suiviRouter from './routes/suivi.js';
import seriesRouter from './routes/series.js';
import profilesRouter from './routes/profiles.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Couche Données : ouverture de la base locale SQLite (fichier).
initDb();

// Couche Logique : routes de l'API REST.
// La recherche (TMDB) et la gestion des profils ne dépendent pas d'un profil actif.
app.use('/api/search', searchRouter);
app.use('/api/profiles', profilesRouter);
// Le suivi et les séries sont scopés par profil : requireProfile fournit req.profileId.
app.use('/api/suivi', requireProfile, suiviRouter);
app.use('/api/tv', requireProfile, seriesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Back (API) démarré sur http://localhost:${PORT}`);
});

import 'dotenv/config';
import express from 'express';
import { initDb } from './db/database.js';
import searchRouter from './routes/search.js';
import suiviRouter from './routes/suivi.js';
import seriesRouter from './routes/series.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Couche Données : ouverture de la base locale SQLite (fichier).
initDb();

// Couche Logique : routes de l'API REST.
app.use('/api/search', searchRouter);
app.use('/api/suivi', suiviRouter);
app.use('/api/tv', seriesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Back (API) démarré sur http://localhost:${PORT}`);
});

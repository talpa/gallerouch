import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from './oauth.js';
import artworksApi from './artworks.js';
import authApi from './auth.js';
import uploadsApi from './uploads.js';
import eventsApi from './events.js';
import settingsApi from './settings.js';
import paymentsApi, { syncFioPayments } from './payments.js';
import offersApi from './offers.js';
import pkg from 'pg';
const { Client } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Always prefer backend/.env over inherited PM2 environment variables.
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

// Run migrations on startup
import { runMigrations } from './migrate.js';
await runMigrations();

const app = express();
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['https://gallerouch.cz', 'https://www.gallerouch.cz'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(bodyParser.json());
app.use(passport.initialize());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', artworksApi);
app.use('/api/auth', authApi);
app.use('/api/auth', settingsApi);
app.use('/api', uploadsApi);
app.use('/api', eventsApi);
app.use('/api', paymentsApi);
app.use('/api/offers', offersApi);

app.get('/api/test-db', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://gallerouch:gallerouch@localhost:5433/gallerouch',
  });
  try {
    await client.connect();
    const result = await client.query('SELECT 1 AS test');
    await client.end();
    res.json({ success: true, result: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/db-tables', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://gallerouch:gallerouch@localhost:5433/gallerouch',
  });
  try {
    await client.connect();
    const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
    const counts = {};
    for (const row of tables.rows) {
      const table = row.tablename;
      const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      counts[table] = parseInt(result.rows[0].count, 10);
    }
    await client.end();
    res.json({ success: true, counts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Gallerouch backend API is running.');
});

const PORT = process.env.PORT || 4777;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);

  // Automatická synchronizace s Fio bankou každé 2 hodiny
  // Běží interně - nepotřebuje JWT ani externí cron job
  const FIO_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hodiny

  const runFioSync = async () => {
    try {
      const result = await syncFioPayments();
      if (result.skipped) {
        // FIO_API_TOKEN není nastaven - tichý log, není to chyba
        return;
      }
      console.log(`[Fio Sync] ${result.message}`);
    } catch (err) {
      console.error('[Fio Sync] Chyba při synchronizaci:', err.message);
    }
  };

  // První sync za 30 sekund po startu (ne hned - DB se teprve rozjíždí)
  setTimeout(runFioSync, 30 * 1000);

  // Pak každé 2 hodiny
  setInterval(runFioSync, FIO_SYNC_INTERVAL_MS);
});

import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Check backend/.env and PM2 environment.');
  }

  // Common production pitfall: unescaped special chars in password (e.g. ?, #, @, :).
  if (/:\/\/[^/]*\?[^@]*@/.test(databaseUrl)) {
    throw new Error('DATABASE_URL appears invalid: password likely contains an unescaped "?". URL-encode DB username/password (encodeURIComponent).');
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('Running database migrations...');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      // Check if migration was already applied
      const result = await client.query('SELECT * FROM migrations WHERE name = $1', [file]);
      
      if (result.rows.length === 0) {
        console.log(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✓ Migration ${file} applied successfully`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`✗ Migration ${file} failed:`, err.message);
          throw err;
        }
      } else {
        console.log(`⊘ Migration ${file} already applied`);
      }
    }

    console.log('All migrations completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

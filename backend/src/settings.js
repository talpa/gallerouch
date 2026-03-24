import express from 'express';
import pkg from 'pg';
import jwt from 'jsonwebtoken';
const { Client } = pkg;

const router = express.Router();

const getConnection = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://gallerouch:gallerouch@localhost:5433/gallerouch',
  });
};

// Middleware to verify admin
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/settings/public - Get public settings (no auth required)
router.get('/public', async (req, res) => {
  const client = getConnection();
  try {
    await client.connect();
    // Only return currency setting for now
    const result = await client.query('SELECT key, value FROM settings WHERE key = $1', ['currency']);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// GET /api/auth/settings - Get all settings
router.get('/settings', verifyAdmin, async (req, res) => {
  const client = getConnection();
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM settings ORDER BY key');
    res.json({ settings: result.rows });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// GET /api/auth/settings/:key - Get specific setting
router.get('/settings/:key', verifyAdmin, async (req, res) => {
  const { key } = req.params;
  const client = getConnection();
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM settings WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// PUT /api/auth/settings/:key - Update setting
router.put('/settings/:key', verifyAdmin, async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body;

  if (!value) {
    return res.status(400).json({ error: 'Value is required' });
  }

  const client = getConnection();
  try {
    await client.connect();
    const result = await client.query(
      'UPDATE settings SET value = $1, description = $2, updated_at = NOW() WHERE key = $3 RETURNING *',
      [value, description || null, key]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ message: 'Setting updated', setting: result.rows[0] });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// POST /api/auth/settings - Create new setting
router.post('/settings', verifyAdmin, async (req, res) => {
  const { key, value, description } = req.body;

  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required' });
  }

  const client = getConnection();
  try {
    await client.connect();
    const result = await client.query(
      'INSERT INTO settings (key, value, description) VALUES ($1, $2, $3) RETURNING *',
      [key, value, description || null]
    );
    res.status(201).json({ message: 'Setting created', setting: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Setting with this key already exists' });
    }
    console.error('Error creating setting:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// DELETE /api/auth/settings/:key - Delete setting
router.delete('/settings/:key', verifyAdmin, async (req, res) => {
  const { key } = req.params;
  const client = getConnection();
  try {
    await client.connect();
    const result = await client.query('DELETE FROM settings WHERE key = $1 RETURNING *', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ message: 'Setting deleted', setting: result.rows[0] });
  } catch (err) {
    console.error('Error deleting setting:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

export default router;

// Mock backend API for artworks and artwork events
import express from 'express';
import pkg from 'pg';
const { Client } = pkg;
const router = express.Router();

// GET /api/artworks

function toCamel(obj) {
  if (!obj) return obj;
  const map = {
    image_url: 'imageUrl',
    event_date: 'eventDate',
    artwork_id: 'artworkId',
    user_name: 'userName',
    user_email: 'userEmail',
    user_bio: 'userBio',
    author_name: 'authorName',
    author_email: 'authorEmail',
    author_bio: 'authorBio',
    author_id: 'authorId',
    artwork_name: 'artworkName',
    artwork_type_id: 'artworkTypeId',
    artwork_type_name: 'artworkTypeName',
    artwork_type_name_en: 'artworkTypeNameEn',
    type: 'type',
    date: 'date',
    status: 'status',
    id: 'id',
    imageurl: 'imageUrl',
    userid: 'userId',
    approveddatetime: 'approvedDateTime',
    eventtype: 'eventType',
    eventstatus: 'eventStatus',
    approved_at: 'approvedAt',
    approved_by: 'approvedBy',
    created_at: 'createdAt',
    created_by: 'createdBy',
    created_by_name: 'createdByName',
    created_by_email: 'createdByEmail',
    user_id: 'userId',
    owner_id: 'ownerId',
    owner_name: 'ownerName',
    owner_email: 'ownerEmail',
    is_primary: 'isPrimary',
    display_order: 'displayOrder',
    updated_at: 'updatedAt',
  };
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      const key = k.toLowerCase();
      const mappedKey = map[key];
      if (mappedKey) {
        return [mappedKey, v];
      }
      // Pro nepřemapované klíče vrátit lowercase verzi
      return [key, v];
    })
  );
}

router.get('/artworks', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        a.id,
        a.title,
        a.description,
        COALESCE((
          SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
          FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 'skryto') as status,
        a.user_id,
        a.author_id,
        a.created_at,
        a.artwork_type_id,
        at.name as artwork_type_name,
        at.name_en as artwork_type_name_en,
        CASE 
          WHEN ai.image_url IS NOT NULL THEN 
            CASE 
              WHEN ai.image_url LIKE 'http%' THEN ai.image_url
              ELSE 'http://localhost:4777' || ai.image_url
            END
          ELSE NULL
        END as image_url,
        u.email as user_email,
        u.username as user_name,
        author.email as author_email,
        author.username as author_name,
        COALESCE((
          SELECT price FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) as price
      FROM artworks a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN users author ON a.author_id = author.id
      LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
      LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
      ORDER BY a.id DESC, ai.id ASC
    `);
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/authors - Get list of authors with artwork counts
router.get('/artworks/authors', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        a.author_id as id,
        u.username as name,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM artworks a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.author_id IS NOT NULL
      GROUP BY a.author_id, u.username, u.email
      ORDER BY u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in authors:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/owners - Get list of owners with artwork counts
router.get('/artworks/owners', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        a.user_id as id,
        u.username as name,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM artworks a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id IS NOT NULL
      GROUP BY a.user_id, u.username, u.email
      ORDER BY u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in owners:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/by-user/:userId - Get artworks by user with optional role filter
router.get('/artworks/by-user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { role } = req.query; // 'author' or 'owner'
  
  if (!role || (role !== 'author' && role !== 'owner')) {
    return res.status(400).json({ error: 'Role parameter must be "author" or "owner"' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    let query = `
      SELECT DISTINCT ON (a.id)
        a.id,
        a.title,
        a.description,
        COALESCE((
          SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
          FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 'skryto') as status,
        a.user_id,
        a.artwork_type_id,
        at.name as artwork_type_name,
        at.name_en as artwork_type_name_en,
        CASE 
          WHEN ai.image_url IS NOT NULL THEN 
            CASE 
              WHEN ai.image_url LIKE 'http%' THEN ai.image_url
              ELSE 'http://localhost:4777' || ai.image_url
            END
          ELSE NULL
        END as image_url,
        owner.email as user_email,
        owner.username as user_name,
        owner.bio as user_bio,
        NULL::text as author_name,
        NULL::text as author_email,
        NULL::text as author_bio,
        COALESCE((
          SELECT price FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) as price,
        COALESCE((
          SELECT approved_at FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), a.created_at) as approved_at
      FROM artworks a
      LEFT JOIN users owner ON a.user_id = owner.id
      LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
      LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true`;
    
    if (role === 'author') {
      // Author: use artworks.author_id directly
      query = query.replace(
        'NULL::text as author_name,\n        NULL::text as author_email,\n        NULL::text as author_bio,',
        'author.username as author_name,\n        author.email as author_email,\n        author.bio as author_bio,'
      );
      query += ` 
        LEFT JOIN users author ON a.author_id = author.id
        WHERE a.author_id = $1
        ORDER BY a.id DESC, ai.id ASC`;
    } else {
      // Owner: user_id matches
      query += ` 
        WHERE a.user_id = $1
        ORDER BY a.id DESC, ai.id ASC`;
    }
    
    const result = await client.query(query, [userId]);
    
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    console.error('Error in by-user:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/statuses-by-user/:userId - Get statuses with counts for user
router.get('/artworks/statuses-by-user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { role } = req.query; // 'author' or 'owner'
  
  if (!role || (role !== 'author' && role !== 'owner')) {
    return res.status(400).json({ error: 'Role parameter must be "author" or "owner"' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const userIdColumn = role === 'author' ? 'author_id' : 'user_id';
    const result = await client.query(`
      SELECT 
        COALESCE(
          LOWER(REPLACE(e.details::json->>'status', ' ', '_')),
          'skryto'
        ) as status,
        COUNT(DISTINCT a.id) as count
      FROM artworks a
      LEFT JOIN (
        SELECT DISTINCT ON (artwork_id)
          artwork_id,
          details
        FROM events
        WHERE approved_at IS NOT NULL AND status = 'approved'
        ORDER BY artwork_id, created_at DESC
      ) e ON a.id = e.artwork_id
      WHERE a.${userIdColumn} = $1
      GROUP BY status
      ORDER BY status
    `, [userId]);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in statuses-by-user:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/approved - Public gallery with approved events and pricing
router.get('/artworks/approved', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    
    // Get latest approved event per title (deduplicate by title, show only most recent)
    const result = await client.query(`
      SELECT DISTINCT ON (a.title)
        a.id,
        a.title,
        a.description,
        a.artwork_type_id,
        at.name as artwork_type_name,
        at.name_en as artwork_type_name_en,
        COALESCE((
          SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
          FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 'skryto') as status,
        CASE 
          WHEN ai.image_url IS NOT NULL THEN 
            CASE 
              WHEN ai.image_url LIKE 'http%' THEN ai.image_url
              ELSE 'http://localhost:4777' || ai.image_url
            END
          ELSE NULL
        END as image_url,
        a.user_id,
        u.email as user_email,
        u.username as user_name,
        u.bio as user_bio,
        a.author_id as author_id,
        author.username as author_name,
        author.email as author_email,
        author.bio as author_bio,
        e.price,
        e.approved_at,
        e.type as event_type,
        e.status as event_status
      FROM artworks a
      LEFT JOIN events e ON a.id = e.artwork_id AND e.approved_at IS NOT NULL AND e.status = 'approved'
      LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
      LEFT JOIN users author ON a.author_id = author.id
      WHERE e.approved_at IS NOT NULL AND e.status = 'approved'
      ORDER BY a.title, e.created_at DESC, ai.id ASC
    `);
    
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/types-by-status - Get artwork types with count for specific status
router.get('/artworks/types-by-status', async (req, res) => {
  const { status } = req.query;
  
  if (!status) {
    return res.status(400).json({ error: 'Status parameter is required' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    // Get artwork types with count of artworks having the specified status
    const result = await client.query(`
      SELECT 
        at.id,
        at.name,
        at.name_en,
        COUNT(DISTINCT a.id) as count
      FROM artwork_types at
      LEFT JOIN artworks a ON at.id = a.artwork_type_id
      LEFT JOIN (
        SELECT DISTINCT ON (artwork_id)
          artwork_id,
          LOWER(REPLACE(details::json->>'status', ' ', '_')) as latest_status
        FROM events
        WHERE approved_at IS NOT NULL AND status = 'approved'
        ORDER BY artwork_id, created_at DESC
      ) latest_events ON a.id = latest_events.artwork_id
      WHERE COALESCE(latest_events.latest_status, 'skryto') = $1
      GROUP BY at.id, at.name, at.name_en
      HAVING COUNT(DISTINCT a.id) > 0
      ORDER BY at.name
    `, [status]);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in types-by-status:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/authors - Get list of authors with artwork counts
router.get('/artworks/authors', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT DISTINCT
        a.author_id as id,
        u.username as name,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM artworks a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.author_id IS NOT NULL
      GROUP BY a.author_id, u.username, u.email
      ORDER BY u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in authors:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/owners - Get list of owners with artwork counts
router.get('/artworks/owners', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT DISTINCT
        a.user_id as id,
        u.username as name,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM artworks a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id IS NOT NULL
      GROUP BY a.user_id, u.username, u.email
      ORDER BY u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in owners:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/by-user/:userId/statuses - Get status counts for specific user
router.get('/artworks/by-user/:userId/statuses', async (req, res) => {
  const { userId } = req.params;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        COALESCE(latest_events.latest_status, 'skryto') as status,
        COUNT(DISTINCT a.id) as count
      FROM artworks a
      LEFT JOIN (
        SELECT DISTINCT ON (artwork_id)
          artwork_id,
          LOWER(REPLACE(details::json->>'status', ' ', '_')) as latest_status
        FROM events
        WHERE approved_at IS NOT NULL AND status = 'approved'
        ORDER BY artwork_id, created_at DESC
      ) latest_events ON a.id = latest_events.artwork_id
      WHERE a.user_id = $1 OR a.author_id = $1
      GROUP BY status
      ORDER BY status
    `, [userId]);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in by-user statuses:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/authors - Get list of authors with artwork counts
router.get('/artworks/authors', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM users u
      LEFT JOIN artworks a ON u.id = a.author_id
      WHERE a.id IS NOT NULL
      GROUP BY u.id, u.username, u.email
      ORDER BY COUNT(DISTINCT a.id) DESC, u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in authors:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/owners - Get list of owners with artwork counts
router.get('/artworks/owners', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM users u
      LEFT JOIN artworks a ON u.id = a.user_id
      WHERE a.id IS NOT NULL
      GROUP BY u.id, u.username, u.email
      ORDER BY COUNT(DISTINCT a.id) DESC, u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in owners:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/by-author/:authorId - Get artworks by author with status filter
router.get('/artworks/by-author/:authorId', async (req, res) => {
  const { authorId } = req.params;
  const { status } = req.query;
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    let query = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.artwork_type_id,
        at.name as artwork_type_name,
        at.name_en as artwork_type_name_en,
        COALESCE((
          SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
          FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 'skryto') as status,
        CASE 
          WHEN ai.image_url IS NOT NULL THEN 
            CASE 
              WHEN ai.image_url LIKE 'http%' THEN ai.image_url
              ELSE 'http://localhost:4777' || ai.image_url
            END
          ELSE NULL
        END as image_url,
        a.user_id,
        u.email as user_email,
        u.username as user_name,
        COALESCE((
          SELECT price FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) as price
      FROM artworks a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
      LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
      WHERE a.author_id = $1
    `;
    
    if (status) {
      query += ` AND COALESCE((
        SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
        FROM events 
        WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
        ORDER BY created_at DESC 
        LIMIT 1
      ), 'skryto') = $2`;
    }
    
    query += ` ORDER BY a.id DESC, ai.id ASC`;
    
    const params = status ? [authorId, status] : [authorId];
    const result = await client.query(query, params);
    
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    console.error('Error in by-author:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/by-owner/:ownerId - Get artworks by owner with status filter
router.get('/artworks/by-owner/:ownerId', async (req, res) => {
  const { ownerId } = req.params;
  const { status } = req.query;
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    let query = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.artwork_type_id,
        at.name as artwork_type_name,
        at.name_en as artwork_type_name_en,
        COALESCE((
          SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
          FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 'skryto') as status,
        CASE 
          WHEN ai.image_url IS NOT NULL THEN 
            CASE 
              WHEN ai.image_url LIKE 'http%' THEN ai.image_url
              ELSE 'http://localhost:4777' || ai.image_url
            END
          ELSE NULL
        END as image_url,
        a.user_id,
        u.email as user_email,
        u.username as user_name,
        COALESCE((
          SELECT price FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) as price
      FROM artworks a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
      LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
      WHERE a.user_id = $1
    `;
    
    if (status) {
      query += ` AND COALESCE((
        SELECT LOWER(REPLACE(details::json->>'status', ' ', '_'))
        FROM events 
        WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
        ORDER BY created_at DESC 
        LIMIT 1
      ), 'skryto') = $2`;
    }
    
    query += ` ORDER BY a.id DESC, ai.id ASC`;
    
    const params = status ? [ownerId, status] : [ownerId];
    const result = await client.query(query, params);
    
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    console.error('Error in by-owner:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/authors - Get all authors with artwork counts
router.get('/artworks/authors', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        u.id,
        u.username as name,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM users u
      INNER JOIN artworks a ON u.id = a.author_id
      GROUP BY u.id, u.username, u.email
      HAVING COUNT(DISTINCT a.id) > 0
      ORDER BY u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in authors:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/owners - Get all owners with artwork counts
router.get('/artworks/owners', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        u.id,
        u.username as name,
        u.email,
        COUNT(DISTINCT a.id) as count
      FROM users u
      INNER JOIN artworks a ON u.id = a.user_id
      GROUP BY u.id, u.username, u.email
      HAVING COUNT(DISTINCT a.id) > 0
      ORDER BY u.username
    `);
    
    await client.end();
    res.json(result.rows);
  } catch (err) {
    console.error('Error in owners:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artwork-events
router.get('/artwork-events', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM artwork_events');
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/artworks - Create new artwork
import { authenticateToken } from './auth.js';

router.post('/artworks', authenticateToken, async (req, res) => {
  const { title, description, userId, authorId, artworkTypeId } = req.body;
  const currentUserId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  // Pokud admin specifiková userId, použij to, jinak použij přihlášeného uživatele
  const finalUserId = isAdmin && userId ? userId : currentUserId;
  
  // Autor - pokud specifikován, použij to, jinak přihlášený uživatel
  const finalAuthorId = authorId || currentUserId;
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Validate artwork type if provided (admins can use any type)
    if (artworkTypeId && !isAdmin) {
      const typeCheck = await client.query(
        `SELECT * FROM user_artwork_types 
         WHERE user_id = $1 AND artwork_type_id = $2 AND approved = true`,
        [finalAuthorId, artworkTypeId]
      );
      
      if (typeCheck.rows.length === 0) {
        await client.end();
        return res.status(403).json({ 
          error: 'artworkTypeNotApproved',
          message: 'You do not have this artwork type approved in your profile' 
        });
      }
    }
    
    const result = await client.query(
      'INSERT INTO artworks (title, description, user_id, author_id, artwork_type_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, finalUserId, finalAuthorId, artworkTypeId || null]
    );
    
    // Create event for audit log
    const artwork = result.rows[0];
    const eventDetails = JSON.stringify({
      title,
      status: 'Skryto'
    });
    
    // If admin, auto-approve the event
    if (isAdmin) {
      await client.query(
        'INSERT INTO events (artwork_id, type, status, details, created_by, owner_id, price, approved_at, approved_by) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)',
        [artwork.id, 'created', 'approved', eventDetails, currentUserId, finalUserId, 0, currentUserId]
      );
    } else {
      await client.query(
        'INSERT INTO events (artwork_id, type, status, details, created_by, owner_id, price) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [artwork.id, 'created', 'pending', eventDetails, currentUserId, finalUserId, 0]
      );
    }
    
    await client.end();
    res.json(toCamel(artwork));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/artworks/:id - Update artwork
router.put('/artworks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, userId, artworkTypeId, authorId } = req.body;
  const currentUserId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Check ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== currentUserId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to modify this artwork' });
    }
    
    const oldArtwork = artwork.rows[0];

    // Author is immutable: block any attempt to change author_id
    if (authorId && Number(authorId) !== Number(oldArtwork.author_id)) {
      await client.end();
      return res.status(403).json({ error: 'Author cannot be changed' });
    }
    // Pokud admin specifikoval userId, použij to, jinak použij původního vlastníka
    const finalUserId = isAdmin && userId ? userId : oldArtwork.user_id;
    
    // Validate artwork type if provided (admins can use any type)
    if (artworkTypeId && !isAdmin) {
      const typeCheck = await client.query(
        `SELECT * FROM user_artwork_types 
         WHERE user_id = $1 AND artwork_type_id = $2 AND approved = true`,
        [oldArtwork.author_id, artworkTypeId]
      );
      
      if (typeCheck.rows.length === 0) {
        await client.end();
        return res.status(403).json({ 
          error: 'artworkTypeNotApproved',
          message: 'You do not have this artwork type approved in your profile' 
        });
      }
    }
    
    const result = await client.query(
      'UPDATE artworks SET title = $1, description = $2, user_id = $3, artwork_type_id = $4 WHERE id = $5 RETURNING *',
      [title, description, finalUserId, artworkTypeId || null, id]
    );
    
    // Create event for audit log
    // Get current status and price from latest approved event
    const statusResult = await client.query(`
      SELECT details, price
      FROM events 
      WHERE artwork_id = $1 AND approved_at IS NOT NULL AND status = 'approved'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [id]);
    
    let currentStatus = 'Skryto';
    let currentPrice = 0;
    if (statusResult.rows.length > 0) {
      const details = JSON.parse(statusResult.rows[0].details || '{}');
      if (details.status) {
        currentStatus = details.status;
      }
      currentPrice = statusResult.rows[0].price || 0;
    }
    
    const eventDetails = JSON.stringify({
      title,
      description,
      status: currentStatus
    });
    
    // If admin, auto-approve the event
    if (isAdmin) {
      await client.query(
        'INSERT INTO events (artwork_id, type, status, details, created_by, owner_id, price, approved_at, approved_by) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)',
        [id, 'updated', 'approved', eventDetails, currentUserId, finalUserId, currentPrice, currentUserId]
      );
    } else {
      await client.query(
        'INSERT INTO events (artwork_id, type, status, details, created_by, owner_id, price) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, 'updated', 'pending', eventDetails, currentUserId, oldArtwork.user_id, currentPrice]
      );
    }
    
    await client.end();
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/artworks/:id - Delete artwork
router.delete('/artworks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Check ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to delete this artwork' });
    }
    
    // Create event for audit log
    const eventDetails = JSON.stringify({
      title: artwork.rows[0].title
    });
    
    // If admin, auto-approve the event
    if (isAdmin) {
      await client.query(
        'INSERT INTO events (artwork_id, type, status, details, created_by, approved_at, approved_by) VALUES ($1, $2, $3, $4, $5, NOW(), $6)',
        [id, 'deleted', 'approved', eventDetails, userId, userId]
      );
    } else {
      await client.query(
        'INSERT INTO events (artwork_id, type, status, details, created_by) VALUES ($1, $2, $3, $4, $5)',
        [id, 'deleted', 'pending', eventDetails, userId]
      );
    }
    
    await client.query('DELETE FROM artworks WHERE id = $1', [id]);
    await client.end();
    res.json({ success: true });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/:id/images - Get all images for an artwork
router.get('/artworks/:id/images', async (req, res) => {
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query(
      'SELECT * FROM artwork_images WHERE artwork_id = $1 ORDER BY display_order, is_primary DESC',
      [id]
    );
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/artworks/:id/images - Add new image to artwork
router.post('/artworks/:id/images', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { imageUrl, isPrimary } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'Image URL is required' });
  }
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check artwork ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to add images to this artwork' });
    }
    
    // If marking as primary, unset previous primary
    if (isPrimary) {
      await client.query(
        'UPDATE artwork_images SET is_primary = false WHERE artwork_id = $1',
        [id]
      );
    }
    
    // Get max display_order
    const orderResult = await client.query(
      'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM artwork_images WHERE artwork_id = $1',
      [id]
    );
    const nextOrder = orderResult.rows[0].next_order;
    
    // Insert new image
    const result = await client.query(
      'INSERT INTO artwork_images (artwork_id, image_url, is_primary, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, imageUrl, isPrimary || false, nextOrder]
    );
    
    await client.end();
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/artworks/:id/images/:imageId - Update image (set as primary, reorder)
router.put('/artworks/:id/images/:imageId', authenticateToken, async (req, res) => {
  const { id, imageId } = req.params;
  const { isPrimary, displayOrder } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check artwork ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to modify this artwork' });
    }
    
    // If marking as primary, unset previous primary
    if (isPrimary) {
      await client.query(
        'UPDATE artwork_images SET is_primary = false WHERE artwork_id = $1',
        [id]
      );
    }
    
    // Update image
    const fields = [];
    const values = [];
    let idx = 1;
    
    if (isPrimary !== undefined) {
      fields.push(`is_primary = $${idx++}`);
      values.push(isPrimary);
    }
    if (displayOrder !== undefined) {
      fields.push(`display_order = $${idx++}`);
      values.push(displayOrder);
    }
    
    if (fields.length === 0) {
      await client.end();
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, imageId);
    
    const result = await client.query(
      `UPDATE artwork_images SET ${fields.join(', ')} WHERE artwork_id = $${idx} AND id = $${idx + 1} RETURNING *`,
      values
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/artworks/:id/images/:imageId - Delete image
router.delete('/artworks/:id/images/:imageId', authenticateToken, async (req, res) => {
  const { id, imageId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check artwork ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to modify this artwork' });
    }
    
    // Delete image
    const result = await client.query(
      'DELETE FROM artwork_images WHERE id = $1 AND artwork_id = $2 RETURNING *',
      [imageId, id]
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/:id/images - Get all images for artwork
router.get('/artworks/:id/images', async (req, res) => {
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      'SELECT * FROM artwork_images WHERE artwork_id = $1 ORDER BY display_order, is_primary DESC',
      [id]
    );
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/artworks/:id/images/:imageId - Update image (set as primary, reorder)
router.put('/artworks/:id/images/:imageId', authenticateToken, async (req, res) => {
  const { id, imageId } = req.params;
  const { isPrimary, displayOrder } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Check ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // If setting as primary, unset others
    if (isPrimary) {
      await client.query(
        'UPDATE artwork_images SET is_primary = false WHERE artwork_id = $1',
        [id]
      );
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (isPrimary !== undefined) {
      updates.push(`is_primary = $${paramCount++}`);
      values.push(isPrimary);
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(displayOrder);
    }
    
    if (updates.length === 0) {
      await client.end();
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(imageId);
    values.push(id);
    
    const result = await client.query(
      `UPDATE artwork_images SET ${updates.join(', ')} WHERE id = $${paramCount++} AND artwork_id = $${paramCount++} RETURNING *`,
      values
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/artworks/:id/images/:imageId - Delete image
router.delete('/artworks/:id/images/:imageId', authenticateToken, async (req, res) => {
  const { id, imageId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Check ownership
    const artwork = await client.query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (artwork.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (!isAdmin && artwork.rows[0].user_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const result = await client.query(
      'DELETE FROM artwork_images WHERE id = $1 AND artwork_id = $2 RETURNING *',
      [imageId, id]
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artworks/:artworkId/events - Get all events for specific artwork
router.get('/artworks/:artworkId/events', async (req, res) => {
  const { artworkId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT e.*, 
             u.username as created_by_name, 
             u.email as created_by_email,
             owner_u.id as owner_id,
             owner_u.username as owner_name, 
             owner_u.email as owner_email
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN users owner_u ON e.owner_id = owner_u.id
      WHERE e.artwork_id = $1
      ORDER BY e.created_at DESC
    `, [artworkId]);
    await client.end();
    res.json(result.rows.map(toCamel));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/artworks/:artworkId/events - Create new event for artwork
router.post('/artworks/:artworkId/events', authenticateToken, async (req, res) => {
  const { artworkId } = req.params;
  const { type, price, details } = req.body;
  const currentUserId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Verify artwork exists
    const artworkCheck = await client.query('SELECT id FROM artworks WHERE id = $1', [artworkId]);
    if (artworkCheck.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    // Parse details to check if trying to set status to "Prodáno"
    let parsedDetails = {};
    if (details) {
      try {
        parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
      } catch (e) {
        // If details is not JSON, treat as plain text
        parsedDetails = { status: details };
      }
    }
    
    // Prevent manual setting of "Prodáno" status - can only be done via payment/purchase
    if (parsedDetails.status === 'Prodáno') {
      await client.end();
      return res.status(400).json({ error: 'Status "Prodáno" se nastavuje automaticky při nákupu. Není možno ho nastavit ručně.' });
    }
    
    // If admin, auto-approve the event
    let result;
    if (isAdmin) {
      result = await client.query(`
        INSERT INTO events (artwork_id, type, status, details, created_by, price, approved_at, approved_by)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        RETURNING *
      `, [artworkId, type || 'status_change', 'approved', details || '', currentUserId, price || 0, currentUserId]);
    } else {
      result = await client.query(`
        INSERT INTO events (artwork_id, type, status, details, created_by, price)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [artworkId, type || 'status_change', 'pending', details || '', currentUserId, price || 0]);
    }
    
    await client.end();
    res.status(201).json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/artworks/:artworkId/events/:eventId - Delete event
router.delete('/artworks/:artworkId/events/:eventId', async (req, res) => {
  const { artworkId, eventId } = req.params;
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    const result = await client.query(`
      DELETE FROM events 
      WHERE id = $1 AND artwork_id = $2
      RETURNING id
    `, [eventId, artworkId]);
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

export default router;


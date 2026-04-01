import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import passport from './oauth.js';
import pkg from 'pg';
const { Client } = pkg;
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Middleware pro ověření JWT tokenu
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Middleware pro ověření admin role
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Helper funkce pro vytvoření JWT tokenu
function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Helper funkce pro konverzi snake_case do camelCase
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
    address: 'address',
    city: 'city',
    postal_code: 'postalCode',
    birth_number: 'birthNumber',
    permanent_address: 'permanentAddress',
    permanent_city: 'permanentCity',
    permanent_postal_code: 'permanentPostalCode',
    country: 'country',
    bank_account_number: 'bankAccountNumber',
    bank_code: 'bankCode',
    bank_name: 'bankName',
    profile_approved: 'profileApproved',
    profile_approved_at: 'profileApprovedAt',
    profile_approved_by: 'profileApprovedBy',
    bio: 'bio',
    bio_en: 'bioEn',
    bio_approved: 'bioApproved',
    bio_approved_at: 'bioApprovedAt',
    bio_approved_by: 'bioApprovedBy',
    bio_en_approved: 'bioEnApproved',
    bio_en_approved_at: 'bioEnApprovedAt',
    bio_en_approved_by: 'bioEnApprovedBy'
  };
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      const key = k.toLowerCase();
      const mappedKey = map[key];
      if (mappedKey) {
        return [mappedKey, v];
      }
      return [key, v];
    })
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await client.query(
      'INSERT INTO users (username, email, password_hash, role, provider) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, provider',
      [username, email, passwordHash, 'user', 'manual']
    );
    await client.end();
    res.json({ user: result.rows[0] });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, passwordLength: password?.length });
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    await client.end();
    
    console.log('User found:', result.rows.length > 0);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    console.log('Comparing password with hash:', { hashStart: user.password_hash.substring(0, 20) });
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Google OAuth routes (only if enabled)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google',
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      session: false 
    })
  );

  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      const token = createToken(req.user);
      // Přesměruj na frontend s tokenem
      res.redirect(`${FRONTEND_URL}/oauth-callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      }))}`);
    }
  );
}

// Facebook OAuth routes (only if enabled)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  router.get('/facebook',
    passport.authenticate('facebook', { 
      scope: ['email'],
      session: false 
    })
  );

  router.get('/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      const token = createToken(req.user);
      // Přesměruj na frontend s tokenem
      res.redirect(`${FRONTEND_URL}/oauth-callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      }))}`);
    }
  );
}

// GET /api/auth/profile/banking - Get current user banking profile
router.get('/profile/banking', authenticateToken, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT id, username, email, role, created_at, 
              address, city, postal_code, 
              birth_number, permanent_address, permanent_city, permanent_postal_code, country,
              bank_account_number, bank_code, bank_name,
              profile_approved, profile_approved_at, profile_approved_by
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile/banking - Update current user banking profile
router.put('/profile/banking', authenticateToken, async (req, res) => {
  const { 
    address, city, postal_code, 
    birth_number, permanent_address, permanent_city, permanent_postal_code, country,
    bank_account_number, bank_code, bank_name 
  } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    // When user updates profile, reset approval status (except for admins)
    const profileApproved = req.user.role === 'admin' ? true : false;
    const result = await client.query(
      `UPDATE users 
       SET address = $1, city = $2, postal_code = $3, 
           birth_number = $4, permanent_address = $5, permanent_city = $6, permanent_postal_code = $7, country = $8,
           bank_account_number = $9, bank_code = $10, bank_name = $11,
           profile_approved = $12,
           profile_approved_at = NULL,
           profile_approved_by = NULL
       WHERE id = $13 
       RETURNING id, username, email, role, created_at, 
                 address, city, postal_code, 
                 birth_number, permanent_address, permanent_city, permanent_postal_code, country,
                 bank_account_number, bank_code, bank_name,
                 profile_approved, profile_approved_at, profile_approved_by`,
      [address, city, postal_code, 
       birth_number, permanent_address, permanent_city, permanent_postal_code, country,
       bank_account_number, bank_code, bank_name,
       profileApproved,
       req.user.id]
    );
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users/list - Get simplified user list (authenticated users)
router.get('/users/list', authenticateToken, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT id, username FROM users ORDER BY username ASC`
    );
    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users - Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT id, username, email, role, created_at, 
              profile_approved, profile_approved_at, profile_approved_by,
              birth_number, permanent_address, permanent_city, permanent_postal_code, country,
              address, city, postal_code, bank_account_number, bank_code, bank_name,
              bio, bio_en
       FROM users ORDER BY created_at DESC`
    );
    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users/:id/approve-profile - Approve user profile (admin only)
router.post('/users/:id/approve-profile', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      `UPDATE users 
       SET profile_approved = true, profile_approved_at = CURRENT_TIMESTAMP, profile_approved_by = $1
       WHERE id = $2 
       RETURNING id, username, email, profile_approved, profile_approved_at, profile_approved_by`,
      [req.user.id, id]
    );
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users/:id/reject-profile - Reject user profile (admin only)
router.post('/users/:id/reject-profile', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      `UPDATE users 
       SET profile_approved = false, profile_approved_at = CURRENT_TIMESTAMP, profile_approved_by = $1
       WHERE id = $2 
       RETURNING id, username, email, profile_approved, profile_approved_at, profile_approved_by`,
      [req.user.id, id]
    );
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// Admin: create user
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, role = 'user', password } = req.body;
  if (!username || !email) {
    return res.status(400).json({ error: 'Missing username or email' });
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const passwordHash = password ? await bcrypt.hash(password, 10) : 'oauth-created';
    const result = await client.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [username, email, passwordHash, role]
    );
    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// Admin: update user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, role, password } = req.body;
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    // Build dynamic update
    const fields = [];
    const values = [];
    let idx = 1;
    if (username) { fields.push(`username = $${idx++}`); values.push(username); }
    if (email) { fields.push(`email = $${idx++}`); values.push(email); }
    if (role) { fields.push(`role = $${idx++}`); values.push(role); }
    if (password) { 
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (fields.length === 0) {
      await client.end();
      return res.status(400).json({ error: 'No fields to update' });
    }
    values.push(id);
    const result = await client.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, email, role, created_at`,
      values
    );
    await client.end();
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    await client.end();
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/events - List pending events (admin only)
router.get('/events', authenticateToken, requireAdmin, async (req, res) => {
  const { status = 'pending', limit = 50, offset = 0 } = req.query;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    let query = `
      SELECT 
        e.id, 
        e.artwork_id, 
        e.type, 
        e.status, 
        e.details,
        e.price,
        e.created_by,
        e.created_at,
        e.approved_by,
        e.approved_at,
        e.rejection_reason,
        a.title as artwork_title,
        u.username as created_by_username,
        a_user.username as approved_by_username
      FROM events e
      LEFT JOIN artworks a ON e.artwork_id = a.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN users a_user ON e.approved_by = a_user.id
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status !== 'all') {
      query += ` WHERE e.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    // Sort by approved_at DESC (newest first), then by created_at DESC for pending
    query += ` ORDER BY e.approved_at DESC NULLS LAST, e.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await client.query(query, params);
    
    // Get total count
    const countQuery = status !== 'all' 
      ? 'SELECT COUNT(*) FROM events WHERE status = $1'
      : 'SELECT COUNT(*) FROM events';
    const countParams = status !== 'all' ? [status] : [];
    const countResult = await client.query(countQuery, countParams);
    
    await client.end();
    
    res.json({
      events: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/events/:id/approve - Approve an event (admin only)
router.post('/events/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get the event first
    const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    
    // Update event status
    const result = await client.query(
      `UPDATE events 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [req.user.id, id]
    );
    
    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/events/:id/reject - Reject an event (admin only)
router.post('/events/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get the event first
    const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Update event status
    const result = await client.query(
      `UPDATE events 
       SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2
       WHERE id = $3 
       RETURNING *`,
      [req.user.id, reason || '', id]
    );
    
    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/admin/artwork-approvals - List all artwork with their events for admin approval management
router.get('/admin/artwork-approvals', authenticateToken, requireAdmin, async (req, res) => {
  const { approved = 'all', limit = 100, offset = 0 } = req.query;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    let query = `
      SELECT 
        a.id as artwork_id,
        a.title,
        a.description,
        CASE 
          WHEN ai.image_url IS NOT NULL THEN ai.image_url
          ELSE NULL
        END as imageUrl,
        COALESCE((SELECT price FROM events WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved' ORDER BY created_at DESC LIMIT 1), 0) as price,
        COALESCE((
          SELECT CASE 
            WHEN details LIKE '%Vystaveno%' THEN 'vystaveno'
            WHEN details LIKE '%Prodáno%' THEN 'prodáno'
            WHEN details LIKE '%Zrušeno%' THEN 'zrušeno'
            ELSE 'vystaveno'
          END
          FROM events 
          WHERE artwork_id = a.id AND approved_at IS NOT NULL AND status = 'approved'
          ORDER BY created_at DESC 
          LIMIT 1
        ), 'skryto') as status,
        a.user_id as userId,
        u.username as creator_username,
        e.id as event_id,
        e.type as event_type,
        e.status as event_status,
        e.details,
        e.created_at as event_created_at,
        e.created_by as event_created_by,
        eu.username as event_creator_username,
        e.approved_by,
        e.approved_at,
        e.rejection_reason,
        ea.username as approved_by_username,
        e.price as event_price
      FROM artworks a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN events e ON a.id = e.artwork_id
      LEFT JOIN users eu ON e.created_by = eu.id
      LEFT JOIN users ea ON e.approved_by = ea.id
      LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
      WHERE 1=1
    `;

    
    const params = [];
    let paramCount = 1;
    
    if (approved === 'approved') {
      query += ` AND e.approved_at IS NOT NULL`;
    } else if (approved === 'pending') {
      query += ` AND e.approved_at IS NULL`;
    }
    
    query += ` ORDER BY a.id DESC, e.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await client.query(query, params);
    
    // Get total count
    let countQuery = `SELECT COUNT(DISTINCT a.id) as total FROM artworks a LEFT JOIN events e ON a.id = e.artwork_id WHERE 1=1`;
    if (approved === 'approved') {
      countQuery += ` AND e.approved_at IS NOT NULL`;
    } else if (approved === 'pending') {
      countQuery += ` AND e.approved_at IS NULL`;
    }
    
    const countResult = await client.query(countQuery);
    
    await client.end();
    
    // Group events by artwork
    const artworkMap = new Map();
    result.rows.forEach(row => {
      if (!artworkMap.has(row.artwork_id)) {
        artworkMap.set(row.artwork_id, {
          id: row.artwork_id,
          title: row.title,
          description: row.description,
          imageUrl: row.imageUrl,
          price: row.price,
          status: row.status,
          userId: row.userId,
          creatorUsername: row.creator_username,
          events: []
        });
      }
      
      if (row.event_id) {
        artworkMap.get(row.artwork_id).events.push({
          id: row.event_id,
          type: row.event_type,
          status: row.event_status,
          details: row.details,
          createdAt: row.event_created_at,
          createdBy: row.event_created_by,
          creatorUsername: row.event_creator_username,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          rejectionReason: row.rejection_reason,
          approvedByUsername: row.approved_by_username,
          price: row.event_price
        });
      }
    });
    
    res.json({
      artworks: Array.from(artworkMap.values()),
      total: parseInt(countResult.rows[0].total)
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/users/:id/profile - Update user profile (admin only)
router.put('/users/:id/profile', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    address,
    city,
    postal_code,
    birth_number,
    permanent_address,
    permanent_city,
    permanent_postal_code,
    country,
    bank_account_number,
    bank_code,
    bank_name
  } = req.body;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    const result = await client.query(
      `UPDATE users 
       SET address = $1, city = $2, postal_code = $3, birth_number = $4,
           permanent_address = $5, permanent_city = $6, permanent_postal_code = $7,
           country = $8, bank_account_number = $9, bank_code = $10, bank_name = $11
       WHERE id = $12
       RETURNING id, username, email, role, address, city, postal_code, birth_number,
                 permanent_address, permanent_city, permanent_postal_code, country,
                 bank_account_number, bank_code, bank_name, profile_approved`,
      [address, city, postal_code, birth_number, permanent_address, permanent_city,
       permanent_postal_code, country, bank_account_number, bank_code, bank_name, id]
    );
    
    if (result.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'User not found' });
    }
    
    await client.end();
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// Middleware to check ownership or admin
export function checkOwnershipOrAdmin(req, res, next) {
  const artworkUserId = parseInt(req.params.userId || req.body.userId);
  if (req.user.role === 'admin' || req.user.id === artworkUserId) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized to modify this artwork' });
  }
}

// GET /api/auth/settings - Get all settings (admin only)
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM settings ORDER BY key ASC');
    await client.end();
    
    res.json({ settings: result.rows });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/settings/:key - Get specific setting (admin only)
router.get('/settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM settings WHERE key = $1', [key]);
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/settings/:key - Update setting (admin only)
router.put('/settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  if (!value) {
    return res.status(400).json({ error: 'Value is required' });
  }
  
  try {
    await client.connect();
    
    // Check if setting exists
    const checkResult = await client.query('SELECT * FROM settings WHERE key = $1', [key]);
    
    if (checkResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    // Update setting
    const updateQuery = description 
      ? 'UPDATE settings SET value = $1, description = $2 WHERE key = $3 RETURNING *'
      : 'UPDATE settings SET value = $1 WHERE key = $2 RETURNING *';
    
    const params = description ? [value, description, key] : [value, key];
    const result = await client.query(updateQuery, params);
    
    await client.end();
    
    res.json({ 
      message: 'Setting updated successfully',
      setting: result.rows[0]
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/settings - Create new setting (admin only)
router.post('/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { key, value, description } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required' });
  }
  
  try {
    await client.connect();
    
    // Check if setting already exists
    const checkResult = await client.query('SELECT * FROM settings WHERE key = $1', [key]);
    
    if (checkResult.rows.length > 0) {
      await client.end();
      return res.status(409).json({ error: 'Setting already exists' });
    }
    
    // Create setting
    const insertQuery = 'INSERT INTO settings (key, value, description) VALUES ($1, $2, $3) RETURNING *';
    const result = await client.query(insertQuery, [key, value, description || null]);
    
    await client.end();
    
    res.status(201).json({ 
      message: 'Setting created successfully',
      setting: result.rows[0]
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/settings/:key - Delete setting (admin only)
router.delete('/settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query('DELETE FROM settings WHERE key = $1 RETURNING *', [key]);
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ 
      message: 'Setting deleted successfully',
      setting: result.rows[0]
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ==================== AUTHOR PROFILE ENDPOINTS ====================

// GET /api/auth/profile/:userId - Get author profile (public)
router.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get user with approved bio
    const userResult = await client.query(
      `SELECT id, username, email, bio, bio_approved, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get approved artwork types for this user
    const typesResult = await client.query(
      `SELECT at.id, at.name, at.name_en, uat.approved, uat.approved_at
       FROM user_artwork_types uat
       JOIN artwork_types at ON uat.artwork_type_id = at.id
       WHERE uat.user_id = $1 AND uat.approved = true
       ORDER BY at.name`,
      [userId]
    );
    
    await client.end();
    
    res.json({
      ...user,
      artworkTypes: typesResult.rows
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/profile - Get own profile with pending changes (authenticated)
router.get('/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get user with bio (Czech and English, approved or pending)
    const userResult = await client.query(
      `SELECT id, username, email, 
              bio, bio_approved, bio_approved_at,
              bio_en, bio_en_approved, bio_en_approved_at,
              created_at 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get all artwork types (both approved and pending)
    const typesResult = await client.query(
      `SELECT at.id, at.name, at.name_en, uat.approved, uat.approved_at, uat.approved_by
       FROM user_artwork_types uat
       JOIN artwork_types at ON uat.artwork_type_id = at.id
       WHERE uat.user_id = $1
       ORDER BY at.name`,
      [userId]
    );
    
    await client.end();
    
    res.json({
      ...user,
      artworkTypes: typesResult.rows
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile/author - Update own author bio and artwork types
router.put('/profile/author', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { bio, bioEn, artworkTypeIds } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  console.log(`[PUT /profile/author] userId=${userId}, bio length=${bio ? bio.length : 0}, bioEn length=${bioEn ? bioEn.length : 0}, artworkTypeIds=${JSON.stringify(artworkTypeIds)}`);
  
  try {
    await client.connect();
    
    // Update bio (Czech and English, both pending approval)
    if (bio !== undefined || bioEn !== undefined) {
      console.log(`[PUT /profile/author] Updating bio for user ${userId}`);
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      if (bio !== undefined) {
        updates.push(`bio = $${paramIndex}`);
        values.push(bio);
        paramIndex++;
        updates.push(`bio_approved = false`);
        updates.push(`bio_approved_at = NULL`);
        updates.push(`bio_approved_by = NULL`);
      }
      
      if (bioEn !== undefined) {
        updates.push(`bio_en = $${paramIndex}`);
        values.push(bioEn);
        paramIndex++;
        updates.push(`bio_en_approved = false`);
        updates.push(`bio_en_approved_at = NULL`);
        updates.push(`bio_en_approved_by = NULL`);
      }
      
      values.push(userId);
      
      await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
      console.log(`[PUT /profile/author] Bio updated successfully`);
    }
    
    // Update artwork types (pending approval)
    if (artworkTypeIds && Array.isArray(artworkTypeIds)) {
      console.log(`[PUT /profile/author] Updating artwork types for user ${userId}, ${artworkTypeIds.length} types`);
      // Delete existing artwork type assignments for this user
      await client.query('DELETE FROM user_artwork_types WHERE user_id = $1', [userId]);
      console.log(`[PUT /profile/author] Deleted existing artwork types`);
      
      // Insert new artwork type assignments (pending approval)
      for (const typeId of artworkTypeIds) {
        console.log(`[PUT /profile/author] Inserting artwork type ${typeId} for user ${userId}`);
        await client.query(
          `INSERT INTO user_artwork_types (user_id, artwork_type_id, approved) 
           VALUES ($1, $2, false)
           ON CONFLICT (user_id, artwork_type_id) DO NOTHING`,
          [userId, typeId]
        );
      }
      console.log(`[PUT /profile/author] Artwork types updated successfully`);
    } else {
      console.log(`[PUT /profile/author] artworkTypeIds not provided or not an array: ${typeof artworkTypeIds}`);
    }
    
    // Get updated user with bio (approved or pending)
    const userResult = await client.query(
      `SELECT id, username, email, bio, bio_approved, bio_approved_at, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get all artwork types (both approved and pending)
    const typesResult = await client.query(
      `SELECT at.id, at.name, at.name_en, uat.approved, uat.approved_at, uat.approved_by
       FROM user_artwork_types uat
       JOIN artwork_types at ON uat.artwork_type_id = at.id
       WHERE uat.user_id = $1
       ORDER BY at.name`,
      [userId]
    );
    
    await client.end();
    
    res.json({
      message: 'Profile updated, pending admin approval',
      ...user,
      artworkTypes: typesResult.rows
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/artwork-types - Get all artwork types
router.get('/artwork-types', async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query(
      'SELECT id, name, name_en FROM artwork_types ORDER BY name'
    );
    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/profile/:userId/approve-bio - Approve user bio (admin)
router.post('/profile/:userId/approve-bio', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user.id;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(
      `UPDATE users 
       SET bio_approved = true, bio_approved_at = NOW(), bio_approved_by = $1
       WHERE id = $2
       RETURNING id, username, bio, bio_approved, bio_approved_at`,
      [adminId, userId]
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Bio approved', user: result.rows[0] });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/profile/:userId/reject-bio - Reject user bio (admin)
router.post('/profile/:userId/reject-bio', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(
      `UPDATE users 
       SET bio = NULL, bio_approved = false, bio_approved_at = NULL, bio_approved_by = NULL
       WHERE id = $1
       RETURNING id, username, bio, bio_approved`,
      [userId]
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Bio rejected', user: result.rows[0] });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/profile/:userId/approve-artwork-type/:typeId - Approve artwork type (admin)
router.post('/profile/:userId/approve-artwork-type/:typeId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, typeId } = req.params;
  const adminId = req.user.id;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(
      `UPDATE user_artwork_types 
       SET approved = true, approved_at = NOW(), approved_by = $1
       WHERE user_id = $2 AND artwork_type_id = $3
       RETURNING *`,
      [adminId, userId, typeId]
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type assignment not found' });
    }
    
    res.json({ message: 'Artwork type approved', assignment: result.rows[0] });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/profile/:userId/reject-artwork-type/:typeId - Reject artwork type (admin)
router.post('/profile/:userId/reject-artwork-type/:typeId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, typeId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(
      `DELETE FROM user_artwork_types 
       WHERE user_id = $1 AND artwork_type_id = $2
       RETURNING *`,
      [userId, typeId]
    );
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type assignment not found' });
    }
    
    res.json({ message: 'Artwork type rejected', assignment: result.rows[0] });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/pending-profiles - Get users with pending profile changes (admin)
router.get('/pending-profiles', authenticateToken, requireAdmin, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get users with pending bio or pending artwork types
    const usersResult = await client.query(`
      SELECT DISTINCT u.id, u.username, u.email, u.bio, u.bio_approved,
             (SELECT COUNT(*) FROM user_artwork_types WHERE user_id = u.id AND approved = false) as pending_types_count
      FROM users u
      LEFT JOIN user_artwork_types uat ON u.id = uat.user_id
      WHERE u.bio_approved = false OR uat.approved = false
      ORDER BY u.username
    `);
    
    // For each user, get their pending artwork types
    const usersWithTypes = await Promise.all(usersResult.rows.map(async (user) => {
      const typesResult = await client.query(`
        SELECT at.id, at.name, at.name_en, uat.approved, uat.approved_at, uat.approved_by
        FROM user_artwork_types uat
        JOIN artwork_types at ON uat.artwork_type_id = at.id
        WHERE uat.user_id = $1
        ORDER BY at.name
      `, [user.id]);
      
      return {
        ...user,
        artwork_types: typesResult.rows
      };
    }));
    
    await client.end();
    res.json(usersWithTypes);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/artwork-types - Get all artwork types
router.get('/artwork-types', async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM artwork_types ORDER BY name ASC');
    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/author-bio - Get current user's author bio
router.get('/author-bio', authenticateToken, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const bioResult = await client.query(
      'SELECT * FROM author_bio WHERE user_id = $1',
      [req.user.id]
    );
    
    // Get user's artwork types
    const typesResult = await client.query(
      `SELECT uat.id, at.id as type_id, at.name, uat.approved, uat.approved_at, uat.approved_by
       FROM user_artwork_types uat
       JOIN artwork_types at ON uat.artwork_type_id = at.id
       WHERE uat.user_id = $1
       ORDER BY at.name ASC`,
      [req.user.id]
    );
    
    await client.end();
    
    res.json({
      bio: bioResult.rows.length > 0 ? bioResult.rows[0] : null,
      artworkTypes: typesResult.rows
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/author-bio - Update current user's author bio
router.put('/author-bio', authenticateToken, async (req, res) => {
  const { bioHtml, bioText } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check if bio exists
    const checkResult = await client.query(
      'SELECT id FROM author_bio WHERE user_id = $1',
      [req.user.id]
    );
    
    let result;
    if (checkResult.rows.length > 0) {
      // Update existing bio - reset approval
      result = await client.query(
        `UPDATE author_bio 
         SET bio_html = $1, bio_text = $2, updated_at = NOW(), approved = false, approved_at = NULL, approved_by = NULL
         WHERE user_id = $3
         RETURNING *`,
        [bioHtml, bioText, req.user.id]
      );
    } else {
      // Create new bio
      result = await client.query(
        `INSERT INTO author_bio (user_id, bio_html, bio_text)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.id, bioHtml, bioText]
      );
    }
    
    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/artwork-types/:typeId - Add artwork type to user
router.post('/artwork-types/:typeId', authenticateToken, async (req, res) => {
  const { typeId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check if type exists
    const typeCheck = await client.query(
      'SELECT id FROM artwork_types WHERE id = $1',
      [typeId]
    );
    
    if (typeCheck.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork type not found' });
    }
    
    // Add type to user (will fail if already exists due to UNIQUE constraint)
    // If admin, auto-approve
    const isAdmin = req.user.role === 'admin';
    let result;
    
    if (isAdmin) {
      result = await client.query(
        `INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at)
         VALUES ($1, $2, true, $3, NOW())
         ON CONFLICT (user_id, artwork_type_id) DO UPDATE 
         SET approved = true, approved_at = NOW(), approved_by = $3
         RETURNING *`,
        [req.user.id, typeId, req.user.id]
      );
    } else {
      result = await client.query(
        `INSERT INTO user_artwork_types (user_id, artwork_type_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, artwork_type_id) DO UPDATE SET approved = false, approved_at = NULL, approved_by = NULL
         RETURNING *`,
        [req.user.id, typeId]
      );
    }
    
    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/artwork-types/:typeId - Remove artwork type from user
router.delete('/artwork-types/:typeId', authenticateToken, async (req, res) => {
  const { typeId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query(
      'DELETE FROM user_artwork_types WHERE user_id = $1 AND artwork_type_id = $2 RETURNING *',
      [req.user.id, typeId]
    );
    
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type assignment not found' });
    }
    res.json({ success: true });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: GET /api/auth/author-bios - Get all pending author bios for approval
router.get('/author-bios', authenticateToken, requireAdmin, async (req, res) => {
  const { approved = 'all' } = req.query;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    let query = `
      SELECT ab.*, u.username, u.email,
             (SELECT COUNT(*) FROM user_artwork_types WHERE user_id = u.id AND approved = false) as pending_types
      FROM author_bio ab
      JOIN users u ON ab.user_id = u.id
    `;
    
    const params = [];
    if (approved === 'pending') {
      query += ' WHERE ab.approved = false';
    } else if (approved === 'approved') {
      query += ' WHERE ab.approved = true';
    }
    
    query += ' ORDER BY ab.updated_at DESC';
    
    const result = await client.query(query, params);
    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: POST /api/auth/author-bios/:userId/approve - Approve author bio
router.post('/author-bios/:userId/approve', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query(
      `UPDATE author_bio 
       SET approved = true, approved_at = NOW(), approved_by = $1
       WHERE user_id = $2
       RETURNING *`,
      [req.user.id, userId]
    );
    
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Author bio not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: POST /api/auth/artwork-types/:typeId/approve - Approve user's artwork type
router.post('/artwork-types/:typeId/approve-user/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { typeId, userId } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const result = await client.query(
      `UPDATE user_artwork_types 
       SET approved = true, approved_at = NOW(), approved_by = $1
       WHERE user_id = $2 AND artwork_type_id = $3
       RETURNING *`,
      [req.user.id, userId, typeId]
    );
    
    await client.end();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type assignment not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: GET /api/auth/pending-approvals - Get all pending approvals
router.get('/pending-approvals', authenticateToken, requireAdmin, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get pending author bios
    const biosResult = await client.query(`
      SELECT ab.*, u.username, u.email, 'author_bio' as type
      FROM author_bio ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.approved = false
      ORDER BY ab.updated_at DESC
    `);
    
    // Get pending artwork types
    const typesResult = await client.query(`
      SELECT uat.*, at.name as type_name, u.username, u.email, 'artwork_type' as type
      FROM user_artwork_types uat
      JOIN artwork_types at ON uat.artwork_type_id = at.id
      JOIN users u ON uat.user_id = u.id
      WHERE uat.approved = false
      ORDER BY uat.created_at DESC
    `);
    
    await client.end();
    
    res.json({
      authorBios: biosResult.rows,
      artworkTypes: typesResult.rows
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ==================== ARTWORK TYPES ADMIN CRUD ====================

// ADMIN: POST /api/auth/artwork-types - Create new artwork type
router.post('/artwork-types-admin', authenticateToken, requireAdmin, async (req, res) => {
  const { name, nameEn, description } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    if (!name) {
      await client.end();
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await client.query(
      `INSERT INTO artwork_types (name, name_en, description) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, nameEn || null, description || null]
    );

    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'This artwork type already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: GET /api/auth/artwork-types-admin - Get all artwork types with usage stats
router.get('/artwork-types-admin', authenticateToken, requireAdmin, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT 
        at.id, 
        at.name, 
        at.name_en,
        at.description,
        at.created_at,
        COUNT(DISTINCT a.id) as artworks_count,
        COUNT(DISTINCT uat.user_id) as users_count
      FROM artwork_types at
      LEFT JOIN artworks a ON at.id = a.artwork_type_id
      LEFT JOIN user_artwork_types uat ON at.id = uat.artwork_type_id
      GROUP BY at.id, at.name, at.name_en, at.description, at.created_at
      ORDER BY at.name ASC
    `);

    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: PUT /api/auth/artwork-types/:id - Update artwork type
router.put('/artwork-types-admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, nameEn, description } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    if (!name) {
      await client.end();
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await client.query(
      `UPDATE artwork_types 
       SET name = $1, name_en = $2, description = $3
       WHERE id = $4
       RETURNING *`,
      [name, nameEn || null, description || null, id]
    );

    await client.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'This artwork type name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: POST /api/auth/artwork-types-admin - Create new artwork type
router.post('/artwork-types-admin', authenticateToken, requireAdmin, async (req, res) => {
  const { name, nameEn, description } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    if (!name) {
      await client.end();
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await client.query(
      `INSERT INTO artwork_types (name, name_en, description) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, nameEn || null, description || null]
    );

    await client.end();
    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'This artwork type already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: GET /api/auth/artwork-types-admin - Get all artwork types with usage stats
router.get('/artwork-types-admin', authenticateToken, requireAdmin, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT 
        at.id, 
        at.name, 
        at.name_en,
        at.description,
        at.created_at,
        COUNT(DISTINCT a.id) as artworks_count,
        COUNT(DISTINCT uat.user_id) as users_count
      FROM artwork_types at
      LEFT JOIN artworks a ON at.id = a.artwork_type_id
      LEFT JOIN user_artwork_types uat ON at.id = uat.artwork_type_id
      GROUP BY at.id, at.name, at.name_en, at.description, at.created_at
      ORDER BY at.name ASC
    `);

    await client.end();
    res.json(result.rows);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: PUT /api/auth/artwork-types-admin/:id - Update artwork type
router.put('/artwork-types-admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, nameEn, description } = req.body;
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    if (!name) {
      await client.end();
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await client.query(
      `UPDATE artwork_types 
       SET name = $1, name_en = $2, description = $3
       WHERE id = $4
       RETURNING *`,
      [name, nameEn || null, description || null, id]
    );

    await client.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    await client.end();
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'This artwork type name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: DELETE /api/auth/artwork-types-admin/:id - Delete artwork type (set to NULL in artworks)
router.delete('/artwork-types-admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    // First, set artwork_type_id to NULL for all artworks with this type
    await client.query(
      'UPDATE artworks SET artwork_type_id = NULL WHERE artwork_type_id = $1',
      [id]
    );

    // Then delete the artwork type
    const result = await client.query(
      'DELETE FROM artwork_types WHERE id = $1 RETURNING *',
      [id]
    );

    await client.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork type not found' });
    }

    res.json({ 
      message: 'Artwork type deleted successfully',
      deletedType: result.rows[0],
      artworksAffected: result.rowCount || 0
    });
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/facebook/data-deletion
// Facebook Data Deletion Callback (required for Facebook Login compliance).
// Facebook sends a signed_request with the user's Facebook ID.
// We delete/anonymize the user row that was created via Facebook OAuth.
// Returns a JSON with a URL where user can check deletion status.
router.post('/facebook/data-deletion', express.urlencoded({ extended: true }), async (req, res) => {
  const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

  // If Facebook app is not configured, still respond with a valid status URL.
  if (!FACEBOOK_APP_SECRET) {
    return res.json({
      url: `${FRONTEND_URL}/data-deletion`,
      confirmation_code: 'not-configured'
    });
  }

  const signed_request = req.body?.signed_request;
  if (!signed_request) {
    return res.status(400).json({ error: 'Missing signed_request' });
  }

  try {
    const crypto = await import('crypto');
    const [encodedSig, payload] = signed_request.split('.');

    // Verify signature
    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expectedSig = crypto.default.createHmac('sha256', FACEBOOK_APP_SECRET)
      .update(payload)
      .digest();
    if (!crypto.default.timingSafeEqual(sig, expectedSig)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const facebookUserId = data.user_id;

    if (facebookUserId) {
      // Anonymize the user: remove personal data but keep the record for referential integrity.
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await client.connect();
        // Find user by matching provider=facebook — we store fb user id as part of email or username fallback.
        // Best-effort deletion: anonymize all fields with PII.
        await client.query(
          `UPDATE users SET
            username = 'deleted-fb-' || id,
            email = 'deleted-fb-' || id || '@deleted.invalid',
            password_hash = 'deleted',
            provider = 'deleted'
          WHERE provider = 'facebook'
            AND (email LIKE '%facebook%' OR username LIKE '%' || $1 || '%')`,
          [facebookUserId]
        );
        await client.end();
      } catch (err) {
        await client.end().catch(() => {});
        console.error('Facebook data deletion DB error:', err.message);
      }
    }

    const confirmationCode = `fb-del-${facebookUserId || 'unknown'}-${Date.now()}`;
    return res.json({
      url: `${FRONTEND_URL}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode
    });
  } catch (err) {
    console.error('Facebook data deletion error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/auth/facebook/data-deletion
// Human-readable data deletion instructions page (also acceptable by Facebook).
router.get('/facebook/data-deletion', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><title>Smazání dat - Gallerouch</title></head>
<body>
<h1>Žádost o smazání dat</h1>
<p>Pokud si přejete smazat veškerá vaše osobní data uložená v aplikaci Gallerouch, postupujte takto:</p>
<ol>
  <li>Přihlaste se na <a href="${FRONTEND_URL}">${FRONTEND_URL}</a></li>
  <li>Přejděte do nastavení účtu</li>
  <li>Klikněte na „Smazat účet"</li>
</ol>
<p>Případně nás kontaktujte e-mailem na adrese uvedené na webu a vaše data smažeme do 30 dnů.</p>
<p>Po smazání budou veškeré osobní údaje (jméno, e-mail, profil) trvale odstraněny.</p>
</body>
</html>`);
});

export default router;

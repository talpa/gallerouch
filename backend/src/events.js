import express from 'express';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://gallerouch:gallerouch@db:5432/gallerouch',
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// GET /api/events - Get events for user or all (admin)
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { userId, status } = req.query;
    const userRole = req.user.role;
    
    let query = `
      SELECT e.*, 
             a.title as artwork_title,
             u.email as user_email,
             u.username as user_username,
             owner_u.id as owner_id,
             owner_u.username as owner_username,
             owner_u.email as owner_email,
             created_by_u.username as created_by_username,
             created_by_u.email as created_by_email
      FROM events e
      LEFT JOIN artworks a ON e.artwork_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN users owner_u ON e.owner_id = owner_u.id
      LEFT JOIN users created_by_u ON e.created_by = created_by_u.id
      WHERE 1=1
    `;
    const params = [];
    
    // If regular user, always filter by their user_id
    // If admin and userId is specified, filter by that userId
    if (userRole !== 'admin') {
      query += ` AND a.user_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (userId) {
      query += ` AND a.user_id = $${params.length + 1}`;
      params.push(userId);
    }
    
    // Filter by status if provided
    if (status && status !== 'all') {
      query += ` AND e.status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ' ORDER BY e.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events', details: err.message });
  }
});

// POST /api/events - Create new event
router.post('/events', authenticateToken, async (req, res) => {
  try {
    const { artwork_id, title, description, event_date, location, price } = req.body;
    
    // Verify user owns the artwork
    const ownershipCheck = await pool.query(
      'SELECT user_id FROM artworks WHERE id = $1',
      [artwork_id]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (req.user.role !== 'admin' && ownershipCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only create events for your own artworks' });
    }
    
    const result = await pool.query(
      `INSERT INTO events (artwork_id, title, description, event_date, location, price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING *`,
      [artwork_id, title, description, event_date, location, price || 0]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event', details: err.message });
  }
});

// DELETE /api/events/:id - Delete event (only pending events, owner or admin)
router.delete('/events/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Get event details
    const eventCheck = await pool.query(
      `SELECT e.*, a.user_id 
       FROM events e
       LEFT JOIN artworks a ON e.artwork_id = a.id
       WHERE e.id = $1`,
      [eventId]
    );
    
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventCheck.rows[0];
    
    // Only allow deletion of pending events
    if (event.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending events can be deleted' });
    }
    
    // Check ownership (admin can delete any, user only their own)
    if (req.user.role !== 'admin' && event.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }
    
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event', details: err.message });
  }
});

// PUT /api/events/:id/approve - Approve event (admin only)
router.put('/events/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve events' });
    }
    
    const result = await pool.query(
      `UPDATE events 
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error approving event:', err);
    res.status(500).json({ error: 'Failed to approve event', details: err.message });
  }
});

// PUT /api/events/:id/reject - Reject event (admin only)
router.put('/events/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reject events' });
    }
    
    const { reason } = req.body;
    
    const result = await pool.query(
      `UPDATE events 
       SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, reason || null]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error rejecting event:', err);
    res.status(500).json({ error: 'Failed to reject event', details: err.message });
  }
});

export default router;

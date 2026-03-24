import express from 'express';
import pkg from 'pg';
import { authenticateToken } from './auth.js';
const { Client } = pkg;
const router = express.Router();

// Helper function to get database connection
async function getPool() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://gallerouch:gallerouch@localhost:5433/gallerouch',
  });
  await client.connect();
  return client;
}

// POST /api/offers - Create a new price offer
router.post('/', authenticateToken, async (req, res) => {
  const { artworkId, offeredPrice, message } = req.body;
  const buyerId = req.user.id;

  const client = await getPool();
  try {
    // Validate input
    if (!artworkId || !offeredPrice) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    if (offeredPrice <= 0) {
      return res.status(400).json({ error: 'Cena musí být větší než 0' });
    }

    // Get artwork details and status from events
    const artworkResult = await client.query(
      `SELECT 
        a.id, 
        a.user_id,
        COALESCE(latest_events.latest_status, 'skryto') as status
      FROM artworks a
      LEFT JOIN (
        SELECT DISTINCT ON (artwork_id)
          artwork_id,
          LOWER(REPLACE(details::json->>'status', ' ', '_')) as latest_status
        FROM events
        WHERE approved_at IS NOT NULL AND status = 'approved'
        ORDER BY artwork_id, created_at DESC
      ) latest_events ON a.id = latest_events.artwork_id
      WHERE a.id = $1`,
      [artworkId]
    );

    if (artworkResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork nenalezen' });
    }

    const artwork = artworkResult.rows[0];

    // Check if artwork is in 'vystaveno' status
    if (artwork.status !== 'vystaveno') {
      await client.end();
      return res.status(400).json({ error: 'Lze nabídnout pouze u artworků ve stavu "Vystaveno"' });
    }

    // Check if buyer is not the owner
    if (artwork.user_id === buyerId) {
      await client.end();
      return res.status(400).json({ error: 'Nemůžete nabídnout cenu na vlastní artwork' });
    }

    // Create offer
    const insertResult = await client.query(
      `INSERT INTO price_offers (artwork_id, buyer_id, owner_id, offered_price, message, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [artworkId, buyerId, artwork.user_id, offeredPrice, message]
    );

    await client.end();
    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    await client.end();
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Chyba při vytváření nabídky' });
  }
});

// GET /api/offers/my - Get all offers for current user's artworks
router.get('/my', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  const client = await getPool();
  try {
    const result = await client.query(
      `SELECT 
        po.id,
        po.artwork_id,
        po.buyer_id,
        po.owner_id,
        po.offered_price,
        po.message,
        po.status,
        po.read_at,
        po.created_at,
        a.title AS artwork_title,
        u.username AS buyer_username,
        u.email AS buyer_email
      FROM price_offers po
      JOIN artworks a ON po.artwork_id = a.id
      JOIN users u ON po.buyer_id = u.id
      WHERE po.owner_id = $1
      ORDER BY po.created_at DESC`,
      [userId]
    );

    await client.end();
    res.json(result.rows);
  } catch (error) {
    await client.end();
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Chyba při načítání nabídek' });
  }
});

// GET /api/offers/unread-count - Get count of unread offers
router.get('/unread-count', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  const client = await getPool();
  try {
    const result = await client.query(
      'SELECT COUNT(*) as count FROM price_offers WHERE owner_id = $1 AND read_at IS NULL',
      [userId]
    );

    await client.end();
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    await client.end();
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Chyba při načítání počtu nepřečtených nabídek' });
  }
});

// PATCH /api/offers/:id/read - Mark offer as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const offerId = req.params.id;
  const userId = req.user.id;

  const client = await getPool();
  try {
    // Verify ownership
    const checkResult = await client.query(
      'SELECT owner_id FROM price_offers WHERE id = $1',
      [offerId]
    );

    if (checkResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Nabídka nenalezena' });
    }

    if (checkResult.rows[0].owner_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Nemáte oprávnění k této nabídce' });
    }

    // Mark as read
    const result = await client.query(
      'UPDATE price_offers SET read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [offerId]
    );

    await client.end();
    res.json(result.rows[0]);
  } catch (error) {
    await client.end();
    console.error('Error marking offer as read:', error);
    res.status(500).json({ error: 'Chyba při označování nabídky jako přečtené' });
  }
});

// PATCH /api/offers/:id/status - Update offer status (accept/reject)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const offerId = req.params.id;
  const userId = req.user.id;
  const { status } = req.body;

  const client = await getPool();
  try {
    // Validate status
    if (!['accepted', 'rejected'].includes(status)) {
      await client.end();
      return res.status(400).json({ error: 'Neplatný status' });
    }

    // Verify ownership
    const checkResult = await client.query(
      'SELECT owner_id FROM price_offers WHERE id = $1',
      [offerId]
    );

    if (checkResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Nabídka nenalezena' });
    }

    if (checkResult.rows[0].owner_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Nemáte oprávnění k této nabídce' });
    }

    // Update status
    const result = await client.query(
      'UPDATE price_offers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, offerId]
    );

    const updatedOffer = result.rows[0];

    // If accepted -> create payment and set artwork status to "Rezervováno"
    if (status === 'accepted' && updatedOffer) {
      // Load artwork title and seller (owner)
      const artworkRes = await client.query(
        'SELECT id, title, user_id as owner_id FROM artworks WHERE id = $1',
        [updatedOffer.artwork_id]
      );

      if (artworkRes.rows.length === 0) {
        await client.end();
        return res.status(404).json({ error: 'Artwork nenalezen' });
      }

      const artwork = artworkRes.rows[0];

      // Commission percent from settings (default 20%)
      const settingsResult = await client.query(
        "SELECT value FROM settings WHERE key = 'gallery_commission_percent'"
      );
      const commissionPercent = settingsResult.rows.length > 0
        ? parseFloat(settingsResult.rows[0].value)
        : 20;

      const price = parseFloat(updatedOffer.offered_price);
      const galleryCommission = (price * commissionPercent) / 100;
      const sellerAmount = price - galleryCommission;

      // Create payment in 'unpaid' status, linked to offer parties
      const paymentRes = await client.query(
        `INSERT INTO payments (artwork_id, buyer_id, seller_id, price, gallery_commission, seller_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'unpaid')
         RETURNING *`,
        [artwork.id, updatedOffer.buyer_id, artwork.owner_id, price, galleryCommission, sellerAmount]
      );

      // Create status_change event -> Rezervováno (approved immediately)
      const eventDetails = JSON.stringify({
        title: artwork.title,
        status: 'Rezervováno',
        offer_id: updatedOffer.id,
        payment_id: paymentRes.rows[0].id
      });

      await client.query(
        `INSERT INTO events (artwork_id, type, status, details, created_by, price, approved_at, approved_by)
         VALUES ($1, 'status_change', 'approved', $2, $3, $4, NOW(), $3)`,
        [artwork.id, eventDetails, userId, price]
      );
    }

    await client.end();
    res.json(updatedOffer);
  } catch (error) {
    await client.end();
    console.error('Error updating offer status:', error);
    res.status(500).json({ error: 'Chyba při aktualizaci statusu nabídky' });
  }
});

export default router;

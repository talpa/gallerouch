import express from 'express';
import { Client } from 'pg';
import { authenticateToken } from './auth.js';
import FioApi from './fio.js';

const router = express.Router();

/**
 * Generate unique variable symbol for payment matching
 * Variable symbol should be 1-10 digits for bank transfers
 * @param {Client} client - Database client
 * @returns {Promise<string>} Unique variable symbol
 */
async function generateUniqueVariableSymbol(client) {
  // Use a counter to generate sequential variable symbols
  const maxSymbol = 9999999999; // 10 digits max
  
  // Get the next available symbol starting from payment ID
  let symbol = null;
  let attempts = 0;
  
  while (!symbol && attempts < 100) {
    const candidate = String(Math.floor(Math.random() * maxSymbol)).padStart(5, '0');
    
    const result = await client.query(
      'SELECT id FROM payments WHERE variable_symbol = $1',
      [candidate]
    );
    
    if (result.rows.length === 0) {
      symbol = candidate;
    }
    
    attempts++;
  }
  
  if (!symbol) {
    throw new Error('Could not generate unique variable symbol');
  }
  
  return symbol;
}

// Utility function to convert snake_case to camelCase
function toCamel(obj) {
  if (!obj) return obj;
  const map = {
    artwork_id: 'artworkId',
    buyer_id: 'buyerId',
    seller_id: 'sellerId',
    gallery_commission: 'galleryCommission',
    seller_amount: 'sellerAmount',
    payment_method: 'paymentMethod',
    transaction_id: 'transactionId',
    variable_symbol: 'variableSymbol',
    fio_transaction_id: 'fioTransactionId',
    fio_matched_at: 'fioMatchedAt',
    fio_amount_matched: 'fioAmountMatched',
    created_at: 'createdAt',
    paid_at: 'paidAt',
    confirmed_by: 'confirmedBy',
    confirmed_at: 'confirmedAt',
    invoice_sent_at: 'invoiceSentAt',
    invoice_number: 'invoiceNumber',
    artwork_title: 'artworkTitle',
    artwork_description: 'artworkDescription',
    buyer_email: 'buyerEmail',
    buyer_name: 'buyerName',
    buyer_street: 'buyerStreet',
    buyer_city: 'buyerCity',
    buyer_postal_code: 'buyerPostalCode',
    buyer_country: 'buyerCountry',
    seller_email: 'sellerEmail',
    seller_name: 'sellerName',
    seller_street: 'sellerStreet',
    seller_city: 'sellerCity',
    seller_postal_code: 'sellerPostalCode',
    seller_country: 'sellerCountry',
    seller_bank_account: 'sellerBankAccount',
    confirmer_email: 'confirmerEmail',
  };
  const result = {};
  for (let key in obj) {
    const camelKey = map[key] || key;
    result[camelKey] = obj[key];
  }
  return result;
}

// GET /api/payments - Get all payments (admin) or user's payments
router.get('/payments', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    let query;
    let params;
    
    if (isAdmin) {
      // Admin sees all payments
      query = `
        SELECT 
          p.*,
          a.title as artwork_title,
          buyer.email as buyer_email,
          buyer.username as buyer_name,
          seller.email as seller_email,
          seller.username as seller_name,
          confirmer.email as confirmer_email
        FROM payments p
        LEFT JOIN artworks a ON p.artwork_id = a.id
        LEFT JOIN users buyer ON p.buyer_id = buyer.id
        LEFT JOIN users seller ON p.seller_id = seller.id
        LEFT JOIN users confirmer ON p.confirmed_by = confirmer.id
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      // User sees only their payments (as buyer or seller)
      query = `
        SELECT 
          p.*,
          a.title as artwork_title,
          buyer.email as buyer_email,
          buyer.username as buyer_name,
          seller.email as seller_email,
          seller.username as seller_name
        FROM payments p
        LEFT JOIN artworks a ON p.artwork_id = a.id
        LEFT JOIN users buyer ON p.buyer_id = buyer.id
        LEFT JOIN users seller ON p.seller_id = seller.id
        WHERE p.buyer_id = $1 OR p.seller_id = $1
        ORDER BY p.created_at DESC
      `;
      params = [userId];
    }
    
    const result = await client.query(query, params);
    
    // Get settings for QR code generation
    const bankAccountResult = await client.query(
      "SELECT value FROM settings WHERE key = 'gallery_bank_account'"
    );
    const galleryNameResult = await client.query(
      "SELECT value FROM settings WHERE key = 'gallery_name'"
    );
    const templateResult = await client.query(
      "SELECT value FROM settings WHERE key = 'payment_description_template'"
    );
    
    const bankAccountNumber = bankAccountResult.rows.length > 0 ? bankAccountResult.rows[0].value : '';
    const galleryName = galleryNameResult.rows.length > 0 ? galleryNameResult.rows[0].value : 'Gallerouch';
    const paymentDescriptionTemplate = templateResult.rows.length > 0 ? templateResult.rows[0].value : '%s zakoupen v %s';
    
    // Add settings to each payment
    const paymentsWithSettings = result.rows.map(payment => ({
      ...toCamel(payment),
      bankAccountNumber: bankAccountNumber,
      galleryName: galleryName,
      paymentDescriptionTemplate: paymentDescriptionTemplate
    }));
    
    await client.end();
    res.json(paymentsWithSettings);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/:id - Get specific payment details
router.get('/payments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        p.*,
        a.title as artwork_title,
        a.description as artwork_description,
        buyer.email as buyer_email,
        buyer.username as buyer_name,
        buyer.address as buyer_address,
        buyer.city as buyer_city,
        buyer.postal_code as buyer_postal_code,
        seller.email as seller_email,
        seller.username as seller_name,
        seller.address as seller_address,
        seller.city as seller_city,
        seller.postal_code as seller_postal_code,
        confirmer.email as confirmer_email
      FROM payments p
      LEFT JOIN artworks a ON p.artwork_id = a.id
      LEFT JOIN users buyer ON p.buyer_id = buyer.id
      LEFT JOIN users seller ON p.seller_id = seller.id
      LEFT JOIN users confirmer ON p.confirmed_by = confirmer.id
      WHERE p.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = result.rows[0];
    
    // Check authorization
    if (!isAdmin && payment.buyer_id !== userId && payment.seller_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to view this payment' });
    }
    
    await client.end();
    res.json(toCamel(payment));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments - Create new payment (purchase artwork)
router.post('/payments', authenticateToken, async (req, res) => {
  const { artworkId, price } = req.body;
  const buyerId = req.user.id;
  
  if (!artworkId || !price) {
    return res.status(400).json({ error: 'Artwork ID and price are required' });
  }
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get artwork and verify it's for sale
    const artworkResult = await client.query(
      'SELECT * FROM artworks WHERE id = $1',
      [artworkId]
    );
    
    if (artworkResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    const artwork = artworkResult.rows[0];
    const sellerId = artwork.user_id;
    
    // Check if buyer is not the seller
    if (buyerId === sellerId) {
      await client.end();
      return res.status(400).json({ error: 'cannotBuyOwnArtwork', message: 'You cannot buy your own artwork' });
    }
    
    // Get current artwork status from latest approved event
    const statusResult = await client.query(`
      SELECT details
      FROM events 
      WHERE artwork_id = $1 AND approved_at IS NOT NULL AND status = 'approved'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [artworkId]);
    
    let currentStatus = 'skryto';
    if (statusResult.rows.length > 0) {
      const details = JSON.parse(statusResult.rows[0].details || '{}');
      if (details.status) {
        if (details.status.includes('Prodáno')) currentStatus = 'prodáno';
        else if (details.status.includes('K prodeji')) currentStatus = 'k_prodeji';
        else if (details.status.includes('Vystaveno')) currentStatus = 'vystaveno';
        else if (details.status.includes('Zrušeno')) currentStatus = 'zrušeno';
      }
    }
    
    // Check if artwork is for sale
    if (currentStatus !== 'k_prodeji') {
      await client.end();
      return res.status(400).json({ error: 'Artwork is not for sale' });
    }
    
    // Get gallery commission percentage from settings
    const settingsResult = await client.query(
      "SELECT value FROM settings WHERE key = 'gallery_commission_percent'"
    );
    const commissionPercent = settingsResult.rows.length > 0 
      ? parseFloat(settingsResult.rows[0].value) 
      : 20;
    
    const galleryCommission = (price * commissionPercent) / 100;
    const sellerAmount = price - galleryCommission;
    
    // Generate unique variable symbol for payment matching (5-10 digits)
    const variableSymbol = await generateUniqueVariableSymbol(client);
    
    // Create payment record with variable symbol
    const paymentResult = await client.query(
      `INSERT INTO payments 
       (artwork_id, buyer_id, seller_id, price, gallery_commission, seller_amount, status, variable_symbol) 
       VALUES ($1, $2, $3, $4, $5, $6, 'unpaid', $7) 
       RETURNING *`,
      [artworkId, buyerId, sellerId, price, galleryCommission, sellerAmount, variableSymbol]
    );
    
    const payment = paymentResult.rows[0];
    
    // Create event for status change to "Rezervováno"
    const eventDetails = JSON.stringify({
      title: artwork.title,
      status: 'Rezervováno',
      buyer_id: buyerId,
      payment_id: payment.id
    });
    
    await client.query(
      `INSERT INTO events 
       (artwork_id, type, status, details, created_by, price, approved_at, approved_by) 
       VALUES ($1, 'status_change', 'approved', $2, $3, $4, NOW(), $3)`,
      [artworkId, eventDetails, buyerId, price]
    );
    
    // Get settings for QR code generation
    const bankAccountResult = await client.query(
      "SELECT value FROM settings WHERE key = 'gallery_bank_account'"
    );
    const galleryNameResult = await client.query(
      "SELECT value FROM settings WHERE key = 'gallery_name'"
    );
    const templateResult = await client.query(
      "SELECT value FROM settings WHERE key = 'payment_description_template'"
    );
    
    const bankAccountNumber = bankAccountResult.rows.length > 0 ? bankAccountResult.rows[0].value : '';
    const galleryName = galleryNameResult.rows.length > 0 ? galleryNameResult.rows[0].value : 'Gallerouch';
    const paymentDescriptionTemplate = templateResult.rows.length > 0 ? templateResult.rows[0].value : '%s zakoupen v %s';
    
    // Return payment with all necessary QR code data and variable symbol
    const paymentWithSettings = {
      ...toCamel(payment),
      variableSymbol: variableSymbol,
      artworkId: artworkId,
      bankAccountNumber: bankAccountNumber,
      galleryName: galleryName,
      paymentDescriptionTemplate: paymentDescriptionTemplate
    };
    
    await client.end();
    res.json(paymentWithSettings);
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id/confirm - Confirm payment (admin only)
router.put('/payments/:id/confirm', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, transactionId, notes } = req.body;
  const adminId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get payment
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );
    
    if (paymentResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = paymentResult.rows[0];
    
    if (payment.status === 'paid') {
      await client.end();
      return res.status(400).json({ error: 'Payment already confirmed' });
    }
    
    // Update payment status
    const result = await client.query(
      `UPDATE payments 
       SET status = 'paid', 
           paid_at = NOW(), 
           confirmed_by = $1, 
           confirmed_at = NOW(),
           payment_method = $2,
           transaction_id = $3,
           notes = $4
       WHERE id = $5 
       RETURNING *`,
      [adminId, paymentMethod, transactionId, notes, id]
    );
    
    // Transfer artwork ownership to buyer
    if (result.rows.length > 0) {
      await client.query(
        'UPDATE artworks SET user_id = $1 WHERE id = $2',
        [payment.buyer_id, payment.artwork_id]
      );
      
      // Create ownership_change event
      const artworkResult = await client.query(
        'SELECT title FROM artworks WHERE id = $1',
        [payment.artwork_id]
      );
      
      if (artworkResult.rows.length > 0) {
        const eventDetails = JSON.stringify({
          title: artworkResult.rows[0].title,
          status: 'Vystaveno',
          previousOwnerId: payment.seller_id,
          newOwnerId: payment.buyer_id,
          reason: 'Payment confirmed'
        });

        await client.query(
          `INSERT INTO events 
           (artwork_id, type, status, details, created_by, owner_id, price, approved_at, approved_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [payment.artwork_id, 'ownership_change', 'approved', eventDetails, adminId, payment.buyer_id, payment.price, adminId]
        );
      }
    }

    await client.end();
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id/cancel - Cancel payment
router.put('/payments/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const { reason } = req.body;
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Get payment
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );
    
    if (paymentResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = paymentResult.rows[0];
    
    // Only admin or buyer can cancel
    if (!isAdmin && payment.buyer_id !== userId) {
      await client.end();
      return res.status(403).json({ error: 'Not authorized to cancel this payment' });
    }
    
    if (payment.status === 'paid') {
      await client.end();
      return res.status(400).json({ error: 'Cannot cancel confirmed payment' });
    }
    
    // Update payment status
    const result = await client.query(
      `UPDATE payments 
       SET status = 'cancelled', 
           notes = COALESCE(notes || E'\\n', '') || $1
       WHERE id = $2 
       RETURNING *`,
      [reason || 'Cancelled by user', id]
    );
    
    // Revert artwork status to "K prodeji"
    const artworkResult = await client.query(
      'SELECT title FROM artworks WHERE id = $1',
      [payment.artwork_id]
    );
    
    if (artworkResult.rows.length > 0) {
      const eventDetails = JSON.stringify({
        title: artworkResult.rows[0].title,
        status: 'K prodeji',
        reason: 'Payment cancelled'
      });
      
      await client.query(
        `INSERT INTO events 
         (artwork_id, type, status, details, created_by, price, approved_at, approved_by) 
         VALUES ($1, 'status_change', 'approved', $2, $3, $4, NOW(), $3)`,
        [payment.artwork_id, eventDetails, userId, payment.price]
      );
    }
    
    await client.end();
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id/invoice - Mark invoice as sent (admin only)
router.put('/payments/:id/invoice', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { invoiceNumber } = req.body;
  const isAdmin = req.user.role === 'admin';
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(
      `UPDATE payments 
       SET invoice_sent_at = NOW(), 
           invoice_number = $1
       WHERE id = $2 
       RETURNING *`,
      [invoiceNumber, id]
    );
    
    if (result.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    await client.end();
    res.json(toCamel(result.rows[0]));
  } catch (err) {
    await client.end();
    res.status(500).json({ error: err.message });
  }
});

// Interní funkce pro synchronizaci plateb s Fio bankou
// Volaná automaticky backendem každé 2 hodiny - bez potřeby JWT nebo HTTP callbacku
export async function syncFioPayments() {
  const fioToken = process.env.FIO_API_TOKEN;
  if (!fioToken) {
    console.log('[Fio Sync] FIO_API_TOKEN není nakonfigurován, přeskakuji sync');
    return { success: false, skipped: true, message: 'FIO_API_TOKEN not configured' };
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const fio = new FioApi(fioToken);

    // Načíst transakce za posledních 7 dní
    const sinceDate = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const transactions = await fio.getRecentTransactions(sinceDate);

    const incomingTransactions = fio.filterIncomingPayments(transactions);
    const transactionsWithSymbol = fio.filterTransactionsWithSymbol(
      incomingTransactions.map(tx => fio.parseTransaction(tx))
    );

    const matched = [];
    const unmatched = [];

    for (const tx of transactionsWithSymbol) {
      const paymentResult = await client.query(
        `SELECT * FROM payments WHERE variable_symbol = $1 AND status = 'unpaid' LIMIT 1`,
        [tx.variableSymbol]
      );

      if (paymentResult.rows.length > 0) {
        const payment = paymentResult.rows[0];
        const amountDiff = Math.abs(parseFloat(payment.price) - tx.amount);

        if (amountDiff <= 1) {
          const updateResult = await client.query(
            `UPDATE payments 
             SET status = 'paid', paid_at = NOW(), payment_method = 'bank_transfer',
                 fio_transaction_id = $1, fio_matched_at = NOW(), fio_amount_matched = $2,
                 confirmed_by = $3, confirmed_at = NOW(), transaction_id = $1
             WHERE id = $4 RETURNING *`,
            [tx.transactionId, tx.amount, 1, payment.id]
          );

          if (updateResult.rows.length > 0) {
            await client.query(
              'UPDATE artworks SET user_id = $1 WHERE id = $2',
              [payment.buyer_id, payment.artwork_id]
            );

            const artworkResult = await client.query(
              'SELECT title FROM artworks WHERE id = $1',
              [payment.artwork_id]
            );

            if (artworkResult.rows.length > 0) {
              const eventDetails = JSON.stringify({
                title: artworkResult.rows[0].title,
                status: 'Vystaveno',
                previousOwnerId: payment.seller_id,
                newOwnerId: payment.buyer_id,
                reason: 'Payment confirmed via Fio Bank'
              });
              await client.query(
                `INSERT INTO events 
                 (artwork_id, type, status, details, created_by, owner_id, price, approved_at, approved_by) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
                [payment.artwork_id, 'ownership_change', 'approved', eventDetails, 1, payment.buyer_id, payment.price, 1]
              );
            }

            matched.push({ paymentId: payment.id, variableSymbol: tx.variableSymbol, amount: tx.amount, senderName: tx.senderName, date: tx.date });
          }
        } else {
          unmatched.push({ variableSymbol: tx.variableSymbol, amount: tx.amount, expectedAmount: payment.price, reason: 'Amount mismatch', senderName: tx.senderName, date: tx.date });
        }
      } else {
        unmatched.push({ variableSymbol: tx.variableSymbol, amount: tx.amount, reason: 'No matching payment or already paid', senderName: tx.senderName, date: tx.date });
      }
    }

    await client.end();
    const message = `Synced ${matched.length} payments, ${unmatched.length} unmatched`;
    return { success: true, message, matched, unmatched, totalProcessed: incomingTransactions.length };
  } catch (err) {
    await client.end();
    throw err;
  }
}

// POST /api/payments/sync-fio - Ruční spuštění syncu (chráněno CRON_SECRET, ne JWT)
// Pro automatický sync backend volá syncFioPayments() interně přes setInterval
router.post('/sync-fio', (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'];
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized - x-cron-secret header required' });
  }
  next();
}, async (req, res) => {
  try {
    const result = await syncFioPayments();
    res.json(result);
  } catch (err) {
    console.error('[Fio Sync] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

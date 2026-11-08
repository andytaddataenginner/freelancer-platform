/**
 * routes/client-notes.js
 * Per-client notes — tips, mandatory rules, business guidelines.
 *
 * Mounted at: /api/client-notes
 */

const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth'); // Use general auth instead of strict freelancer-only

const VALID_CATEGORIES = ['basic', 'mandatory', 'business_rule', 'tip', 'general'];

// Helper to resolve the correct client_id depending on whether a freelancer or client is logged in
async function resolveClientAndFreelancer(user, targetClientId) {
  if (user.role === 'client') {
    // If a client is logged in, they can only access their own notes.
    // Look up their client record to find their assigned freelancer_id.
    const clientRes = await pool.query(
      'SELECT id, freelancer_id FROM clients WHERE user_id = $1 LIMIT 1',
      [user.id]
    );
    if (!clientRes.rows.length) return null;
    return {
      clientId: user.id,
      freelancerId: clientRes.rows[0].freelancer_id
    };
  } else {
    // If a freelancer is logged in, targetClientId is passed in the URL params
    const clientRes = await pool.query(
      'SELECT user_id FROM clients WHERE user_id = $1 AND freelancer_id = $2 LIMIT 1',
      [targetClientId, user.id]
    );
    if (!clientRes.rows.length) return null;
    return {
      clientId: targetClientId,
      freelancerId: user.id
    };
  }
}

// ── GET /:clientId (or GET / for clients) ────────────────────────────────────
router.get(['/:clientId', '/'], requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveClientAndFreelancer(req.user, req.params.clientId);
    if (!resolved) return res.status(403).json({ error: 'Unauthorized or client not found' });

    const { rows } = await pool.query(`
      SELECT n.*, u.name AS client_name
      FROM client_notes n
      JOIN users u ON u.id = n.client_id
      WHERE n.freelancer_id = $1 AND n.client_id = $2
      ORDER BY n.is_pinned DESC, n.category, n.created_at DESC
    `, [resolved.freelancerId, resolved.clientId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── POST /:clientId (or POST / for clients) ──────────────────────────────────
router.post(['/:clientId', '/'], requireAuth, async (req, res, next) => {
  try {
    const { title, content, category = 'general', is_pinned = false } = req.body;
    if (!title || !content)
      return res.status(400).json({ error: 'title and content required' });
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });

    const resolved = await resolveClientAndFreelancer(req.user, req.params.clientId);
    if (!resolved) return res.status(403).json({ error: 'Unauthorized or client not found' });

    const { rows } = await pool.query(`
      INSERT INTO client_notes (freelancer_id, client_id, category, title, content, is_pinned)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [resolved.freelancerId, resolved.clientId, category, title, content, is_pinned]);

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ── PUT /:clientId/:noteId (or PUT /:noteId for clients) ─────────────────────
router.put(['/:clientId/:noteId', '/:noteId'], requireAuth, async (req, res, next) => {
  try {
    const { title, content, category, is_pinned } = req.body;
    if (category && !VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });

    const noteId = req.params.noteId || req.params.clientId; // Handles both route patterns safely
    const targetParam = req.params.noteId ? req.params.clientId : null;

    const resolved = await resolveClientAndFreelancer(req.user, targetParam);
    if (!resolved) return res.status(403).json({ error: 'Unauthorized or client not found' });

    const { rows } = await pool.query(`
      UPDATE client_notes
      SET title      = COALESCE($1, title),
          content    = COALESCE($2, content),
          category   = COALESCE($3, category),
          is_pinned  = COALESCE($4, is_pinned),
          updated_at = NOW()
      WHERE id = $5 AND freelancer_id = $6 AND client_id = $7
      RETURNING *
    `, [title, content, category, is_pinned, noteId, resolved.freelancerId, resolved.clientId]);

    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── DELETE /:clientId/:noteId (or DELETE /:noteId for clients) ───────────────
router.delete(['/:clientId/:noteId', '/:noteId'], requireAuth, async (req, res, next) => {
  try {
    const noteId = req.params.noteId || req.params.clientId;
    const targetParam = req.params.noteId ? req.params.clientId : null;

    const resolved = await resolveClientAndFreelancer(req.user, targetParam);
    if (!resolved) return res.status(403).json({ error: 'Unauthorized or client not found' });

    const { rows } = await pool.query(
      'DELETE FROM client_notes WHERE id=$1 AND freelancer_id=$2 AND client_id=$3 RETURNING id',
      [noteId, resolved.freelancerId, resolved.clientId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// ── PATCH /:clientId/:noteId/pin (or PATCH /:noteId/pin for clients) ─────────
router.patch(['/:clientId/:noteId/pin', '/:noteId/pin'], requireAuth, async (req, res, next) => {
  try {
    const noteId = req.params.noteId || req.params.clientId;
    const targetParam = req.params.noteId ? req.params.clientId : null;

    const resolved = await resolveClientAndFreelancer(req.user, targetParam);
    if (!resolved) return res.status(403).json({ error: 'Unauthorized or client not found' });

    const { rows } = await pool.query(`
      UPDATE client_notes
      SET is_pinned  = NOT is_pinned,
          updated_at = NOW()
      WHERE id = $1 AND freelancer_id = $2 AND client_id = $3
      RETURNING *
    `, [noteId, resolved.freelancerId, resolved.clientId]);
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;

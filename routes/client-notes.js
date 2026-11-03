/**
 * routes/client-notes.js
 * Per-client notes — tips, mandatory rules, business guidelines.
 *
 * Mounted at: /api/client-notes
 *
 * Routes:
 *   GET    /:clientId              — list all notes for a client
 *   POST   /:clientId              — create a note
 *   PUT    /:clientId/:noteId      — update a note
 *   DELETE /:clientId/:noteId      — delete a note
 *   PATCH  /:clientId/:noteId/pin  — toggle pin
 */

const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

const VALID_CATEGORIES = ['basic', 'mandatory', 'business_rule', 'tip', 'general'];

// ── GET /:clientId ────────────────────────────────────────────────────────────
router.get('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT n.*, u.name AS client_name
      FROM client_notes n
      JOIN users u ON u.id = n.client_id
      WHERE n.freelancer_id = $1 AND n.client_id = $2
      ORDER BY n.is_pinned DESC, n.category, n.created_at DESC
    `, [req.user.id, req.params.clientId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── POST /:clientId ───────────────────────────────────────────────────────────
router.post('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { title, content, category = 'general', is_pinned = false } = req.body;
    if (!title || !content)
      return res.status(400).json({ error: 'title and content required' });
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });

    // Verify the client belongs to this freelancer
    const check = await pool.query(
      'SELECT id FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [req.params.clientId, req.user.id]
    );
    if (!check.rows.length)
      return res.status(403).json({ error: 'Client not found' });

    const { rows } = await pool.query(`
      INSERT INTO client_notes (freelancer_id, client_id, category, title, content, is_pinned)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.id, req.params.clientId, category, title, content, is_pinned]);

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ── PUT /:clientId/:noteId ────────────────────────────────────────────────────
router.put('/:clientId/:noteId', requireFreelancer, async (req, res, next) => {
  try {
    const { title, content, category, is_pinned } = req.body;
    if (category && !VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });

    const { rows } = await pool.query(`
      UPDATE client_notes
      SET title      = COALESCE($1, title),
          content    = COALESCE($2, content),
          category   = COALESCE($3, category),
          is_pinned  = COALESCE($4, is_pinned),
          updated_at = NOW()
      WHERE id = $5 AND freelancer_id = $6 AND client_id = $7
      RETURNING *
    `, [title, content, category, is_pinned, req.params.noteId, req.user.id, req.params.clientId]);

    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── DELETE /:clientId/:noteId ─────────────────────────────────────────────────
router.delete('/:clientId/:noteId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM client_notes WHERE id=$1 AND freelancer_id=$2 AND client_id=$3 RETURNING id',
      [req.params.noteId, req.user.id, req.params.clientId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// ── PATCH /:clientId/:noteId/pin — toggle pin ─────────────────────────────────
router.patch('/:clientId/:noteId/pin', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      UPDATE client_notes
      SET is_pinned  = NOT is_pinned,
          updated_at = NOW()
      WHERE id = $1 AND freelancer_id = $2 AND client_id = $3
      RETURNING *
    `, [req.params.noteId, req.user.id, req.params.clientId]);
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;

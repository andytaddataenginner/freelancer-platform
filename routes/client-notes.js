const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/client-notes/:clientId — fetch all notes/guidelines for a specific client
router.get('/:clientId', async (req, res, next) => {
  try {
    const freelancerId = req.user ? req.user.id : null;
    const { clientId } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM client_project_notes 
       WHERE client_id = $1 AND freelancer_id = $2 
       ORDER BY created_at DESC`,
      [clientId, freelancerId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/client-notes — create a new note or rule for a client
router.post('/', async (req, res, next) => {
  try {
    const freelancerId = req.user ? req.user.id : null;
    const { client_id, title, content, category } = req.body;

    if (!client_id || !title || !content) {
      return res.status(400).json({ error: 'client_id, title, and content are required.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO client_project_notes (client_id, freelancer_id, title, content, category)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client_id, freelancerId, title, content, category || 'guidelines']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/client-notes/:id — delete a specific note
router.delete('/:id', async (req, res, next) => {
  try {
    const freelancerId = req.user ? req.user.id : null;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM client_project_notes WHERE id = $1 AND freelancer_id = $2 RETURNING id`,
      [id, freelancerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found or unauthorized.' });
    }

    res.json({ message: 'Note deleted successfully.' });
  } catch (e) { next(e); }
});

module.exports = router;

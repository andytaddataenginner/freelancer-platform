const router = require('express').Router();
const pool   = require('../db/pool');

router.post('/', async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });
    await pool.query(
      'INSERT INTO contact_submissions (name, email, message) VALUES ($1,$2,$3)',
      [name, email, message]
    );
    res.json({ message: 'Received' });
  } catch (e) { next(e); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/sync', async (req, res) => {
  const { firebase_uid, email, role, full_name, age } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO users (firebase_uid, email, role, full_name, age)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET email = $2, role = $3, full_name = $4, age = $5
      RETURNING *
    `, [firebase_uid, email, role, full_name, age]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:uid', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [req.params.uid]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
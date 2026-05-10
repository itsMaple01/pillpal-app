const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:patient_uid', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM medications WHERE patient_uid = $1 ORDER BY created_at DESC',
      [req.params.patient_uid]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { patient_uid, name, dosage, frequency, program, start_date, end_date } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO medications (patient_uid, name, dosage, frequency, program, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [patient_uid, name, dosage, frequency, program, start_date, end_date]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM medications WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
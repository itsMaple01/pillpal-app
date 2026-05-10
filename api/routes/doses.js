const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:patient_uid/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT dl.*, m.name as medication_name, m.dosage
      FROM dose_logs dl
      JOIN schedules s ON s.id = dl.schedule_id
      JOIN medications m ON m.id = s.medication_id
      WHERE dl.patient_uid = $1
        AND dl.scheduled_at::date = CURRENT_DATE
      ORDER BY dl.scheduled_at
    `, [req.params.patient_uid]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/take', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE dose_logs SET status = 'taken', taken_at = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
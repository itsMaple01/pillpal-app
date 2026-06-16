const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:caretaker_uid', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, cp.status as link_status,
        COALESCE(missed_today.missed_count, 0) as missed_doses,
        ROUND(
          COUNT(dl.id) FILTER (WHERE dl.status = 'taken') * 100.0 /
          NULLIF(COUNT(dl.id) FILTER (WHERE dl.status IN ('taken', 'missed')), 0)
        ) as compliance
      FROM caretaker_patients cp
      JOIN users u ON u.firebase_uid = cp.patient_uid
      LEFT JOIN (
        SELECT patient_uid, COUNT(*)::int AS missed_count
        FROM dose_logs
        WHERE status = 'missed'
          AND scheduled_at::date = (NOW() AT TIME ZONE 'Asia/Manila')::date
          AND scheduled_at < NOW()
        GROUP BY patient_uid
      ) missed_today ON missed_today.patient_uid = cp.patient_uid
      LEFT JOIN dose_logs dl ON dl.patient_uid = cp.patient_uid
        AND dl.scheduled_at >= NOW() - INTERVAL '30 days'
      WHERE cp.caretaker_uid = $1
      GROUP BY u.id, cp.status, missed_today.missed_count
    `, [req.params.caretaker_uid]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/link', async (req, res) => {
  const { caretaker_uid, patient_uid } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO caretaker_patients (caretaker_uid, patient_uid)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [caretaker_uid, patient_uid]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/unlink', async (req, res) => {
  const { caretaker_uid, patient_uid } = req.body;
  if (!caretaker_uid || !patient_uid) {
    return res.status(400).json({ error: 'caretaker_uid and patient_uid are required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'DELETE FROM caretaker_patients WHERE caretaker_uid = $1 AND patient_uid = $2',
      [caretaker_uid, patient_uid]
    );
    
    await client.query(
      'DELETE FROM alerts WHERE caretaker_uid = $1 AND patient_uid = $2',
      [caretaker_uid, patient_uid]
    );
    
    await client.query(
      'DELETE FROM intelligence_events WHERE firebase_uid = $1',
      [patient_uid]
    );
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

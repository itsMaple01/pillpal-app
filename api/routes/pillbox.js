const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getManilaNow } = require('../lib/manilaTime');
const { syncTodayDoseLogsForPatient } = require('../lib/doseSync');

const VALID_TOKEN = process.env.PILLBOX_SECRET_TOKEN || 'supersecret123';

function validateToken(token) {
  return typeof token === 'string' && token.length > 0 && token === VALID_TOKEN;
}

router.post('/connect', async (req, res) => {
  const { patient_uid, device_id, token } = req.body;
  if (!patient_uid || !device_id || !token) {
    return res.status(400).json({ error: 'patient_uid, device_id, and token are required' });
  }
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Invalid pillbox token' });
  }

  try {
    await pool.query(
      `UPDATE pillbox_devices SET is_active = FALSE
       WHERE patient_uid = $1 OR (device_id = $2 AND is_active = TRUE)`,
      [patient_uid, device_id],
    );

    const result = await pool.query(
      `INSERT INTO pillbox_devices (patient_uid, device_id, token, battery_level, is_active)
       VALUES ($1, $2, $3, 100, TRUE)
       RETURNING *`,
      [patient_uid, device_id, token],
    );

    res.json({ connected: true, device: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:patient_uid', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, patient_uid, device_id, battery_level, last_dose_time, connected_at, is_active
       FROM pillbox_devices
       WHERE patient_uid = $1 AND is_active = TRUE
       ORDER BY connected_at DESC
       LIMIT 1`,
      [req.params.patient_uid],
    );

    if (result.rowCount === 0) {
      return res.json({ connected: false });
    }

    const device = result.rows[0];

    const lastDose = await pool.query(
      `SELECT MAX(taken_at) AS last_taken
       FROM dose_logs
       WHERE patient_uid = $1 AND status = 'taken'
         AND taken_at::date = (NOW() AT TIME ZONE 'Asia/Manila')::date`,
      [req.params.patient_uid],
    );

    const lastDoseTime = device.last_dose_time || lastDose.rows[0]?.last_taken || null;

    res.json({
      connected: true,
      device_id: device.device_id,
      battery_level: device.battery_level ?? 100,
      last_dose_time: lastDoseTime,
      connected_at: device.connected_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disconnect', async (req, res) => {
  const { patient_uid } = req.body;
  if (!patient_uid) {
    return res.status(400).json({ error: 'patient_uid is required' });
  }

  try {
    await pool.query(
      `UPDATE pillbox_devices SET is_active = FALSE WHERE patient_uid = $1 AND is_active = TRUE`,
      [patient_uid],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/adherence/:patient_uid', async (req, res) => {
  try {
    await syncTodayDoseLogsForPatient(req.params.patient_uid);
    const manila = getManilaNow();

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('taken', 'missed', 'pending'))::int AS total,
         COUNT(*) FILTER (WHERE status = 'taken')::int AS taken,
         COUNT(*) FILTER (WHERE status = 'missed')::int AS missed
       FROM dose_logs
       WHERE patient_uid = $1
         AND log_date = (NOW() AT TIME ZONE 'Asia/Manila')::date`,
      [req.params.patient_uid],
    );

    const recent = await pool.query(
      `SELECT dl.scheduled_at, dl.status, dl.taken_at, m.name AS medication_name
       FROM dose_logs dl
       JOIN schedules s ON s.id = dl.schedule_id
       JOIN medications m ON m.id = s.medication_id
       WHERE dl.patient_uid = $1
         AND dl.log_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
       ORDER BY dl.scheduled_at ASC`,
      [req.params.patient_uid],
    );

    const row = stats.rows[0] || { total: 0, taken: 0, missed: 0 };
    const total = row.total || 0;
    const taken = row.taken || 0;
    const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;

    res.json({
      date: manila.today,
      percentage,
      taken,
      total,
      missed: row.missed || 0,
      recent_doses: recent.rows.map(r => ({
        medication_name: r.medication_name,
        scheduled_at: r.scheduled_at,
        taken_at: r.taken_at,
        status: r.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

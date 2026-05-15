const express = require('express');
const router = express.Router();
const pool = require('../db');
const admin = require('../firebaseAdmin');

// Helper — write alert to both Neon + Firestore
async function createMissedAlert({ caretaker_uid, patient_uid, patient_name, medication_name, message }) {
  try {
    const result = await pool.query(
      `INSERT INTO alerts (caretaker_uid, patient_uid, patient_name, medication_name, message, type)
       VALUES ($1, $2, $3, $4, $5, 'missed_dose')
       RETURNING *`,
      [caretaker_uid, patient_uid, patient_name, medication_name, message]
    );
    const alert = result.rows[0];

    await admin.firestore()
      .collection('alerts')
      .doc(String(alert.id))
      .set({
        id:              alert.id,
        caretaker_uid,
        patient_uid,
        patient_name:    patient_name ?? '',
        medication_name: medication_name ?? '',
        message,
        type:            'missed_dose',
        is_read:         false,
        created_at:      admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error('Alert creation failed:', err.message);
  }
}

// GET today's doses for a patient
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

// PATCH mark a dose as taken
router.patch('/:id/take', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE dose_logs SET status = 'taken', taken_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    const dose = result.rows[0];
    res.json(dose);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark a dose as missed + fire alert to all linked caretakers
router.patch('/:id/miss', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE dose_logs SET status = 'missed'
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    const dose = result.rows[0];

    // Get medication name + patient info + linked caretakers
    const info = await pool.query(`
      SELECT
        m.name        AS medication_name,
        u.full_name   AS patient_name,
        dl.patient_uid,
        cp.caretaker_uid
      FROM dose_logs dl
      JOIN schedules s   ON s.id  = dl.schedule_id
      JOIN medications m ON m.id  = s.medication_id
      JOIN users u       ON u.firebase_uid = dl.patient_uid
      JOIN caretaker_patients cp ON cp.patient_uid = dl.patient_uid
      WHERE dl.id = $1
    `, [req.params.id]);

    // Fire an alert for each linked caretaker
    for (const row of info.rows) {
      await createMissedAlert({
        caretaker_uid:   row.caretaker_uid,
        patient_uid:     row.patient_uid,
        patient_name:    row.patient_name,
        medication_name: row.medication_name,
        message: `${row.patient_name} missed their ${row.medication_name} dose scheduled for ${new Date(dose.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
    }

    res.json(dose);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST check for overdue pending doses and auto-mark missed
// Call this from a cron job or scheduler (e.g. every 30 min)
router.post('/check-missed', async (req, res) => {
  try {
    const overdueResult = await pool.query(`
      UPDATE dose_logs
      SET status = 'missed'
      WHERE status = 'pending'
        AND scheduled_at < NOW() - INTERVAL '30 minutes'
      RETURNING *
    `);

    const overdue = overdueResult.rows;

    for (const dose of overdue) {
      const info = await pool.query(`
        SELECT
          m.name        AS medication_name,
          u.full_name   AS patient_name,
          cp.caretaker_uid
        FROM dose_logs dl
        JOIN schedules s   ON s.id  = dl.schedule_id
        JOIN medications m ON m.id  = s.medication_id
        JOIN users u       ON u.firebase_uid = dl.patient_uid
        JOIN caretaker_patients cp ON cp.patient_uid = dl.patient_uid
        WHERE dl.id = $1
      `, [dose.id]);

      for (const row of info.rows) {
        await createMissedAlert({
          caretaker_uid:   row.caretaker_uid,
          patient_uid:     dose.patient_uid,
          patient_name:    row.patient_name,
          medication_name: row.medication_name,
          message: `${row.patient_name} missed their ${row.medication_name} dose scheduled for ${new Date(dose.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        });
      }
    }

    res.json({ marked_missed: overdue.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
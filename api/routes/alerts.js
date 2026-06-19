const express = require('express');
const router = express.Router();
const pool = require('../db');
const admin = require('../firebaseAdmin');
const { notifyPatientAndLinkedCaregivers } = require('../lib/patientNotify');

// GET all alerts for a caretaker
router.get('/:caretaker_uid', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM alerts
       WHERE caretaker_uid = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.params.caretaker_uid]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark a single alert as read
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark ALL alerts as read for a caretaker
router.patch('/read-all/:caretaker_uid', async (req, res) => {
  try {
    await pool.query(
      `UPDATE alerts SET is_read = TRUE WHERE caretaker_uid = $1`,
      [req.params.caretaker_uid]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create an alert (called internally or from missed-dose checker)
router.post('/', async (req, res) => {
  const { caretaker_uid, patient_uid, patient_name, medication_name, message, type } = req.body;
  try {
    // 1. Write to Neon
    const result = await pool.query(
      `INSERT INTO alerts (caretaker_uid, patient_uid, patient_name, medication_name, message, type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [caretaker_uid, patient_uid, patient_name, medication_name, message, type ?? 'missed_dose']
    );
    const alert = result.rows[0];

    // 2. Write to Firestore for real-time sync
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
        type:            type ?? 'missed_dose',
        is_read:         false,
        created_at:      admin.firestore.FieldValue.serverTimestamp(),
      });

    const alertTitle = type === 'missed_dose'
      ? 'Medication Missed'
      : type === 'late_dose'
        ? 'Medication Late'
        : 'GabayRa Alert';
    const caretakerBody = message || `${patient_name ?? 'Patient'} — ${medication_name ?? 'medication'}`;
    const patientBody = type === 'missed_dose'
      ? `Your ${medication_name ?? 'medication'} dose was missed.`
      : type === 'late_dose'
        ? `Your ${medication_name ?? 'medication'} dose is late.`
        : caretakerBody;

    try {
      await notifyPatientAndLinkedCaregivers(patient_uid, {
        title: alertTitle,
        caretakerBody,
        patientBody,
        data: {
          type: type ?? 'alert',
          alert_id: String(alert.id),
          patient_uid,
          medication_name: medication_name ?? '',
        },
      });
    } catch (pushErr) {
      console.warn('[alerts] FCM push failed:', pushErr.message);
    }

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');
const admin = require('../firebaseAdmin');
const { pushToUser } = require('../lib/expoPush');

// POST caregiver → send medication reminder push to patient
router.post('/send', async (req, res) => {
  const { caretaker_uid, patient_uid, message } = req.body;
  if (!caretaker_uid || !patient_uid) {
    return res.status(400).json({ error: 'caretaker_uid and patient_uid required' });
  }

  try {
    const link = await pool.query(
      `SELECT 1 FROM caretaker_patients WHERE caretaker_uid = $1 AND patient_uid = $2`,
      [caretaker_uid, patient_uid],
    );
    if (link.rowCount === 0) {
      return res.status(403).json({ error: 'Patient is not linked to this caregiver' });
    }

    const users = await pool.query(
      `SELECT p.full_name AS patient_name, p.expo_push_token AS patient_token,
              c.full_name AS caregiver_name
       FROM users p
       JOIN users c ON c.firebase_uid = $1
       WHERE p.firebase_uid = $2`,
      [caretaker_uid, patient_uid],
    );
    if (users.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = users.rows[0];
    const patientName = row.patient_name || 'Patient';
    const caregiverName = row.caregiver_name || 'Your caregiver';
    const body =
      message?.trim() ||
      `${caregiverName} sent you a reminder to take your medication.`;

    let pushResult = { ok: false, error: 'Patient has not enabled notifications on their device yet.' };
    if (row.patient_token) {
      pushResult = await pushToUser(row.patient_token, {
        title: 'GabayRa — Medication reminder',
        body,
        data: { type: 'caregiver_reminder', patient_uid, caretaker_uid },
      });
    }

    const alertMsg = `${caregiverName} sent a medication reminder to ${patientName}.`;
    const alertRes = await pool.query(
      `INSERT INTO alerts (caretaker_uid, patient_uid, patient_name, message, type)
       VALUES ($1, $2, $3, $4, 'caregiver_reminder')
       RETURNING *`,
      [caretaker_uid, patient_uid, patientName, alertMsg],
    );
    const alert = alertRes.rows[0];

    try {
      await admin.firestore().collection('alerts').doc(String(alert.id)).set({
        id: alert.id,
        caretaker_uid,
        patient_uid,
        patient_name: patientName,
        message: alertMsg,
        type: 'caregiver_reminder',
        is_read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      await admin.firestore().collection('patient_activity').doc(patient_uid).set(
        { type: 'caregiver_reminder', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      console.warn('Firestore alert write failed:', e.message);
    }

    res.json({
      ok: true,
      push_sent: pushResult.ok,
      push_error: pushResult.ok ? null : pushResult.error,
      alert,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

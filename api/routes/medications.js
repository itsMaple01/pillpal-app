const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const admin   = require('../firebaseAdmin');

async function bumpPatientActivity(patientUid, type = 'medication_update') {
  try {
    await admin.firestore().collection('patient_activity').doc(patientUid).set(
      { type, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn('patient_activity bump failed:', err.message);
  }
}

// GET all medications for a patient (resets "taken" when last taken was before today)
router.get('/:patient_uid', async (req, res) => {
  try {
    // Reset taken status for medications where last_taken_at is before today
    await pool.query(
      `UPDATE medications SET taken = FALSE
       WHERE patient_uid = $1 AND taken = TRUE
         AND (last_taken_at IS NULL OR last_taken_at < CURRENT_DATE)`,
      [req.params.patient_uid],
    );
    
    // Get medications with today's dose status from dose_logs
    const result = await pool.query(`
      SELECT 
        m.*,
        COALESCE(
          (SELECT dl.status FROM dose_logs dl
           JOIN schedules s ON s.id = dl.schedule_id
           WHERE s.medication_id = m.id
             AND dl.patient_uid = m.patient_uid
             AND dl.scheduled_at::date = CURRENT_DATE
             AND dl.status = 'taken'
           LIMIT 1),
          'pending'
        ) as today_status
      FROM medications m
      WHERE m.patient_uid = $1
      ORDER BY m.created_at DESC
    `, [req.params.patient_uid]);
    
    // Override taken field based on today's dose status
    const medications = result.rows.map(med => ({
      ...med,
      taken: med.today_status === 'taken'
    }));
    
    res.json(medications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new medication
router.post('/', async (req, res) => {
  const { patient_uid, name, dosage, frequency, time, program, start_date, end_date } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO medications
        (patient_uid, name, dosage, frequency, program, start_date, end_date, taken)
      VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
      RETURNING *
    `, [patient_uid, name, dosage, frequency ?? time, program ?? time, start_date, end_date]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT edit a medication (name, dosage, frequency, time, end_date, suspended, notify_enabled)
router.put('/:id', async (req, res) => {
  const { name, dosage, frequency, time, end_date, suspended, notify_enabled } = req.body;
  if (!name) return res.status(400).json({ error: '`name` is required' });
  try {
    const result = await pool.query(`
      UPDATE medications
      SET name = $1, dosage = $2, frequency = $3, program = $4, end_date = $5,
          suspended = COALESCE($6, suspended),
          notify_enabled = COALESCE($7, notify_enabled),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [name, dosage ?? 'As prescribed', frequency, time, end_date ?? null,
      typeof suspended === 'boolean' ? suspended : null,
      typeof notify_enabled === 'boolean' ? notify_enabled : null,
      req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Medication not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update taken status
router.patch('/:id/taken', async (req, res) => {
  const { taken } = req.body;
  if (typeof taken !== 'boolean') {
    return res.status(400).json({ error: '`taken` must be a boolean' });
  }
  try {
    const result = await pool.query(
      `UPDATE medications SET taken = $1,
        last_taken_at = CASE WHEN $1 = TRUE THEN CURRENT_DATE ELSE NULL END
       WHERE id = $2 RETURNING *`,
      [taken, req.params.id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Medication not found' });
    const row = result.rows[0];
    await bumpPatientActivity(
      row.patient_uid,
      taken ? 'medication_taken' : 'medication_update',
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH save firestore_id back to Neon
router.patch('/:id/firestore-id', async (req, res) => {
  const { firestore_id } = req.body;
  if (!firestore_id) return res.status(400).json({ error: '`firestore_id` is required' });
  try {
    const result = await pool.query(
      'UPDATE medications SET firestore_id = $1 WHERE id = $2 RETURNING *',
      [firestore_id, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Medication not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST refill — extend end_date by 30 days (or from today if none)
router.post('/:id/refill', async (req, res) => {
  try {
    const cur = await pool.query('SELECT end_date FROM medications WHERE id = $1', [req.params.id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Medication not found' });
    const base = cur.rows[0].end_date ? new Date(cur.rows[0].end_date) : new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + 30);
    const result = await pool.query(
      `UPDATE medications SET end_date = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [next.toISOString().slice(0, 10), req.params.id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a medication
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM medications WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
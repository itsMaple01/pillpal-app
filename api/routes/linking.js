const express = require('express');
const router = express.Router();
const pool = require('../db');

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Patient sends link request to caregiver by email */
router.post('/request', async (req, res) => {
  const { patient_uid, caretaker_email } = req.body;
  if (!patient_uid || !caretaker_email) {
    return res.status(400).json({ error: 'patient_uid and caretaker_email required' });
  }
  try {
    const u = await pool.query(
      `SELECT firebase_uid, role FROM users WHERE LOWER(email) = LOWER($1)`,
      [String(caretaker_email).trim()],
    );
    if (u.rows.length === 0) return res.status(404).json({ error: 'No user with that email' });
    const caretaker = u.rows[0];
    if (caretaker.role !== 'caretaker') {
      return res.status(400).json({ error: 'That email is not a caregiver/family account' });
    }
    const caretaker_uid = caretaker.firebase_uid;

    const dup = await pool.query(
      `SELECT 1 FROM caretaker_patients WHERE caretaker_uid = $1 AND patient_uid = $2`,
      [caretaker_uid, patient_uid],
    );
    if (dup.rows.length) return res.status(400).json({ error: 'Already linked' });

    const pend = await pool.query(
      `SELECT id FROM link_requests WHERE patient_uid = $1 AND caretaker_uid = $2 AND status = 'pending'`,
      [patient_uid, caretaker_uid],
    );
    if (pend.rows.length) return res.status(400).json({ error: 'Request already pending' });

    const ins = await pool.query(
      `INSERT INTO link_requests (patient_uid, caretaker_uid, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [patient_uid, caretaker_uid],
    );
    res.json(ins.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Caregiver asks to link with a patient by email (patient must accept). */
router.post('/caregiver-request', async (req, res) => {
  const { caretaker_uid, patient_email } = req.body;
  if (!caretaker_uid || !patient_email) {
    return res.status(400).json({ error: 'caretaker_uid and patient_email required' });
  }
  try {
    const u = await pool.query(
      `SELECT firebase_uid, role FROM users WHERE LOWER(email) = LOWER($1)`,
      [String(patient_email).trim()],
    );
    if (u.rows.length === 0) return res.status(404).json({ error: 'No user with that email' });
    const patient = u.rows[0];
    if (patient.role !== 'patient') {
      return res.status(400).json({ error: 'That email is not a patient account' });
    }
    const patient_uid = patient.firebase_uid;
    const dup = await pool.query(
      `SELECT 1 FROM caretaker_patients WHERE caretaker_uid = $1 AND patient_uid = $2`,
      [caretaker_uid, patient_uid],
    );
    if (dup.rows.length) return res.status(400).json({ error: 'Already linked' });
    const pend = await pool.query(
      `SELECT id FROM link_requests WHERE patient_uid = $1 AND caretaker_uid = $2 AND status = 'pending'`,
      [patient_uid, caretaker_uid],
    );
    if (pend.rows.length) return res.status(400).json({ error: 'Request already pending' });
    const ins = await pool.query(
      `INSERT INTO link_requests (patient_uid, caretaker_uid, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [patient_uid, caretaker_uid],
    );
    res.json(ins.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/incoming/:caretaker_uid', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lr.*, u.email as patient_email, u.full_name as patient_name, u.age as patient_age
       FROM link_requests lr
       JOIN users u ON u.firebase_uid = lr.patient_uid
       WHERE lr.caretaker_uid = $1 AND lr.status = 'pending'
       ORDER BY lr.created_at DESC`,
      [req.params.caretaker_uid],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/incoming-patient/:patient_uid', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lr.*, u.email as caretaker_email, u.full_name as caretaker_name
       FROM link_requests lr
       JOIN users u ON u.firebase_uid = lr.caretaker_uid
       WHERE lr.patient_uid = $1 AND lr.status = 'pending'
       ORDER BY lr.created_at DESC`,
      [req.params.patient_uid],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/request/:id/accept', async (req, res) => {
  const { caretaker_uid } = req.body;
  const id = Number(req.params.id);
  if (!caretaker_uid) return res.status(400).json({ error: 'caretaker_uid required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT * FROM link_requests WHERE id = $1 AND caretaker_uid = $2 AND status = 'pending' FOR UPDATE`,
      [id, caretaker_uid],
    );
    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    const { patient_uid } = r.rows[0];
    await client.query(
      `INSERT INTO caretaker_patients (caretaker_uid, patient_uid) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [caretaker_uid, patient_uid],
    );
    await client.query(`UPDATE link_requests SET status = 'accepted' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true, patient_uid });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/** Patient accepts a caregiver-initiated link request */
router.post('/request/:id/accept-by-patient', async (req, res) => {
  const { patient_uid } = req.body;
  const id = Number(req.params.id);
  if (!patient_uid) return res.status(400).json({ error: 'patient_uid required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT * FROM link_requests WHERE id = $1 AND patient_uid = $2 AND status = 'pending' FOR UPDATE`,
      [id, patient_uid],
    );
    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    const { caretaker_uid } = r.rows[0];
    await client.query(
      `INSERT INTO caretaker_patients (caretaker_uid, patient_uid) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [caretaker_uid, patient_uid],
    );
    await client.query(`UPDATE link_requests SET status = 'accepted' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true, caretaker_uid });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/request/:id/reject', async (req, res) => {
  const { caretaker_uid, patient_uid } = req.body;
  const id = Number(req.params.id);
  if (!caretaker_uid && !patient_uid) {
    return res.status(400).json({ error: 'caretaker_uid or patient_uid required' });
  }
  try {
    let r;
    if (caretaker_uid) {
      r = await pool.query(
        `UPDATE link_requests SET status = 'rejected'
         WHERE id = $1 AND caretaker_uid = $2 AND status = 'pending'
         RETURNING *`,
        [id, caretaker_uid],
      );
    } else {
      r = await pool.query(
        `UPDATE link_requests SET status = 'rejected'
         WHERE id = $1 AND patient_uid = $2 AND status = 'pending'
         RETURNING *`,
        [id, patient_uid],
      );
    }
    if (r.rowCount === 0) return res.status(404).json({ error: 'Request not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Patient generates a short code */
router.post('/code/generate', async (req, res) => {
  const { patient_uid } = req.body;
  if (!patient_uid) return res.status(400).json({ error: 'patient_uid required' });
  try {
    await pool.query(`DELETE FROM link_codes WHERE expires_at < NOW()`);
    let code;
    for (let i = 0; i < 5; i++) {
      code = randomCode();
      const chk = await pool.query(`SELECT 1 FROM link_codes WHERE code = $1`, [code]);
      if (chk.rows.length === 0) break;
    }
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO link_codes (code, patient_uid, expires_at) VALUES ($1, $2, $3)`,
      [code, patient_uid, expires],
    );
    res.json({ code, expires_at: expires });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Caregiver redeems patient code */
router.post('/code/redeem', async (req, res) => {
  const { caretaker_uid, code } = req.body;
  if (!caretaker_uid || !code) return res.status(400).json({ error: 'caretaker_uid and code required' });
  const c = String(code).trim().toUpperCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await client.query(
      `SELECT * FROM link_codes WHERE code = $1 FOR UPDATE`,
      [c],
    );
    if (row.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid code' });
    }
    const { patient_uid, expires_at } = row.rows[0];
    if (new Date(expires_at) < new Date()) {
      await client.query('DELETE FROM link_codes WHERE code = $1', [c]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Code expired' });
    }
    const linked = await client.query(
      `SELECT 1 FROM caretaker_patients WHERE caretaker_uid = $1 AND patient_uid = $2`,
      [caretaker_uid, patient_uid],
    );
    if (linked.rows.length) {
      await client.query(`DELETE FROM link_codes WHERE code = $1`, [c]);
      await client.query('COMMIT');
      return res.json({ ok: true, patient_uid, already_linked: true });
    }
    await client.query(
      `INSERT INTO caretaker_patients (caretaker_uid, patient_uid) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [caretaker_uid, patient_uid],
    );
    await client.query(`DELETE FROM link_codes WHERE code = $1`, [c]);
    await client.query('COMMIT');
    res.json({ ok: true, patient_uid });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

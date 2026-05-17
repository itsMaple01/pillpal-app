const express = require('express');
const router = express.Router();
const pool = require('../db');

async function migrateFirebaseUid(client, oldUid, newUid, email, role, full_name, age, health_condition) {
  await client.query(
    `UPDATE users SET firebase_uid = $1, email = $2, role = COALESCE($3, role),
      full_name = COALESCE($4, full_name), age = COALESCE($5, age),
      health_condition = COALESCE($6, health_condition)
     WHERE firebase_uid = $7`,
    [newUid, email, role, full_name ?? null, age ?? null, health_condition ?? null, oldUid],
  );
  await client.query(
    'UPDATE caretaker_patients SET caretaker_uid = $1 WHERE caretaker_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE caretaker_patients SET patient_uid = $1 WHERE patient_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE medications SET patient_uid = $1 WHERE patient_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE link_requests SET patient_uid = $1 WHERE patient_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE link_requests SET caretaker_uid = $1 WHERE caretaker_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE link_codes SET patient_uid = $1 WHERE patient_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE alerts SET caretaker_uid = $1 WHERE caretaker_uid = $2',
    [newUid, oldUid],
  );
  await client.query(
    'UPDATE alerts SET patient_uid = $1 WHERE patient_uid = $2',
    [newUid, oldUid],
  );
}

router.post('/sync', async (req, res) => {
  const { firebase_uid, email, role, full_name, age, health_condition } = req.body;
  if (!firebase_uid || !email || !role) {
    return res.status(400).json({ error: 'firebase_uid, email, and role are required' });
  }
  try {
    const existingByEmail = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
    );
    if (
      existingByEmail.rows.length > 0 &&
      existingByEmail.rows[0].firebase_uid !== firebase_uid
    ) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await migrateFirebaseUid(
          client,
          existingByEmail.rows[0].firebase_uid,
          firebase_uid,
          email,
          role,
          full_name,
          age,
          health_condition,
        );
        await client.query('COMMIT');
        const updated = await pool.query(
          'SELECT * FROM users WHERE firebase_uid = $1',
          [firebase_uid],
        );
        return res.json(updated.rows[0]);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const result = await pool.query(`
      INSERT INTO users (firebase_uid, email, role, full_name, age, health_condition)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET email = $2, role = $3, full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        age = COALESCE(EXCLUDED.age, users.age),
        health_condition = COALESCE(EXCLUDED.health_condition, users.health_condition)
      RETURNING *
    `, [firebase_uid, email, role, full_name ?? null, age ?? null, health_condition ?? null]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-email/:email', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [req.params.email]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No user found with that email.' });
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

router.patch('/:uid/push-token', async (req, res) => {
  const { expo_push_token } = req.body;
  try {
    await pool.query(
      'UPDATE users SET expo_push_token = $1 WHERE firebase_uid = $2',
      [expo_push_token ?? null, req.params.uid],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:uid/profile', async (req, res) => {
  const { firebase_uid, full_name, age, health_condition } = req.body;
  if (firebase_uid !== req.params.uid) {
    return res.status(403).json({ error: 'Cannot update another account' });
  }
  try {
    const result = await pool.query(
      `UPDATE users SET full_name = $1, age = $2, health_condition = $3 WHERE firebase_uid = $4 RETURNING *`,
      [full_name, age, health_condition ?? null, req.params.uid],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Caregiver updates a linked patient's profile */
router.put('/:patient_uid/linked-profile', async (req, res) => {
  const { caretaker_uid, full_name, age, health_condition } = req.body;
  if (!caretaker_uid) return res.status(400).json({ error: 'caretaker_uid required' });
  try {
    const link = await pool.query(
      `SELECT 1 FROM caretaker_patients WHERE caretaker_uid = $1 AND patient_uid = $2`,
      [caretaker_uid, req.params.patient_uid],
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not linked to this patient' });
    const result = await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), age = COALESCE($2, age),
        health_condition = COALESCE($3, health_condition) WHERE firebase_uid = $4 RETURNING *`,
      [full_name ?? null, age ?? null, health_condition ?? null, req.params.patient_uid],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
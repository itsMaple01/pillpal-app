const pool = require('./db');
const axios = require('axios');

async function checkMissedDoses() {
  try {
    const result = await pool.query(`
      SELECT 
        dl.id as dose_id,
        dl.patient_uid,
        dl.scheduled_at,
        s.medication_id,
        m.name as medication_name,
        u.full_name as patient_name,
        cp.caretaker_uid
      FROM dose_logs dl
      JOIN schedules s ON dl.schedule_id = s.id
      JOIN medications m ON s.medication_id = m.id
      JOIN users u ON dl.patient_uid = u.firebase_uid
      JOIN caretaker_patients cp ON dl.patient_uid = cp.patient_uid
      WHERE dl.status = 'pending'
        AND dl.scheduled_at < NOW() - INTERVAL '30 minutes'
        AND dl.scheduled_at::date = CURRENT_DATE
        AND dl.alert_sent = FALSE
    `);

    console.log(`🔍 Checking missed doses: found ${result.rows.length} pending doses`);

    for (const dose of result.rows) {
      await axios.post('http://localhost:3001/api/alerts', {
        caretaker_uid:   dose.caretaker_uid,
        patient_uid:     dose.patient_uid,
        patient_name:    dose.patient_name,
        medication_name: dose.medication_name,
        message: `${dose.patient_name} missed their ${dose.medication_name} scheduled at ${dose.scheduled_at}`,
        type: 'missed_dose'
      });

      await pool.query(
        `UPDATE dose_logs SET alert_sent = TRUE WHERE id = $1`,
        [dose.dose_id]
      );

      console.log(`📢 Alert sent for ${dose.patient_name} - ${dose.medication_name}`);
    }

    console.log(`✅ Checked missed doses: ${result.rows.length} alerts sent`);
  } catch (err) {
    console.error('❌ Missed dose checker error:', err.message);
  }
}

module.exports = checkMissedDoses;
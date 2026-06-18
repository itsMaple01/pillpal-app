const pool = require('../db');
const { sendPushNotification } = require('./expoPush');

async function notifyLinkedCaretakers(patientUid, { title, body, data = {} }) {
  const caretakers = await pool.query(
    `SELECT u.expo_push_token
     FROM caretaker_patients cp
     JOIN users u ON u.firebase_uid = cp.caretaker_uid
     WHERE cp.patient_uid = $1
       AND cp.status = 'active'
       AND u.expo_push_token IS NOT NULL`,
    [patientUid],
  );

  for (const c of caretakers.rows) {
    await sendPushNotification(c.expo_push_token, title, body, data);
  }
}

module.exports = { notifyLinkedCaretakers };

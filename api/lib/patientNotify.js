const pool = require('../db');
const { sendPushNotification } = require('./expoPush');
const { notifyLinkedCaretakers } = require('./caretakerNotify');

/**
 * Send FCM to the patient and all linked caretakers/family with active status.
 * Skips recipients without expo_push_token.
 */
async function notifyPatientAndLinkedCaregivers(patientUid, { title, body, data = {} }) {
  try {
    const patientRes = await pool.query(
      `SELECT expo_push_token FROM users WHERE firebase_uid = $1`,
      [patientUid],
    );
    const patientToken = patientRes.rows[0]?.expo_push_token;
    if (patientToken) {
      try {
        await sendPushNotification(patientToken, title, body, data);
      } catch (err) {
        console.warn(`[notify] patient push failed for ${patientUid}:`, err.message);
      }
    }
  } catch (err) {
    console.warn(`[notify] patient lookup failed for ${patientUid}:`, err.message);
  }

  await notifyLinkedCaretakers(patientUid, { title, body, data });
}

module.exports = { notifyPatientAndLinkedCaregivers };

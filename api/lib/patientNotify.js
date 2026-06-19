const pool = require('../db');
const { sendPushNotification } = require('./expoPush');
const { notifyLinkedCaretakers } = require('./caretakerNotify');

/**
 * Send FCM to the patient and all linked caretakers/family with active status.
 * Use patientBody for first-person patient copy; caretakerBody for third-person caregiver copy.
 * Falls back to body when role-specific copy is omitted.
 */
async function notifyPatientAndLinkedCaregivers(
  patientUid,
  { title, body, patientBody, caretakerBody, data = {} },
) {
  const forPatient = patientBody ?? body;
  const forCaretakers = caretakerBody ?? body;

  try {
    const patientRes = await pool.query(
      `SELECT expo_push_token FROM users WHERE firebase_uid = $1`,
      [patientUid],
    );
    const patientToken = patientRes.rows[0]?.expo_push_token;
    if (patientToken && forPatient) {
      try {
        await sendPushNotification(patientToken, title, forPatient, data);
      } catch (err) {
        console.warn(`[notify] patient push failed for ${patientUid}:`, err.message);
      }
    }
  } catch (err) {
    console.warn(`[notify] patient lookup failed for ${patientUid}:`, err.message);
  }

  if (forCaretakers) {
    await notifyLinkedCaretakers(patientUid, { title, body: forCaretakers, data });
  }
}

module.exports = { notifyPatientAndLinkedCaregivers };

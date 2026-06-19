const pool = require('../db');
const { sendPushNotification } = require('./expoPush');

/**
 * Linked caretakers/family for a patient — never the patient account itself.
 */
async function getLinkedCaregiverTokens(patientUid) {
  const result = await pool.query(
    `SELECT u.firebase_uid, u.expo_push_token, u.role
     FROM caretaker_patients cp
     JOIN users u ON u.firebase_uid = cp.caretaker_uid
     WHERE cp.patient_uid = $1
       AND cp.status = 'active'
       AND cp.caretaker_uid != cp.patient_uid
       AND cp.caretaker_uid != $1
       AND u.firebase_uid != $1
       AND u.role IN ('caretaker', 'family')
       AND u.expo_push_token IS NOT NULL`,
    [patientUid],
  );
  return result.rows;
}

async function notifyLinkedCaretakers(patientUid, { title, body, data = {} }) {
  const caretakers = await getLinkedCaregiverTokens(patientUid);

  for (const c of caretakers) {
    try {
      await sendPushNotification(c.expo_push_token, title, body, data);
    } catch (err) {
      console.warn(
        `[notify] caretaker push failed for ${c.firebase_uid} (${c.role}):`,
        err.message || err,
      );
    }
  }
}

/** Spec: caretakers/family only — "{patient_name} has taken {medication_name}". */
async function notifyMedicationTaken(patientUid, patientName, medicationName, extraData = {}) {
  await notifyLinkedCaretakers(patientUid, {
    title: 'Medication Taken',
    body: `${patientName} has taken ${medicationName}`,
    data: {
      type: 'medication_taken',
      patient_uid: patientUid,
      medication_name: medicationName,
      ...extraData,
    },
  });
}

module.exports = {
  notifyLinkedCaretakers,
  notifyMedicationTaken,
  getLinkedCaregiverTokens,
};

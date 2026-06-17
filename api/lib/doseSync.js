const pool = require('../db');
const {
  getManilaNow,
  parseMedicationTime,
  manilaScheduledTimestamp,
  manilaLocalToUtcMs,
  isPastTwoHourWindow,
} = require('./manilaTime');

function medicationTimeStr(med) {
  return (med.program || med.frequency || '').trim();
}

function isTakenToday(med, today) {
  if (!med.taken) return false;
  if (!med.last_taken_at) return med.taken;
  const takenDate = med.last_taken_at instanceof Date
    ? med.last_taken_at.toISOString().slice(0, 10)
    : String(med.last_taken_at).slice(0, 10);
  return takenDate === today;
}

async function ensureScheduleForMedication(med) {
  const existing = await pool.query(
    'SELECT id FROM schedules WHERE medication_id = $1 LIMIT 1',
    [med.id],
  );
  if (existing.rowCount > 0) return existing.rows[0].id;

  const parsed = parseMedicationTime(medicationTimeStr(med));
  if (!parsed) return null;

  const timeValue = `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:00`;
  const ins = await pool.query(
    `INSERT INTO schedules (medication_id, patient_uid, scheduled_time, days_of_week)
     VALUES ($1, $2, $3::time, ARRAY['mon','tue','wed','thu','fri','sat','sun'])
     RETURNING id`,
    [med.id, med.patient_uid, timeValue],
  );
  return ins.rows[0].id;
}

function resolveDoseStatus(med, parsed, manila) {
  if (isTakenToday(med, manila.today)) return 'taken';

  const scheduledMs = manilaLocalToUtcMs(manila.today, parsed.hour, parsed.minute);
  if (isPastTwoHourWindow(scheduledMs)) return 'missed';
  if (Date.now() >= scheduledMs) return 'pending';
  return 'pending';
}

async function syncTodayDoseLogsForPatient(patientUid) {
  const manila = getManilaNow();
  const meds = await pool.query(
    `SELECT id, patient_uid, program, frequency, taken, last_taken_at
     FROM medications
     WHERE patient_uid = $1 AND COALESCE(suspended, FALSE) = FALSE`,
    [patientUid],
  );

  for (const med of meds.rows) {
    try {
      const scheduleId = await ensureScheduleForMedication(med);
      if (!scheduleId) continue;

      const parsed = parseMedicationTime(medicationTimeStr(med));
      if (!parsed) continue;

      const scheduledLocal = manilaScheduledTimestamp(manila.today, parsed.hour, parsed.minute);
      const status = resolveDoseStatus(med, parsed, manila);

      const existing = await pool.query(
        `SELECT id, status FROM dose_logs
         WHERE schedule_id = $1 AND patient_uid = $2
           AND scheduled_at::date = $3::date`,
        [Number(scheduleId), String(med.patient_uid), String(manila.today)],
      );

      if (existing.rowCount === 0) {
        const scheduledAtUtc = new Date(scheduledLocal).toISOString();
        await pool.query(
          `INSERT INTO dose_logs (schedule_id, patient_uid, scheduled_at, status, taken_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            Number(scheduleId),
            String(med.patient_uid),
            scheduledAtUtc,
            String(status),
            status === 'taken' ? new Date().toISOString() : null,
          ],
        );
        continue;
      }

      const row = existing.rows[0];
      if (row.status === 'taken') continue;

      if (status === 'taken') {
        await pool.query(
          `UPDATE dose_logs SET status = 'taken', taken_at = NOW() WHERE id = $1`,
          [Number(row.id)],
        );
      } else if (row.status === 'pending' && status === 'missed') {
        await pool.query(
          `UPDATE dose_logs SET status = 'missed' WHERE id = $1 AND status = 'pending'`,
          [Number(row.id)],
        );
      }
    } catch (err) {
      console.error(`[doseSync] med ${med.id} patient ${med.patient_uid}:`, err.message);
    }
  }
}

async function syncTodayDoseLogsForCaretaker(caretakerUid) {
  const patients = await pool.query(
    `SELECT patient_uid FROM caretaker_patients
     WHERE caretaker_uid = $1 AND status = 'active'`,
    [caretakerUid],
  );
  for (const row of patients.rows) {
    await syncTodayDoseLogsForPatient(row.patient_uid);
  }
}

async function syncAllTodayDoseLogs() {
  const res = await pool.query(
    `SELECT DISTINCT patient_uid FROM medications WHERE COALESCE(suspended, FALSE) = FALSE`,
  );
  for (const row of res.rows) {
    await syncTodayDoseLogsForPatient(row.patient_uid);
  }
}

module.exports = {
  syncTodayDoseLogsForPatient,
  syncTodayDoseLogsForCaretaker,
  syncAllTodayDoseLogs,
  isTakenToday,
};
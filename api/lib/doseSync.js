const pool = require('../db');
const {
  getManilaNow,
  parseMedicationTime,
  manilaLocalToUtcMs,
  isPastTwoHourWindow,
  toManilaDateString,
} = require('./manilaTime');

function medicationTimeStr(med) {
  return (med.program || med.frequency || '').trim();
}

function isTakenToday(med, today) {
  if (!med.taken) return false;
  if (!med.last_taken_at) return med.taken;
  const takenDate = toManilaDateString(med.last_taken_at);
  return takenDate === today;
}

async function ensureScheduleForMedication(med) {
  const existing = await pool.query(
    'SELECT id FROM schedules WHERE medication_id = $1 ORDER BY id ASC LIMIT 1',
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
  return 'pending';
}

/** Today's dose_log for a schedule — prefers taken rows when duplicates exist. */
async function getTodayDoseLog(scheduleId, patientUid, logDate) {
  const result = await pool.query(
    `SELECT id, status, taken_at FROM dose_logs
     WHERE schedule_id = $1 AND patient_uid = $2 AND log_date = $3::date
     ORDER BY
       CASE WHEN status = 'taken' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
       taken_at DESC NULLS LAST,
       id DESC
     LIMIT 1`,
    [Number(scheduleId), String(patientUid), String(logDate)],
  );
  return result.rows[0] ?? null;
}

function isDoseLogTaken(row) {
  return row?.status === 'taken' || row?.taken_at != null;
}

/**
 * Insert or update exactly one dose_logs row per schedule_id + log_date.
 * Never downgrades a taken row.
 */
async function upsertTodayDoseLog({
  scheduleId,
  patientUid,
  logDate,
  scheduledAtUtc,
  status,
  takenAt = null,
}) {
  const result = await pool.query(
    `INSERT INTO dose_logs (schedule_id, patient_uid, scheduled_at, log_date, status, taken_at)
     VALUES ($1, $2, $3, $4::date, $5, $6)
     ON CONFLICT (schedule_id, log_date)
     DO UPDATE SET
       status = CASE
         WHEN dose_logs.status = 'taken' OR dose_logs.taken_at IS NOT NULL THEN dose_logs.status
         WHEN EXCLUDED.status = 'taken' THEN 'taken'
         WHEN dose_logs.status = 'missed' AND EXCLUDED.status = 'pending' THEN dose_logs.status
         ELSE EXCLUDED.status
       END,
       taken_at = COALESCE(dose_logs.taken_at, EXCLUDED.taken_at),
       scheduled_at = COALESCE(dose_logs.scheduled_at, EXCLUDED.scheduled_at)
     RETURNING id, status, taken_at`,
    [
      Number(scheduleId),
      String(patientUid),
      scheduledAtUtc,
      String(logDate),
      String(status),
      takenAt,
    ],
  );
  return result.rows[0];
}

/** Mark today's dose taken for a schedule — upserts the single row for that day. */
async function markTodayDoseTaken({ scheduleId, patientUid, logDate, scheduledAtUtc }) {
  return upsertTodayDoseLog({
    scheduleId,
    patientUid,
    logDate,
    scheduledAtUtc,
    status: 'taken',
    takenAt: new Date().toISOString(),
  });
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

      const scheduledAtUtc = new Date(
        manilaLocalToUtcMs(manila.today, parsed.hour, parsed.minute),
      ).toISOString();
      const status = resolveDoseStatus(med, parsed, manila);

      const existing = await getTodayDoseLog(scheduleId, med.patient_uid, manila.today);

      if (isDoseLogTaken(existing)) continue;

      if (existing) {
        if (status === 'taken') {
          await markTodayDoseTaken({
            scheduleId,
            patientUid: med.patient_uid,
            logDate: manila.today,
            scheduledAtUtc,
          });
        } else if (existing.status === 'pending' && status === 'missed') {
          await pool.query(
            `UPDATE dose_logs SET status = 'missed'
             WHERE id = $1 AND status = 'pending'`,
            [Number(existing.id)],
          );
        }
        continue;
      }

      await upsertTodayDoseLog({
        scheduleId,
        patientUid: med.patient_uid,
        logDate: manila.today,
        scheduledAtUtc,
        status,
        takenAt: status === 'taken' ? new Date().toISOString() : null,
      });
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
  upsertTodayDoseLog,
  markTodayDoseTaken,
  getTodayDoseLog,
  isTakenToday,
};

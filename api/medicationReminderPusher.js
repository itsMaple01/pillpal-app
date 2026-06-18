const pool = require('./db');
const { sendPushNotification } = require('./lib/expoPush');
const { notifyLinkedCaretakers } = require('./lib/caretakerNotify');

const WINDOW_MINUTES = 5;
const MANILA_TZ = 'Asia/Manila';

function parseMedicationTime(timeStr) {
  const t = (timeStr || '').trim();
  if (!t) return null;

  const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const minute = parseInt(m12[2], 10);
    const ap = m12[3].toUpperCase();
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    return { hour: hour % 24, minute: minute % 60, label: t };
  }

  const m24 = t.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    return {
      hour: parseInt(m24[1], 10) % 24,
      minute: parseInt(m24[2], 10) % 60,
      label: t,
    };
  }

  return null;
}

function parseScheduleTime(timeValue) {
  if (!timeValue) return null;
  const str = String(timeValue);
  const m = str.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return {
    hour: parseInt(m[1], 10) % 24,
    minute: parseInt(m[2], 10) % 60,
    label: str.slice(0, 5),
  };
}

function getManilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find(p => p.type === type)?.value ?? '0';
  const hour = parseInt(get('hour'), 10) % 24;
  const minute = parseInt(get('minute'), 10) % 60;
  const today = `${get('year')}-${get('month')}-${get('day')}`;

  return {
    nowMinutes: hour * 60 + minute,
    today,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function isScheduledWithinNextWindow(scheduledMinutes, nowMinutes, window = WINDOW_MINUTES) {
  const diff = scheduledMinutes - nowMinutes;
  if (diff < 0) return false;
  return diff >= 0 && diff < window;
}

async function alreadySentToday(medicationId, patientUid, today) {
  const sent = await pool.query(
    `SELECT 1 FROM medication_push_log
     WHERE medication_id = $1 AND patient_uid = $2
       AND push_date = $3::date AND push_type = 'scheduled'`,
    [medicationId, patientUid, today],
  );
  return sent.rowCount > 0;
}

async function doseAlreadyResolved(medicationId, patientUid, today) {
  const result = await pool.query(
    `SELECT 1 FROM dose_logs dl
     JOIN schedules s ON s.id = dl.schedule_id
     WHERE s.medication_id = $1
       AND dl.patient_uid = $2
       AND dl.scheduled_at::date = $3::date
       AND dl.status IN ('taken', 'missed')
     LIMIT 1`,
    [medicationId, patientUid, today],
  );
  return result.rowCount > 0;
}

async function medicationTakenToday(medicationId, patientUid) {
  const result = await pool.query(
    `SELECT 1 FROM medications
     WHERE id = $1 AND patient_uid = $2
       AND taken = TRUE AND last_taken_at = CURRENT_DATE
     LIMIT 1`,
    [medicationId, patientUid],
  );
  return result.rowCount > 0;
}

async function sendPushAndLog(row, body, today, scheduledLabel) {
  if (!row.expo_push_token) {
    console.warn(`⚠️ No FCM token for patient ${row.patient_uid}`);
    return false;
  }

  try {
    await sendPushNotification(
      row.expo_push_token,
      'GabayRa — Medication reminder',
      body,
      {
        type: 'med_reminder',
        medication_id: row.medication_id,
        patient_uid: row.patient_uid,
        schedule_id: row.schedule_id ?? '',
      },
    );

    const patientName = row.patient_name || 'Patient';
    await notifyLinkedCaretakers(row.patient_uid, {
      title: 'Medication Reminder',
      body: `${patientName} has a medication due: ${row.medication_name} at ${scheduledLabel}`,
      data: {
        type: 'caretaker_med_reminder',
        patient_uid: row.patient_uid,
        medication_id: String(row.medication_id),
      },
    });

    await pool.query(
      `INSERT INTO medication_push_log (medication_id, patient_uid, push_type, push_date)
       VALUES ($1, $2, 'scheduled', $3::date)
       ON CONFLICT (medication_id, push_date, push_type) DO NOTHING`,
      [row.medication_id, row.patient_uid, today],
    );
    console.log(`📲 Scheduled FCM push sent: ${row.medication_name} → ${row.patient_uid}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ FCM push failed for med ${row.medication_id}:`, err.message);
    return false;
  }
}

async function sendDueMedicationReminders() {
  try {
    const manila = getManilaNow();
    console.log(
      `[cron] Medication reminder pusher fired — Manila ${manila.today} ${manila.label} (UTC+8)`,
    );

    let sentCount = 0;
    let skippedCount = 0;

    const scheduleResult = await pool.query(`
      SELECT s.id AS schedule_id,
             s.medication_id,
             s.scheduled_time,
             s.patient_uid,
             m.name AS medication_name,
             u.expo_push_token,
             pu.full_name AS patient_name
      FROM schedules s
      JOIN medications m ON m.id = s.medication_id
      JOIN users u ON u.firebase_uid = s.patient_uid
      JOIN users pu ON pu.firebase_uid = s.patient_uid
      WHERE COALESCE(m.suspended, FALSE) = FALSE
        AND COALESCE(m.notify_enabled, TRUE) = TRUE
        AND u.expo_push_token IS NOT NULL
    `);

    console.log(`[cron] Found ${scheduleResult.rows.length} schedule row(s) to evaluate`);

    for (const row of scheduleResult.rows) {
      const parsed = parseScheduleTime(row.scheduled_time);
      if (!parsed) {
        skippedCount += 1;
        continue;
      }

      const scheduledMinutes = parsed.hour * 60 + parsed.minute;
      if (!isScheduledWithinNextWindow(scheduledMinutes, manila.nowMinutes)) {
        skippedCount += 1;
        continue;
      }

      if (await alreadySentToday(row.medication_id, row.patient_uid, manila.today)) {
        console.log(`[cron] Skip (already pushed): med ${row.medication_id} patient ${row.patient_uid}`);
        skippedCount += 1;
        continue;
      }

      if (await doseAlreadyResolved(row.medication_id, row.patient_uid, manila.today)) {
        console.log(`[cron] Skip (dose taken/missed): med ${row.medication_id} patient ${row.patient_uid}`);
        skippedCount += 1;
        continue;
      }

      const sent = await sendPushAndLog(
        row,
        `Time for ${row.medication_name} · ${parsed.label}`,
        manila.today,
        parsed.label,
      );
      if (sent) sentCount += 1;
    }

    const medResult = await pool.query(`
      SELECT m.id AS medication_id,
             m.name AS medication_name,
             m.program,
             m.frequency,
             m.patient_uid,
             u.expo_push_token,
             pu.full_name AS patient_name
      FROM medications m
      JOIN users u ON u.firebase_uid = m.patient_uid
      JOIN users pu ON pu.firebase_uid = m.patient_uid
      WHERE COALESCE(m.suspended, FALSE) = FALSE
        AND COALESCE(m.notify_enabled, TRUE) = TRUE
        AND u.expo_push_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM schedules s WHERE s.medication_id = m.id
        )
    `);

    console.log(`[cron] Found ${medResult.rows.length} legacy medication row(s) without schedules`);

    for (const row of medResult.rows) {
      const timeStr = row.program || row.frequency || '';
      const parsed = parseMedicationTime(timeStr);
      if (!parsed) {
        skippedCount += 1;
        continue;
      }

      const scheduledMinutes = parsed.hour * 60 + parsed.minute;
      if (!isScheduledWithinNextWindow(scheduledMinutes, manila.nowMinutes)) {
        skippedCount += 1;
        continue;
      }

      if (await alreadySentToday(row.medication_id, row.patient_uid, manila.today)) {
        console.log(`[cron] Skip (already pushed): med ${row.medication_id} patient ${row.patient_uid}`);
        skippedCount += 1;
        continue;
      }

      if (await medicationTakenToday(row.medication_id, row.patient_uid)) {
        console.log(`[cron] Skip (medication taken today): med ${row.medication_id}`);
        skippedCount += 1;
        continue;
      }

      const sent = await sendPushAndLog(
        row,
        `Time for ${row.medication_name} · ${parsed.label}`,
        manila.today,
        parsed.label,
      );
      if (sent) sentCount += 1;
    }

    console.log(
      `[cron] Medication reminder pusher done — sent ${sentCount}, skipped ${skippedCount}`,
    );
  } catch (err) {
    console.error('Medication reminder pusher error:', err);
  }
}

module.exports = sendDueMedicationReminders;

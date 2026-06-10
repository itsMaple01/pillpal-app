const pool = require('./db');
const { pushToUser } = require('./lib/expoPush');

const WINDOW_MINUTES = 5;

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

function minutesSinceMidnight(hour, minute) {
  return hour * 60 + minute;
}

function isDueWithinWindow(targetMinutes, nowMinutes, window = WINDOW_MINUTES) {
  let diff = targetMinutes - nowMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff >= 0 && diff < window;
}

async function alreadySentToday(medicationId) {
  const sent = await pool.query(
    `SELECT 1 FROM medication_push_log
     WHERE medication_id = $1 AND push_date = CURRENT_DATE AND push_type = 'scheduled'`,
    [medicationId],
  );
  return sent.rowCount > 0;
}

async function sendPushAndLog(row, body) {
  const pushResult = await pushToUser(row.expo_push_token, {
    title: 'GabayRa — Medication reminder',
    body,
    data: {
      type: 'med_reminder',
      medication_id: row.medication_id,
      patient_uid: row.patient_uid,
      schedule_id: row.schedule_id ?? null,
    },
  });

  if (pushResult.ok) {
    await pool.query(
      `INSERT INTO medication_push_log (medication_id, patient_uid, push_type)
       VALUES ($1, $2, 'scheduled')
       ON CONFLICT (medication_id, push_date, push_type) DO NOTHING`,
      [row.medication_id, row.patient_uid],
    );
    console.log(`📲 Scheduled push sent: ${row.medication_name} → ${row.patient_uid}`);
    return true;
  }

  console.warn(`⚠️ Push failed for med ${row.medication_id}:`, pushResult.error);
  return false;
}

async function sendDueMedicationReminders() {
  try {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let sentCount = 0;

    const scheduleResult = await pool.query(`
      SELECT s.id AS schedule_id,
             s.medication_id,
             s.scheduled_time,
             s.patient_uid,
             m.name AS medication_name,
             u.expo_push_token,
             COALESCE(ip.preferred_lead_minutes, 5) AS lead_minutes
      FROM schedules s
      JOIN medications m ON m.id = s.medication_id
      JOIN users u ON u.firebase_uid = s.patient_uid
      LEFT JOIN intelligence_profiles ip ON ip.firebase_uid = s.patient_uid
      WHERE COALESCE(m.suspended, FALSE) = FALSE
        AND COALESCE(m.notify_enabled, TRUE) = TRUE
        AND u.expo_push_token IS NOT NULL
    `);

    for (const row of scheduleResult.rows) {
      const parsed = parseScheduleTime(row.scheduled_time);
      if (!parsed) continue;

      let targetMinutes = minutesSinceMidnight(parsed.hour, parsed.minute) - row.lead_minutes;
      while (targetMinutes < 0) targetMinutes += 24 * 60;
      targetMinutes %= 24 * 60;

      if (!isDueWithinWindow(targetMinutes, nowMinutes)) continue;
      if (await alreadySentToday(row.medication_id)) continue;

      const sent = await sendPushAndLog(
        row,
        `Time for ${row.medication_name} · ${parsed.label}`,
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
             COALESCE(ip.preferred_lead_minutes, 5) AS lead_minutes
      FROM medications m
      JOIN users u ON u.firebase_uid = m.patient_uid
      LEFT JOIN intelligence_profiles ip ON ip.firebase_uid = m.patient_uid
      WHERE COALESCE(m.suspended, FALSE) = FALSE
        AND COALESCE(m.notify_enabled, TRUE) = TRUE
        AND u.expo_push_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM schedules s WHERE s.medication_id = m.id
        )
    `);

    for (const row of medResult.rows) {
      const timeStr = row.program || row.frequency || '';
      const parsed = parseMedicationTime(timeStr);
      if (!parsed) continue;

      let targetMinutes = minutesSinceMidnight(parsed.hour, parsed.minute) - row.lead_minutes;
      while (targetMinutes < 0) targetMinutes += 24 * 60;
      targetMinutes %= 24 * 60;

      if (!isDueWithinWindow(targetMinutes, nowMinutes)) continue;
      if (await alreadySentToday(row.medication_id)) continue;

      const sent = await sendPushAndLog(
        row,
        `Time for ${row.medication_name} · ${parsed.label}`,
      );
      if (sent) sentCount += 1;
    }

    if (sentCount > 0) {
      console.log(`✅ Medication reminder pusher: ${sentCount} notification(s) sent`);
    }
  } catch (err) {
    console.error('❌ Medication reminder pusher error:', err.message);
  }
}

module.exports = sendDueMedicationReminders;

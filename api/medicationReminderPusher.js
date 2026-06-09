const pool = require('./db');
const { pushToUser } = require('./lib/expoPush');

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

function minutesSinceMidnight(hour, minute) {
  return hour * 60 + minute;
}

async function sendDueMedicationReminders() {
  try {
    const result = await pool.query(`
      SELECT m.id, m.name, m.program, m.frequency, m.patient_uid,
             u.expo_push_token,
             COALESCE(ip.preferred_lead_minutes, 5) AS lead_minutes
      FROM medications m
      JOIN users u ON u.firebase_uid = m.patient_uid
      LEFT JOIN intelligence_profiles ip ON ip.firebase_uid = m.patient_uid
      WHERE COALESCE(m.suspended, FALSE) = FALSE
        AND COALESCE(m.notify_enabled, TRUE) = TRUE
        AND u.expo_push_token IS NOT NULL
    `);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let sentCount = 0;

    for (const row of result.rows) {
      const timeStr = row.program || row.frequency || '';
      const parsed = parseMedicationTime(timeStr);
      if (!parsed) continue;

      let targetMinutes = minutesSinceMidnight(parsed.hour, parsed.minute) - row.lead_minutes;
      while (targetMinutes < 0) targetMinutes += 24 * 60;
      targetMinutes %= 24 * 60;

      if (nowMinutes !== targetMinutes) continue;

      const alreadySent = await pool.query(
        `SELECT 1 FROM medication_push_log
         WHERE medication_id = $1 AND push_date = CURRENT_DATE AND push_type = 'scheduled'`,
        [row.id],
      );
      if (alreadySent.rowCount > 0) continue;

      const pushResult = await pushToUser(row.expo_push_token, {
        title: 'GabayRa — Medication reminder',
        body: `Time for ${row.name} · ${parsed.label}`,
        data: {
          type: 'med_reminder',
          medication_id: row.id,
          patient_uid: row.patient_uid,
        },
      });

      if (pushResult.ok) {
        await pool.query(
          `INSERT INTO medication_push_log (medication_id, patient_uid, push_type)
           VALUES ($1, $2, 'scheduled')
           ON CONFLICT (medication_id, push_date, push_type) DO NOTHING`,
          [row.id, row.patient_uid],
        );
        sentCount += 1;
        console.log(`📲 Scheduled push sent: ${row.name} → ${row.patient_uid}`);
      } else {
        console.warn(`⚠️ Push failed for med ${row.id}:`, pushResult.error);
      }
    }

    if (sentCount > 0) {
      console.log(`✅ Medication reminder pusher: ${sentCount} notification(s) sent`);
    }
  } catch (err) {
    console.error('❌ Medication reminder pusher error:', err.message);
  }
}

module.exports = sendDueMedicationReminders;

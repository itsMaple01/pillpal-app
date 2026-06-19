const pool = require('../db');
const admin = require('../firebaseAdmin');
const { notifyMedicationTaken } = require('./caretakerNotify');
const { markTodayDoseTaken, getTodayDoseLog } = require('./doseSync');
const { getManilaNow, manilaLocalToUtcMs, parseMedicationTime } = require('./manilaTime');

let mqttPublishClient = null;

async function bumpPatientActivity(patientUid, type = 'pillbox_dose_taken') {
  try {
    await admin.firestore().collection('patient_activity').doc(patientUid).set(
      { type, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn('[mqtt] patient_activity bump failed:', err.message);
  }
}

function setMqttPublishClient(client) {
  mqttPublishClient = client;
}

function publishPillboxCommand(deviceId, command) {
  if (!mqttPublishClient || !mqttPublishClient.connected) {
    console.warn(`[mqtt] cannot publish ${command} — client not connected`);
    return false;
  }
  const topic = `gabayra/devices/${deviceId}/commands`;
  mqttPublishClient.publish(topic, JSON.stringify({ command }));
  console.log(`[mqtt] published ${command} → ${topic}`);
  return true;
}

async function getActivePillboxDeviceId(patientUid) {
  const res = await pool.query(
    `SELECT device_id FROM pillbox_devices
     WHERE patient_uid = $1 AND is_active = TRUE
     LIMIT 1`,
    [patientUid],
  );
  return res.rows[0]?.device_id ?? null;
}

async function buzzOnForPatient(patientUid) {
  const deviceId = await getActivePillboxDeviceId(patientUid);
  if (!deviceId) return false;
  return publishPillboxCommand(deviceId, 'buzz_on');
}

async function buzzOffForPatient(patientUid) {
  const deviceId = await getActivePillboxDeviceId(patientUid);
  if (!deviceId) return false;
  return publishPillboxCommand(deviceId, 'buzz_off');
}

function scheduledAtUtcForToday(manila, parsed) {
  if (!parsed) return new Date().toISOString();
  return new Date(manilaLocalToUtcMs(manila.today, parsed.hour, parsed.minute)).toISOString();
}

/** Earliest pending dose for today — one row per schedule via DISTINCT ON. */
async function findPendingDoseForToday(patientUid) {
  const manila = getManilaNow();

  const pending = await pool.query(
    `SELECT DISTINCT ON (s.medication_id)
            dl.id AS dose_log_id,
            dl.schedule_id,
            s.medication_id,
            m.name AS medication_name,
            s.scheduled_time,
            m.program,
            m.frequency
     FROM dose_logs dl
     JOIN schedules s ON s.id = dl.schedule_id
     JOIN medications m ON m.id = s.medication_id
     WHERE dl.patient_uid = $1
       AND dl.status = 'pending'
       AND dl.log_date = $2::date
     ORDER BY s.medication_id, dl.scheduled_at ASC`,
    [patientUid, manila.today],
  );

  if (pending.rowCount > 0) return pending.rows[0];

  const fallback = await pool.query(
    `SELECT m.id AS medication_id,
            m.name AS medication_name,
            m.program,
            m.frequency,
            s.id AS schedule_id,
            s.scheduled_time
     FROM medications m
     JOIN schedules s ON s.medication_id = m.id
     WHERE m.patient_uid = $1
       AND COALESCE(m.suspended, FALSE) = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM dose_logs dl
         WHERE dl.schedule_id = s.id
           AND dl.patient_uid = $1
           AND dl.log_date = $2::date
           AND (dl.status = 'taken' OR dl.taken_at IS NOT NULL)
       )
     ORDER BY s.scheduled_time ASC NULLS LAST, m.id ASC
     LIMIT 1`,
    [patientUid, manila.today],
  );

  if (fallback.rowCount === 0) return null;
  return fallback.rows[0];
}

async function handlePillboxDoseTaken(payload) {
  const deviceId = payload?.device_id;
  if (!deviceId) {
    console.warn('[mqtt] dose_taken missing device_id');
    return;
  }

  const deviceRes = await pool.query(
    `SELECT patient_uid, device_id
     FROM pillbox_devices
     WHERE device_id = $1 AND is_active = TRUE
     LIMIT 1`,
    [deviceId],
  );

  if (deviceRes.rowCount === 0) {
    console.warn(`[mqtt] no active pillbox registered for device ${deviceId}`);
    return;
  }

  const { patient_uid: patientUid } = deviceRes.rows[0];
  const manila = getManilaNow();

  const dose = await findPendingDoseForToday(patientUid);
  if (!dose || !dose.schedule_id) {
    console.warn(`[mqtt] no pending dose found for patient ${patientUid} (device ${deviceId})`);
    return;
  }

  const medTime = dose.program || dose.frequency || '';
  const parsed = parseMedicationTime(medTime)
    || (() => {
      const t = String(dose.scheduled_time || '');
      const m = t.match(/(\d{1,2}):(\d{2})/);
      return m ? { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) } : null;
    })();
  const scheduledAtUtc = scheduledAtUtcForToday(manila, parsed);

  const existing = await getTodayDoseLog(dose.schedule_id, patientUid, manila.today);
  if (existing?.status === 'taken' || existing?.taken_at) {
    console.log(
      `[mqtt] dose already taken for schedule ${dose.schedule_id} patient ${patientUid} — skipping`,
    );
    return;
  }

  await markTodayDoseTaken({
    scheduleId: dose.schedule_id,
    patientUid,
    logDate: manila.today,
    scheduledAtUtc,
  });

  await pool.query(
    `UPDATE medications
     SET taken = TRUE,
         last_taken_at = (NOW() AT TIME ZONE 'Asia/Manila')::date
     WHERE id = $1`,
    [dose.medication_id],
  );

  await pool.query(
    `UPDATE pillbox_devices SET last_dose_time = NOW()
     WHERE device_id = $1 AND is_active = TRUE`,
    [deviceId],
  );

  await pool.query(
    `INSERT INTO medication_push_log (medication_id, patient_uid, push_type, push_date)
     VALUES ($1, $2, 'pillbox', $3::date)
     ON CONFLICT (medication_id, push_date, push_type) DO NOTHING`,
    [dose.medication_id, patientUid, manila.today],
  );

  const patientRes = await pool.query(
    `SELECT full_name FROM users WHERE firebase_uid = $1`,
    [patientUid],
  );
  const patientName = patientRes.rows[0]?.full_name || 'Patient';

  await notifyMedicationTaken(patientUid, patientName, dose.medication_name, {
    medication_id: String(dose.medication_id),
    device_id: deviceId,
  });

  await buzzOffForPatient(patientUid);
  await bumpPatientActivity(patientUid, 'pillbox_dose_taken');

  console.log(
    `[mqtt] dose_taken processed: ${deviceId} → ${patientName} / ${dose.medication_name}`,
  );
}

function startMqttPillboxListener() {
  let mqtt;
  try {
    mqtt = require('mqtt');
  } catch (err) {
    console.error('[mqtt] mqtt package not installed:', err.message);
    return null;
  }

  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
  const topic = process.env.MQTT_PILLBOX_TOPIC || 'gabayra/devices/+/events';

  const client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    setMqttPublishClient(client);
    client.subscribe(topic, (err) => {
      if (err) console.error('[mqtt] subscribe error:', err);
      else console.log(`[mqtt] subscribed to ${topic}`);
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const deviceId = payload?.device_id ?? 'unknown';
      const eventType = payload?.event ?? 'unknown';
      console.log(`[mqtt] message received topic=${topic} device_id=${deviceId} event=${eventType}`);

      if (payload.event === 'dose_taken') {
        await handlePillboxDoseTaken(payload);
      }
    } catch (err) {
      console.error('[mqtt] message handler error:', err.message || err);
    }
  });

  client.on('error', (err) => {
    console.error('[mqtt] client error:', err);
  });

  client.on('reconnect', () => {
    console.log('[mqtt] reconnecting…');
  });

  return client;
}

module.exports = {
  startMqttPillboxListener,
  handlePillboxDoseTaken,
  buzzOnForPatient,
  buzzOffForPatient,
  publishPillboxCommand,
};

const pool = require('../db');
const { sendPushNotification } = require('./expoPush');
const { notifyLinkedCaretakers } = require('./caretakerNotify');
const { syncTodayDoseLogsForPatient } = require('./doseSync');
const { getManilaNow } = require('./manilaTime');

let mqttPublishClient = null;

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

async function findPendingDoseForToday(patientUid) {
  const manila = getManilaNow();

  const pending = await pool.query(
    `SELECT dl.id AS dose_log_id,
            dl.schedule_id,
            s.medication_id,
            m.name AS medication_name
     FROM dose_logs dl
     JOIN schedules s ON s.id = dl.schedule_id
     JOIN medications m ON m.id = s.medication_id
     WHERE dl.patient_uid = $1
       AND dl.status = 'pending'
       AND (dl.scheduled_at AT TIME ZONE 'Asia/Manila')::date = $2::date
     ORDER BY dl.scheduled_at ASC
     LIMIT 1`,
    [patientUid, manila.today],
  );

  if (pending.rowCount > 0) return pending.rows[0];

  const fallback = await pool.query(
    `SELECT m.id AS medication_id, m.name AS medication_name
     FROM medications m
     WHERE m.patient_uid = $1
       AND COALESCE(m.suspended, FALSE) = FALSE
       AND COALESCE(m.taken, FALSE) = FALSE
     ORDER BY m.id ASC
     LIMIT 1`,
    [patientUid],
  );

  if (fallback.rowCount === 0) return null;

  const med = fallback.rows[0];
  const schedule = await pool.query(
    `SELECT id FROM schedules WHERE medication_id = $1 LIMIT 1`,
    [med.medication_id],
  );

  return {
    dose_log_id: null,
    schedule_id: schedule.rows[0]?.id ?? null,
    medication_id: med.medication_id,
    medication_name: med.medication_name,
  };
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

  await syncTodayDoseLogsForPatient(patientUid);

  const dose = await findPendingDoseForToday(patientUid);
  if (!dose) {
    console.warn(`[mqtt] no pending dose found for patient ${patientUid}`);
    return;
  }

  if (dose.dose_log_id) {
    await pool.query(
      `UPDATE dose_logs SET status = 'taken', taken_at = NOW() WHERE id = $1`,
      [dose.dose_log_id],
    );
  } else if (dose.schedule_id) {
    await pool.query(
      `INSERT INTO dose_logs (schedule_id, patient_uid, scheduled_at, status, taken_at)
       SELECT $1, $2::text, NOW(), 'taken', NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM dose_logs
         WHERE schedule_id = $1
           AND patient_uid = $2::text
           AND (scheduled_at AT TIME ZONE 'Asia/Manila')::date = $3::date
       )`,
      [dose.schedule_id, patientUid, manila.today],
    );
  }

  await pool.query(
    `UPDATE medications
     SET taken = TRUE, last_taken_at = CURRENT_DATE
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
    `SELECT full_name, expo_push_token FROM users WHERE firebase_uid = $1`,
    [patientUid],
  );
  const patient = patientRes.rows[0];
  const patientName = patient?.full_name || 'Patient';

  if (patient?.expo_push_token) {
    await sendPushNotification(
      patient.expo_push_token,
      'Pillbox Update',
      'Dose recorded by your pillbox',
      {
        type: 'pillbox_dose_taken',
        patient_uid: patientUid,
        medication_id: String(dose.medication_id),
        device_id: deviceId,
      },
    );
  }

  await notifyLinkedCaretakers(patientUid, {
    title: 'Medication Taken',
    body: `${patientName} took their medication via pillbox`,
    data: {
      type: 'pillbox_dose_taken',
      patient_uid: patientUid,
      medication_id: String(dose.medication_id),
      device_id: deviceId,
    },
  });

  await buzzOffForPatient(patientUid);

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

  client.on('message', async (_topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.event === 'dose_taken') {
        await handlePillboxDoseTaken(payload);
      }
    } catch (err) {
      console.error('[mqtt] message handler error:', err);
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
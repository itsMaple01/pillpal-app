const pool = require('../db');
const { suggestReminderLead } = require('./ml/reinforcementLearning');
const { predictMissRisk } = require('./ml/predictiveAnalytics');

const DEFAULT_LEAD = 5;

async function recomputeProfile(firebase_uid) {
  const events = await pool.query(
    `SELECT event_type, scheduled_at, responded_at
     FROM intelligence_events
     WHERE firebase_uid = $1
     ORDER BY responded_at DESC
     LIMIT 120`,
    [firebase_uid],
  );

  // Query dose_logs directly for missed/late dose tracking
  const doseLogs = await pool.query(
    `SELECT status, scheduled_at, taken_at
     FROM dose_logs
     WHERE patient_uid = $1
     ORDER BY scheduled_at DESC
     LIMIT 120`,
    [firebase_uid],
  );

  const delays = [];
  let snoozeCount = 0;
  let confirmCount = 0;
  let missedCount = 0;
  let lateCount = 0;

  for (const row of events.rows) {
    if (row.event_type === 'snooze') snoozeCount += 1;
    if (row.event_type === 'confirm' || row.event_type === 'taken') confirmCount += 1;
    if (row.scheduled_at && row.responded_at) {
      const delayMin = Math.round(
        (new Date(row.responded_at).getTime() - new Date(row.scheduled_at).getTime()) / 60000,
      );
      if (delayMin >= 0 && delayMin <= 120) delays.push(delayMin);
    }
  }

  // Count missed and late doses from dose_logs
  for (const row of doseLogs.rows) {
    if (row.status === 'missed') missedCount += 1;
    if (row.status === 'taken' && row.taken_at && row.scheduled_at) {
      const delayMin = Math.round(
        (new Date(row.taken_at).getTime() - new Date(row.scheduled_at).getTime()) / 60000,
      );
      if (delayMin > 30) lateCount += 1; // Consider late if taken more than 30 minutes after scheduled
    }
  }

  const avgDelay = delays.length
    ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
    : 0;

  let preferredLead = DEFAULT_LEAD;
  if (avgDelay >= 10) preferredLead = Math.min(15, avgDelay);
  else if (snoozeCount > confirmCount * 2) preferredLead = 10;
  else if (confirmCount > 5 && avgDelay <= 3) preferredLead = 3;

  let clusterLabel = 'default';
  if (avgDelay >= 15) clusterLabel = 'needs_nudge';
  else if (confirmCount >= 10 && avgDelay <= 5) clusterLabel = 'consistent';

  await pool.query(
    `INSERT INTO intelligence_profiles (firebase_uid, avg_response_delay_minutes, preferred_lead_minutes, cluster_label, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (firebase_uid)
     DO UPDATE SET
       avg_response_delay_minutes = EXCLUDED.avg_response_delay_minutes,
       preferred_lead_minutes = EXCLUDED.preferred_lead_minutes,
       cluster_label = EXCLUDED.cluster_label,
       updated_at = NOW()`,
    [firebase_uid, avgDelay, preferredLead, clusterLabel],
  );

  return { avgDelay, preferredLead, clusterLabel, missedCount, lateCount };
}

async function logEvent(body) {
  const {
    firebase_uid,
    event_type,
    medication_id,
    scheduled_at,
    metadata,
  } = body;

  await pool.query(
    `INSERT INTO intelligence_events (firebase_uid, event_type, medication_id, scheduled_at, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      firebase_uid,
      event_type,
      medication_id ?? null,
      scheduled_at ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );

  return recomputeProfile(firebase_uid);
}

async function getReminderPlan(firebase_uid, patientContext = {}) {
  const profile = await pool.query(
    'SELECT * FROM intelligence_profiles WHERE firebase_uid = $1',
    [firebase_uid],
  );

  const eventsRes = await pool.query(
    `SELECT event_type, scheduled_at, responded_at FROM intelligence_events
     WHERE firebase_uid = $1 ORDER BY responded_at DESC LIMIT 120`,
    [firebase_uid],
  );
  const events = eventsRes.rows;

  if (profile.rows.length === 0) {
    const rl = suggestReminderLead(events, {});
    const risk = await predictMissRisk(events, {}, patientContext);
    return {
      preferred_lead_minutes: rl.preferred_lead_minutes,
      notify_at_exact_time: false,
      cluster_label: 'default',
      avg_response_delay_minutes: 0,
      miss_risk: risk.miss_risk,
      miss_risk_label: risk.label,
      action: risk.action,
      model_version: risk.model_version,
      engine: 'rules-v1+ml-stub',
    };
  }

  const row = profile.rows[0];
  const rl = suggestReminderLead(events, row);
  const risk = await predictMissRisk(events, row, patientContext);
  return {
    preferred_lead_minutes: rl.preferred_lead_minutes ?? row.preferred_lead_minutes ?? DEFAULT_LEAD,
    notify_at_exact_time: false,
    cluster_label: row.cluster_label ?? 'default',
    avg_response_delay_minutes: row.avg_response_delay_minutes ?? 0,
    miss_risk: risk.miss_risk,
    miss_risk_label: risk.label,
    action: risk.action,
    model_version: risk.model_version,
    engine: `rules-v1+${rl.policy_version}`,
  };
}

module.exports = { logEvent, getReminderPlan, recomputeProfile };
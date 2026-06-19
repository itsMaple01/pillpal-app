const path = require('path');
const ort = require('onnxruntime-node');

const MODEL_DIR = path.join(__dirname, 'ml-model');

const HEALTH_CONDITION_MAP = {
  asthma: 0, copd: 1, diabetes: 2, heart_disease: 3, hypertension: 4, none: 5
};

/** Matches intelligenceEngine.js — late if taken > 30 minutes after scheduled. */
const LATE_THRESHOLD_MINUTES = 30;
const MIN_EVENTS_FOR_RISK = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let riskSession = null;
let actionSession = null;
let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;

  try {
    if (!riskSession) {
      riskSession = await ort.InferenceSession.create(
        path.join(MODEL_DIR, 'gabayra_risk_model.onnx')
      );
      console.log('✅ Risk model loaded successfully');
    }
    if (!actionSession) {
      actionSession = await ort.InferenceSession.create(
        path.join(MODEL_DIR, 'gabayra_action_model.onnx')
      );
      console.log('✅ Action model loaded successfully');
    }
    modelsLoaded = true;
  } catch (error) {
    console.error('❌ Failed to load ONNX models:', error.message);
    throw error;
  }
}

function extractOnnxLabel(output) {
  const key = ['output_label', 'label', 'variable', 'output_probability']
    .find(k => output[k] !== undefined);
  if (!key) {
    throw new Error(`Unknown ONNX output keys: ${Object.keys(output).join(', ')}`);
  }
  return Number(output[key].data[0]);
}

/**
 * Count late/missed adherence signals in intelligence_events over the last 7 days.
 * Missed: event_type === 'missed' (dose already classified missed via 2-hour rule upstream).
 * Late: taken/confirm with responded_at > 30 min after scheduled_at (same as intelligenceEngine.js).
 */
function countLateMissedInLast7Days(events) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  let count = 0;

  for (const e of events) {
    const anchor = e.responded_at || e.scheduled_at;
    if (!anchor) continue;
    const ts = new Date(anchor).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;

    if (e.event_type === 'missed') {
      count += 1;
      continue;
    }

    if (
      (e.event_type === 'taken' || e.event_type === 'confirm')
      && e.scheduled_at
      && e.responded_at
    ) {
      const delayMin = Math.round(
        (new Date(e.responded_at).getTime() - new Date(e.scheduled_at).getTime()) / 60000,
      );
      if (delayMin > LATE_THRESHOLD_MINUTES) count += 1;
    }
  }

  return count;
}

/**
 * Derive risk tier from intelligence_events history + ONNX binary score.
 * Below MIN_EVENTS_FOR_RISK logged events → always low, sample_size_sufficient: false.
 */
function deriveRiskLabel(events, onnxRiskScore) {
  const sample_size_sufficient = events.length >= MIN_EVENTS_FOR_RISK;

  if (!sample_size_sufficient) {
    return { label: 'low', sample_size_sufficient: false };
  }

  const lateMissedCount = countLateMissedInLast7Days(events);

  if (lateMissedCount >= 3 || onnxRiskScore === 1) {
    return { label: 'high', sample_size_sufficient: true, lateMissedCount };
  }
  if (lateMissedCount >= 1) {
    return { label: 'medium', sample_size_sufficient: true, lateMissedCount };
  }
  return { label: 'low', sample_size_sufficient: true, lateMissedCount };
}

function buildModelVersion(base, sample_size_sufficient) {
  return sample_size_sufficient ? base : `${base}:insufficient_sample`;
}

/**
 * Runs both ONNX models and returns risk + action prediction.
 * Risk tier is derived from event history; ONNX risk_score is binary (0|1) input only.
 */
async function predictMissRisk(events, profile, patientContext = {}) {
  try {
    await loadModels();

    const scheduledTime = patientContext.scheduled_time
      ? new Date(patientContext.scheduled_time)
      : new Date();
    const streak_7d = computeStreak(events);
    const missed_last = events.length > 0 && events[0].event_type === 'missed' ? 1 : 0;
    const alert_sent = patientContext.alert_sent ? 1 : 0;
    const day_of_week = scheduledTime.getDay();
    const is_weekend = day_of_week >= 5 ? 1 : 0;

    const values = new Float32Array([
      patientContext.age ?? 45,
      HEALTH_CONDITION_MAP[patientContext.health_condition] ?? 5,
      patientContext.medication_count ?? 1,
      patientContext.notify_enabled !== false ? 1 : 0,
      patientContext.suspended ? 1 : 0,
      scheduledTime.getHours(),
      day_of_week,
      is_weekend,
      streak_7d,
      missed_last,
      alert_sent,
      profile.avg_response_delay_minutes ?? 15,
      profile.preferred_lead_minutes ?? 10,
    ]);

    const tensor = new ort.Tensor('float32', values, [1, 13]);

    const [riskOutput, actionOutput] = await Promise.all([
      riskSession.run({ float_input: tensor }),
      actionSession.run({ float_input: tensor }),
    ]);

    const risk_score = extractOnnxLabel(riskOutput);
    const action_code = extractOnnxLabel(actionOutput);
    const action = action_code === 0 ? 'send_now' : action_code === 1 ? 'delay' : 'snooze';

    const { label, sample_size_sufficient } = deriveRiskLabel(events, risk_score);

    console.log(
      `🤖 ML Prediction: onnx_risk=${risk_score}, tier=${label}, `
      + `action=${action}, sample_sufficient=${sample_size_sufficient}`,
    );

    return {
      miss_risk: risk_score,
      label,
      action,
      action_code,
      sample_size_sufficient,
      model_version: buildModelVersion('gabayra-onnx-v1', sample_size_sufficient),
    };

  } catch (err) {
    console.error('[predictMissRisk] ONNX failed, falling back to stub:', err.message);
    return fallbackStub(events);
  }
}

function computeStreak(events) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  let streak = 0;
  let consecutiveDays = 0;
  let lastDate = null;

  const sortedEvents = events
    .filter(e => e.responded_at || e.scheduled_at)
    .sort((a, b) => new Date(b.responded_at || b.scheduled_at) - new Date(a.responded_at || a.scheduled_at));

  for (const e of sortedEvents) {
    const eventDate = new Date(e.responded_at || e.scheduled_at);

    if (eventDate < sevenDaysAgo) continue;

    if (e.event_type === 'taken' || e.event_type === 'confirm') {
      if (lastDate === null) {
        streak = 1;
        consecutiveDays = 1;
        lastDate = eventDate;
      } else {
        const daysDiff = Math.floor((lastDate.getTime() - eventDate.getTime()) / (24 * 60 * 60 * 1000));

        if (daysDiff <= 1) {
          if (daysDiff === 1) consecutiveDays++;
          streak++;
          lastDate = eventDate;
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }

  return Math.min(streak, 7);
}

async function initializeModels() {
  try {
    await loadModels();
    console.log('✅ ML models initialized on server startup');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize ML models on startup:', error.message);
    return false;
  }
}

function fallbackStub(events) {
  const { label, sample_size_sufficient } = deriveRiskLabel(events, 0);
  const missed = events.filter(e => e.event_type === 'missed').length;

  return {
    miss_risk: sample_size_sufficient && missed > 0 ? 1 : 0,
    label,
    action: 'send_now',
    action_code: 0,
    sample_size_sufficient,
    model_version: buildModelVersion('predict-stub-v1', sample_size_sufficient),
  };
}

module.exports = { predictMissRisk, initializeModels };

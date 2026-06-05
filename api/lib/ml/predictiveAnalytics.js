const path = require('path');
const ort = require('onnxruntime-node');

const MODEL_DIR = path.join(__dirname, '../../../ml/ml-model');

const HEALTH_CONDITION_MAP = {
  asthma: 0, copd: 1, diabetes: 2, heart_disease: 3, hypertension: 4, none: 5
};
const CLUSTER_LABEL_MAP = {
  consistent: 0, early_responder: 1, irregular: 2, late_responder: 3
};

let riskSession = null;
let actionSession = null;

async function loadModels() {
  if (!riskSession) {
    riskSession = await ort.InferenceSession.create(
      path.join(MODEL_DIR, 'gabayra_risk_model.onnx')
    );
  }
  if (!actionSession) {
    actionSession = await ort.InferenceSession.create(
      path.join(MODEL_DIR, 'gabayra_action_model.onnx')
    );
  }
}

/**
 * Runs both ONNX models and returns risk + action prediction.
 * Falls back to rule-based stub if model fails.
 */
async function predictMissRisk(events, profile, patientContext = {}) {
  try {
    await loadModels();

    const now = new Date();
    const streak_7d = computeStreak(events);
    const missed_last = events.length > 0 && events[0].event_type === 'missed' ? 1 : 0;
    const alert_sent = patientContext.alert_sent ? 1 : 0;
    const day_of_week = now.getDay();
    const is_weekend = day_of_week >= 5 ? 1 : 0;

    const values = new Float32Array([
      patientContext.age ?? 45,
      HEALTH_CONDITION_MAP[patientContext.health_condition] ?? 5,
      patientContext.medication_count ?? 1,
      patientContext.notify_enabled !== false ? 1 : 0,
      patientContext.suspended ? 1 : 0,
      now.getHours(),
      day_of_week,
      is_weekend,
      streak_7d,
      missed_last,
      alert_sent,
      profile.avg_response_delay_minutes ?? 15,
      profile.preferred_lead_minutes ?? 10,
      CLUSTER_LABEL_MAP[profile.cluster_label] ?? 2,
    ]);

    const tensor = new ort.Tensor('float32', values, [1, 14]);

    const [riskOutput, actionOutput] = await Promise.all([
      riskSession.run({ float_input: tensor }),
      actionSession.run({ float_input: tensor }),
    ]);

    const risk_score = Number(riskOutput['output_label'].data[0]);
    const action_code = Number(actionOutput['output_label'].data[0]);
    const action = action_code === 0 ? 'send_now' : action_code === 1 ? 'delay' : 'snooze';

    return {
      miss_risk: risk_score,
      label: risk_score === 1 ? 'high' : 'low',
      action,
      action_code,
      model_version: 'gabayra-onnx-v1',
    };

  } catch (err) {
    console.error('[predictMissRisk] ONNX failed, falling back to stub:', err.message);
    return fallbackStub(events);
  }
}

function computeStreak(events) {
  let streak = 0;
  for (const e of events.slice(0, 7)) {
    if (e.event_type === 'taken' || e.event_type === 'confirm') streak++;
    else break;
  }
  return streak;
}

function fallbackStub(events) {
  const missed = events.filter(e => e.event_type === 'missed').length;
  const taken = events.filter(e => e.event_type === 'taken').length;
  const total = missed + taken || 1;
  const miss_risk = Math.min(1, missed / total);
  const label = miss_risk > 0.5 ? 'high' : miss_risk > 0.25 ? 'medium' : 'low';
  return { miss_risk: Math.round(miss_risk * 100) / 100, label, action: 'send_now', action_code: 0, model_version: 'predict-stub-v1' };
}

module.exports = { predictMissRisk };
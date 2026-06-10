const path = require('path');
const ort = require('onnxruntime-node');

const MODEL_DIR = path.join(__dirname, '../../../ml/ml-model');

const HEALTH_CONDITION_MAP = {
  asthma: 0, copd: 1, diabetes: 2, heart_disease: 3, hypertension: 4, none: 5
};

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
 * Runs both ONNX models and returns risk + action prediction.
 * Falls back to rule-based stub if model fails.
 */
async function predictMissRisk(events, profile, patientContext = {}) {
  try {
    await loadModels();

    // Use scheduled time from context if available, otherwise use current time
    const scheduledTime = patientContext.scheduled_time ? new Date(patientContext.scheduled_time) : new Date();
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

    console.log('Risk output keys:', Object.keys(riskOutput));
    console.log('Action output keys:', Object.keys(actionOutput));

    const risk_score = extractOnnxLabel(riskOutput);
    const action_code = extractOnnxLabel(actionOutput);
    const action = action_code === 0 ? 'send_now' : action_code === 1 ? 'delay' : 'snooze';

    console.log(`🤖 ML Prediction: risk=${risk_score}, action=${action}`);

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
  // Calendar-based 7-day window streak calculation
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  let streak = 0;
  let consecutiveDays = 0;
  let lastDate = null;
  
  // Sort events by date (most recent first)
  const sortedEvents = events
    .filter(e => e.responded_at || e.scheduled_at)
    .sort((a, b) => new Date(b.responded_at || b.scheduled_at) - new Date(a.responded_at || a.scheduled_at));
  
  for (const e of sortedEvents) {
    const eventDate = new Date(e.responded_at || e.scheduled_at);
    
    // Only consider events within the last 7 days
    if (eventDate < sevenDaysAgo) continue;
    
    // Check if this is a taken/confirm event
    if (e.event_type === 'taken' || e.event_type === 'confirm') {
      if (lastDate === null) {
        // First event in streak
        streak = 1;
        consecutiveDays = 1;
        lastDate = eventDate;
      } else {
        // Check if this is the same day or consecutive day
        const daysDiff = Math.floor((lastDate.getTime() - eventDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysDiff <= 1) {
          // Same day or consecutive day - continue streak
          if (daysDiff === 1) consecutiveDays++;
          streak++;
          lastDate = eventDate;
        } else {
          // Gap in streak - break
          break;
        }
      }
    } else {
      // Non-taken event breaks the streak
      break;
    }
  }
  
  // Return the streak, capped at 7 for the 7-day window
  return Math.min(streak, 7);
}

/**
 * Initialize models on startup - call this when server starts
 */
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
  const missed = events.filter(e => e.event_type === 'missed').length;
  const taken = events.filter(e => e.event_type === 'taken').length;
  const total = missed + taken || 1;
  const miss_risk = Math.min(1, missed / total);
  const label = miss_risk > 0.5 ? 'high' : miss_risk > 0.25 ? 'medium' : 'low';
  return { miss_risk: Math.round(miss_risk * 100) / 100, label, action: 'send_now', action_code: 0, model_version: 'predict-stub-v1' };
}

module.exports = { predictMissRisk, initializeModels };
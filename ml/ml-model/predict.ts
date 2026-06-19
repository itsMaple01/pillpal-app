/// <reference path="./onnxruntime-node.d.ts" />
import * as ort from 'onnxruntime-node';
import * as path from 'path';

const MODEL_DIR = path.join(__dirname);

// Feature order must match training exactly — 13 features
const FEATURES = [
  'age', 'health_condition', 'medication_count', 'notify_enabled',
  'suspended', 'hour_of_day', 'day_of_week', 'is_weekend',
  'streak_7d', 'missed_last', 'alert_sent',
  'avg_response_delay_minutes', 'preferred_lead_minutes'
];

// Match the category encoding from training
const HEALTH_CONDITION_MAP: Record<string, number> = {
  asthma: 0, copd: 1, diabetes: 2, heart_disease: 3, hypertension: 4, none: 5
};

export interface PatientInput {
  age: number;
  health_condition: string;
  medication_count: number;
  notify_enabled: boolean;
  suspended: boolean;
  hour_of_day: number;
  day_of_week: number;          // 0=Monday, 6=Sunday
  streak_7d: number;            // doses taken out of last 7
  missed_last: boolean;
  alert_sent: boolean;
  avg_response_delay_minutes: number;
  preferred_lead_minutes: number;
}

export interface PredictionResult {
  risk: 'high' | 'low';
  risk_score: number;           // 0 or 1
  action: 'send_now' | 'delay' | 'snooze';
  action_code: number;          // 0, 1, or 2
}

let riskSession: ort.InferenceSession | null = null;
let actionSession: ort.InferenceSession | null = null;

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

function encodeInput(input: PatientInput): Float32Array {
  const is_weekend = input.day_of_week >= 5 ? 1 : 0;

  const values = [
    input.age,
    HEALTH_CONDITION_MAP[input.health_condition] ?? 5,
    input.medication_count,
    input.notify_enabled ? 1 : 0,
    input.suspended ? 1 : 0,
    input.hour_of_day,
    input.day_of_week,
    is_weekend,
    input.streak_7d,
    input.missed_last ? 1 : 0,
    input.alert_sent ? 1 : 0,
    input.avg_response_delay_minutes,
    input.preferred_lead_minutes,
  ];

  return new Float32Array(values);
}

export async function predict(input: PatientInput): Promise<PredictionResult> {
  await loadModels();

  const encoded = encodeInput(input);
  const tensor = new ort.Tensor('float32', encoded, [1, FEATURES.length]);

  const [riskOutput, actionOutput] = await Promise.all([
    riskSession!.run({ float_input: tensor }),
    actionSession!.run({ float_input: tensor }),
  ]);

  // XGBoost ONNX outputs the label under 'output_label'
  const risk_score = Number((riskOutput['output_label'].data as BigInt64Array)[0]);
  const action_code = Number((actionOutput['output_label'].data as BigInt64Array)[0]);

  return {
    risk: risk_score === 1 ? 'high' : 'low',
    risk_score,
    action: action_code === 0 ? 'send_now' : action_code === 1 ? 'delay' : 'snooze',
    action_code,
  };
}
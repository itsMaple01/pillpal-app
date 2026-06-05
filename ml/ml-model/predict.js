"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.predict = predict;
const ort = __importStar(require("onnxruntime-node"));
const path = __importStar(require("path"));
const MODEL_DIR = path.join(__dirname);
// Feature order must match training exactly
const FEATURES = [
    'age', 'health_condition', 'medication_count', 'notify_enabled',
    'suspended', 'hour_of_day', 'day_of_week', 'is_weekend',
    'streak_7d', 'missed_last', 'alert_sent',
    'avg_response_delay_minutes', 'preferred_lead_minutes', 'cluster_label'
];
// Match the category encoding from training
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
        riskSession = await ort.InferenceSession.create(path.join(MODEL_DIR, 'gabayra_risk_model.onnx'));
    }
    if (!actionSession) {
        actionSession = await ort.InferenceSession.create(path.join(MODEL_DIR, 'gabayra_action_model.onnx'));
    }
}
function encodeInput(input) {
    var _a, _b;
    const is_weekend = input.day_of_week >= 5 ? 1 : 0;
    const values = [
        input.age,
        (_a = HEALTH_CONDITION_MAP[input.health_condition]) !== null && _a !== void 0 ? _a : 5,
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
        (_b = CLUSTER_LABEL_MAP[input.cluster_label]) !== null && _b !== void 0 ? _b : 2,
    ];
    return new Float32Array(values);
}
async function predict(input) {
    await loadModels();
    const encoded = encodeInput(input);
    const tensor = new ort.Tensor('float32', encoded, [1, FEATURES.length]);
    const [riskOutput, actionOutput] = await Promise.all([
        riskSession.run({ float_input: tensor }),
        actionSession.run({ float_input: tensor }),
    ]);
    // XGBoost ONNX outputs the label under 'output_label'
    const risk_score = Number(riskOutput['output_label'].data[0]);
    const action_code = Number(actionOutput['output_label'].data[0]);
    return {
        risk: risk_score === 1 ? 'high' : 'low',
        risk_score,
        action: action_code === 0 ? 'send_now' : action_code === 1 ? 'delay' : 'snooze',
        action_code,
    };
}

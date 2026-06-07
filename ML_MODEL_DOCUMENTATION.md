# GabayRa ML Model Documentation

## Overview
GabayRa Care uses two XGBoost models exported as ONNX files for intelligent medication reminder management:
- **Risk Score Model** (`gabayra_risk_model.onnx`) - Predicts the likelihood of a patient missing a dose
- **Reminder Action Model** (`gabayra_action_model.onnx`) - Determines the optimal reminder timing strategy

## Model Architecture
- **Type**: XGBoost (Gradient Boosting)
- **Format**: ONNX (Open Neural Network Exchange)
- **Framework**: onnxruntime-node
- **Location**: `ml/ml-model/` directory

## Input Features (14 total)

### Patient Demographics
1. **age** - Patient's age (integer)
   - Source: `users.age` from database
   - Default: 45

2. **health_condition** - Encoded health condition (integer 0-5)
   - Source: `users.health_condition` from database
   - Encoding:
     - asthma: 0
     - copd: 1
     - diabetes: 2
     - heart_disease: 3
     - hypertension: 4
     - none: 5

### Medication Context
3. **medication_count** - Number of active medications (integer)
   - Source: Count from `medications` table
   - Default: 1

4. **notify_enabled** - Whether notifications are enabled (0/1)
   - Source: `schedules.notify_enabled` or `reminders.notify_enabled`
   - Default: 1 (enabled)

5. **suspended** - Whether medication is suspended (0/1)
   - Source: `medications.suspended` or `reminders.suspended`
   - Default: 0 (not suspended)

### Temporal Features
6. **hour_of_day** - Current hour (0-23)
   - Source: Current time `new Date().getHours()`
   - Used for time-of-day patterns

7. **day_of_week** - Day of week (0-6, Sunday=0)
   - Source: Current time `new Date().getDay()`
   - Used for weekly patterns

8. **is_weekend** - Whether it's a weekend (0/1)
   - Source: Derived from `day_of_week >= 5`
   - Used for weekend vs weekday patterns

### Behavioral Features
9. **streak_7d** - 7-day adherence streak (integer 0-7)
   - Source: Computed from `intelligence_events` table
   - Calculation: Count of consecutive 'taken' or 'confirm' events in last 7 events
   - Used to measure recent adherence

10. **missed_last** - Whether last dose was missed (0/1)
    - Source: Most recent event in `intelligence_events`
    - Calculation: `event_type === 'missed' ? 1 : 0`
    - Used to detect recent missed doses

11. **alert_sent** - Whether alert was already sent (0/1)
    - Source: `dose_logs.alert_sent` or passed in context
    - Used to avoid duplicate alerts

### Intelligence Profile Features
12. **avg_response_delay_minutes** - Average response time (integer)
    - Source: `intelligence_profiles.avg_response_delay_minutes`
    - Calculation: Mean of (responded_at - scheduled_at) in minutes
    - Default: 15
    - Used to measure how quickly patient responds to reminders

13. **preferred_lead_minutes** - Preferred reminder lead time (integer)
    - Source: `intelligence_profiles.preferred_lead_minutes`
    - Default: 10
    - Used to personalize reminder timing

14. **cluster_label** - Patient behavior cluster (integer 0-3)
    - Source: `intelligence_profiles.cluster_label`
    - Encoding:
      - consistent: 0
      - early_responder: 1
      - irregular: 2
      - late_responder: 3
    - Default: 2 (irregular)
    - Used to categorize patient behavior patterns

## Model Outputs

### Risk Score Model Output
- **output_label**: Binary classification (0 or 1)
  - 0 = Low risk (patient likely to take medication)
  - 1 = High risk (patient likely to miss medication)

### Reminder Action Model Output
- **output_label**: Multi-class classification (0, 1, or 2)
  - 0 = send_now (send reminder immediately)
  - 1 = delay (delay reminder)
  - 2 = snooze (snooze reminder)

## Data Flow

### 1. Data Collection
```
Database Tables:
- users (demographics)
- medications (medication list)
- schedules (timing information)
- dose_logs (dose tracking)
- intelligence_events (behavior tracking)
- intelligence_profiles (computed profiles)
```

### 2. Feature Extraction
```
intelligenceEngine.js:
- Fetches events from intelligence_events
- Computes streak_7d, missed_last
- Fetches profile from intelligence_profiles
- Calls predictMissRisk with patient context
```

### 3. Model Inference
```
predictiveAnalytics.js:
- Loads ONNX models on server startup
- Encodes features using maps
- Creates Float32Array tensor [1, 14]
- Runs both models in parallel
- Returns risk score and action recommendation
```

### 4. Action Execution
```
Based on model output:
- If action = 'send_now': Trigger notification immediately
- If action = 'delay': Schedule notification for later
- If action = 'snooze': Skip notification
```

## Data Validation

### Time (scheduled_time from schedules)
- **Current Implementation**: Uses `hour_of_day` from current time
- **Issue**: Should use scheduled time from database
- **Fix Needed**: Extract hour from `schedules.scheduled_time` instead of current time

### Day (days_of_week from schedules)
- **Current Implementation**: Uses `day_of_week` from current time
- **Issue**: Should use scheduled day from database
- **Fix Needed**: Extract day from `schedules.days_of_week` array

### Missed Doses (status from dose_logs)
- **Current Implementation**: Uses `missed_last` from intelligence_events
- **Issue**: Should query dose_logs for actual missed doses
- **Fix Needed**: Query dose_logs for status='missed' in relevant time window

### Late Doses (difference between scheduled_at and taken_at in dose_logs)
- **Current Implementation**: Uses `avg_response_delay_minutes` from intelligence_profiles
- **Issue**: Should compute from dose_logs directly
- **Fix Needed**: Calculate (taken_at - scheduled_at) from dose_logs

### 7-Day Window (rolling 7-day aggregation)
- **Current Implementation**: Uses `streak_7d` from last 7 events
- **Issue**: Should be based on actual 7-day calendar window
- **Fix Needed**: Aggregate events from last 7 days, not last 7 events

## Integration Points

### Backend API
- **Route**: `/api/ai/predict` (POST)
- **Handler**: `api/routes/aiPredict.js`
- **Function**: Loads and calls ML models

### Intelligence Engine
- **Route**: `/api/intelligence/reminder-plan/:uid` (GET)
- **Handler**: `api/routes/intelligence.js`
- **Function**: Calls `predictMissRisk` from `api/lib/ml/predictiveAnalytics.js`

### Missed Dose Checker
- **Cron**: Runs every 5 minutes
- **Handler**: `api/missedDoseChecker.js`
- **Function**: Checks for missed doses and sends alerts

## Model Initialization
Models are loaded on server startup in `api/index.js`:
```javascript
const { initializeModels } = require('./lib/ml/predictiveAnalytics');
await initializeModels();
```

## Fallback Mechanism
If ONNX models fail to load or run, the system falls back to a rule-based stub:
```javascript
function fallbackStub(events) {
  const missed = events.filter(e => e.event_type === 'missed').length;
  const taken = events.filter(e => e.event_type === 'taken').length;
  const total = missed + taken || 1;
  const miss_risk = Math.min(1, missed / total);
  const label = miss_risk > 0.5 ? 'high' : miss_risk > 0.25 ? 'medium' : 'low';
  return { miss_risk: Math.round(miss_risk * 100) / 100, label, action: 'send_now', action_code: 0, model_version: 'predict-stub-v1' };
}
```

## Notification System

### Local Notifications (Client-side)
- **File**: `lib/pushNotifications.ts`
- **Function**: `rescheduleMedicationLocalNotifications`
- **Trigger**: Medication time minus preferred_lead_minutes
- **Platform**: expo-notifications

### Push Notifications (Server-side)
- **File**: `api/routes/alerts.js`
- **Function**: Creates alert in database + Firestore
- **Trigger**: Missed dose checker (every 5 minutes)
- **Platform**: Firebase Cloud Messaging (FCM)

## Recommendations

### High Priority
1. **Fix temporal features**: Use scheduled time/day from database instead of current time
2. **Fix missed dose tracking**: Query dose_logs directly instead of relying on intelligence_events
3. **Fix late dose calculation**: Compute from dose_logs (taken_at - scheduled_at)
4. **Fix 7-day window**: Use calendar-based 7-day window instead of event-based

### Medium Priority
1. **Add model monitoring**: Log predictions and actual outcomes for retraining
2. **Add feature importance**: Track which features contribute most to predictions
3. **Add A/B testing**: Compare model performance against rule-based system
4. **Add model versioning**: Track model versions and enable rollback

### Low Priority
1. **Add model retraining pipeline**: Automate model retraining with new data
2. **Add model explainability**: Provide SHAP values or similar explanations
3. **Add model calibration**: Ensure predicted probabilities match actual frequencies

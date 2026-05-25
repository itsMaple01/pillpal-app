# GabayRa Machine Learning

Two model tracks (not trained yet — API stubs wire in from `api/lib/ml/`):

| Track | Folder | Algorithm | Purpose |
|-------|--------|-----------|---------|
| **Adaptive reminders** | `reinforcement-learning/` | Reinforcement learning (RL) | Learn snooze/confirm patterns; optimize reminder lead time |
| **Adherence forecasting** | `predictive-analytics/` | Predictive analytics | Forecast missed doses; flag patients for caregivers |

## Data source

Events and profiles live in Postgres (`intelligence_events`, `intelligence_profiles`) via `/api/intelligence/*`.

## Next steps

1. Export events: `SELECT * FROM intelligence_events ORDER BY responded_at DESC;`
2. Train RL policy offline → export weights → load in `api/lib/ml/reinforcementLearning.js`
3. Train predictive model → load in `api/lib/ml/predictiveAnalytics.js`
4. Keep REST contract in `api/lib/intelligenceEngine.js` so the mobile app stays unchanged

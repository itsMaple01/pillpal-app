# Predictive analytics — adherence risk

**Goal:** Predict probability of missing the next dose; surface alerts to family/caregiver dashboards.

**Features:** time-series of taken/missed, day-of-week, age band, medication count.

**Integration:** `api/lib/ml/predictiveAnalytics.js` → optional `GET /api/intelligence/risk/:uid`.

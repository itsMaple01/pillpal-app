# Reinforcement Learning — reminder timing

**Goal:** Choose `preferred_lead_minutes` (and optional second nudge) from user actions.

**State (example):** hour of day, streak of confirms, recent snooze count, cluster label.

**Actions:** lead time ∈ {3, 5, 10, 15} minutes before scheduled dose.

**Reward:** +1 confirm/taken on time, −1 ignore, small penalty for snooze.

**Integration:** `api/lib/ml/reinforcementLearning.js` → called from `intelligenceEngine.js`.

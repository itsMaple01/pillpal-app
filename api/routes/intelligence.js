const express = require('express');
const router = express.Router();
const { logEvent, getReminderPlan } = require('../lib/intelligenceEngine');

/** Log user behavior (confirm, snooze, ignore, taken, missed). */
router.post('/events', async (req, res) => {
  const { firebase_uid, event_type } = req.body;
  if (!firebase_uid || !event_type) {
    return res.status(400).json({ error: 'firebase_uid and event_type are required' });
  }
  try {
    const profile = await logEvent(req.body);
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Reminder timing hints (placeholder until ML model is wired). */
router.get('/reminder-plan/:uid', async (req, res) => {
  try {
    const plan = await getReminderPlan(req.params.uid);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Profile summary for dashboards / future model training export. */
router.get('/profile/:uid', async (req, res) => {
  try {
    const plan = await getReminderPlan(req.params.uid);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

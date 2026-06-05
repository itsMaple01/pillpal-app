const express = require('express');
const router = express.Router();
const path = require('path');

let predict;

async function loadPredictor() {
  if (!predict) {
    const mod = require(path.join(__dirname, '../../ml/ml-model/predict.js'));
    predict = mod.predict;
  }
  return predict;
}

// POST /api/ai/predict
router.post('/predict', async (req, res) => {
  try {
    const predictor = await loadPredictor();
    const result = await predictor(req.body);
    res.json(result);
  } catch (err) {
    console.error('AI predict error:', err.message);
    res.status(500).json({
      risk: 'low',
      risk_score: 0,
      action: 'send_now',
      action_code: 0,
    });
  }
});

module.exports = router;
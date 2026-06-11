require('dotenv').config();

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const express = require('express');
const cors = require('cors');

const { runMigrations } = require('./db/migrate');
runMigrations().catch(() => {});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('GabayRa API is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'gabayra-api' });
});

// Routes
app.use('/api/users',        require('./routes/users'));
app.use('/api/medications',  require('./routes/medications'));
app.use('/api/doses',        require('./routes/doses'));
app.use('/api/patients',     require('./routes/patients'));
app.use('/api/linking',      require('./routes/linking'));
app.use('/api/alerts',       require('./routes/alerts'));
app.use('/api/reminders',    require('./routes/reminders'));
app.use('/api/intelligence', require('./routes/intelligence'));
app.use('/api/ai',           require('./routes/aiPredict'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  const { initializeModels } = require('./lib/ml/predictiveAnalytics');
  await initializeModels();
});

const checkMissedDoses = require('./missedDoseChecker');
setInterval(checkMissedDoses, 5 * 60 * 1000);
checkMissedDoses();

const sendDueMedicationReminders = require('./medicationReminderPusher');
setInterval(sendDueMedicationReminders, 5 * 60 * 1000);
sendDueMedicationReminders();

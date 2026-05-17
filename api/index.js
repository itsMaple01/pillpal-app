const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { runMigrations } = require('./db/migrate');
runMigrations().catch(() => {});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('PillPal API is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'pillpal-api' });
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/doses', require('./routes/doses'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/linking', require('./routes/linking'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/reminders', require('./routes/reminders'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const checkMissedDoses = require('./missedDoseChecker');

// Run every 5 minutes
setInterval(checkMissedDoses, 5 * 60 * 1000);
checkMissedDoses(); // run once on startup
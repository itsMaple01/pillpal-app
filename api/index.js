const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/doses', require('./routes/doses'));

app.get('/', (req, res) => res.json({ status: '✅ PillPal API running' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
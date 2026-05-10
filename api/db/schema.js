const pool = require('./index');

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      firebase_uid VARCHAR(128) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(20) CHECK (role IN ('patient', 'caretaker')) NOT NULL,
      full_name VARCHAR(255),
      age INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS caretaker_patients (
      id SERIAL PRIMARY KEY,
      caretaker_uid VARCHAR(128) NOT NULL,
      patient_uid VARCHAR(128) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      linked_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(caretaker_uid, patient_uid)
    );

    CREATE TABLE IF NOT EXISTS medications (
      id SERIAL PRIMARY KEY,
      patient_uid VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      dosage VARCHAR(100),
      frequency VARCHAR(100),
      program VARCHAR(255),
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      medication_id INTEGER REFERENCES medications(id) ON DELETE CASCADE,
      patient_uid VARCHAR(128) NOT NULL,
      scheduled_time TIME NOT NULL,
      days_of_week TEXT[],
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dose_logs (
      id SERIAL PRIMARY KEY,
      schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
      patient_uid VARCHAR(128) NOT NULL,
      scheduled_at TIMESTAMP NOT NULL,
      taken_at TIMESTAMP,
      status VARCHAR(20) CHECK (status IN ('taken', 'missed', 'pending')) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      caretaker_uid VARCHAR(128) NOT NULL,
      patient_uid VARCHAR(128) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50),
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ All tables created successfully!');
  process.exit(0);
};

createTables().catch(err => {
  console.error('❌ Error creating tables:', err);
  process.exit(1);
});
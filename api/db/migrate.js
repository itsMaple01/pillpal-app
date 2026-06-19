const pool = require('./index');

/** Idempotent schema updates — safe to run on every server start. */
async function runMigrations() {
  const run = async (label, sql) => {
    try {
      await pool.query(sql);
    } catch (e) {
      console.error(`[migrate] ${label}:`, e.message);
      if (e.stack) console.error(e.stack);
    }
  };

  // Core tables required by cron jobs (schedules, dose_logs, medication_push_log)
  await run('medications.base', `
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
    )`);

  await run('schedules', `
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      medication_id INTEGER REFERENCES medications(id) ON DELETE CASCADE,
      patient_uid VARCHAR(128) NOT NULL,
      scheduled_time TIME NOT NULL,
      days_of_week TEXT[],
      created_at TIMESTAMP DEFAULT NOW()
    )`);

  await run('dose_logs', `
    CREATE TABLE IF NOT EXISTS dose_logs (
      id SERIAL PRIMARY KEY,
      schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
      patient_uid VARCHAR(128) NOT NULL,
      scheduled_at TIMESTAMP NOT NULL,
      taken_at TIMESTAMP,
      status VARCHAR(20) CHECK (status IN ('taken', 'missed', 'pending')) DEFAULT 'pending',
      alert_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

  await run('users.health_condition', `ALTER TABLE users ADD COLUMN IF NOT EXISTS health_condition TEXT`);
  await run('users.expo_push_token', `ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT`);

  await run('medications.taken', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS taken BOOLEAN DEFAULT FALSE`);
  await run('medications.firestore_id', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS firestore_id VARCHAR(255)`);
  await run('medications.suspended', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE`);
  await run('medications.notify_enabled', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN DEFAULT TRUE`);
  await run('medications.updated_at', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
  await run('medications.last_taken_at', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS last_taken_at DATE`);
  await run('medications.current_stock', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS current_stock INTEGER DEFAULT 30`);
  await run('medications.refill_threshold', `ALTER TABLE medications ADD COLUMN IF NOT EXISTS refill_threshold INTEGER DEFAULT 5`);

  await run('medication_push_log', `
    CREATE TABLE IF NOT EXISTS medication_push_log (
      id SERIAL PRIMARY KEY,
      medication_id INTEGER NOT NULL,
      patient_uid VARCHAR(128) NOT NULL,
      push_date DATE NOT NULL DEFAULT CURRENT_DATE,
      push_type VARCHAR(32) NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (medication_id, push_date, push_type)
    )`);

  await run('users.date_of_birth', `ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`);

  await run('alerts.patient_name', `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255)`);
  await run('alerts.medication_name', `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS medication_name VARCHAR(255)`);

  await run('link_requests', `
    CREATE TABLE IF NOT EXISTS link_requests (
      id SERIAL PRIMARY KEY,
      patient_uid VARCHAR(128) NOT NULL,
      caretaker_uid VARCHAR(128) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  await run('link_codes', `
    CREATE TABLE IF NOT EXISTS link_codes (
      code VARCHAR(8) PRIMARY KEY,
      patient_uid VARCHAR(128) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

  await run('intelligence_events', `
    CREATE TABLE IF NOT EXISTS intelligence_events (
      id SERIAL PRIMARY KEY,
      firebase_uid VARCHAR(128) NOT NULL,
      event_type VARCHAR(32) NOT NULL,
      medication_id INTEGER,
      scheduled_at TIMESTAMP,
      responded_at TIMESTAMP DEFAULT NOW(),
      metadata JSONB
    )`);

  await run('intelligence_profiles', `
    CREATE TABLE IF NOT EXISTS intelligence_profiles (
      firebase_uid VARCHAR(128) PRIMARY KEY,
      avg_response_delay_minutes INTEGER DEFAULT 0,
      preferred_lead_minutes INTEGER DEFAULT 5,
      cluster_label VARCHAR(32) DEFAULT 'default',
      updated_at TIMESTAMP DEFAULT NOW()
    )`);

  await run('dose_logs.alert_sent', `ALTER TABLE dose_logs ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT FALSE`);
  await run('dose_logs.late_alert_sent', `ALTER TABLE dose_logs ADD COLUMN IF NOT EXISTS late_alert_sent BOOLEAN DEFAULT FALSE`);

  await run('users.profile_picture', `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT`);

  await run('pillbox_devices', `
    CREATE TABLE IF NOT EXISTS pillbox_devices (
      id SERIAL PRIMARY KEY,
      patient_uid VARCHAR(128) NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      token VARCHAR(255) NOT NULL,
      battery_level INTEGER DEFAULT 100,
      last_dose_time TIMESTAMP,
      connected_at TIMESTAMP DEFAULT NOW(),
      is_active BOOLEAN DEFAULT TRUE
    )`);
  await run('pillbox_devices.unique_active_patient', `
    CREATE UNIQUE INDEX IF NOT EXISTS pillbox_devices_active_patient
    ON pillbox_devices (patient_uid) WHERE is_active = TRUE`);

  console.log('[migrate] complete');
}

module.exports = { runMigrations };

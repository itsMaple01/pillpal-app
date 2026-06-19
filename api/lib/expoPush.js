const admin = require('../firebaseAdmin');
const pool = require('../db');

const STALE_TOKEN_CODE = 'messaging/registration-token-not-registered';

/** Tokens already pruned this process — skip duplicate sends in the same run. */
const prunedTokensThisRun = new Set();

function toFcmData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')]),
  );
}

function getFirebaseErrorCode(error) {
  return error?.code || error?.errorInfo?.code || '';
}

async function pruneStaleToken(token) {
  if (prunedTokensThisRun.has(token)) return;
  prunedTokensThisRun.add(token);

  try {
    const result = await pool.query(
      'UPDATE users SET expo_push_token = NULL WHERE expo_push_token = $1 RETURNING firebase_uid',
      [token],
    );
    const uid = result.rows[0]?.firebase_uid ?? 'unknown';
    console.log(`Pruned stale FCM token for user ${uid}`);
  } catch (dbErr) {
    console.warn(`Failed to prune stale FCM token: ${dbErr.message}`);
  }
}

async function sendPushNotification(token, title, body, data = {}) {
  if (!token) {
    throw new Error('No FCM token provided');
  }

  if (prunedTokensThisRun.has(token)) {
    return null;
  }

  try {
    const message = {
      token,
      notification: { title, body },
      data: toFcmData(data),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('FCM notification sent:', response);
    return response;
  } catch (error) {
    if (getFirebaseErrorCode(error) === STALE_TOKEN_CODE) {
      await pruneStaleToken(token);
      return null;
    }
    console.error('FCM send failed:', error.message || error);
    throw error;
  }
}

module.exports = { sendPushNotification };

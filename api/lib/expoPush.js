const admin = require('../firebaseAdmin');

function toFcmData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')]),
  );
}

async function sendPushNotification(token, title, body, data = {}) {
  if (!token) {
    throw new Error('No FCM token provided');
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
    console.error('FCM send failed:', error);
    throw error;
  }
}

module.exports = { sendPushNotification };

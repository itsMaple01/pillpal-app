const https = require('https');

/** Send Expo push notifications (works with standalone EAS builds). */
function sendExpoPush(messages) {
  const chunks = [];
  const body = JSON.stringify(messages);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ data });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function pushToUser(expoPushToken, { title, body, data }) {
  if (!expoPushToken || !String(expoPushToken).startsWith('ExponentPushToken')) {
    return { ok: false, error: 'No valid Expo push token' };
  }
  const result = await sendExpoPush([
    {
      to: expoPushToken,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'medication-reminders',
      data: data ?? {},
    },
  ]);
  const ticket = result?.data?.[0];
  if (ticket?.status === 'error') {
    return { ok: false, error: ticket.message };
  }
  return { ok: true, ticket };
}

module.exports = { sendExpoPush, pushToUser };

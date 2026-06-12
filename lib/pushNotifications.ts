import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { getUser, saveExpoPushToken } from '@/api/index';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) return null;

    const token = await messaging().getToken();
    return token;
  } catch (e) {
    console.error('FCM token registration failed:', e);
    return null;
  }
}

/** Register FCM token silently — skips save if token is already stored. */
export async function registerAndSavePushTokenIfNeeded(uid: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const res = await getUser(uid);
    if (res.data?.expo_push_token === token) return;

    await saveExpoPushToken(uid, token);
  } catch (err) {
    console.error('FCM token save failed:', err);
  }
}

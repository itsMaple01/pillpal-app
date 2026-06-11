import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

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

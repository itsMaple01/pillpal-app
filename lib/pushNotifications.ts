import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { PatientMedication } from '@/types/medication';

let warned = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (isExpoGo()) {
    if (!warned) {
      console.warn(
        'Remote push is unavailable in Expo Go (SDK 53+). Use a development build for push tokens.',
      );
      warned = true;
    }
    return null;
  }
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (e) {
    if (!warned) {
      console.warn('Push registration skipped:', e);
      warned = true;
    }
    return null;
  }
}

/** Local daily reminders per medication (device-only; works in Expo Go). */
export async function rescheduleMedicationLocalNotifications(meds: PatientMedication[]) {
  if (Platform.OS === 'web' || isExpoGo()) return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
    const active = meds.filter(m => !m.suspended && m.notify_enabled !== false);
    for (const med of active) {
      const m = (med.time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!m) continue;
      let hour = parseInt(m[1], 10);
      const minute = parseInt(m[2], 10);
      const ap = m[3].toUpperCase();
      if (ap === 'PM' && hour !== 12) hour += 12;
      if (ap === 'AM' && hour === 12) hour = 0;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication reminder',
          body: `Time for ${med.name} (${med.dosage})`,
        },
        trigger: { hour, minute, repeats: true } as any,
      });
    }
  } catch (e) {
    if (!isExpoGo()) {
      console.warn('Local notification schedule failed:', e);
    }
  }
}

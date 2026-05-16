import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { PatientMedication } from '@/types/medication';

let warned = false;
let handlerReady = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function getNotifications() {
  return import('expo-notifications');
}

/** Call once at app start (standalone / dev build). */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web' || isExpoGo()) return;
  try {
    const Notifications = await getNotifications();
    if (!handlerReady) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerReady = true;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication reminders',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
      });
    }
  } catch (e) {
    if (!warned) {
      console.warn('Notification setup skipped:', e);
      warned = true;
    }
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  await setupNotifications();
  if (isExpoGo()) return null;

  try {
    const Notifications = await getNotifications();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: true },
      });
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId: String(projectId) } : undefined,
    );
    return token.data;
  } catch (e) {
    if (!warned) {
      console.warn('Push registration skipped:', e);
      warned = true;
    }
    return null;
  }
}

/** Show immediate local notification (e.g. patient received caregiver reminder while app open). */
export async function presentLocalNotification(title: string, body: string) {
  if (Platform.OS === 'web' || isExpoGo()) return;
  try {
    const Notifications = await getNotifications();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}

export async function rescheduleMedicationLocalNotifications(meds: PatientMedication[]) {
  if (Platform.OS === 'web' || isExpoGo()) return;
  try {
    const Notifications = await getNotifications();
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
          sound: true,
        },
        trigger: { hour, minute, repeats: true, channelId: 'medication-reminders' } as any,
      });
    }
  } catch (e) {
    if (!isExpoGo()) console.warn('Local notification schedule failed:', e);
  }
}

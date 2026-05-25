import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatientMedication } from '@/types/medication';
import { parseMedicationTime } from '@/utils/medicationTimeBucket';
import { getReminderPlan } from '@/api/index';

let warned = false;
let handlerReady = false;
let lastScheduleKey = '';

const SCHEDULE_STORAGE_KEY = 'gabayra:notification-schedule-key';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function getNotifications() {
  return import('expo-notifications');
}

function medScheduleFingerprint(meds: PatientMedication[], leadMinutes: number): string {
  return JSON.stringify({
    leadMinutes,
    meds: meds
      .filter(m => !m.suspended && m.notify_enabled !== false)
      .map(m => `${m.id}:${m.time}:${m.name}`),
  });
}

function subtractMinutes(hour: number, minute: number, delta: number) {
  let total = hour * 60 + minute - delta;
  while (total < 0) total += 24 * 60;
  return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
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
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerReady = true;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication reminders',
        importance: Notifications.AndroidImportance.HIGH,
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

/** Show immediate local notification (caregiver push while app open). */
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

export async function rescheduleMedicationLocalNotifications(
  meds: PatientMedication[],
  patientUid?: string,
) {
  if (Platform.OS === 'web' || isExpoGo()) return;
  try {
    let leadMinutes = 5;
    if (patientUid) {
      try {
        const plan = await getReminderPlan(patientUid);
        leadMinutes = plan.data?.preferred_lead_minutes ?? 5;
      } catch {
        leadMinutes = 5;
      }
    }

    const fingerprint = medScheduleFingerprint(meds, leadMinutes);
    if (fingerprint === lastScheduleKey) return;

    const stored = await AsyncStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (stored === fingerprint) {
      lastScheduleKey = fingerprint;
      return;
    }

    const Notifications = await getNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const active = meds.filter(m => !m.suspended && m.notify_enabled !== false);
    for (const med of active) {
      const parsed = parseMedicationTime(med.time);
      if (!parsed) continue;
      const when = subtractMinutes(parsed.hour, parsed.minute, leadMinutes);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'GabayRa — Medication reminder',
          body: `Time for ${med.name} (${med.dosage}) in ${leadMinutes} min`,
          sound: true,
          data: { medicationId: med.id, type: 'med_reminder' },
        },
        trigger: {
          hour: when.hour,
          minute: when.minute,
          repeats: true,
          channelId: 'medication-reminders',
        } as any,
      });
    }

    lastScheduleKey = fingerprint;
    await AsyncStorage.setItem(SCHEDULE_STORAGE_KEY, fingerprint);
  } catch (e) {
    if (!isExpoGo()) console.warn('Local notification schedule failed:', e);
  }
}

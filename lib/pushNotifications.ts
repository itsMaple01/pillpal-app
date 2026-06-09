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
  return Constants.executionEnvironment === 'storeClient';
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

async function ensureAndroidChannel(Notifications: Awaited<ReturnType<typeof getNotifications>>) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('medication-reminders', {
    name: 'Medication reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

/** Call once at app start. */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
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
    await ensureAndroidChannel(Notifications);
  } catch (e) {
    if (!warned) {
      console.warn('Notification setup skipped:', e);
      warned = true;
    }
  }
}

/** Register for Expo push tokens — no Expo Go guards, always attempt token retrieval. */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Notifications = await getNotifications();

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    await ensureAndroidChannel(Notifications);

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: true },
      });
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] Permission not granted:', finalStatus);
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('[push] Missing EAS projectId in app config');
      return null;
    }

    console.log('[push] Requesting token with projectId:', projectId);
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: String(projectId),
    });

    console.log('[push] Token received:', tokenResponse.data);
    return tokenResponse.data;
  } catch (e) {
    console.error('[push] Registration failed:', e);
    return null;
  }
}

/** Show immediate local notification (fallback while app is open). */
export async function presentLocalNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await getNotifications();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority?.MAX ?? 'max',
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[push] Local notification failed:', err);
  }
}

export async function forceRescheduleMedicationLocalNotifications(
  meds: PatientMedication[],
  patientUid?: string,
) {
  lastScheduleKey = '';
  await AsyncStorage.removeItem(SCHEDULE_STORAGE_KEY);
  await rescheduleMedicationLocalNotifications(meds, patientUid);
}

/** Local schedule kept as fallback; primary delivery is server-side Expo push. */
export async function rescheduleMedicationLocalNotifications(
  meds: PatientMedication[],
  patientUid?: string,
) {
  if (Platform.OS === 'web') return;
  try {
    const { areAppNotificationsEnabled } = await import('@/lib/notificationPrefs');
    if (!(await areAppNotificationsEnabled())) {
      const Notifications = await getNotifications();
      await Notifications.cancelAllScheduledNotificationsAsync();
      lastScheduleKey = '';
      await AsyncStorage.removeItem(SCHEDULE_STORAGE_KEY);
      return;
    }

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
    await ensureAndroidChannel(Notifications);
    await Notifications.cancelAllScheduledNotificationsAsync();

    const active = meds.filter(m => !m.suspended && m.notify_enabled !== false);
    for (const med of active) {
      const parsed = parseMedicationTime(med.time);
      if (!parsed) continue;
      const when = subtractMinutes(parsed.hour, parsed.minute, leadMinutes);

      const now = new Date();
      const triggerDate = new Date();
      triggerDate.setHours(when.hour, when.minute, 0, 0);

      if (triggerDate <= now) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'GabayRa',
          body: `${med.name} · ${parsed.label}`,
          sound: 'default',
          priority: 'max',
          vibrate: [0, 250, 250, 250],
          data: { medicationId: med.id, type: 'med_reminder', doseTime: med.time },
        },
        trigger: {
          date: triggerDate,
          channelId: 'medication-reminders',
          repeats: true,
        } as any,
      });
    }

    lastScheduleKey = fingerprint;
    await AsyncStorage.setItem(SCHEDULE_STORAGE_KEY, fingerprint);
  } catch (e) {
    console.warn('[push] Local notification schedule failed:', e);
  }
}

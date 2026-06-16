import { Platform } from 'react-native';

/** FCM handles push reminders; keep handler for foreground display when needed. */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn('Notification setup skipped:', e);
  }
}

/** @deprecated Medication reminders use FCM push only. */
export async function presentLocalNotification(_title: string, _body: string): Promise<void> {}

/** @deprecated Medication reminders use FCM push only. */
export async function forceRescheduleMedicationLocalNotifications(
  _meds: unknown[],
  _patientUid?: string,
): Promise<void> {}

/** @deprecated Medication reminders use FCM push only. */
export async function rescheduleMedicationLocalNotifications(
  _meds: unknown[],
  _patientUid?: string,
): Promise<void> {}

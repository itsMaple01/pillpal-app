import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gabayra:app_notifications_enabled';

/** In-app preference for medication reminders (independent of OS permission). */
export async function areAppNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  if (v === null) return true;
  return v === 'true';
}

export async function setAppNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? 'true' : 'false');
}

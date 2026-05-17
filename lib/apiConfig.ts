import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const PRODUCTION_API_URL = 'https://pillpal-app.onrender.com';

/** Resolve API host: production Render URL unless dev + local Metro. */
export function getApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? fromExtra;
  if (envUrl) return envUrl.replace(/\/$/, '');

  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location?.hostname
      ? `http://${window.location.hostname}:3001`
      : PRODUCTION_API_URL;
  }

  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra
        ?.expoGo?.debuggerHost ??
      Constants.manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
      if (host && host !== 'localhost') {
        return `http://${host}:3001`;
      }
    }
  }

  return PRODUCTION_API_URL;
}

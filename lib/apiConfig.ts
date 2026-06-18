import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const PRODUCTION_API_URL = 'https://pillpal-app-production.up.railway.app';

/**
 * Resolve API host.
 * Defaults to production Railway URL so Expo Go / team builds work without a local server.
 * Set EXPO_PUBLIC_USE_LOCAL_API=1 to use Metro host on port 3001 during backend dev.
 */
export function getApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? fromExtra;
  if (envUrl) return envUrl.replace(/\/$/, '');

  const useLocal = process.env.EXPO_PUBLIC_USE_LOCAL_API === '1';
  if (__DEV__ && useLocal) {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.location?.hostname
        ? `http://${window.location.hostname}:3001`
        : PRODUCTION_API_URL;
    }

    const legacy = Constants as typeof Constants & {
      manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
      manifest?: { debuggerHost?: string };
    };
    const hostUri =
      Constants.expoConfig?.hostUri ??
      legacy.manifest2?.extra?.expoGo?.debuggerHost ??
      legacy.manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
      if (host && host !== 'localhost') {
        return `http://${host}:3001`;
      }
    }
    return 'http://localhost:3001';
  }

  return PRODUCTION_API_URL;
}
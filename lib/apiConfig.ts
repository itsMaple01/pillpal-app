import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Resolve API host for phone/tablet (Expo) vs web vs fallback LAN IP. */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location?.hostname
      ? `http://${window.location.hostname}:3001`
      : 'http://localhost:3001';
  }

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

  return 'http://192.168.1.52:3001';
}

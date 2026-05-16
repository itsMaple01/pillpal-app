import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

let NetInfo: typeof import('@react-native-community/netinfo').default | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  NetInfo = null;
}

let globalOnline = true;

export function isOnline(): boolean {
  return globalOnline;
}

export function setOnlineStatus(online: boolean): void {
  globalOnline = online;
}

export function useNetworkStatus(): { isConnected: boolean; isInternetReachable: boolean } {
  const [status, setStatus] = useState({ isConnected: true, isInternetReachable: true });

  useEffect(() => {
    if (!NetInfo || Platform.OS === 'web') {
      const update = () => setStatus({ isConnected: navigator.onLine, isInternetReachable: navigator.onLine });
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    const unsub = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      const reachable = state.isInternetReachable ?? connected;
      globalOnline = connected && reachable !== false;
      setStatus({ isConnected: connected, isInternetReachable: reachable !== false });
    });
    return unsub;
  }, []);

  useEffect(() => {
    globalOnline = status.isConnected && status.isInternetReachable;
  }, [status]);

  return status;
}

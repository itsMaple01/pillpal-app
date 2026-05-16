import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/lib/offline/network';
import AppIcon from '@/components/AppIcon';

export default function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const offline = !isConnected || !isInternetReachable;

  if (!offline) return null;

  return (
    <View style={styles.banner}>
      <AppIcon name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>Offline mode — changes save locally and sync when you reconnect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5d4037',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  text: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 16 },
});

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert, Platform,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import { APP_NAME } from '@/lib/branding';
import { theme } from '@/lib/theme';
import {
  areAppNotificationsEnabled,
  setAppNotificationsEnabled,
} from '@/lib/notificationPrefs';
import { setupNotifications } from '@/lib/pushNotifications';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPreferenceChange?: (enabled: boolean) => void;
}

export default function NotificationSettingsModal({
  visible,
  onClose,
  onPreferenceChange,
}: Props) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    areAppNotificationsEnabled()
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, [visible]);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      await setAppNotificationsEnabled(next);
      setEnabled(next);
      onPreferenceChange?.(next);

      if (next && Platform.OS !== 'web') {
        await setupNotifications();
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: requested } = await Notifications.requestPermissionsAsync();
          if (requested !== 'granted') {
            Alert.alert(
              'Permission needed',
              'GabayRa can remind you when notifications are allowed on this device. You can enable them in system settings.',
            );
          }
        }
      } else if (!next && Platform.OS !== 'web') {
        const Notifications = await import('expo-notifications');
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch {
      Alert.alert('Error', 'Could not update notification settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.iconWrap}>
              <AppIcon name="notifications-outline" size={26} color={theme.green} />
            </View>
            <Text style={s.kicker}>{APP_NAME}</Text>
            <Text style={s.title}>Notification settings</Text>
            <Text style={s.sub}>Turn medication reminders on or off inside the app.</Text>
          </View>

          <View style={s.body}>
            {loading ? (
              <ActivityIndicator color={theme.green} style={{ marginVertical: 20 }} />
            ) : (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>Medication reminders</Text>
                  <Text style={s.rowSub}>
                    {enabled
                      ? 'Local alerts before each scheduled dose'
                      : 'Reminders are paused in GabayRa'}
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  disabled={saving}
                  trackColor={{ false: '#e0e0e0', true: theme.greenMuted }}
                  thumbColor="#fff"
                />
              </View>
            )}
            <Text style={s.hint}>
              This toggle controls reminders scheduled by {APP_NAME}. Your device may still need notification permission for alerts to appear.
            </Text>
          </View>

          <TouchableOpacity style={s.doneBtn} onPress={onClose}>
            <Text style={s.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    backgroundColor: theme.greenDark,
    padding: 22,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8, textAlign: 'center', lineHeight: 18 },
  body: { padding: 20, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.greenLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowLabel: { fontSize: 15, fontWeight: '700', color: theme.text },
  rowSub: { fontSize: 12, color: theme.textSecondary, marginTop: 4, lineHeight: 16 },
  hint: { fontSize: 12, color: theme.textMuted, lineHeight: 17 },
  doneBtn: {
    margin: 16,
    marginTop: 0,
    backgroundColor: theme.bg,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  doneText: { fontSize: 15, fontWeight: '700', color: theme.text },
});

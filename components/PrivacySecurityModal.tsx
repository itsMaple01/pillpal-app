import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import AppIcon from '@/components/AppIcon';
import { APP_NAME } from '@/lib/branding';
import { theme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PrivacySecurityModal({ visible, onClose }: Props) {
  const openSystemSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => {});
    } else if (Platform.OS === 'android') {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.iconWrap}>
              <AppIcon name="lock-closed-outline" size={26} color={theme.green} />
            </View>
            <Text style={s.kicker}>{APP_NAME}</Text>
            <Text style={s.title}>Privacy & security</Text>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            <Text style={s.section}>Your data</Text>
            <Text style={s.p}>
              Medication reminders and profile details are stored securely and linked to your account.
              Only caregivers you approve can view your schedule when linked.
            </Text>

            <Text style={s.section}>Notifications</Text>
            <Text style={s.p}>
              Control in-app reminders from Notification settings. Device-level permissions can be
              updated in your phone settings if needed.
            </Text>

            <Text style={s.section}>Account</Text>
            <Text style={s.p}>
              Sign out anytime from Manage. Use a strong password and do not share your login with others.
            </Text>

            {Platform.OS !== 'web' && (
              <TouchableOpacity style={s.linkBtn} onPress={openSystemSettings}>
                <AppIcon name="settings-outline" size={18} color={theme.green} />
                <Text style={s.linkText}>Open device settings</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

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
    maxHeight: '85%',
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
  body: { padding: 20, maxHeight: 320 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  p: { fontSize: 14, color: theme.textSecondary, lineHeight: 21, marginBottom: 12 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  linkText: { fontSize: 14, fontWeight: '700', color: theme.green },
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

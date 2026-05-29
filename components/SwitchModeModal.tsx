import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import AppLogo from '@/components/AppLogo';
import AppIcon from '@/components/AppIcon';
import { APP_NAME } from '@/lib/branding';
import { theme } from '@/lib/theme';

interface Props {
  visible: boolean;
  mode: 'toCaregiver' | 'toFamily';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SwitchModeModal({ visible, mode, onConfirm, onCancel }: Props) {
  const toCaregiver = mode === 'toCaregiver';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <AppLogo size={52} />
            <Text style={s.kicker}>{APP_NAME}</Text>
            <Text style={s.title}>
              {toCaregiver ? 'Caregiver mode' : 'Family mode'}
            </Text>
            <Text style={s.sub}>
              {toCaregiver
                ? 'Open the full caregiver dashboard with patient lists, alerts, and schedules? You can return to family view anytime from Manage.'
                : 'Switch to the simpler family view for supporting a few loved ones? You can return to caregiver mode anytime from Manage.'}
            </Text>
          </View>

          <View style={s.iconRow}>
            <View style={s.modeIcon}>
              <AppIcon
                name={toCaregiver ? 'people-outline' : 'home-outline'}
                size={28}
                color={theme.green}
              />
            </View>
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={onConfirm}>
              <Text style={s.confirmText}>{toCaregiver ? 'Switch' : 'Switch'}</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    backgroundColor: theme.greenLight,
    padding: 22,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: theme.green, letterSpacing: 1.5, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 6 },
  sub: { fontSize: 14, color: theme.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 21 },
  iconRow: { alignItems: 'center', paddingVertical: 16 },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.bg,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.textSecondary },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.green,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

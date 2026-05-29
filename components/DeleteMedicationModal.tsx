import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import { APP_NAME } from '@/lib/branding';
import { theme } from '@/lib/theme';

interface Props {
  visible: boolean;
  medicationName: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting?: boolean;
}

export default function DeleteMedicationModal({
  visible,
  medicationName,
  onCancel,
  onConfirm,
  deleting = false,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <AppLogo size={48} />
            <Text style={s.kicker}>{APP_NAME}</Text>
            <Text style={s.title}>Remove medication?</Text>
            <Text style={s.sub}>
              <Text style={s.medName}>{medicationName || 'This reminder'}</Text>
              {' '}will be deleted from your list. This cannot be undone.
            </Text>
          </View>

          <View style={s.iconRow}>
            <View style={s.warnIcon}>
              <AppIcon name="trash-outline" size={28} color={theme.danger} />
            </View>
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} disabled={deleting}>
              <Text style={s.cancelText}>Keep</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.deleteBtn, deleting && { opacity: 0.7 }]}
              onPress={onConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.deleteText}>Remove</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    alignItems: 'center',
    padding: 22,
    paddingBottom: 12,
    backgroundColor: theme.greenLight,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.green,
    letterSpacing: 1.5,
    marginTop: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 6 },
  sub: { fontSize: 14, color: theme.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 21 },
  medName: { fontWeight: '800', color: theme.text },
  iconRow: { alignItems: 'center', paddingVertical: 16 },
  warnIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 0,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.text },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.danger,
    alignItems: 'center',
  },
  deleteText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

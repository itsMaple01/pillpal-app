import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';

export interface LinkedPatientRow {
  firebase_uid: string;
  full_name?: string;
  email?: string;
  age?: number;
  missed_doses?: number;
  compliance?: number;
}

interface Props {
  visible: boolean;
  title?: string;
  patients: LinkedPatientRow[];
  onClose: () => void;
  onViewInventory?: (patientUid: string) => void;
  onRemove?: (patient: LinkedPatientRow) => void;
}

export default function LinkedPatientsScreen({
  visible,
  title = 'Linked patients',
  patients,
  onClose,
  onViewInventory,
  onRemove,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn} accessibilityLabel="Close">
            <AppIcon name="arrow-back" size={24} color={theme.green} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{title}</Text>
          <View style={s.backBtnSpacer} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {patients.length === 0 ? (
            <View style={s.empty}>
              <AppIcon name="people-outline" size={40} color="#ccc" />
              <Text style={s.emptyTitle}>No linked accounts yet</Text>
              <Text style={s.emptySub}>Use Link in Manage to connect with a patient.</Text>
            </View>
          ) : (
            patients.map(person => (
              <View key={person.firebase_uid} style={s.card}>
                <View style={s.cardRow}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {(person.full_name ?? person.email ?? 'P').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{person.full_name ?? person.email}</Text>
                    <Text style={s.sub}>
                      {person.age ? `Age ${person.age}` : 'Age unknown'}
                      {person.missed_doses != null ? ` · ${person.missed_doses} missed today` : ''}
                      {person.compliance != null ? ` · ${Math.round(person.compliance)}% compliance` : ''}
                    </Text>
                  </View>
                  {onRemove && (
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => onRemove(person)}
                      accessibilityLabel="Remove patient"
                    >
                      <AppIcon name="trash-outline" size={18} color="#c62828" />
                    </TouchableOpacity>
                  )}
                </View>
                {onViewInventory && (
                  <TouchableOpacity
                    style={s.inventoryBtn}
                    onPress={() => onViewInventory(person.firebase_uid)}
                  >
                    <AppIcon name="cube-outline" size={18} color={theme.green} />
                    <Text style={s.inventoryBtnText}>View inventory</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: '#f4faf4',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.border,
  },
  backBtnSpacer: { width: 40 },
  headerTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#222' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: TEXT.md, fontWeight: '800', color: '#333' },
  emptySub: { fontSize: TEXT.sm, color: '#888', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: theme.green },
  name: { fontSize: TEXT.md, fontWeight: '800', color: '#222' },
  sub: { fontSize: TEXT.sm, color: theme.textSecondary, marginTop: 2 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fce4ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.green,
    backgroundColor: theme.greenLight,
  },
  inventoryBtnText: { fontSize: TEXT.sm, fontWeight: '800', color: theme.green },
});

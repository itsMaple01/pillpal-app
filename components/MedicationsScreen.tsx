/**
 * MedicationsScreen.tsx
 *
 * Drop-in screen for the 💊 Medications tab.
 * Used in both PatientDashboard and CaretakerDashboard.
 *
 * PATIENT usage:
 *   <MedicationsScreen
 *     medications={medications}
 *     onToggleTaken={handleToggleTaken}
 *     onDelete={handleDeleteMed}
 *     onEdit={handleEditMed}
 *     onAddPress={() => setShowAddModal(true)}
 *   />
 *
 * CARETAKER usage (read-only):
 *   <MedicationsScreen
 *     medications={patientMedications}
 *     patientName="John Doe"
 *     readOnly
 *   />
 */

import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch,
} from 'react-native';
import AppIcon from '@/components/AppIcon';

const GREEN       = '#2d7a3a';
const GREEN_LIGHT = '#e8f5e9';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string;
  taken: boolean;
  suspended?: boolean;
  notify_enabled?: boolean;
}

interface Props {
  medications: Medication[];
  onToggleTaken?: (id: string) => void;
  onDelete?:      (id: string) => void;
  onEdit?:        (med: Medication) => void;
  onAddPress?:    () => void;
  onRefill?:      (id: string) => void;
  onSuspend?:     (med: Medication) => void;
  onToggleNotify?: (med: Medication) => void;
  patientName?:   string;
  readOnly?:      boolean;
}

export default function MedicationsScreen({
  medications,
  onToggleTaken,
  onDelete,
  onEdit,
  onAddPress,
  onRefill,
  onSuspend,
  onToggleNotify,
  patientName,
  readOnly = false,
}: Props) {
  const pending = medications.filter(m => !m.taken && !m.suspended).length;
  const taken   = medications.filter(m =>  m.taken && !m.suspended).length;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Banner ── */}
      <View style={s.banner}>
        <View style={s.bannerLeft}>
          <Text style={s.bannerTitle}>
            {patientName ? `${patientName}'s Medications` : 'My Medications'}
          </Text>
          <Text style={s.bannerSub}>
            {medications.length} active reminder{medications.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {!readOnly && onAddPress && (
          <TouchableOpacity style={s.addBtn} onPress={onAddPress} activeOpacity={0.85}>
            <Text style={s.addBtnText}>＋ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Stats row ── */}
      <View style={s.statsRow}>
        {[
          { label: 'Total',   num: medications.length, color: GREEN,     bg: GREEN_LIGHT },
          { label: 'Pending', num: pending,             color: '#e65100', bg: '#fff3e0'  },
          { label: 'Taken',   num: taken,               color: '#388e3c', bg: '#f1f8e9'  },
        ].map((stat, i) => (
          <View key={i} style={[s.statCard, { backgroundColor: stat.bg }]}>
            <Text style={[s.statNum,   { color: stat.color }]}>{stat.num}</Text>
            <Text style={[s.statLabel, { color: stat.color }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Empty state ── */}
      {medications.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconWrap}>
            <AppIcon name="medical-outline" size={40} color={GREEN} />
          </View>
          <Text style={s.emptyTitle}>No medications yet</Text>
          <Text style={s.emptySub}>
            {readOnly
              ? 'This patient has no active medications.'
              : 'Tap Add to create your first reminder'}
          </Text>
          {!readOnly && onAddPress && (
            <TouchableOpacity style={s.emptyActionBtn} onPress={onAddPress}>
              <Text style={s.emptyActionText}>+ Add Medication</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <Text style={s.sectionTitle}>All Medications</Text>

          {medications.map((med) => (
            <View key={med.id} style={[s.medCard, med.suspended && { opacity: 0.65 }]}>
              {/* Colour strip */}
              <View style={[s.strip, { backgroundColor: med.suspended ? '#999' : med.taken ? '#bdbdbd' : GREEN }]} />

              {/* Main content */}
              <View style={s.medBody}>
                <View style={s.medTopRow}>
                  <Text style={[s.medName, med.taken && s.medNameTaken]} numberOfLines={1}>
                    {med.name}{med.suspended ? ' · Paused' : ''}
                  </Text>
                  <View style={[s.badge, { backgroundColor: med.taken ? '#f5f5f5' : GREEN_LIGHT }]}>
                    <Text style={[s.badgeText, { color: med.taken ? '#aaa' : GREEN }]}>
                      {med.taken ? 'Taken' : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={s.metaRow}>
                  <View style={s.metaChip}>
                    <AppIcon name="fitness-outline" size={12} color="#666" />
                    <Text style={s.metaChipText}>{med.dosage}</Text>
                  </View>
                  <View style={s.metaChip}>
                    <AppIcon name="repeat-outline" size={12} color="#666" />
                    <Text style={s.metaChipText}>{med.frequency}</Text>
                  </View>
                  <View style={s.metaChip}>
                    <AppIcon name="time-outline" size={12} color="#666" />
                    <Text style={s.metaChipText}>{med.time}</Text>
                  </View>
                </View>

                {!readOnly && (onEdit || onRefill || onSuspend || onToggleNotify) && (
                  <View style={s.actionRow}>
                    {onEdit && (
                      <TouchableOpacity style={s.smallBtn} onPress={() => onEdit(med)}>
                        <Text style={s.smallBtnTxt}>Edit</Text>
                      </TouchableOpacity>
                    )}
                    {onRefill && (
                      <TouchableOpacity style={s.smallBtn} onPress={() => onRefill(med.id)}>
                        <Text style={s.smallBtnTxt}>Refill</Text>
                      </TouchableOpacity>
                    )}
                    {onSuspend && (
                      <TouchableOpacity style={s.smallBtn} onPress={() => onSuspend(med)}>
                        <Text style={s.smallBtnTxt}>{med.suspended ? 'Resume' : 'Pause'}</Text>
                      </TouchableOpacity>
                    )}
                    {onToggleNotify && (
                      <TouchableOpacity style={s.smallBtn} onPress={() => onToggleNotify(med)}>
                        <Text style={s.smallBtnTxt}>{med.notify_enabled === false ? 'Notify off' : 'Notify on'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Toggle + Delete — patient only */}
              {!readOnly && (
                <View style={s.medControls}>
                  <Switch
                    value={med.taken}
                    onValueChange={() => onToggleTaken?.(med.id)}
                    disabled={!!med.suspended}
                    trackColor={{ false: '#f5c842', true: GREEN }}
                    thumbColor="#fff"
                  />
                  <TouchableOpacity
                    onPress={() => onDelete?.(med.id)}
                    style={s.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="trash-outline" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#f0f4f0' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },

  banner: {
    backgroundColor: GREEN, borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bannerLeft:  {},
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  bannerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  addBtn:      { backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText:  { color: GREEN, fontWeight: '800', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statNum:   { fontSize: 26, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 1,
  },

  emptyWrap: {
    alignItems: 'center', paddingVertical: 48,
    backgroundColor: '#fff', borderRadius: 18, gap: 8,
  },
  emptyIconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:     { fontSize: 17, fontWeight: '800', color: '#333' },
  emptySub:       { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 24 },
  emptyActionBtn: {
    marginTop: 8, backgroundColor: GREEN,
    borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
  },
  emptyActionText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  medCard: {
    backgroundColor: '#fff', borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  strip:   { width: 5, alignSelf: 'stretch' },
  medBody: { flex: 1, padding: 14, gap: 8 },

  medTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  medName:      { fontSize: 17, fontWeight: '800', color: '#1a1a1a', flex: 1 },
  medNameTaken: { color: '#bbb', textDecorationLine: 'line-through' },

  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f5f5f5', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  metaChipText: { fontSize: 13, color: '#666', fontWeight: '600' },

  editBtn: {
    alignSelf: 'flex-start',
    backgroundColor: GREEN_LIGHT,
    borderRadius: 8, borderWidth: 1, borderColor: GREEN,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 2,
  },
  editBtnText: { fontSize: 12, color: GREEN, fontWeight: '700' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  smallBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#f0f4f0',
    borderWidth: 1, borderColor: '#dde8dd',
  },
  smallBtnTxt: { fontSize: 11, fontWeight: '700', color: GREEN },

  medControls: { paddingRight: 14, alignItems: 'center', gap: 10 },
  deleteBtn:   { padding: 4 },
  deleteTxt:   { fontSize: 17 },
});
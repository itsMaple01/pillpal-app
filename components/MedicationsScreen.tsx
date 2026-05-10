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
 *     onAddPress={() => setShowAddModal(true)}
 *   />
 *
 * CARETAKER usage (read-only, pass no onToggleTaken / onDelete):
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

const GREEN       = '#2d7a3a';
const GREEN_LIGHT = '#e8f5e9';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string;
  taken: boolean;
}

interface Props {
  medications: Medication[];
  /** Patient-only: toggles taken state */
  onToggleTaken?: (id: string) => void;
  /** Patient-only: deletes a medication */
  onDelete?: (id: string) => void;
  /** Patient-only: opens Add Medication modal */
  onAddPress?: () => void;
  /** Caretaker-only: shows whose meds these are */
  patientName?: string;
  /** When true, hides toggle/delete/add controls */
  readOnly?: boolean;
}

export default function MedicationsScreen({
  medications,
  onToggleTaken,
  onDelete,
  onAddPress,
  patientName,
  readOnly = false,
}: Props) {
  const pending = medications.filter(m => !m.taken).length;
  const taken   = medications.filter(m =>  m.taken).length;

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
          { label: 'Total',   num: medications.length, color: GREEN,     bg: GREEN_LIGHT   },
          { label: 'Pending', num: pending,             color: '#e65100', bg: '#fff3e0'     },
          { label: 'Taken',   num: taken,               color: '#388e3c', bg: '#f1f8e9'     },
        ].map((stat, i) => (
          <View key={i} style={[s.statCard, { backgroundColor: stat.bg }]}>
            <Text style={[s.statNum, { color: stat.color }]}>{stat.num}</Text>
            <Text style={[s.statLabel, { color: stat.color }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Empty state ── */}
      {medications.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>💊</Text>
          <Text style={s.emptyTitle}>No medications yet</Text>
          <Text style={s.emptySub}>
            {readOnly
              ? 'This patient has no active medications.'
              : 'Tap "Add" to set your first reminder'}
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
            <View key={med.id} style={s.medCard}>
              {/* Colour strip */}
              <View style={[s.strip, { backgroundColor: med.taken ? '#bdbdbd' : GREEN }]} />

              {/* Main content */}
              <View style={s.medBody}>
                <View style={s.medTopRow}>
                  <Text style={[s.medName, med.taken && s.medNameTaken]}>
                    {med.name}
                  </Text>
                  <View style={[s.badge, { backgroundColor: med.taken ? '#f5f5f5' : GREEN_LIGHT }]}>
                    <Text style={[s.badgeText, { color: med.taken ? '#aaa' : GREEN }]}>
                      {med.taken ? 'Taken' : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={s.metaRow}>
                  <View style={s.metaChip}>
                    <Text style={s.metaChipText}>
                      💊 {med.dosage !== 'As prescribed' ? med.dosage : 'As prescribed'}
                    </Text>
                  </View>
                  <View style={s.metaChip}>
                    <Text style={s.metaChipText}>🔄 {med.frequency}</Text>
                  </View>
                  <View style={s.metaChip}>
                    <Text style={s.metaChipText}>⏰ {med.time}</Text>
                  </View>
                </View>
              </View>

              {/* Controls (patient only) */}
              {!readOnly && (
                <View style={s.medControls}>
                  <Switch
                    value={med.taken}
                    onValueChange={() => onToggleTaken?.(med.id)}
                    trackColor={{ false: '#f5c842', true: GREEN }}
                    thumbColor="#fff"
                  />
                  <TouchableOpacity
                    onPress={() => onDelete?.(med.id)}
                    style={s.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={s.deleteTxt}>🗑</Text>
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

  // Banner
  banner: {
    backgroundColor: GREEN,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft:  {},
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  bannerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  addBtn: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addBtnText: { color: GREEN, fontWeight: '800', fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  statNum:   { fontSize: 26, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Section title
  sectionTitle: {
    fontSize: 13, fontWeight: '800',
    color: '#aaa', textTransform: 'uppercase', letterSpacing: 1,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center', paddingVertical: 48,
    backgroundColor: '#fff', borderRadius: 18, gap: 8,
  },
  emptyIcon:      { fontSize: 48 },
  emptyTitle:     { fontSize: 17, fontWeight: '800', color: '#333' },
  emptySub:       { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 24 },
  emptyActionBtn: {
    marginTop: 8, backgroundColor: GREEN,
    borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
  },
  emptyActionText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Med card
  medCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  strip: { width: 5, alignSelf: 'stretch' },
  medBody: { flex: 1, padding: 14, gap: 8 },

  medTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  medName:     { fontSize: 15, fontWeight: '800', color: '#1a1a1a', flex: 1 },
  medNameTaken:{ color: '#bbb', textDecorationLine: 'line-through' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    backgroundColor: '#f5f5f5', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaChipText: { fontSize: 11, color: '#666', fontWeight: '600' },

  medControls: {
    paddingRight: 14,
    alignItems: 'center',
    gap: 10,
  },
  deleteBtn: { padding: 4 },
  deleteTxt: { fontSize: 17 },
});
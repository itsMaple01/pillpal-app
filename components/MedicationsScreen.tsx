/**
 * Medications tab — patient (editable) or caregiver (read-only).
 */

import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Pressable,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';

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
  onOpenAlerts?:  () => void;
  patientName?:   string;
  readOnly?:      boolean;
  showAlertsEntry?: boolean;
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
  onOpenAlerts,
  patientName,
  readOnly = false,
  showAlertsEntry = false,
}: Props) {
  const pending = medications.filter(m => !m.taken && !m.suspended).length;
  const taken   = medications.filter(m =>  m.taken && !m.suspended).length;
  const title = patientName ? `${patientName}'s medications` : 'My medications';

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: theme.greenLight }]}>
          <Text style={[s.statNum, { color: theme.green }]}>{pending}</Text>
          <Text style={[s.statLabel, { color: theme.green }]}>Pending</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#f5f5f5' }]}>
          <Text style={[s.statNum, { color: theme.textSecondary }]}>{taken}</Text>
          <Text style={[s.statLabel, { color: theme.textMuted }]}>Taken</Text>
        </View>
      </View>

      <View style={s.sectionHeadRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionHeadTitle}>{title}</Text>
          <Text style={s.sectionHeadSub}>{medications.length} active reminders</Text>
        </View>
        {!readOnly && onAddPress && (
          <TouchableOpacity style={s.addFab} onPress={onAddPress} accessibilityLabel="Add medication">
            <AppIcon name="add" size={26} color="#fff" />
          </TouchableOpacity>
        )}
        {showAlertsEntry && onOpenAlerts && (
          <TouchableOpacity style={s.alertFab} onPress={onOpenAlerts}>
            <AppIcon name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {medications.length === 0 ? (
        <View style={s.emptyWrap}>
          <AppIcon name="medical-outline" size={40} color={theme.green} />
          <Text style={s.emptyTitle}>No medications yet</Text>
          {!readOnly && onAddPress && (
            <TouchableOpacity style={s.emptyActionBtn} onPress={onAddPress}>
              <AppIcon name="add-circle-outline" size={20} color="#fff" />
              <Text style={s.emptyActionText}>Add medication</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <Text style={s.sectionTitle}>All medications</Text>
          {medications.map(med => (
            <Pressable
              key={med.id}
              style={({ pressed }) => [s.medCard, pressed && s.medCardPressed, med.suspended && { opacity: 0.7 }]}
              onPress={() => onEdit?.(med)}
              disabled={readOnly || !onEdit}
            >
              <View
                style={[
                  s.strip,
                  { backgroundColor: med.suspended ? '#999' : med.taken ? '#bdbdbd' : theme.green },
                ]}
              />
              <View style={s.medBody}>
                <Text style={[s.medName, med.taken && s.medNameTaken]} numberOfLines={1}>
                  {med.name}{med.suspended ? ' · Paused' : ''}
                </Text>
                <View style={s.metaRow}>
                  <Text style={s.metaText}>{med.dosage}</Text>
                  <Text style={s.metaDot}>·</Text>
                  <Text style={s.metaText}>{med.time}</Text>
                </View>
                {!readOnly && (onRefill || onSuspend) && (
                  <View style={s.quickRow}>
                    {onRefill && (
                      <TouchableOpacity style={s.chip} onPress={() => onRefill(med.id)}>
                        <AppIcon name="refresh-outline" size={14} color={theme.green} />
                        <Text style={s.chipText}>Refill</Text>
                      </TouchableOpacity>
                    )}
                    {onSuspend && (
                      <TouchableOpacity style={s.chip} onPress={() => onSuspend(med)}>
                        <AppIcon name="pause-circle-outline" size={14} color={theme.green} />
                        <Text style={s.chipText}>{med.suspended ? 'Resume' : 'Pause'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
              <View style={s.medControls}>
                {!readOnly && onToggleTaken && (
                  <Switch
                    value={med.taken}
                    onValueChange={() => onToggleTaken(med.id)}
                    disabled={!!med.suspended}
                    trackColor={{ false: '#e8d9a8', true: theme.green }}
                    thumbColor="#fff"
                  />
                )}
                {!readOnly && onDelete && (
                  <TouchableOpacity
                    onPress={() => onDelete(med.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={s.deleteBtn}
                  >
                    <AppIcon name="trash-outline" size={20} color={theme.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statNum:   { fontSize: TEXT.xxl, fontWeight: '900' },
  statLabel: { fontSize: TEXT.sm, fontWeight: '600', marginTop: 2 },

  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  sectionHeadTitle: { fontSize: TEXT.lg, fontWeight: '800', color: theme.text },
  sectionHeadSub: { fontSize: TEXT.sm, color: theme.textSecondary, marginTop: 2 },
  addFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.greenDark,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  alertFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: TEXT.sm,
    fontWeight: '800',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: theme.surface,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyTitle: { fontSize: TEXT.md, fontWeight: '800', color: theme.text },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: theme.green,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyActionText: { color: '#fff', fontWeight: '800' },

  medCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
  },
  medCardPressed: { backgroundColor: theme.greenLight },
  strip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  medBody: { flex: 1, padding: 16, paddingLeft: 21, gap: 6 },
  medName: { fontSize: TEXT.md, fontWeight: '800', color: theme.text },
  medNameTaken: { color: theme.textMuted, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  metaText: { fontSize: TEXT.sm, color: theme.textSecondary },
  metaDot: { color: theme.textMuted },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.greenMuted,
    backgroundColor: theme.greenLight,
  },
  chipText: { fontSize: TEXT.xs, fontWeight: '700', color: theme.green },
  medControls: { alignItems: 'center', gap: 10, paddingRight: 14 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

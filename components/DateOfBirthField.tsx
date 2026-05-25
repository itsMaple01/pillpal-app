import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ageFromDateOfBirth(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export function formatDobDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Select date of birth';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

interface Props {
  value: string | null;
  onChange: (isoDate: string) => void;
}

export default function DateOfBirthField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? 1990);
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? 0);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, (): null => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pick = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(d.toISOString().slice(0, 10));
    setOpen(false);
  };

  return (
    <View style={s.group}>
      <View style={s.labelRow}>
        <AppIcon name="calendar-outline" size={16} color={theme.green} />
        <Text style={s.label}>Date of birth</Text>
      </View>
      <TouchableOpacity style={s.field} onPress={() => setOpen(true)}>
        <Text style={[s.fieldText, !value && s.placeholder]}>
          {value ? formatDobDisplay(value) : 'Tap to choose your birth date'}
        </Text>
        <AppIcon name="chevron-down" size={18} color={theme.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Date of birth</Text>
            <View style={s.nav}>
              <TouchableOpacity onPress={() => setViewMonth(m => (m <= 0 ? 11 : m - 1))}>
                <Text style={s.navBtn}>‹</Text>
              </TouchableOpacity>
              <Text style={s.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={() => setViewMonth(m => (m >= 11 ? 0 : m + 1))}>
                <Text style={s.navBtn}>›</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {Array.from({ length: 80 }, (_, i) => 2026 - i).map(y => (
                <TouchableOpacity
                  key={y}
                  style={[s.yearChip, viewYear === y && s.yearChipOn]}
                  onPress={() => setViewYear(y)}
                >
                  <Text style={[s.yearChipText, viewYear === y && s.yearChipTextOn]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.grid}>
              {cells.map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.cell}
                  disabled={day === null}
                  onPress={() => day && pick(day)}
                >
                  {day !== null && (
                    <Text style={s.cellText}>{day}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.doneBtn} onPress={() => setOpen(false)}>
              <Text style={s.doneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  group: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.bg,
  },
  fieldText: { fontSize: 15, color: theme.text, flex: 1 },
  placeholder: { color: theme.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  navBtn: { fontSize: 28, color: theme.green, paddingHorizontal: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: theme.text },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.bg,
    marginRight: 8,
  },
  yearChipOn: { backgroundColor: theme.greenLight },
  yearChipText: { fontSize: 13, color: theme.textSecondary },
  yearChipTextOn: { color: theme.green, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 15, color: theme.text },
  doneBtn: {
    marginTop: 12,
    backgroundColor: theme.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

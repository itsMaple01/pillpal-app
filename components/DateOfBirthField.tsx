import { useState, useEffect, useRef, type ComponentProps } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, Animated,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  const yearScrollRef = useRef<ScrollView>(null);
  const hintAnim = useRef(new Animated.Value(0)).current;

  const years = Array.from({ length: 80 }, (_, i) => 2026 - i);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, (): null => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  useEffect(() => {
    if (!open) return;
    const idx = years.indexOf(viewYear);
    if (idx >= 0) {
      setTimeout(() => {
        yearScrollRef.current?.scrollTo({ x: Math.max(0, idx * 56 - 40), animated: false });
        Animated.sequence([
          Animated.timing(hintAnim, { toValue: -28, duration: 400, useNativeDriver: true }),
          Animated.timing(hintAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 120);
    }
  }, [open]);

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

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable style={s.floatingCard} onPress={e => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Date of birth</Text>
            <Text style={s.hint}>Swipe years left or right</Text>

            <Animated.View style={{ transform: [{ translateX: hintAnim }] }}>
              <ScrollView
                ref={yearScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.yearScroll}
                contentContainerStyle={{ paddingHorizontal: 4 }}
              >
                {years.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[s.yearChip, viewYear === y && s.yearChipOn]}
                    onPress={() => setViewYear(y)}
                  >
                    <Text style={[s.yearChipText, viewYear === y && s.yearChipTextOn]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>

            <View style={s.nav}>
              <TouchableOpacity
                onPress={() => {
                  if (viewMonth <= 0) { setViewYear(y => y - 1); setViewMonth(11); }
                  else setViewMonth(m => m - 1);
                }}
              >
                <AppIcon name="chevron-back" size={22} color={theme.green} />
              </TouchableOpacity>
              <Text style={s.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (viewMonth >= 11) { setViewYear(y => y + 1); setViewMonth(0); }
                  else setViewMonth(m => m + 1);
                }}
              >
                <AppIcon name="chevron-forward" size={22} color={theme.green} />
              </TouchableOpacity>
            </View>

            <View style={s.dayHeaderRow}>
              {DAY_HEADERS.map((d, i) => (
                <Text key={i} style={s.dayHeader}>{d}</Text>
              ))}
            </View>
            <View style={s.grid}>
              {cells.map((day, i) => {
                const isSel = selected
                  && day === selected.getDate()
                  && viewMonth === selected.getMonth()
                  && viewYear === selected.getFullYear();
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.cell, isSel && s.cellOn]}
                    disabled={day === null}
                    onPress={() => day && pick(day)}
                  >
                    {day !== null && (
                      <Text style={[s.cellText, isSel && s.cellTextOn]}>{day}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 40, 22, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  floatingCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  hint: { fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 10 },
  yearScroll: { marginBottom: 12, maxHeight: 44 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.bg,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  yearChipOn: { backgroundColor: theme.greenLight, borderColor: theme.green },
  yearChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  yearChipTextOn: { color: theme.green, fontWeight: '800' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: theme.text },
  dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '700', color: theme.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cellOn: { backgroundColor: theme.green },
  cellText: { fontSize: 15, color: theme.text },
  cellTextOn: { color: '#fff', fontWeight: '800' },
  doneBtn: {
    marginTop: 14,
    backgroundColor: theme.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { theme } from '@/lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface Props {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  /** Dates (yyyy-mm-dd) that have scheduled meds — dots only for today/future */
  markedDates?: string[];
}

export default function WeekCalendarStrip({ selectedDate, onSelectDate, markedDates = [] }: Props) {
  const today = startOfDay(new Date());
  const [anchor, setAnchor] = useState(startOfDay(selectedDate));
  const [pickerOpen, setPickerOpen] = useState(false);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i));
    }
    return days;
  }, [anchor]);

  const markedSet = useMemo(() => new Set(markedDates), [markedDates]);

  const showDot = (d: Date) => {
    if (d < today) return false;
    const key = d.toISOString().slice(0, 10);
    return markedSet.has(key);
  };

  const monthOptions = useMemo(() => {
    const list: { label: string; date: Date }[] = [];
    const base = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = -2; i <= 10; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      list.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, date: d });
    }
    return list;
  }, [today]);

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.monthBtn} onPress={() => setPickerOpen(true)}>
        <Text style={s.monthText}>
          {MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
        </Text>
        <Text style={s.chevron}>▾</Text>
      </TouchableOpacity>

      <View style={s.weekRow}>
        {weekDays.map(d => {
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const past = d < today;
          return (
            <TouchableOpacity
              key={d.toISOString()}
              style={[s.dayCell, selected && s.dayCellSelected]}
              onPress={() => onSelectDate(d)}
            >
              <Text style={[s.dayLabel, past && s.pastText]}>{DAY_LABELS[d.getDay()]}</Text>
              <Text style={[s.dayNum, selected && s.dayNumSelected, past && s.pastText]}>
                {isToday ? 'Today' : d.getDate()}
              </Text>
              {showDot(d) && <View style={s.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.navRow}>
        <TouchableOpacity
          onPress={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 7))}
        >
          <Text style={s.navBtn}>‹ Prev week</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { const t = today; setAnchor(t); onSelectDate(t); }}>
          <Text style={s.todayLink}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7))}
        >
          <Text style={s.navBtn}>Next week ›</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={s.modalBg} onPress={() => setPickerOpen(false)}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Jump to month</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {monthOptions.map(m => (
                <TouchableOpacity
                  key={m.label}
                  style={s.monthOption}
                  onPress={() => {
                    setAnchor(startOfDay(m.date));
                    setPickerOpen(false);
                  }}
                >
                  <Text style={s.monthOptionText}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  monthText: { fontSize: 17, fontWeight: '800', color: theme.text },
  chevron: { fontSize: 14, color: theme.textSecondary },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 64,
  },
  dayCellSelected: { backgroundColor: theme.greenLight },
  dayLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  dayNum: { fontSize: 15, fontWeight: '800', color: theme.text, marginTop: 4 },
  dayNumSelected: { color: theme.green },
  pastText: { color: theme.textMuted, opacity: 0.65 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.green,
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  navBtn: { fontSize: 12, fontWeight: '600', color: theme.green },
  todayLink: { fontSize: 12, fontWeight: '800', color: theme.greenDark },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: theme.text },
  monthOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  monthOptionText: { fontSize: 15, color: theme.text },
});

import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions, TextInput,
  Alert, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

interface Props { onLogout: () => void; uid: string; }

const GREEN = '#2d7a3a';
const GREEN_DARK = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

type PatientTab = 'Home' | 'Add' | 'Calendar' | 'Manage';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string;
  taken: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Every other day', 'Weekly'];
const TIMES = ['Morning (8:00 AM)', 'Afternoon (12:00 PM)', 'Evening (6:00 PM)', 'Night (9:00 PM)'];

export default function PatientDashboard({ onLogout, uid }: Props) {
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<PatientTab>('Home');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Add form state
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [time, setTime] = useState('');
  const [showFreqPicker, setShowFreqPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const today = new Date();
  const todayMeds = medications.filter(m => true); // in real app, filter by date
  const takenToday = todayMeds.filter(m => m.taken).length;

  const handleAddMed = () => {
    if (!medName.trim()) { Alert.alert('Required', 'Please enter a medication name.'); return; }
    if (!frequency) { Alert.alert('Required', 'Please select a frequency.'); return; }
    if (!time) { Alert.alert('Required', 'Please select a time.'); return; }
    const newMed: Medication = {
      id: Date.now().toString(),
      name: medName.trim(),
      dosage: dosage.trim() || 'As prescribed',
      frequency,
      time,
      taken: false,
    };
    setMedications(prev => [...prev, newMed]);
    setMedName(''); setDosage(''); setFrequency(''); setTime('');
    Alert.alert('✅ Added', `${newMed.name} has been added to your reminders.`);
    setActiveTab('Home');
  };

  const handleToggleTaken = (id: string) => {
    setMedications(prev => prev.map(m => m.id === id ? { ...m, taken: !m.taken } : m));
  };

  const handleDeleteMed = (id: string) => {
    Alert.alert('Delete Medication', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setMedications(prev => prev.filter(m => m.id !== id)) }
    ]);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const TABS: { icon: string; label: PatientTab }[] = [
    { icon: '🏠', label: 'Home' },
    { icon: '➕', label: 'Add' },
    { icon: '📅', label: 'Calendar' },
    { icon: '⚙️', label: 'Manage' },
  ];

  // ── HOME SCREEN ──
  const HomeScreen = () => (
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet ? styles.bodyContentTablet : undefined]}>
      <View style={styles.greetingCard}>
        <Text style={styles.greetingIcon}>☀️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingText}>Good day, Patient!</Text>
          <Text style={styles.greetingSub}>Stay on track with your medication today.</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💊</Text>
          <Text style={styles.statNum}>{todayMeds.length}</Text>
          <Text style={styles.statLabel}>Today's Meds</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statNum}>{takenToday}</Text>
          <Text style={styles.statLabel}>Taken Today</Text>
        </View>
      </View>

      <View style={styles.remindersCard}>
        <View style={styles.remindersHeader}>
          <Text style={styles.remindersTitle}>📋 Today's Reminders</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{todayMeds.length} total</Text>
          </View>
        </View>
        {todayMeds.length === 0 ? (
          <Text style={styles.emptyText}>No reminders scheduled for today</Text>
        ) : (
          todayMeds.map(med => (
            <View key={med.id} style={styles.medRow}>
              <TouchableOpacity
                style={[styles.medCheck, med.taken ? styles.medCheckDone : undefined]}
                onPress={() => handleToggleTaken(med.id)}
              >
                {med.taken && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.medName, med.taken ? styles.medNameDone : undefined]}>{med.name}</Text>
                <Text style={styles.medSub}>{med.dosage} · {med.time.split(' ')[0]}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteMed(med.id)}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.actionCard} onPress={() => setActiveTab('Add')}>
        <Text style={styles.actionIcon}>➕</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Set Reminder</Text>
          <Text style={styles.actionSub}>Add a new medication</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionCard, styles.actionCardWhite]} onPress={() => setActiveTab('Calendar')}>
        <Text style={styles.actionIcon}>📅</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: '#222' }]}>Calendar</Text>
          <Text style={[styles.actionSub, { color: '#888' }]}>View your schedule</Text>
        </View>
        <Text style={[styles.arrow, { color: '#222' }]}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── ADD SCREEN ──
  const AddScreen = () => (
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet ? styles.bodyContentTablet : undefined]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>➕ Add Medication</Text>
        <Text style={styles.sectionSub}>Fill in the details below to set a reminder</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Medication Name *</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. Metformin, Aspirin..."
          placeholderTextColor="#aaa"
          value={medName}
          onChangeText={setMedName}
        />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Dosage</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. 500mg, 1 tablet..."
          placeholderTextColor="#aaa"
          value={dosage}
          onChangeText={setDosage}
        />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Frequency *</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowFreqPicker(true)}>
          <Text style={[styles.pickerText, !frequency ? { color: '#aaa' } : undefined]}>
            {frequency || 'Select frequency...'}
          </Text>
          <Text style={styles.pickerArrow}>▾</Text>
        </TouchableOpacity>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Time *</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
          <Text style={[styles.pickerText, !time ? { color: '#aaa' } : undefined]}>
            {time || 'Select time...'}
          </Text>
          <Text style={styles.pickerArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleAddMed}>
        <Text style={styles.submitText}>✅ Add Medication</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveTab('Home')}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      {/* Frequency Picker Modal */}
      <Modal visible={showFreqPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowFreqPicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Frequency</Text>
            {FREQUENCIES.map(f => (
              <TouchableOpacity key={f} style={[styles.modalOption, frequency === f ? styles.modalOptionActive : undefined]}
                onPress={() => { setFrequency(f); setShowFreqPicker(false); }}>
                <Text style={[styles.modalOptionText, frequency === f ? styles.modalOptionTextActive : undefined]}>{f}</Text>
                {frequency === f && <Text style={{ color: GREEN }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTimePicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Time</Text>
            {TIMES.map(t => (
              <TouchableOpacity key={t} style={[styles.modalOption, time === t ? styles.modalOptionActive : undefined]}
                onPress={() => { setTime(t); setShowTimePicker(false); }}>
                <Text style={[styles.modalOptionText, time === t ? styles.modalOptionTextActive : undefined]}>{t}</Text>
                {time === t && <Text style={{ color: GREEN }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );

  // ── CALENDAR SCREEN ──
  const CalendarScreen = () => {
    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarMonth);
    const cells: (number | null)[] = [
      ...Array.from({ length: firstDay }, (): null => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    const isToday = (d: number) =>
      d === today.getDate() &&
      calendarMonth.getMonth() === today.getMonth() &&
      calendarMonth.getFullYear() === today.getFullYear();
    const isSelected = (d: number) =>
      d === selectedDate.getDate() &&
      calendarMonth.getMonth() === selectedDate.getMonth() &&
      calendarMonth.getFullYear() === selectedDate.getFullYear();

    return (
      <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet ? styles.bodyContentTablet : undefined]}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarNav}>
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
              <Text style={styles.calNavBtn}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</Text>
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
              <Text style={styles.calNavBtn}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calDaysRow}>
            {DAYS.map(d => <Text key={d} style={styles.calDayLabel}>{d}</Text>)}
          </View>

          <View style={styles.calGrid}>
            {cells.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.calCell,
                  day !== null && isToday(day) ? styles.calCellToday : undefined,
                  day !== null && isSelected(day) ? styles.calCellSelected : undefined,
                ]}
                onPress={() => {
                  if (day !== null) setSelectedDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                }}
                disabled={day === null}
              >
                <Text style={[
                  styles.calCellText,
                  day !== null && isToday(day) ? styles.calCellTextToday : undefined,
                  day !== null && isSelected(day) ? styles.calCellTextSelected : undefined,
                ]}>
                  {day !== null ? String(day) : ''}
                </Text>
                {day !== null && medications.length > 0 ? (
                  <View style={styles.calDot} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedDate.toDateString() === today.toDateString() ? "Today's" : MONTHS[selectedDate.getMonth()] + ' ' + selectedDate.getDate()} Schedule
          </Text>
        </View>

        {medications.length === 0 ? (
          <View style={styles.calEmptyState}>
            <Text style={styles.calEmptyIcon}>📭</Text>
            <Text style={styles.calEmptyText}>No medications scheduled</Text>
            <TouchableOpacity style={styles.calAddBtn} onPress={() => setActiveTab('Add')}>
              <Text style={styles.calAddBtnText}>+ Add Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          medications.map(med => (
            <View key={med.id} style={styles.scheduleRow}>
              <View style={[styles.scheduleTime, { backgroundColor: med.taken ? GREEN_LIGHT : '#fff3e0' }]}>
                <Text style={[styles.scheduleTimeText, { color: med.taken ? GREEN : '#e65100' }]}>
                  {med.time.split(' ')[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleMedName}>{med.name}</Text>
                <Text style={styles.scheduleMedSub}>{med.dosage} · {med.frequency}</Text>
              </View>
              <View style={[styles.scheduleBadge, { backgroundColor: med.taken ? GREEN_LIGHT : '#fff3e0' }]}>
                <Text style={[styles.scheduleBadgeText, { color: med.taken ? GREEN : '#e65100' }]}>
                  {med.taken ? 'Taken' : 'Pending'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // ── MANAGE SCREEN ──
  const ManageScreen = () => (
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet ? styles.bodyContentTablet : undefined]}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>P</Text>
        </View>
        <Text style={styles.profileName}>Patient</Text>
        <Text style={styles.profileUid}>ID: {uid?.slice(0, 12)}...</Text>
      </View>

      <Text style={styles.manageSection}>Essentials</Text>

      {[
        { icon: '💊', label: 'Medications', sub: `${medications.length} active`, onPress: () => setActiveTab('Home') },
        { icon: '📊', label: 'Report', sub: `${takenToday} taken today` },
        { icon: '📅', label: 'Schedule & Calendar', sub: 'View all reminders', onPress: () => setActiveTab('Calendar') },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={styles.manageRow} onPress={item.onPress}>
          <View style={styles.manageIconBox}>
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageRowLabel}>{item.label}</Text>
            <Text style={styles.manageRowSub}>{item.sub}</Text>
          </View>
          <Text style={styles.manageArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.manageSection}>Account</Text>

      {[
        { icon: '🔗', label: 'Linked Caretaker', sub: 'No caretaker linked yet' },
        { icon: '🔔', label: 'Notification Settings', sub: 'Manage alerts' },
        { icon: '🔒', label: 'Privacy & Security', sub: 'Manage your data' },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={styles.manageRow}>
          <View style={styles.manageIconBox}>
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageRowLabel}>{item.label}</Text>
            <Text style={styles.manageRowSub}>{item.sub}</Text>
          </View>
          <Text style={styles.manageArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutRowBtn} onPress={onLogout}>
        <Text style={styles.logoutRowIcon}>🚪</Text>
        <Text style={styles.logoutRowText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>PillPal v1.0.0</Text>
    </ScrollView>
  );

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home': return <HomeScreen />;
      case 'Add': return <AddScreen />;
      case 'Calendar': return <CalendarScreen />;
      case 'Manage': return <ManageScreen />;
    }
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.headerTitle, isTablet ? styles.headerTitleTablet : undefined]}>
          💊 Medicine Reminder
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {renderScreen()}

      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.label} style={styles.tabItem} onPress={() => setActiveTab(tab.label)}>
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.label ? { color: GREEN, fontWeight: '700' } : undefined]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerTitleTablet: { fontSize: 20 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12, paddingBottom: 32 },
  bodyContentTablet: { padding: 24, maxWidth: 900, alignSelf: 'center', width: '100%' },

  // Home
  greetingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  greetingIcon: { fontSize: 32 },
  greetingText: { fontSize: 16, fontWeight: '700', color: '#222' },
  greetingSub: { fontSize: 13, color: '#666', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statNum: { fontSize: 28, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  remindersCard: { backgroundColor: GREEN, borderRadius: 16, padding: 16 },
  remindersHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  remindersTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 12 },
  emptyText: {
    color: 'rgba(255,255,255,0.75)', textAlign: 'center',
    fontSize: 14, paddingVertical: 16,
  },
  medRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  medCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  medCheckDone: { backgroundColor: 'rgba(255,255,255,0.3)', borderColor: '#fff' },
  medName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  medNameDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  medSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },
  actionCard: {
    backgroundColor: GREEN, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  actionCardWhite: { backgroundColor: '#fff' },
  actionIcon: { fontSize: 24 },
  actionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  arrow: { color: '#fff', fontSize: 18 },

  // Add screen
  sectionHeader: { marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#222' },
  sectionSub: { fontSize: 13, color: '#888', marginTop: 2 },
  formCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 8 },
  fieldInput: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#222',
    backgroundColor: '#fafafa',
  },
  pickerBtn: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fafafa',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pickerText: { fontSize: 15, color: '#222' },
  pickerArrow: { fontSize: 16, color: '#aaa' },
  submitBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
    shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#888', fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#222', marginBottom: 16 },
  modalOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalOptionActive: { backgroundColor: GREEN_LIGHT, borderRadius: 8, paddingHorizontal: 8 },
  modalOptionText: { fontSize: 15, color: '#333' },
  modalOptionTextActive: { color: GREEN, fontWeight: '700' },

  // Calendar screen
  calendarCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  calendarNav: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  calNavBtn: { fontSize: 28, color: GREEN, fontWeight: '300', paddingHorizontal: 8 },
  calMonthLabel: { fontSize: 16, fontWeight: '800', color: '#222' },
  calDaysRow: { flexDirection: 'row', marginBottom: 8 },
  calDayLabel: {
    flex: 1, textAlign: 'center', fontSize: 12,
    fontWeight: '700', color: '#aaa',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  calCellToday: { backgroundColor: GREEN_LIGHT },
  calCellSelected: { backgroundColor: GREEN },
  calCellText: { fontSize: 14, color: '#333' },
  calCellTextToday: { color: GREEN, fontWeight: '800' },
  calCellTextSelected: { color: '#fff', fontWeight: '800' },
  calDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: GREEN, marginTop: 2,
  },
  calEmptyState: { alignItems: 'center', paddingVertical: 32 },
  calEmptyIcon: { fontSize: 40, marginBottom: 12 },
  calEmptyText: { fontSize: 15, color: '#aaa', marginBottom: 16 },
  calAddBtn: {
    backgroundColor: GREEN, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  calAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scheduleRow: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  scheduleTime: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 70, alignItems: 'center',
  },
  scheduleTimeText: { fontSize: 12, fontWeight: '700' },
  scheduleMedName: { fontSize: 14, fontWeight: '700', color: '#222' },
  scheduleMedSub: { fontSize: 12, color: '#888', marginTop: 2 },
  scheduleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  scheduleBadgeText: { fontSize: 11, fontWeight: '700' },

  // Manage screen
  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  profileAvatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#222' },
  profileUid: { fontSize: 12, color: '#aaa', marginTop: 4 },
  manageSection: {
    fontSize: 12, fontWeight: '700', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4,
  },
  manageRow: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  manageIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  manageRowLabel: { fontSize: 15, fontWeight: '700', color: '#222' },
  manageRowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  manageArrow: { fontSize: 20, color: '#ccc' },
  logoutRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1.5, borderColor: '#ffcdd2',
  },
  logoutRowIcon: { fontSize: 20 },
  logoutRowText: { fontSize: 15, fontWeight: '700', color: '#c62828' },
  versionText: { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 24 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
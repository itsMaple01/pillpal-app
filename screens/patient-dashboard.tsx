import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions,
  Alert, Modal, Platform, Switch,
} from 'react-native';
import { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, deleteDoc,
  doc, serverTimestamp, onSnapshot,
  query, where, updateDoc,
} from 'firebase/firestore';
import { addMedication, getMedications, deleteMedication } from '@/api/index';
import LogoutModal from '@/components/LogoutModal';
import MedicationsScreen from '@/components/MedicationsScreen';

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';
const RED         = '#d32f2f';
const RED_LIGHT   = '#fdecea';

interface Props { onLogout: () => void; uid: string; }

interface Medication {
  id: string;
  firestoreId?: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string;
  taken: boolean;
}

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const FREQUENCIES = [
  { label: 'Once daily',        sub: 'Appears every day starting today.' },
  { label: 'Twice daily',       sub: 'Appears twice a day starting today.' },
  { label: 'Three times daily', sub: 'Appears three times a day.' },
  { label: 'Every other day',   sub: 'Appears every 2 days.' },
  { label: 'Weekly',            sub: 'Appears once a week.' },
];
const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];

type PatientTab = 'Home' | 'Add' | 'Calendar' | 'Medications' | 'Manage';
const TABS: { icon: string; label: PatientTab }[] = [
  { icon: '🏠', label: 'Home' },
  { icon: '➕', label: 'Add' },
  { icon: '📅', label: 'Calendar' },
  { icon: '💊', label: 'Medications' },
  { icon: '⚙️', label: 'Manage' },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// ─────────────────────────────────────────────────────────────
// ADD MEDICATION MODAL
// ─────────────────────────────────────────────────────────────
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (med: Omit<Medication, 'id' | 'taken'>) => Promise<void>;
  saving: boolean;
}

function AddMedicationModal({ visible, onClose, onSave, saving }: AddModalProps) {
  const [name,           setName]           = useState('');
  const [dosage,         setDosage]         = useState('');
  const [freqIdx,        setFreqIdx]        = useState(0);
  const [showFreqDrop,   setShowFreqDrop]   = useState(false);
  const [showEndDate,    setShowEndDate]    = useState(false);
  const [calMonth,       setCalMonth]       = useState(new Date());
  const [endDate,        setEndDate]        = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hour,           setHour]           = useState('08');
  const [minute,         setMinute]         = useState('00');
  const [ampm,           setAmpm]           = useState<'AM' | 'PM'>('AM');

  const today = new Date();

  const reset = () => {
    setName(''); setDosage(''); setFreqIdx(0);
    setShowFreqDrop(false); setShowEndDate(false);
    setEndDate(null); setShowTimePicker(false);
    setHour('08'); setMinute('00'); setAmpm('AM');
    setCalMonth(new Date());
  };

  const handleClose = () => { reset(); onClose(); };

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Required', 'Please enter a medication name.'); return; }
    await onSave({
      name:      name.trim(),
      dosage:    dosage.trim() || 'As prescribed',
      frequency: FREQUENCIES[freqIdx].label,
      time:      `${hour}:${minute} ${ampm}`,
    });
    reset();
  };

  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const cells: (number | null)[] = [
    ...Array.from({ length: getFirstDay(y, m) }, (): null => null),
    ...Array.from({ length: getDaysInMonth(y, m) }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>

          <View style={ms.handle} />

          <View style={ms.headerArea}>
            <Text style={ms.pillIcon}>💊</Text>
            <Text style={ms.title}>Set Reminder</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Medicine Name */}
            <View style={ms.fieldGroup}>
              <View style={ms.labelRow}>
                <Text style={ms.labelIcon}>🩺</Text>
                <Text style={ms.label}>MEDICINE NAME *</Text>
              </View>
              <TextInput
                style={ms.input}
                placeholder="Enter medicine name"
                placeholderTextColor="#c0c0c0"
                value={name}
                onChangeText={setName}
                autoCorrect={false}
                autoCapitalize="words"
              />
            </View>

            {/* Dosage */}
            <View style={ms.fieldGroup}>
              <View style={ms.labelRow}>
                <Text style={ms.labelIcon}>🏷️</Text>
                <Text style={ms.label}>DOSAGE</Text>
              </View>
              <TextInput
                style={ms.input}
                placeholder="e.g., 1 tablet, 500mg, 5ml"
                placeholderTextColor="#c0c0c0"
                value={dosage}
                onChangeText={setDosage}
                autoCorrect={false}
              />
            </View>

            {/* Frequency */}
            <View style={ms.fieldGroup}>
              <View style={ms.labelRow}>
                <Text style={ms.labelIcon}>🔄</Text>
                <Text style={ms.label}>FREQUENCY</Text>
              </View>
              <TouchableOpacity
                style={[ms.dropdown, showFreqDrop && ms.dropdownOpen]}
                onPress={() => setShowFreqDrop(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={ms.dropdownText}>{FREQUENCIES[freqIdx].label}</Text>
                <Text style={ms.dropdownArrow}>{showFreqDrop ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showFreqDrop && (
                <View style={ms.dropdownList}>
                  {FREQUENCIES.map((f, i) => (
                    <TouchableOpacity
                      key={f.label}
                      style={[
                        ms.dropdownItem,
                        i === freqIdx && ms.dropdownItemActive,
                        i === FREQUENCIES.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => { setFreqIdx(i); setShowFreqDrop(false); }}
                    >
                      <Text style={[ms.dropdownItemText, i === freqIdx && ms.dropdownItemTextActive]}>
                        {f.label}
                      </Text>
                      {i === freqIdx && <Text style={{ color: GREEN, fontSize: 14 }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={ms.freqSubRow}>
                <Text style={ms.freqSubIcon}>📅</Text>
                <Text style={ms.freqSub}>{FREQUENCIES[freqIdx].sub}</Text>
              </View>
            </View>

            {/* End Date */}
            <View style={ms.fieldGroup}>
              {!showEndDate ? (
                <TouchableOpacity
                  style={ms.endDateBtn}
                  onPress={() => setShowEndDate(true)}
                  activeOpacity={0.8}
                >
                  <Text style={ms.endDateIcon}>📅</Text>
                  <Text style={ms.endDateText}>Set end date (optional)</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={ms.removeEndDateBtn}
                    onPress={() => { setShowEndDate(false); setEndDate(null); }}
                    activeOpacity={0.8}
                  >
                    <Text style={ms.endDateIcon}>📅</Text>
                    <Text style={ms.removeEndDateText}>Remove end date</Text>
                  </TouchableOpacity>

                  <View style={ms.calBox}>
                    <Text style={ms.calBoxLabel}>REMIND ME UNTIL</Text>
                    <View style={[ms.dateDisplay, !!endDate && ms.dateDisplayActive]}>
                      <Text style={ms.endDateIcon}>📅</Text>
                      <Text style={[ms.dateDisplayText, !endDate && { color: '#aaa' }]}>
                        {endDate
                          ? `${MONTHS[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`
                          : 'Select end date'}
                      </Text>
                      <Text style={ms.dropdownArrow}>▲</Text>
                    </View>

                    <View style={ms.calendar}>
                      <View style={ms.calNav}>
                        <TouchableOpacity onPress={() => setCalMonth(new Date(y, m - 1, 1))}>
                          <Text style={ms.calNavBtn}>‹</Text>
                        </TouchableOpacity>
                        <Text style={ms.calMonthLabel}>{MONTHS[m]} {y}</Text>
                        <TouchableOpacity onPress={() => setCalMonth(new Date(y, m + 1, 1))}>
                          <Text style={ms.calNavBtn}>›</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={ms.calDayRow}>
                        {['S','M','T','W','T','F','S'].map((d, i) => (
                          <Text key={i} style={ms.calDayLabel}>{d}</Text>
                        ))}
                      </View>
                      <View style={ms.calGrid}>
                        {cells.map((day, i) => {
                          const isToday    = day === today.getDate() && m === today.getMonth() && y === today.getFullYear();
                          const isSelected = endDate
                            ? day === endDate.getDate() && m === endDate.getMonth() && y === endDate.getFullYear()
                            : false;
                          const isPast = day !== null &&
                            new Date(y, m, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          return (
                            <TouchableOpacity
                              key={i}
                              style={[
                                ms.calCell,
                                isToday    && ms.calCellToday,
                                isSelected && ms.calCellSelected,
                              ]}
                              onPress={() => day !== null && !isPast && setEndDate(new Date(y, m, day))}
                              disabled={day === null || isPast}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                ms.calCellText,
                                isPast     && { color: '#d0d0d0' },
                                isToday    && ms.calCellTextToday,
                                isSelected && ms.calCellTextSelected,
                              ]}>
                                {day ?? ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Time Picker */}
            <View style={ms.fieldGroup}>
              <View style={ms.labelRow}>
                <Text style={ms.labelIcon}>⏰</Text>
                <Text style={ms.label}>TIME *</Text>
              </View>
              <TouchableOpacity
                style={[ms.dropdown, showTimePicker && ms.dropdownOpen]}
                onPress={() => setShowTimePicker(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={ms.timeIcon}>🕐</Text>
                <Text style={[ms.dropdownText, { flex: 1 }]}>
                  {showTimePicker ? 'Select time' : `${hour}:${minute} ${ampm}`}
                </Text>
                <Text style={ms.dropdownArrow}>{showTimePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <View style={ms.timePicker}>
                  <Text style={ms.timePickerTitle}>PICK A TIME</Text>
                  <View style={ms.timePickerRow}>
                    <View style={ms.timeCol}>
                      <Text style={ms.timeColLabel}>HR</Text>
                      <ScrollView style={ms.timeScroll} showsVerticalScrollIndicator={false}>
                        {HOURS.map(h => (
                          <TouchableOpacity
                            key={h}
                            style={[ms.timeItem, hour === h && ms.timeItemActive]}
                            onPress={() => setHour(h)}
                          >
                            <Text style={[ms.timeItemText, hour === h && ms.timeItemTextActive]}>{h}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <Text style={ms.timeSep}>:</Text>
                    <View style={ms.timeCol}>
                      <Text style={ms.timeColLabel}>MIN</Text>
                      <ScrollView style={ms.timeScroll} showsVerticalScrollIndicator={false}>
                        {MINUTES.map(mn => (
                          <TouchableOpacity
                            key={mn}
                            style={[ms.timeItem, minute === mn && ms.timeItemActive]}
                            onPress={() => setMinute(mn)}
                          >
                            <Text style={[ms.timeItemText, minute === mn && ms.timeItemTextActive]}>{mn}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={ms.ampmCol}>
                      {(['AM', 'PM'] as const).map(p => (
                        <TouchableOpacity
                          key={p}
                          style={[ms.ampmBtn, ampm === p && ms.ampmBtnActive]}
                          onPress={() => setAmpm(p)}
                        >
                          <Text style={[ms.ampmText, ampm === p && ms.ampmTextActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity style={ms.timeDoneBtn} onPress={() => setShowTimePicker(false)}>
                    <Text style={ms.timeDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </ScrollView>

          <View style={ms.footer}>
            <TouchableOpacity style={ms.cancelBtn} onPress={handleClose} activeOpacity={0.75}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ms.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={ms.saveText}>{saving ? 'Saving...' : 'Save Reminder'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// MEDICATIONS CARD  (used on Home tab)
// ─────────────────────────────────────────────────────────────
interface MedCardProps {
  medications: Medication[];
  onToggleTaken: (id: string) => void;
  onDelete: (id: string) => void;
  onAddPress: () => void;
}

function MedicationsCard({ medications, onToggleTaken, onDelete, onAddPress }: MedCardProps) {
  const pending = medications.filter(m => !m.taken).length;
  const taken   = medications.filter(m =>  m.taken).length;

  return (
    <View style={mc.card}>
      <View style={mc.header}>
        <View style={mc.headerLeft}>
          <Text style={mc.headerIcon}>💊</Text>
          <View>
            <Text style={mc.headerTitle}>Medications</Text>
            <Text style={mc.headerSub}>CURRENTLY TAKING</Text>
          </View>
        </View>
        <View style={mc.countBadge}>
          <Text style={mc.countNum}>{medications.length}</Text>
          <Text style={mc.countLabel}>total</Text>
        </View>
      </View>

      <View style={mc.statsRow}>
        <View style={[mc.statPill, { backgroundColor: GREEN_LIGHT }]}>
          <Text style={[mc.statNum, { color: GREEN }]}>{pending}</Text>
          <Text style={[mc.statLabel, { color: GREEN }]}>Pending</Text>
        </View>
        <View style={[mc.statPill, { backgroundColor: '#f5f5f5' }]}>
          <Text style={[mc.statNum, { color: '#888' }]}>{taken}</Text>
          <Text style={[mc.statLabel, { color: '#888' }]}>Taken</Text>
        </View>
      </View>

      {medications.length === 0 ? (
        <View style={mc.empty}>
          <Text style={mc.emptyIcon}>📭</Text>
          <Text style={mc.emptyText}>No medications added yet</Text>
          <TouchableOpacity style={mc.emptyAddBtn} onPress={onAddPress}>
            <Text style={mc.emptyAddText}>+ Add Medication</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={mc.list}>
          {medications.map((med, i) => (
            <View key={med.id} style={[mc.medRow, i === 0 && mc.medRowFirst]}>
              <Switch
                value={med.taken}
                onValueChange={() => onToggleTaken(med.id)}
                trackColor={{ false: '#f5c842', true: GREEN }}
                thumbColor="#fff"
              />
              <View style={mc.medInfo}>
                <Text style={[mc.medName, med.taken && mc.medNameTaken]}>{med.name}</Text>
                <Text style={mc.medSub}>
                  {med.dosage !== 'As prescribed' ? med.dosage : 'Take as needed'} · {med.time}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onDelete(med.id)} style={mc.deleteBtn}>
                <Text style={mc.deleteArrow}>›</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {medications.length > 0 && (
        <TouchableOpacity style={mc.addBtn} onPress={onAddPress}>
          <Text style={mc.addBtnText}>+ Add Medication</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PATIENT DASHBOARD
// ─────────────────────────────────────────────────────────────
export default function PatientDashboard({ onLogout, uid }: Props) {
  const { width } = Dimensions.get('window');
  const isTablet  = width >= 768;
  const insets    = useSafeAreaInsets();

  const [activeTab,     setActiveTab]     = useState<PatientTab>('Home');
  const [medications,   setMedications]   = useState<Medication[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showLogout,    setShowLogout]    = useState(false);
  const [selectedDate,  setSelectedDate]  = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // ── Ref so callbacks always see current medications without stale closures ──
  const medicationsRef = useRef<Medication[]>([]);
  useEffect(() => { medicationsRef.current = medications; }, [medications]);

  const today      = new Date();
  const takenToday = medications.filter(m => m.taken).length;

  // ── Load medications from Neon + attach Firestore real-time listener ──
  useEffect(() => {
    if (!uid) return;

    // 1. Fetch initial data from Neon (fast first paint)
    getMedications(uid)
      .then(res => {
        const rows: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setMedications(rows.map((row: any) => ({
          id:          String(row.id),
          name:        row.name        ?? '',
          dosage:      row.dosage      ?? 'As prescribed',
          frequency:   row.frequency   ?? '',
          time:        row.time        ?? row.program ?? '',
          taken:       row.taken       ?? false,
          firestoreId: row.firestore_id ?? undefined,
        })));
      })
      .catch(err => console.error('Failed to load medications:', err));

    // 2. Attach real-time Firestore listener — fires on every device instantly
    //    whenever any reminder document for this user changes.
    const q = query(
      collection(db, 'reminders'),
      where('uid', '==', uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach(change => {
          // Only care about updates (add handled locally, delete handled locally)
          if (change.type === 'modified') {
            const data = change.doc.data();
            setMedications(prev =>
              prev.map(m =>
                m.firestoreId === change.doc.id
                  ? { ...m, taken: data.taken ?? m.taken }
                  : m
              )
            );
          }
        });
      },
      err => console.error('Firestore onSnapshot error:', err)
    );

    // Cleanup listener when component unmounts or uid changes
    return () => unsub();
  }, [uid]);

  // ── Save medication ──
  const handleSaveMedication = useCallback(async (med: Omit<Medication, 'id' | 'taken'>) => {
    setSaving(true);
    try {
      const apiRes     = await addMedication({
        patient_uid: uid, name: med.name,
        dosage: med.dosage, frequency: med.frequency, time: med.time,
      });
      const body       = apiRes.data;
      const postgresId = body?.id?.toString() ?? body?.data?.id?.toString() ?? Date.now().toString();

      // Write to Firestore
      const firestoreDoc = await addDoc(collection(db, 'reminders'), {
        uid, postgres_id: postgresId,
        name: med.name, dosage: med.dosage,
        frequency: med.frequency, time: med.time,
        taken: false, created_at: serverTimestamp(),
      });

      // Persist Firestore ID back to Neon so the link survives reloads
      try {
        await fetch(`/api/medications/${postgresId}/firestore-id`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firestore_id: firestoreDoc.id }),
        });
      } catch (e) {
        // Non-fatal — app still works, just won't sync taken state after reload
        console.warn('Could not persist firestore_id to Neon:', e);
      }

      setMedications(prev => [...prev, {
        id: postgresId, firestoreId: firestoreDoc.id,
        name: med.name, dosage: med.dosage,
        frequency: med.frequency, time: med.time, taken: false,
      }]);

      setShowAddModal(false);
      setActiveTab('Home');

      if (Platform.OS === 'web') window.alert(`${med.name} has been added to your reminders.`);
      else Alert.alert('✅ Added', `${med.name} added to your reminders.`);
    } catch (err) {
      console.error('Save failed:', err);
      if (Platform.OS === 'web') window.alert('Could not save. Please try again.');
      else Alert.alert('Error', 'Could not save. Please try again.');
    } finally { setSaving(false); }
  }, [uid]);

  // ── Toggle taken ──
  // Uses medicationsRef so we always read the CURRENT value, never a stale closure.
  const handleToggleTaken = useCallback(async (id: string) => {
    // Read current state from ref — avoids stale closure bug
    const med = medicationsRef.current.find(m => m.id === id);
    if (!med) return;

    const newTaken = !med.taken;

    // Optimistic UI update immediately
    setMedications(prev =>
      prev.map(m => m.id === id ? { ...m, taken: newTaken } : m)
    );

    // Write correct value to Firestore
    if (med.firestoreId) {
      try {
        await updateDoc(doc(db, 'reminders', med.firestoreId), { taken: newTaken });
      } catch (err) {
        // Rollback optimistic update on failure
        setMedications(prev =>
          prev.map(m => m.id === id ? { ...m, taken: med.taken } : m)
        );
        console.error('Toggle sync failed:', err);
        if (Platform.OS === 'web') window.alert('Could not update. Please try again.');
        else Alert.alert('Error', 'Could not update. Please try again.');
      }
    }
  }, []); // no deps — reads from ref, writes to Firestore directly

  // ── Delete medication ──
  const handleDeleteMed = useCallback((id: string) => {
    const doDelete = async () => {
      const med = medicationsRef.current.find(m => m.id === id);
      setMedications(prev => prev.filter(m => m.id !== id));
      try { await deleteMedication(Number(id)); } catch (err) { console.error(err); }
      if (med?.firestoreId) {
        try { await deleteDoc(doc(db, 'reminders', med.firestoreId)); } catch (err) { console.error(err); }
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this medication?')) doDelete();
    } else {
      Alert.alert('Delete', 'Remove this medication?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, []);

  // Calendar helpers
  const getDaysInMonth2    = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  // ── HOME SCREEN ──
  const HomeScreen = () => (
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}>
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
          <Text style={styles.statNum}>{medications.length}</Text>
          <Text style={styles.statLabel}>Today's Meds</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statNum}>{takenToday}</Text>
          <Text style={styles.statLabel}>Taken Today</Text>
        </View>
      </View>

      <MedicationsCard
        medications={medications}
        onToggleTaken={handleToggleTaken}
        onDelete={handleDeleteMed}
        onAddPress={() => setShowAddModal(true)}
      />

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: GREEN_LIGHT }]}
        onPress={() => setActiveTab('Medications')}
      >
        <Text style={styles.actionIcon}>💊</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: '#222' }]}>All Medications</Text>
          <Text style={[styles.actionSub, { color: '#888' }]}>
            {medications.length} active · {takenToday} taken today
          </Text>
        </View>
        <Text style={[styles.arrow, { color: GREEN }]}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, styles.actionCardWhite]}
        onPress={() => setActiveTab('Calendar')}
      >
        <Text style={styles.actionIcon}>📅</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: '#222' }]}>Calendar</Text>
          <Text style={[styles.actionSub, { color: '#888' }]}>View your schedule</Text>
        </View>
        <Text style={[styles.arrow, { color: '#222' }]}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── CALENDAR SCREEN ──
  const CalendarScreen = () => {
    const daysInMonth = getDaysInMonth2(calendarMonth);
    const firstDay    = getFirstDayOfMonth(calendarMonth);
    const cells: (number | null)[] = [
      ...Array.from({ length: firstDay }, (): null => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    const isToday    = (d: number) => d === today.getDate() && calendarMonth.getMonth() === today.getMonth() && calendarMonth.getFullYear() === today.getFullYear();
    const isSelected = (d: number) => d === selectedDate.getDate() && calendarMonth.getMonth() === selectedDate.getMonth() && calendarMonth.getFullYear() === selectedDate.getFullYear();

    return (
      <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}>
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
                  day !== null && isToday(day)    ? styles.calCellToday    : undefined,
                  day !== null && isSelected(day) ? styles.calCellSelected : undefined,
                ]}
                onPress={() => { if (day !== null) setSelectedDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)); }}
                disabled={day === null}
              >
                <Text style={[
                  styles.calCellText,
                  day !== null && isToday(day)    ? styles.calCellTextToday    : undefined,
                  day !== null && isSelected(day) ? styles.calCellTextSelected : undefined,
                ]}>
                  {day !== null ? String(day) : ''}
                </Text>
                {day !== null && medications.length > 0 ? <View style={styles.calDot} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedDate.toDateString() === today.toDateString()
              ? "Today's"
              : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`} Schedule
          </Text>
        </View>

        {medications.length === 0 ? (
          <View style={styles.calEmptyState}>
            <Text style={styles.calEmptyIcon}>📭</Text>
            <Text style={styles.calEmptyText}>No medications scheduled</Text>
            <TouchableOpacity style={styles.calAddBtn} onPress={() => setShowAddModal(true)}>
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
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>P</Text>
        </View>
        <Text style={styles.profileName}>Patient</Text>
        <Text style={styles.profileUid}>ID: {uid?.slice(0, 12)}...</Text>
      </View>

      <Text style={styles.manageSection}>Essentials</Text>

      <TouchableOpacity style={styles.manageRow} onPress={() => setActiveTab('Medications')}>
        <View style={styles.manageIconBox}><Text style={{ fontSize: 20 }}>💊</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.manageRowLabel}>Medications</Text>
          <Text style={styles.manageRowSub}>{medications.length} active · {takenToday} taken today</Text>
        </View>
        <View style={styles.medCountBadge}>
          <Text style={styles.medCountBadgeText}>{medications.length}</Text>
        </View>
        <Text style={styles.manageArrow}>›</Text>
      </TouchableOpacity>

      {[
        { icon: '📊', label: 'Report',              sub: `${takenToday} taken today`,    onPress: undefined },
        { icon: '📅', label: 'Schedule & Calendar', sub: 'View all reminders',           onPress: () => setActiveTab('Calendar') },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={styles.manageRow} onPress={item.onPress}>
          <View style={styles.manageIconBox}><Text style={{ fontSize: 20 }}>{item.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageRowLabel}>{item.label}</Text>
            <Text style={styles.manageRowSub}>{item.sub}</Text>
          </View>
          <Text style={styles.manageArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.manageSection}>Account</Text>

      {[
        { icon: '🔗', label: 'Linked Caretaker',      sub: 'No caretaker linked yet' },
        { icon: '🔔', label: 'Notification Settings', sub: 'Manage alerts' },
        { icon: '🔒', label: 'Privacy & Security',    sub: 'Manage your data' },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={styles.manageRow}>
          <View style={styles.manageIconBox}><Text style={{ fontSize: 20 }}>{item.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageRowLabel}>{item.label}</Text>
            <Text style={styles.manageRowSub}>{item.sub}</Text>
          </View>
          <Text style={styles.manageArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutRowBtn} onPress={() => setShowLogout(true)}>
        <Text style={styles.logoutRowIcon}>🚪</Text>
        <Text style={styles.logoutRowText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>PillPal v1.0.0</Text>
    </ScrollView>
  );

  // ── RENDER SCREEN ──
  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':        return <HomeScreen />;
      case 'Add':         return <HomeScreen />;
      case 'Calendar':    return <CalendarScreen />;
      case 'Medications': return (
        <MedicationsScreen
          medications={medications}
          onToggleTaken={handleToggleTaken}
          onDelete={handleDeleteMed}
          onAddPress={() => setShowAddModal(true)}
        />
      );
      case 'Manage':      return <ManageScreen />;
    }
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
          💊 Medicine Reminder
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogout(true)}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {renderScreen()}

      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.label}
            style={styles.tabItem}
            onPress={() => {
              if (tab.label === 'Add') { setShowAddModal(true); return; }
              setActiveTab(tab.label);
            }}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.label && { color: GREEN, fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <AddMedicationModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveMedication}
        saving={saving}
      />

      <LogoutModal
        visible={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={() => { setShowLogout(false); onLogout(); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outer:  { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle:       { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerTitleTablet: { fontSize: 20 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  body:               { flex: 1 },
  bodyContent:        { padding: 16, gap: 12, paddingBottom: 32 },
  bodyContentTablet:  { padding: 24, maxWidth: 900, alignSelf: 'center', width: '100%' },

  greetingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  greetingIcon: { fontSize: 32 },
  greetingText: { fontSize: 16, fontWeight: '700', color: '#222' },
  greetingSub:  { fontSize: 13, color: '#666', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center' },
  statIcon:  { fontSize: 24, marginBottom: 4 },
  statNum:   { fontSize: 28, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  actionCard: {
    backgroundColor: GREEN, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  actionCardWhite: { backgroundColor: '#fff' },
  actionIcon:  { fontSize: 24 },
  actionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  arrow:       { color: '#fff', fontSize: 18 },

  sectionHeader: { marginBottom: 4 },
  sectionTitle:  { fontSize: 18, fontWeight: '800', color: '#222' },

  calendarCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  calendarNav:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calNavBtn:     { fontSize: 28, color: GREEN, fontWeight: '300', paddingHorizontal: 8 },
  calMonthLabel: { fontSize: 16, fontWeight: '800', color: '#222' },
  calDaysRow:    { flexDirection: 'row', marginBottom: 8 },
  calDayLabel:   { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#aaa' },
  calGrid:            { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:            { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellToday:       { backgroundColor: GREEN_LIGHT },
  calCellSelected:    { backgroundColor: GREEN },
  calCellText:        { fontSize: 14, color: '#333' },
  calCellTextToday:   { color: GREEN, fontWeight: '800' },
  calCellTextSelected:{ color: '#fff', fontWeight: '800' },
  calDot:             { width: 4, height: 4, borderRadius: 2, backgroundColor: GREEN, marginTop: 2 },

  calEmptyState: { alignItems: 'center', paddingVertical: 32 },
  calEmptyIcon:  { fontSize: 40, marginBottom: 12 },
  calEmptyText:  { fontSize: 15, color: '#aaa', marginBottom: 16 },
  calAddBtn:     { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  calAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  scheduleRow: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  scheduleTime:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 70, alignItems: 'center' },
  scheduleTimeText:   { fontSize: 12, fontWeight: '700' },
  scheduleMedName:    { fontSize: 14, fontWeight: '700', color: '#222' },
  scheduleMedSub:     { fontSize: 12, color: '#888', marginTop: 2 },
  scheduleBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  scheduleBadgeText:  { fontSize: 11, fontWeight: '700' },

  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  profileAvatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName:       { fontSize: 20, fontWeight: '800', color: '#222' },
  profileUid:        { fontSize: 12, color: '#aaa', marginTop: 4 },

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
  manageRowSub:   { fontSize: 12, color: '#888', marginTop: 2 },
  manageArrow:    { fontSize: 20, color: '#ccc' },

  medCountBadge:     { backgroundColor: GREEN_LIGHT, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  medCountBadgeText: { color: GREEN, fontWeight: '800', fontSize: 13 },

  logoutRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1.5, borderColor: '#ffcdd2',
  },
  logoutRowIcon: { fontSize: 20 },
  logoutRowText: { fontSize: 15, fontWeight: '700', color: '#c62828' },
  versionText:   { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 24 },

  tabBar:  {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10,
  },
  tabItem:  { flex: 1, alignItems: 'center' },
  tabIcon:  { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────
// ADD MEDICATION MODAL STYLES
// ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0',
    alignSelf: 'center', marginTop: 12,
  },
  headerArea: {
    alignItems: 'center', paddingTop: 20, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  pillIcon:      { fontSize: 40, marginBottom: 6 },
  title:         { fontSize: 22, fontWeight: '800', color: '#1a3a22', letterSpacing: -0.5 },
  scrollContent: { padding: 20, paddingBottom: 8, gap: 20 },

  fieldGroup: { gap: 8 },
  labelRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelIcon:  { fontSize: 14 },
  label:      { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1 },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#222', backgroundColor: '#fafafa',
  },

  dropdown: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fafafa',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownOpen:         { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  dropdownText:         { fontSize: 15, color: '#222', fontWeight: '500' },
  dropdownArrow:        { fontSize: 12, color: '#aaa' },
  dropdownList: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  dropdownItemActive:     { backgroundColor: GREEN_LIGHT },
  dropdownItemText:       { fontSize: 15, color: '#333' },
  dropdownItemTextActive: { color: GREEN, fontWeight: '700' },

  freqSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  freqSubIcon: { fontSize: 12 },
  freqSub:     { fontSize: 12, color: '#888' },

  endDateBtn: {
    borderWidth: 1.5, borderColor: GREEN, borderStyle: 'dashed',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GREEN_LIGHT,
  },
  endDateIcon: { fontSize: 16 },
  endDateText: { fontSize: 14, color: GREEN, fontWeight: '700' },

  removeEndDateBtn: {
    borderWidth: 1.5, borderColor: RED, borderStyle: 'dashed',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: RED_LIGHT,
  },
  removeEndDateText: { fontSize: 14, color: RED, fontWeight: '700' },

  calBox:          { borderWidth: 1.5, borderColor: GREEN, borderRadius: 14, padding: 14, backgroundColor: GREEN_LIGHT, gap: 10 },
  calBoxLabel:     { fontSize: 10, fontWeight: '800', color: GREEN, letterSpacing: 1 },
  dateDisplay: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
  },
  dateDisplayActive: { borderColor: GREEN },
  dateDisplayText:   { flex: 1, fontSize: 14, color: '#222', fontWeight: '500' },

  calendar:      { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  calNav:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNavBtn:     { fontSize: 26, color: GREEN, paddingHorizontal: 8, fontWeight: '300' },
  calMonthLabel: { fontSize: 14, fontWeight: '800', color: '#222' },
  calDayRow:     { flexDirection: 'row', marginBottom: 4 },
  calDayLabel:   { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#aaa' },
  calGrid:            { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:            { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellToday:       { backgroundColor: GREEN_LIGHT },
  calCellSelected:    { backgroundColor: GREEN },
  calCellText:        { fontSize: 13, color: '#333' },
  calCellTextToday:   { color: GREEN, fontWeight: '800' },
  calCellTextSelected:{ color: '#fff', fontWeight: '800' },

  timeIcon: { fontSize: 16, marginRight: 8 },
  timePicker: {
    borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 14,
    backgroundColor: '#fff', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  timePickerTitle: {
    textAlign: 'center', fontSize: 11, fontWeight: '800',
    color: '#888', letterSpacing: 1.5, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  timePickerRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  timeCol:        { flex: 1, alignItems: 'center' },
  timeColLabel:   { fontSize: 10, fontWeight: '800', color: '#aaa', letterSpacing: 1, marginBottom: 8 },
  timeScroll:     { height: 160 },
  timeItem:       { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginVertical: 1, minWidth: 56 },
  timeItemActive: { backgroundColor: GREEN },
  timeItemText:       { fontSize: 16, color: '#555', fontWeight: '500' },
  timeItemTextActive: { color: '#fff', fontWeight: '800' },
  timeSep:   { fontSize: 24, fontWeight: '800', color: '#333', marginTop: 24 },
  ampmCol:   { gap: 8, justifyContent: 'center' },
  ampmBtn:   { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center' },
  ampmBtnActive:  { backgroundColor: GREEN, borderColor: GREEN },
  ampmText:       { fontSize: 14, fontWeight: '700', color: '#888' },
  ampmTextActive: { color: '#fff' },
  timeDoneBtn:  { backgroundColor: GREEN, margin: 12, marginTop: 4, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  timeDoneText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  footer:    { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#e8e8e8',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  saveBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  saveText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─────────────────────────────────────────────────────────────
// MEDICATIONS CARD STYLES
// ─────────────────────────────────────────────────────────────
const mc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon:  { fontSize: 24 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  headerSub:   { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 0.8, marginTop: 1 },
  countBadge:  { backgroundColor: GREEN_LIGHT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  countNum:    { fontSize: 18, fontWeight: '900', color: GREEN, lineHeight: 20 },
  countLabel:  { fontSize: 9, fontWeight: '700', color: GREEN, letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  statPill:  { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statNum:   { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  list:        { paddingHorizontal: 16, paddingBottom: 4 },
  medRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  medRowFirst: { borderTopWidth: 0 },
  medInfo:     { flex: 1 },
  medName:     { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  medNameTaken:{ color: '#aaa', textDecorationLine: 'line-through' },
  medSub:      { fontSize: 12, color: '#888', marginTop: 2 },
  deleteBtn:   { padding: 4 },
  deleteArrow: { fontSize: 22, color: '#ccc', fontWeight: '300' },

  empty:       { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon:   { fontSize: 36 },
  emptyText:   { fontSize: 14, color: '#aaa' },
  emptyAddBtn: { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyAddText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  addBtn:     { margin: 12, marginTop: 4, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: GREEN, borderStyle: 'dashed' },
  addBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
});
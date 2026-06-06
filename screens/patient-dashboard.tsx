import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions,
  Alert, Modal, Platform, Switch, Pressable,
} from 'react-native';
import SwipeTabHost from '@/components/SwipeTabHost';
import WeekCalendarStrip from '@/components/WeekCalendarStrip';
import NavTutorialOverlay from '@/components/NavTutorialOverlay';
import DeleteMedicationModal from '@/components/DeleteMedicationModal';
import LogoutModal from '@/components/LogoutModal';
import { SkeletonMedCard } from '@/components/Skeleton';
import {
  isTutorialDone, setTutorialDone, PATIENT_TUTORIAL,
} from '@/lib/tutorial';
import { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, deleteDoc,
  doc, serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  addMedication, deleteMedication, setMedicationTaken, updateMedication,
  getUser, saveExpoPushToken, refillMedication, setMedicationFirestoreId,
  getPatientIncomingLinkRequests, acceptLinkRequestAsPatient, rejectLinkRequest,
} from '@/api/index';
import { subscribePatientMedications } from '@/services/medicationRealtime';
import {
  registerForPushNotificationsAsync,
  rescheduleMedicationLocalNotifications,
  forceRescheduleMedicationLocalNotifications,
  setupNotifications,
} from '@/lib/pushNotifications';
import { logIntelligenceEvent } from '@/api/index';
import { APP_NAME } from '@/lib/branding';
import { TEXT } from '@/lib/typography';
import type { PatientMedication } from '@/types/medication';
import MedicationsScreen from '@/components/MedicationsScreen';
import LinkCaretakerModal from '@/components/LinkCaretakerModal';
import AppIcon, { PATIENT_TAB_ICONS } from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import AppHeader from '@/components/AppHeader';
import MenuRow from '@/components/MenuRow';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import MedicationInventoryModal from '@/components/MedicationInventoryModal';
import PrivacySecurityModal from '@/components/PrivacySecurityModal';
import StatTile from '@/components/StatTile';
import StatisticsScreen from '@/components/StatisticsScreen';
import { bumpPatientActivity } from '@/lib/patientActivity';
import { cacheMedications, enqueueMutation } from '@/lib/offline/store';
import { flushOfflineQueue } from '@/lib/offline/sync';
import { useNetworkStatus } from '@/lib/offline/network';
import { exportDataToCSV, exportDataToJSON } from '@/lib/dataExport';
import Constants from 'expo-constants';
import { pickEarliestReminderSlot, parseTimeSlot } from '@/utils/algorithms/greedy';
import { validateMedicationName } from '@/utils/algorithms/linear';

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';
const RED         = '#d32f2f';
const RED_LIGHT   = '#fdecea';

interface Props { onLogout: () => void; uid: string; email: string; }

type AddModalPayload = Omit<PatientMedication, 'taken' | 'firestoreId' | 'id'> & { id?: string };

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

type PatientTab = 'Home' | 'Calendar' | 'Medications' | 'Manage';
const TABS: { label: PatientTab }[] = [
  { label: 'Home' },
  { label: 'Calendar' },
  { label: 'Medications' },
  { label: 'Manage' },
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
  onSave: (med: AddModalPayload) => Promise<void>;
  saving: boolean;
  editingMed?: PatientMedication | null;
  existingMedicationTimes?: string[];
}

function AddMedicationModal({ visible, onClose, onSave, saving, editingMed, existingMedicationTimes = [] }: AddModalProps) {
  const scrollRef = useRef<ScrollView>(null);
  const timeSectionY = useRef(0);
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
  // New fields for real-world medication management
  const [currentStock,   setCurrentStock]   = useState('');
  const [refillThreshold,setRefillThreshold]= useState('');
  const [prescriptionNumber, setPrescriptionNumber] = useState('');
  const [doctorName,     setDoctorName]     = useState('');
  const [pharmacyName,   setPharmacyName]   = useState('');
  const [instructions,   setInstructions]   = useState('');
  const [takeWithFood,   setTakeWithFood]   = useState(false);
  const [showInventory,  setShowInventory]  = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);

  const today = new Date();

  const reset = () => {
    setName(''); setDosage(''); setFreqIdx(0);
    setShowFreqDrop(false); setShowEndDate(false);
    setEndDate(null); setShowTimePicker(false);
    setHour('08'); setMinute('00'); setAmpm('AM');
    setCalMonth(new Date());
    setCurrentStock(''); setRefillThreshold('');
    setPrescriptionNumber(''); setDoctorName('');
    setPharmacyName(''); setInstructions('');
    setTakeWithFood(false);
    setShowInventory(false); setShowPrescription(false);
  };

  const handleClose = () => { reset(); onClose(); };

  useEffect(() => {
    if (!visible) return;
    if (editingMed) {
      setName(editingMed.name);
      setDosage(editingMed.dosage === 'As prescribed' ? '' : editingMed.dosage);
      const fi = FREQUENCIES.findIndex(f => f.label === editingMed.frequency);
      setFreqIdx(fi >= 0 ? fi : 0);
      const tm = editingMed.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (tm) {
        setHour(tm[1].padStart(2, '0'));
        setMinute(tm[2]);
        setAmpm(tm[3].toUpperCase() === 'PM' ? 'PM' : 'AM');
      }
      setCurrentStock(editingMed.currentStock?.toString() || '');
      setRefillThreshold(editingMed.refillThreshold?.toString() || '');
      setPrescriptionNumber(editingMed.prescriptionNumber || '');
      setDoctorName(editingMed.doctorName || '');
      setPharmacyName(editingMed.pharmacyName || '');
      setInstructions(editingMed.instructions || '');
      setTakeWithFood(editingMed.takeWithFood || false);
    } else {
      reset();
      const occupied = existingMedicationTimes
        .map(parseTimeSlot)
        .filter((s): s is NonNullable<ReturnType<typeof parseTimeSlot>> => s != null);
      const suggested = pickEarliestReminderSlot(occupied);
      const tm = suggested.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (tm) {
        setHour(tm[1].padStart(2, '0'));
        setMinute(tm[2]);
        setAmpm(tm[3].toUpperCase() === 'PM' ? 'PM' : 'AM');
      }
    }
  }, [visible, editingMed?.id, existingMedicationTimes.join('|')]);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const handleSave = async () => {
    if (!validateMedicationName(name)) { showAlert('Required', 'Please enter a medication name.'); return; }
    await onSave({
      ...(editingMed ? { id: editingMed.id } : {}),
      name:      name.trim(),
      dosage:    dosage.trim() || 'As prescribed',
      frequency: FREQUENCIES[freqIdx].label,
      time:      `${hour}:${minute} ${ampm}`,
      currentStock: currentStock ? parseInt(currentStock, 10) : undefined,
      refillThreshold: refillThreshold ? parseInt(refillThreshold, 10) : undefined,
      prescriptionNumber: prescriptionNumber.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      pharmacyName: pharmacyName.trim() || undefined,
      instructions: instructions.trim() || undefined,
      takeWithFood: takeWithFood || undefined,
    });
    if (!editingMed) reset();
  };

  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const cells: (number | null)[] = [
    ...Array.from({ length: getFirstDay(y, m) }, (): null => null),
    ...Array.from({ length: getDaysInMonth(y, m) }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={ms.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close add medication" />
        <View style={ms.sheet}>
          <View style={ms.sheetHeader}>
            <View style={ms.heroLogoRow}>
              <AppLogo size={44} />
              <View style={ms.heroTextCol}>
                <Text style={ms.heroKicker}>{APP_NAME}</Text>
                <Text style={ms.title}>{editingMed ? 'Edit medication' : 'Add medication'}</Text>
              </View>
            </View>
            <Text style={ms.heroSub}>Set name, time, and optional end date — reminders sync automatically.</Text>
            <TouchableOpacity style={ms.closeBtn} onPress={handleClose}>
              <AppIcon name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Medicine Name */}
            <View style={ms.fieldGroup}>
              <View style={ms.labelRow}>
                <AppIcon name="fitness-outline" size={16} color={GREEN} />
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
                <AppIcon name="pricetag-outline" size={16} color={GREEN} />
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
                <AppIcon name="repeat-outline" size={16} color={GREEN} />
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
                <AppIcon name="calendar-outline" size={14} color="#888" />
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
                  <AppIcon name="calendar-outline" size={18} color={GREEN} />
                  <Text style={ms.endDateText}>Set end date (optional)</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={ms.removeEndDateBtn}
                    onPress={() => { setShowEndDate(false); setEndDate(null); }}
                    activeOpacity={0.8}
                  >
                    <AppIcon name="calendar-outline" size={18} color={RED} />
                    <Text style={ms.removeEndDateText}>Remove end date</Text>
                  </TouchableOpacity>

                  <View style={ms.calBox}>
                    <Text style={ms.calBoxLabel}>REMIND ME UNTIL</Text>
                    <View style={[ms.dateDisplay, !!endDate && ms.dateDisplayActive]}>
                      <AppIcon name="calendar-outline" size={18} color={GREEN} />
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
                          <AppIcon name="chevron-back" size={20} color={GREEN} />
                        </TouchableOpacity>
                        <Text style={ms.calMonthLabel}>{MONTHS[m]} {y}</Text>
                        <TouchableOpacity onPress={() => setCalMonth(new Date(y, m + 1, 1))}>
                          <AppIcon name="chevron-forward" size={20} color={GREEN} />
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
            <View
              style={ms.fieldGroup}
              onLayout={e => { timeSectionY.current = e.nativeEvent.layout.y; }}
            >
              <View style={ms.labelRow}>
                <AppIcon name="time-outline" size={16} color={GREEN} />
                <Text style={ms.label}>TIME *</Text>
              </View>
              <TouchableOpacity
                style={[ms.dropdown, showTimePicker && ms.dropdownOpen]}
                onPress={() => {
                  const next = !showTimePicker;
                  setShowTimePicker(next);
                  if (next) {
                    setTimeout(() => {
                      scrollRef.current?.scrollTo({ y: Math.max(0, timeSectionY.current - 8), animated: true });
                    }, 80);
                  }
                }}
                activeOpacity={0.8}
              >
                <AppIcon name="time-outline" size={18} color={GREEN} />
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
                      <ScrollView
                        style={ms.timeScroll}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                        keyboardShouldPersistTaps="handled"
                      >
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
                      <ScrollView
                        style={ms.timeScroll}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                        keyboardShouldPersistTaps="handled"
                      >
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

            {/* Inventory Tracking Section */}
            <View style={ms.fieldGroup}>
              <TouchableOpacity
                style={ms.collapsibleHeader}
                onPress={() => setShowInventory(!showInventory)}
                activeOpacity={0.8}
              >
                <View style={ms.labelRow}>
                  <AppIcon name="cube-outline" size={16} color={GREEN} />
                  <Text style={ms.label}>INVENTORY TRACKING (Optional)</Text>
                </View>
                <Text style={ms.dropdownArrow}>{showInventory ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showInventory && (
                <View style={ms.collapsibleContent}>
                  <View style={ms.fieldGroup}>
                    <Text style={ms.subLabel}>Current Stock</Text>
                    <TextInput
                      style={ms.input}
                      placeholder="e.g., 30 tablets"
                      placeholderTextColor="#c0c0c0"
                      value={currentStock}
                      onChangeText={setCurrentStock}
                      keyboardType="number-pad"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={ms.fieldGroup}>
                    <Text style={ms.subLabel}>Refill Alert Threshold</Text>
                    <TextInput
                      style={ms.input}
                      placeholder="Alert when stock falls below this number"
                      placeholderTextColor="#c0c0c0"
                      value={refillThreshold}
                      onChangeText={setRefillThreshold}
                      keyboardType="number-pad"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Prescription Details Section */}
            <View style={ms.fieldGroup}>
              <TouchableOpacity
                style={ms.collapsibleHeader}
                onPress={() => setShowPrescription(!showPrescription)}
                activeOpacity={0.8}
              >
                <View style={ms.labelRow}>
                  <AppIcon name="document-text-outline" size={16} color={GREEN} />
                  <Text style={ms.label}>PRESCRIPTION DETAILS (Optional)</Text>
                </View>
                <Text style={ms.dropdownArrow}>{showPrescription ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showPrescription && (
                <View style={ms.collapsibleContent}>
                  <View style={ms.fieldGroup}>
                    <Text style={ms.subLabel}>Prescription Number</Text>
                    <TextInput
                      style={ms.input}
                      placeholder="e.g., RX123456"
                      placeholderTextColor="#c0c0c0"
                      value={prescriptionNumber}
                      onChangeText={setPrescriptionNumber}
                      autoCorrect={false}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={ms.fieldGroup}>
                    <Text style={ms.subLabel}>Doctor Name</Text>
                    <TextInput
                      style={ms.input}
                      placeholder="Prescribing doctor"
                      placeholderTextColor="#c0c0c0"
                      value={doctorName}
                      onChangeText={setDoctorName}
                      autoCorrect={false}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={ms.fieldGroup}>
                    <Text style={ms.subLabel}>Pharmacy Name</Text>
                    <TextInput
                      style={ms.input}
                      placeholder="Pharmacy name"
                      placeholderTextColor="#c0c0c0"
                      value={pharmacyName}
                      onChangeText={setPharmacyName}
                      autoCorrect={false}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Instructions Section */}
            <View style={ms.fieldGroup}>
              <View style={ms.labelRow}>
                <AppIcon name="information-circle-outline" size={16} color={GREEN} />
                <Text style={ms.label}>INSTRUCTIONS (Optional)</Text>
              </View>
              <TextInput
                style={[ms.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="e.g., Take with food, avoid alcohol, store in cool place"
                placeholderTextColor="#c0c0c0"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                autoCorrect={false}
              />
              <TouchableOpacity
                style={ms.switchRow}
                onPress={() => setTakeWithFood(!takeWithFood)}
                activeOpacity={0.8}
              >
                <Text style={ms.switchLabel}>Take with food</Text>
                <Switch
                  value={takeWithFood}
                  onValueChange={setTakeWithFood}
                  trackColor={{ false: '#e0e0e0', true: GREEN }}
                  thumbColor={takeWithFood ? '#fff' : '#f0f0f0'}
                />
              </TouchableOpacity>
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
              <Text style={ms.saveText}>{saving ? 'Saving...' : 'Save reminder'}</Text>
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
  medications: PatientMedication[];
  onToggleTaken: (id: string) => void;
  onEdit: (med: PatientMedication) => void;
  onAddPress: () => void;
}

function MedicationsCard({ medications, onToggleTaken, onEdit, onAddPress }: MedCardProps) {
  const pending = medications.filter(m => !m.taken).length;
  const taken   = medications.filter(m =>  m.taken).length;

  return (
    <View style={mc.card}>
      <View style={mc.header}>
        <View style={mc.headerLeft}>
          <View style={mc.headerIconWrap}>
            <AppIcon name="medical" size={22} color={GREEN} />
          </View>
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
          <AppIcon name="medical-outline" size={36} color="#ccc" />
          <Text style={mc.emptyText}>No medications added yet</Text>
          <TouchableOpacity style={mc.emptyAddBtn} onPress={onAddPress}>
            <Text style={mc.emptyAddText}>+ Add Medication</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={mc.list}>
          {medications.map((med, i) => (
            <Pressable
              key={med.id}
              style={[mc.medRow, i === 0 && mc.medRowFirst]}
              onPress={() => onEdit(med)}
            >
              <View style={mc.medInfo}>
                <Text style={[mc.medName, med.taken && mc.medNameTaken]}>{med.name}</Text>
                <Text style={mc.medSub}>
                  {med.dosage !== 'As prescribed' ? med.dosage : 'Take as needed'} · {med.time}
                </Text>
              </View>
              <Switch
                value={med.taken}
                onValueChange={() => onToggleTaken(med.id)}
                trackColor={{ false: '#e8d9a8', true: GREEN }}
                thumbColor="#fff"
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PATIENT DASHBOARD
// ─────────────────────────────────────────────────────────────
export default function PatientDashboard({ onLogout, uid, email }: Props) {
  const { width } = Dimensions.get('window');
  const isTablet  = width >= 768;
  const insets    = useSafeAreaInsets();

  const [activeTab,     setActiveTab]     = useState<PatientTab>('Home');
  const [medications,   setMedications]   = useState<PatientMedication[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [editingMed,    setEditingMed]    = useState<PatientMedication | null>(null);
  const [selectedDate,  setSelectedDate]  = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [displayName, setDisplayName] = useState('Patient');
  const [showLinkCaretaker, setShowLinkCaretaker] = useState(false);
  const [patientIncomingReqs, setPatientIncomingReqs] = useState<any[]>([]);
  const [medsLoading, setMedsLoading] = useState(true);
  const [tutorialIdx, setTutorialIdx] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingMed, setDeletingMed] = useState(false);
  const [showInventory,   setShowInventory]   = useState(false);
  const [inventoryMedId,  setInventoryMedId]  = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showStatistics,  setShowStatistics]  = useState(false);

  // ── Ref so callbacks always see current medications without stale closures ──
  const medicationsRef = useRef<PatientMedication[]>([]);
  useEffect(() => { medicationsRef.current = medications; }, [medications]);

  const today      = new Date();
  const takenToday = medications.filter(m => m.taken && !m.suspended).length;

  useEffect(() => {
    if (!uid) return;
    setMedsLoading(true);
    return subscribePatientMedications(uid, meds => {
      setMedications(meds);
      setMedsLoading(false);
    });
  }, [uid]);

  useEffect(() => {
    isTutorialDone('patient', uid).then(done => {
      if (!done) {
        setTutorialIdx(0);
        setShowTutorial(true);
      }
    });
  }, [uid]);

  useEffect(() => {
    if (!showTutorial) return;
    const step = PATIENT_TUTORIAL[tutorialIdx];
    if (step?.tab) setActiveTab(step.tab as PatientTab);
  }, [showTutorial, tutorialIdx]);

  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable;
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    if (isExpoGo) return;
    rescheduleMedicationLocalNotifications(medications, uid).catch(() => {});
  }, [medications, isExpoGo, uid]);

  useEffect(() => {
    setupNotifications().catch(() => {});
    if (isExpoGo) return;
    registerForPushNotificationsAsync().then(token => {
      if (token) saveExpoPushToken(uid, token).catch(() => {});
    });
    logIntelligenceEvent({ firebase_uid: uid, event_type: 'opened_app' }).catch(() => {});
  }, [uid, isExpoGo]);

  useEffect(() => {
    if (online) flushOfflineQueue().catch(() => {});
  }, [online]);

  useEffect(() => {
    getUser(uid)
      .then(r => {
        const n = (r.data?.full_name as string | undefined)?.trim();
        setDisplayName(n || (email?.split('@')[0] ?? 'Patient'));
      })
      .catch(() => setDisplayName(email?.split('@')[0] ?? 'Patient'));
  }, [uid, email]);

  const loadPatientIncoming = useCallback(async () => {
    try {
      const res = await getPatientIncomingLinkRequests(uid);
      setPatientIncomingReqs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPatientIncomingReqs([]);
    }
  }, [uid]);

  useEffect(() => {
    loadPatientIncoming();
    const id = setInterval(loadPatientIncoming, 15000);
    return () => clearInterval(id);
  }, [loadPatientIncoming]);

  // ── Add or update medication (modal) ──
  const handleMedicationModalSave = useCallback(async (med: AddModalPayload) => {
    if (med.id) {
      setSaving(true);
      try {
        await updateMedication(Number(med.id), {
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          time: med.time,
        });
        const cur = medicationsRef.current.find(m => m.id === med.id);
        if (cur?.firestoreId) {
          await updateDoc(doc(db, 'reminders', cur.firestoreId), {
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            time: med.time,
          });
        }
        setShowAddModal(false);
        setEditingMed(null);
        setActiveTab('Medications');
        const updatedMeds = medicationsRef.current.map(m =>
          m.id === med.id
            ? { ...m, name: med.name, dosage: med.dosage, frequency: med.frequency, time: med.time }
            : m,
        );
        setMedications(updatedMeds);
        medicationsRef.current = updatedMeds;
        await bumpPatientActivity(uid, 'medication_update');
        await forceRescheduleMedicationLocalNotifications(updatedMeds, uid);
      } catch (err) {
        console.error(err);
        if (Platform.OS === 'web') window.alert('Could not update medication.');
        else Alert.alert('Error', 'Could not update medication.');
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const apiRes     = await addMedication({
        patient_uid: uid, name: med.name,
        dosage: med.dosage, frequency: med.frequency, time: med.time,
      });
      const body       = apiRes.data;
      const postgresId = body?.id?.toString() ?? body?.data?.id?.toString() ?? Date.now().toString();

      const firestoreDoc = await addDoc(collection(db, 'reminders'), {
        uid, postgres_id: postgresId,
        name: med.name, dosage: med.dosage,
        frequency: med.frequency, time: med.time,
        taken: false, created_at: serverTimestamp(),
      });

      try {
        await setMedicationFirestoreId(Number(postgresId), firestoreDoc.id);
      } catch (e) {
        console.warn('Could not persist firestore_id to Neon:', e);
      }

      setMedications(prev => {
        const next = [...prev, {
          id: postgresId, firestoreId: firestoreDoc.id,
          name: med.name, dosage: med.dosage,
          frequency: med.frequency, time: med.time, taken: false,
        }];
        medicationsRef.current = next;
        return next;
      });

      setShowAddModal(false);
      setActiveTab('Home');
      await bumpPatientActivity(uid, 'medication_update');
      await forceRescheduleMedicationLocalNotifications(medicationsRef.current, uid);

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
    const med = medicationsRef.current.find(m => m.id === id);
    if (!med) return;

    const newTaken = !med.taken;
    const nextMeds = medicationsRef.current.map(m => m.id === id ? { ...m, taken: newTaken } : m);

    setMedications(nextMeds);
    await cacheMedications(uid, nextMeds);

    const syncRemote = async () => {
      await setMedicationTaken(Number(id), newTaken);
      if (med.firestoreId) {
        try {
          await updateDoc(doc(db, 'reminders', med.firestoreId), { taken: newTaken });
        } catch {
          /* Firestore optional */
        }
      }
      await bumpPatientActivity(uid, newTaken ? 'medication_taken' : 'medication_update');
    };

    if (!online) {
      await enqueueMutation({
        id: `${id}-${Date.now()}`,
        type: 'medication_taken',
        medicationId: Number(id),
        taken: newTaken,
        patientUid: uid,
      });
      return;
    }

    try {
      await syncRemote();
      logIntelligenceEvent({
        firebase_uid: uid,
        event_type: newTaken ? 'taken' : 'confirm',
        medication_id: Number(id),
      }).catch(() => {});
    } catch (err) {
      await enqueueMutation({
        id: `${id}-${Date.now()}`,
        type: 'medication_taken',
        medicationId: Number(id),
        taken: newTaken,
        patientUid: uid,
      });
      if (Platform.OS === 'web') {
        window.alert('Saved offline — will sync when you are back online.');
      } else {
        Alert.alert('Saved offline', 'Your change will sync when you reconnect.');
      }
    }
  }, [uid, online]);

  // ── Delete medication ──
  const handleDeleteMed = useCallback((id: string) => {
    const med = medicationsRef.current.find(m => m.id === id);
    setDeleteTarget({ id, name: med?.name ?? 'Medication' });
  }, []);

  const confirmDeleteMed = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingMed(true);
    const { id } = deleteTarget;
    const med = medicationsRef.current.find(m => m.id === id);
    setMedications(prev => prev.filter(m => m.id !== id));
    try {
      await deleteMedication(Number(id));
    } catch (err) {
      console.error(err);
    }
    if (med?.firestoreId) {
      try {
        await deleteDoc(doc(db, 'reminders', med.firestoreId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeletingMed(false);
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleRefill = useCallback((id: string) => {
    setInventoryMedId(id);
    setShowInventory(true);
  }, []);

  const handleSuspendMed = useCallback(async (med: PatientMedication) => {
    const pausing = !med.suspended;
    const nextMeds = medicationsRef.current.map(m =>
      m.id === med.id ? { ...m, suspended: pausing } : m,
    );
    setMedications(nextMeds);
    medicationsRef.current = nextMeds;
    await cacheMedications(uid, nextMeds);

    try {
      await updateMedication(Number(med.id), {
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        time: med.time,
        suspended: pausing,
      });
      if (med.firestoreId) {
        await updateDoc(doc(db, 'reminders', med.firestoreId), { suspended: pausing });
      }
      await forceRescheduleMedicationLocalNotifications(nextMeds, uid);
    } catch {
      const reverted = medicationsRef.current.map(m =>
        m.id === med.id ? { ...m, suspended: !pausing } : m,
      );
      setMedications(reverted);
      medicationsRef.current = reverted;
      Alert.alert('Error', 'Could not update medication.');
    }
  }, [uid]);

  const handleExportData = useCallback(async () => {
    try {
      const exportDate = new Date().toISOString().slice(0, 10);
      const stats = {
        total: medications.length,
        taken: medications.filter(m => m.taken && !m.suspended).length,
        missed: medications.filter(m => m.missed && !m.suspended).length,
        late: 0,
        pending: medications.filter(m => !m.taken && !m.missed && !m.suspended).length,
        complianceRate: medications.length > 0 
          ? Math.round((medications.filter(m => m.taken && !m.suspended).length / medications.length) * 100) 
          : 0,
      };

      const exportData = {
        exportDate,
        user: {
          name: displayName,
          email: email,
          role: 'patient',
        },
        medications: medications.map(m => ({
          date: exportDate,
          medicationName: m.name,
          dosage: m.dosage,
          time: m.time,
          status: m.taken ? 'taken' as const : m.missed ? 'missed' as const : 'pending' as const,
        })),
        connectedAccounts: patientIncomingReqs.map((req: any) => ({
          id: req.id,
          name: req.caretaker_name || req.caretaker_email,
          type: 'caretaker' as const,
          email: req.caretaker_email,
        })),
        statistics: stats,
      };

      await exportDataToCSV(exportData);
      if (Platform.OS === 'web') {
        window.alert('Data exported successfully!');
      } else {
        Alert.alert('Success', 'Data exported successfully!');
      }
    } catch (err) {
      console.error('Export failed:', err);
      if (Platform.OS === 'web') {
        window.alert('Could not export data. Please try again.');
      } else {
        Alert.alert('Error', 'Could not export data. Please try again.');
      }
    }
  }, [medications, displayName, email, patientIncomingReqs]);

  const handleToggleMedNotify = useCallback(async (med: PatientMedication) => {
    const next = !(med.notify_enabled !== false);
    try {
      await updateMedication(Number(med.id), {
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        time: med.time,
        notify_enabled: next,
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Calendar helpers
  const getDaysInMonth2    = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  // ── HOME SCREEN ──
  const HomeScreen = () => (
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}>
      <View style={styles.greetingCard}>
        <View style={styles.cardAccent} />
        <View style={styles.greetingIconWrap}>
          <AppIcon name="sunny-outline" size={28} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingText}>Good day, {displayName}!</Text>
          <Text style={styles.greetingSub}>Stay on track with your medication today.</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatTile icon="medical-outline" value={medications.length} label="Today's meds" accent={GREEN} />
        <StatTile icon="checkmark-circle-outline" value={takenToday} label="Taken today" accent={GREEN} iconBg="#f1f8e9" />
      </View>

      {medsLoading ? <SkeletonMedCard /> : (
        <MedicationsCard
          medications={medications}
          onToggleTaken={handleToggleTaken}
          onEdit={m => { setEditingMed(m); setShowAddModal(true); }}
          onAddPress={() => { setEditingMed(null); setShowAddModal(true); }}
        />
      )}

      <MenuRow
        icon="medical-outline"
        label="All medications"
        sub={`${medications.length} active · ${takenToday} taken today`}
        onPress={() => setActiveTab('Medications')}
      />
      <MenuRow icon="calendar-outline" label="Calendar" sub="View your schedule" onPress={() => setActiveTab('Calendar')} />
    </ScrollView>
  );

  const markedDates = medications.map(() => today.toISOString().slice(0, 10));

  // ── CALENDAR SCREEN ──
  const CalendarScreen = () => (
      <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}>
        <WeekCalendarStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDates={markedDates}
        />

        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>
            {selectedDate.toDateString() === today.toDateString()
              ? "Today's"
              : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`} schedule
          </Text>
        </View>

        {medications.length === 0 ? (
          <View style={styles.calEmptyState}>
            <Text style={styles.calEmptyIcon}>📭</Text>
            <Text style={styles.calEmptyText}>No medications scheduled</Text>
            <TouchableOpacity style={styles.calAddBtn} onPress={() => { setActiveTab('Medications'); setShowAddModal(true); }}>
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

  // ── MANAGE SCREEN ──
  const ManageScreen = () => (
    <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{displayName}</Text>
        <Text style={styles.profileUid}>ID: {uid?.slice(0, 12)}...</Text>
      </View>

      <Text style={styles.manageSection}>Essentials</Text>

      <MenuRow
        icon="medical-outline"
        label="Medications"
        sub={`${medications.length} active · ${takenToday} taken today`}
        badge={medications.length}
        onPress={() => setActiveTab('Medications')}
      />
      <MenuRow
        icon="bar-chart-outline"
        label="Statistics"
        sub="View your medication statistics"
        onPress={() => setShowStatistics(true)}
      />
      <MenuRow
        icon="download-outline"
        label="Export data"
        sub="Download your medication data"
        onPress={handleExportData}
      />
      <MenuRow icon="calendar-outline" label="Schedule & calendar" sub="View all reminders" onPress={() => setActiveTab('Calendar')} />

      <Text style={styles.manageSection}>Account</Text>

      <TouchableOpacity style={styles.linkCaregiverCard} onPress={() => setShowLinkCaretaker(true)}>
        <View style={styles.linkCaregiverIcon}>
          <AppIcon name="link" size={22} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.manageRowLabel}>Link caregiver / family</Text>
          <Text style={styles.manageRowSub}>Share a code or send a link request</Text>
        </View>
        <AppIcon name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      {patientIncomingReqs.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={[styles.manageSection, { marginTop: 4 }]}>Pending requests</Text>
          {patientIncomingReqs.map((lr: any) => (
            <View key={lr.id} style={styles.incomingReqCard}>
              <Text style={styles.incomingReqTitle}>{lr.caretaker_name || lr.caretaker_email}</Text>
              <Text style={styles.incomingReqSub}>Wants to support you on {APP_NAME}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={styles.incomingReqAccept}
                  onPress={async () => {
                    try {
                      await acceptLinkRequestAsPatient(lr.id, uid);
                      await loadPatientIncoming();
                    } catch {
                      Alert.alert('Error', 'Could not accept request.');
                    }
                  }}
                >
                  <Text style={styles.incomingReqAcceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.incomingReqReject}
                  onPress={async () => {
                    try {
                      await rejectLinkRequest(lr.id, { patient_uid: uid });
                      await loadPatientIncoming();
                    } catch {
                      Alert.alert('Error', 'Could not decline.');
                    }
                  }}
                >
                  <Text style={styles.incomingReqRejectText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <MenuRow
        icon="notifications-outline"
        label="Notification settings"
        sub="Manage alerts"
        onPress={() => setShowNotificationSettings(true)}
      />
      <MenuRow
        icon="lock-closed-outline"
        label="Privacy & security"
        sub="Manage your data"
        onPress={() => setShowPrivacySettings(true)}
      />
      <MenuRow
        icon="book-outline"
        label="Show tutorial"
        sub="Learn what each tab does"
        onPress={() => { setTutorialIdx(0); setShowTutorial(true); }}
      />
      <MenuRow
        icon="help-circle-outline"
        label="Help & support"
        sub="Get help"
        onPress={() => Alert.alert(APP_NAME, 'For help, contact your caregiver or clinic. Medication data stays on your account until you sign out.')}
      />

      <TouchableOpacity style={styles.logoutRowBtn} onPress={() => setShowLogoutModal(true)}>
        <AppIcon name="log-out-outline" size={22} color="#c62828" />
        <Text style={styles.logoutRowText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>{APP_NAME} v1.0.1</Text>
    </ScrollView>
  );

  // ── RENDER SCREEN ──
  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':        return <HomeScreen />;
      case 'Calendar':    return <CalendarScreen />;
      case 'Medications': return (
        <MedicationsScreen
          medications={medications}
          onToggleTaken={handleToggleTaken}
          onDelete={handleDeleteMed}
          onAddPress={() => { setEditingMed(null); setShowAddModal(true); }}
          onEdit={m => { setEditingMed(m); setShowAddModal(true); }}
          onRefill={handleRefill}
          onSuspend={handleSuspendMed}
          onToggleNotify={handleToggleMedNotify}
        />
      );
      case 'Manage':      return <ManageScreen />;
    }
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />

      <AppHeader
        title={activeTab === 'Home' ? 'Your health' : activeTab}
        subtitle={
          activeTab === 'Medications'
            ? `${medications.length} active reminders`
            : activeTab === 'Home'
              ? `Hi ${displayName.split(/\s+/)[0]}`
              : ' '
        }
        paddingTop={insets.top + 14}
      />

      <SwipeTabHost
        tabs={TABS.map(t => ({ key: t.label, icon: PATIENT_TAB_ICONS[t.label] }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bottomInset={insets.bottom || 10}
        iconOnly
      >
        <HomeScreen />
        <CalendarScreen />
        <MedicationsScreen
          medications={medications}
          onToggleTaken={handleToggleTaken}
          onDelete={handleDeleteMed}
          onAddPress={() => { setEditingMed(null); setShowAddModal(true); }}
          onEdit={m => { setEditingMed(m); setShowAddModal(true); }}
          onRefill={handleRefill}
          onSuspend={handleSuspendMed}
        />
        <ManageScreen />
      </SwipeTabHost>

      <AddMedicationModal
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingMed(null); }}
        onSave={handleMedicationModalSave}
        saving={saving}
        editingMed={editingMed}
        existingMedicationTimes={medications.map(m => m.time).filter(Boolean)}
      />
      <NavTutorialOverlay
        visible={showTutorial}
        steps={PATIENT_TUTORIAL}
        index={tutorialIdx}
        tabs={TABS.map(t => ({ key: t.label, icon: PATIENT_TAB_ICONS[t.label], label: t.label }))}
        activeTab={activeTab}
        onSkip={async () => {
          setShowTutorial(false);
          await setTutorialDone('patient', uid);
        }}
        onBack={() => setTutorialIdx(i => Math.max(0, i - 1))}
        onNext={async () => {
          if (tutorialIdx >= PATIENT_TUTORIAL.length - 1) {
            setShowTutorial(false);
            await setTutorialDone('patient', uid);
          } else {
            setTutorialIdx(i => i + 1);
          }
        }}
      />
      <DeleteMedicationModal
        visible={deleteTarget !== null}
        medicationName={deleteTarget?.name ?? ''}
        onCancel={() => !deletingMed && setDeleteTarget(null)}
        onConfirm={confirmDeleteMed}
        deleting={deletingMed}
      />
      <MedicationInventoryModal
        visible={showInventory}
        uid={uid}
        medications={medications}
        focusMedId={inventoryMedId}
        onClose={() => { setShowInventory(false); setInventoryMedId(null); }}
      />
      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          onLogout();
        }}
      />
      <Modal visible={showStatistics} animationType="slide" onRequestClose={() => setShowStatistics(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowStatistics(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatistics(false)}>
                <AppIcon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <StatisticsScreen
              stats={{
                total: medications.length,
                taken: medications.filter(m => m.taken && !m.suspended).length,
                missed: medications.filter(m => m.missed && !m.suspended).length,
                pending: medications.filter(m => !m.taken && !m.missed && !m.suspended).length,
              }}
              connectedAccounts={patientIncomingReqs.map((req: any) => ({
                id: req.id,
                name: req.caretaker_name || req.caretaker_email,
                type: 'caretaker' as const,
                email: req.caretaker_email,
              }))}
            />
          </View>
        </View>
      </Modal>
      <LinkCaretakerModal
        visible={showLinkCaretaker}
        onClose={() => {
          setShowLinkCaretaker(false);
          loadPatientIncoming();
        }}
        uid={uid}
        email={email}
      />
      <NotificationSettingsModal
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        onPreferenceChange={enabled => {
          if (enabled) {
            rescheduleMedicationLocalNotifications(medications, uid).catch(() => {});
          }
        }}
      />
      <PrivacySecurityModal
        visible={showPrivacySettings}
        onClose={() => setShowPrivacySettings(false)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outer:  { flex: 1, backgroundColor: '#ffffff' },
  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle: { fontSize: TEXT.lg, fontWeight: '700', color: '#fff' },
  headerTitleTablet: { fontSize: TEXT.xl },
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
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#e0e0e0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#e0e0e0',
  },
  greetingIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  greetingText: { fontSize: TEXT.lg, fontWeight: '700', color: '#222' },
  greetingSub:  { fontSize: TEXT.sm, color: '#666', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center' },
  statIcon:  { fontSize: 24, marginBottom: 4 },
  statNum:   { fontSize: TEXT.xxl, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: TEXT.sm, color: '#888', marginTop: 2 },

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
  sectionTitle:  { fontSize: TEXT.lg, fontWeight: '800', color: '#222' },

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
  scheduleTimeText:   { fontSize: TEXT.sm, fontWeight: '700' },
  scheduleMedName:    { fontSize: TEXT.md, fontWeight: '700', color: '#222' },
  scheduleMedSub:     { fontSize: TEXT.sm, color: '#888', marginTop: 2 },
  scheduleBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  scheduleBadgeText:  { fontSize: TEXT.xs, fontWeight: '700' },

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
  linkCaregiverCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: GREEN,
    shadowColor: GREEN, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  linkCaregiverIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  manageIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  manageRowLabel: { fontSize: TEXT.md, fontWeight: '700', color: '#222' },
  manageRowSub:   { fontSize: TEXT.sm, color: '#888', marginTop: 2 },
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

  incomingReqCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: GREEN, marginBottom: 8 },
  incomingReqTitle:      { fontSize: 15, fontWeight: '800', color: '#222' },
  incomingReqSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  incomingReqAccept:     { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  incomingReqAcceptText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  incomingReqReject:     { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  incomingReqRejectText: { color: '#666', fontWeight: '700', fontSize: 13 },

  tabBar:  {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10,
  },
  tabItem:  { flex: 1, alignItems: 'center' },
  tabIcon:  { fontSize: 22 },
  tabLabel:       { fontSize: TEXT.sm, color: '#aaa', marginTop: 2 },
  tabLabelActive: { color: GREEN, fontWeight: '700' },

  // Statistics modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: TEXT.lg,
    fontWeight: '800',
    color: '#222',
  },
});

// ─────────────────────────────────────────────────────────────
// ADD MEDICATION MODAL STYLES
// ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 35, 18, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '86%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8f0e8',
    shadowColor: '#0d2815',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  sheetHeader: {
    backgroundColor: '#f4faf4',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f0e8',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8ece8',
  },
  heroLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroTextCol: { flex: 1 },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroIcon: { fontSize: 26 },
  heroKicker: {
    fontSize: 11, fontWeight: '800', color: GREEN,
    letterSpacing: 1.2, marginBottom: 2,
  },
  title: {
    fontSize: 20, fontWeight: '800', color: '#142018', letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13, color: '#6a736e', marginTop: 12, lineHeight: 19,
  },
  scrollContent: { padding: 20, paddingBottom: 16, gap: 20 },

  fieldGroup: { gap: 8 },
  labelRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelIcon:  { fontSize: 14 },
  label:      { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1 },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#222', backgroundColor: '#fafafa',
    width: '100%',
  },

  dropdown: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fafafa',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
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
  timeScroll:     { height: 200, maxHeight: 220 },
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

  footer:    { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, borderTopWidth: 1, borderTopColor: '#edf3ed', backgroundColor: '#fafcfa' },
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

  // New styles for enhanced medication management
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  collapsibleContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
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
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  },
  headerTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#1a1a1a' },
  headerSub:   { fontSize: TEXT.sm, fontWeight: '700', color: '#aaa', letterSpacing: 0.8, marginTop: 1 },
  countBadge:  { backgroundColor: GREEN_LIGHT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  countNum:    { fontSize: 18, fontWeight: '900', color: GREEN, lineHeight: 20 },
  countLabel:  { fontSize: 9, fontWeight: '700', color: GREEN, letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  statPill:  { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statNum:   { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  list:        { paddingHorizontal: 16, paddingBottom: 4 },
  medRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, gap: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  medRowFirst: { borderTopWidth: 0 },
  medInfo:     { flex: 1, minWidth: 0 },
  medName:     { fontSize: TEXT.md, fontWeight: '700', color: '#1a1a1a' },
  medNameTaken:{ color: '#aaa', textDecorationLine: 'line-through' },
  medSub:      { fontSize: TEXT.sm, color: '#888', marginTop: 2 },

  empty:       { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon:   { fontSize: 36 },
  emptyText:   { fontSize: 14, color: '#aaa' },
  emptyAddBtn: { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyAddText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  addBtn:     { margin: 12, marginTop: 4, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: GREEN, borderStyle: 'dashed' },
  addBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
});
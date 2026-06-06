import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Alert, Platform,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (patient: OfflinePatientData) => Promise<void>;
  saving: boolean;
}

export interface OfflinePatientData {
  name: string;
  age: string;
  healthCondition: string;
  medications: OfflineMedication[];
}

export interface OfflineMedication {
  name: string;
  dosage: string;
  frequency: string;
  time: string;
}

const FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every other day',
  'Weekly',
];

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];

export default function AddOfflinePatientModal({ visible, onClose, onSave, saving }: Props) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [healthCondition, setHealthCondition] = useState('');
  
  // Medication form state
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('Once daily');
  const [medHour, setMedHour] = useState('08');
  const [medMinute, setMedMinute] = useState('00');
  const [medAmpm, setMedAmpm] = useState<'AM' | 'PM'>('AM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFreqDrop, setShowFreqDrop] = useState(false);
  
  const [medications, setMedications] = useState<OfflineMedication[]>([]);

  const reset = () => {
    setName('');
    setAge('');
    setHealthCondition('');
    setMedName('');
    setMedDosage('');
    setMedFreq('Once daily');
    setMedHour('08');
    setMedMinute('00');
    setMedAmpm('AM');
    setShowTimePicker(false);
    setShowFreqDrop(false);
    setMedications([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const addMedication = () => {
    if (!medName.trim()) {
      showAlert('Required', 'Please enter a medication name.');
      return;
    }
    const newMed: OfflineMedication = {
      name: medName.trim(),
      dosage: medDosage.trim() || 'As prescribed',
      frequency: medFreq,
      time: `${medHour}:${medMinute} ${medAmpm}`,
    };
    setMedications([...medications, newMed]);
    setMedName('');
    setMedDosage('');
    setMedFreq('Once daily');
    setMedHour('08');
    setMedMinute('00');
    setMedAmpm('AM');
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Required', 'Please enter a patient name.'); return; }
    if (!age.trim()) { showAlert('Required', 'Please enter the patient age.'); return; }
    
    const patientData: OfflinePatientData = {
      name: name.trim(),
      age: age.trim(),
      healthCondition: healthCondition.trim() || 'Not specified',
      medications,
    };
    
    await onSave(patientData);
    reset();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={s.card}>
          <View style={s.header}>
            <AppLogo size={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>Offline Patient</Text>
              <Text style={s.title}>Add patient without phone</Text>
              <Text style={s.sub}>Create medication schedules for patients without accounts</Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <AppIcon name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Patient Info */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Patient Information</Text>
              
              <View style={s.fieldGroup}>
                <Text style={s.label}>Name *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Patient name"
                  placeholderTextColor="#c0c0c0"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Age *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Age"
                  placeholderTextColor="#c0c0c0"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Health Condition</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., Hypertension, Diabetes"
                  placeholderTextColor="#c0c0c0"
                  value={healthCondition}
                  onChangeText={setHealthCondition}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Add Medication */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Add Medication</Text>
              
              <View style={s.fieldGroup}>
                <Text style={s.label}>Medication Name *</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., Lisinopril"
                  placeholderTextColor="#c0c0c0"
                  value={medName}
                  onChangeText={setMedName}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Dosage</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., 10mg, 1 tablet"
                  placeholderTextColor="#c0c0c0"
                  value={medDosage}
                  onChangeText={setMedDosage}
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Frequency</Text>
                <TouchableOpacity
                  style={[s.dropdown, showFreqDrop && s.dropdownOpen]}
                  onPress={() => setShowFreqDrop(!showFreqDrop)}
                >
                  <Text style={s.dropdownText}>{medFreq}</Text>
                  <Text style={s.dropdownArrow}>{showFreqDrop ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showFreqDrop && (
                  <View style={s.dropdownList}>
                    {FREQUENCIES.map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[s.dropdownItem, medFreq === freq && s.dropdownItemActive]}
                        onPress={() => { setMedFreq(freq); setShowFreqDrop(false); }}
                      >
                        <Text style={[s.dropdownItemText, medFreq === freq && s.dropdownItemTextActive]}>
                          {freq}
                        </Text>
                        {medFreq === freq && <Text style={{ color: theme.green }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Time</Text>
                <TouchableOpacity
                  style={[s.dropdown, showTimePicker && s.dropdownOpen]}
                  onPress={() => setShowTimePicker(!showTimePicker)}
                >
                  <Text style={s.dropdownText}>{showTimePicker ? 'Select time' : `${medHour}:${medMinute} ${medAmpm}`}</Text>
                  <Text style={s.dropdownArrow}>{showTimePicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showTimePicker && (
                  <View style={s.timePicker}>
                    <View style={s.timePickerRow}>
                      <View style={s.timeCol}>
                        <Text style={s.timeColLabel}>HR</Text>
                        <ScrollView style={s.timeScroll} nestedScrollEnabled>
                          {HOURS.map(h => (
                            <TouchableOpacity
                              key={h}
                              style={[s.timeItem, medHour === h && s.timeItemActive]}
                              onPress={() => setMedHour(h)}
                            >
                              <Text style={[s.timeItemText, medHour === h && s.timeItemTextActive]}>{h}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <Text style={s.timeSep}>:</Text>
                      <View style={s.timeCol}>
                        <Text style={s.timeColLabel}>MIN</Text>
                        <ScrollView style={s.timeScroll} nestedScrollEnabled>
                          {MINUTES.map(m => (
                            <TouchableOpacity
                              key={m}
                              style={[s.timeItem, medMinute === m && s.timeItemActive]}
                              onPress={() => setMedMinute(m)}
                            >
                              <Text style={[s.timeItemText, medMinute === m && s.timeItemTextActive]}>{m}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={s.ampmCol}>
                        {(['AM', 'PM'] as const).map(p => (
                          <TouchableOpacity
                            key={p}
                            style={[s.ampmBtn, medAmpm === p && s.ampmBtnActive]}
                            onPress={() => setMedAmpm(p)}
                          >
                            <Text style={[s.ampmText, medAmpm === p && s.ampmTextActive]}>{p}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity style={s.timeDoneBtn} onPress={() => setShowTimePicker(false)}>
                      <Text style={s.timeDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity style={s.addMedBtn} onPress={addMedication}>
                <AppIcon name="add-circle-outline" size={20} color={theme.green} />
                <Text style={s.addMedText}>Add Medication</Text>
              </TouchableOpacity>
            </View>

            {/* Medications List */}
            {medications.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Medications ({medications.length})</Text>
                {medications.map((med, index) => (
                  <View key={index} style={s.medRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.medName}>{med.name}</Text>
                      <Text style={s.medSub}>{med.dosage} · {med.frequency} · {med.time}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMedication(index)}>
                      <AppIcon name="trash-outline" size={20} color="#d32f2f" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={s.saveText}>{saving ? 'Saving...' : 'Save Patient'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 40, 22, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.greenLight,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: theme.green, letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 },
  sub: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  scroll: { maxHeight: 500, paddingHorizontal: 18, paddingVertical: 12 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: TEXT.md,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  fieldGroup: { marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.text,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOpen: { borderColor: theme.green },
  dropdownText: { fontSize: 15, color: theme.text },
  dropdownArrow: { fontSize: 12, color: '#888' },
  dropdownList: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemActive: { backgroundColor: theme.greenLight },
  dropdownItemText: { fontSize: 14, color: theme.text },
  dropdownItemTextActive: { color: theme.green, fontWeight: '700' },
  timePicker: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    marginTop: 4,
    padding: 12,
    backgroundColor: '#fff',
  },
  timePickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 8,
    textAlign: 'center',
  },
  timePickerRow: { flexDirection: 'row', gap: 8 },
  timeCol: { flex: 1 },
  timeColLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    marginBottom: 4,
    textAlign: 'center',
  },
  timeScroll: { maxHeight: 100 },
  timeItem: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeItemActive: { backgroundColor: theme.greenLight },
  timeItemText: { fontSize: 14, color: theme.text },
  timeItemTextActive: { color: theme.green, fontWeight: '700' },
  timeSep: { fontSize: 18, fontWeight: '700', color: theme.text, alignSelf: 'center' },
  ampmCol: { gap: 4 },
  ampmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  ampmBtnActive: { backgroundColor: theme.green, borderColor: theme.green },
  ampmText: { fontSize: 14, fontWeight: '700', color: '#888' },
  ampmTextActive: { color: '#fff' },
  timeDoneBtn: {
    backgroundColor: theme.green,
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeDoneText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  addMedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.greenLight,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: theme.green,
    borderStyle: 'dashed',
  },
  addMedText: { color: theme.green, fontWeight: '700', fontSize: 14 },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
  },
  medName: { fontSize: 14, fontWeight: '700', color: theme.text },
  medSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: '#fafcfa',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.green,
  },
  saveText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

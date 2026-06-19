import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions, TextInput,
  ActivityIndicator, Alert, Platform, Modal, Animated, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLinkedPatients, getMedications, getIncomingLinkRequests, getUser,
  acceptLinkRequest, rejectLinkRequest, updateLinkedPatientProfile,
  sendPatientReminder, unlinkPatient, getIntelligenceProfile, getPillboxStatus,
} from '@/api/index';
import { registerAndSavePushTokenIfNeeded } from '@/lib/pushNotifications';
import { subscribePatientMedications, mapMedicationRows } from '@/services/medicationRealtime';
import { subscribeCaretakerOverview } from '@/services/caretakerRealtime';
import { cachePatients, getCachedPatients } from '@/lib/offline/store';
import { flushOfflineQueue } from '@/lib/offline/sync';
import { useNetworkStatus } from '@/lib/offline/network';
import { medicationTimeBucket, parseMedicationTime } from '@/utils/medicationTimeBucket';
import DoseStatusBadge from '@/components/DoseStatusBadge';
import LinkedPatientsScreen from '@/components/LinkedPatientsScreen';
import { patientMatchesSearch } from '@/utils/patientSearch';
import type { PatientMedication } from '@/types/medication';
import MedicationsScreen from '@/components/MedicationsScreen';
import LinkPatientModal from '@/components/Linkpatientmodal';
import PatientSearchBar from '@/components/PatientSearchBar';
import AppIcon, { TAB_ICONS } from '@/components/AppIcon';
import MenuRow from '@/components/MenuRow';
import StatTile from '@/components/StatTile';
import SwipeTabHost from '@/components/SwipeTabHost';
import NavTutorialOverlay from '@/components/NavTutorialOverlay';
import SwitchModeModal from '@/components/SwitchModeModal';
import WeekCalendarStrip from '@/components/WeekCalendarStrip';
import LogoutModal from '@/components/LogoutModal';
import AppLogo from '@/components/AppLogo';
import { SkeletonPatientRow } from '@/components/Skeleton';
import StatisticsScreen from '@/components/StatisticsScreen';
import MedicationInventoryScreen from '@/components/MedicationInventoryScreen';
import PillboxScreen from '@/screens/PillboxScreen';
import {
  getRiskLevel, getRiskColor, getRiskBg, getRecommendedActionForProfile,
  isSampleInsufficient, getLearningPatternMessage,
  type IntelligenceProfile,
} from '@/lib/intelligenceDisplay';
import EditProfileModal from '@/components/EditProfileModal';
import AddOfflinePatientModal, { type OfflinePatientData } from '@/components/AddOfflinePatientModal';
import {
  isTutorialDone, setTutorialDone, CAREGIVER_TUTORIAL,
} from '@/lib/tutorial';
import { confirmAndExportCSV } from '@/lib/dataExport';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IonName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  onLogout: () => void;
  uid: string;
  onSwitchToFamily?: () => void;
}

const GREEN       = '#3d8f5a';
const GREEN_DARK  = '#2f6f47';
const GREEN_LIGHT = '#eef6f0';

type CaretakerTab = 'Home' | 'Patients' | 'Schedule' | 'Medications' | 'Manage';

const FILTERS = ['All', 'Active', 'Inactive', 'Missed Doses', 'Needs Attention'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Active':          { bg: '#e8f5e9', text: '#2d7a3a' },
  'Missed Doses':    { bg: '#fff3e0', text: '#e65100' },
  'Needs Attention': { bg: '#fce4ec', text: '#c62828' },
  'Inactive':        { bg: '#f5f5f5', text: '#777' },
};

interface Patient {
  id: string;
  firebase_uid: string;
  full_name: string;
  email: string;
  age: number;
  missed_doses: number;
  compliance: number;
  link_status: string;
  health_condition?: string;
}

function getPatientStatus(patient: Patient): string {
  if (patient.link_status === 'inactive') return 'Inactive';
  if ((patient.missed_doses ?? 0) >= 5)   return 'Needs Attention';
  if ((patient.missed_doses ?? 0) > 0)    return 'Missed Doses';
  return 'Active';
}

const SIDE_TABS: { icon: IonName; label: CaretakerTab }[] = [
  { icon: TAB_ICONS.Home, label: 'Home' },
  { icon: TAB_ICONS.Patients, label: 'Patients' },
  { icon: TAB_ICONS.Schedule, label: 'Schedule' },
  { icon: TAB_ICONS.Medications, label: 'Medications' },
  { icon: TAB_ICONS.Manage, label: 'Manage' },
];

export default function CaretakerDashboard({ onLogout, uid, onSwitchToFamily }: Props) {
  const insets   = useSafeAreaInsets();
  const { width }= Dimensions.get('window');
  const isTablet = width >= 768;

  const [activeTab,    setActiveTab]    = useState<CaretakerTab>('Patients');
  const [activeFilter, setActiveFilter] = useState('All');
  const [search,       setSearch]       = useState('');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [loading,      setLoading]      = useState(true);

  // Medications tab state
  const [selectedPatient,    setSelectedPatient]    = useState<Patient | null>(null);
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([]);
  const [loadingMeds,        setLoadingMeds]        = useState(false);
  const [scheduleByPatient,  setScheduleByPatient]  = useState<Record<string, PatientMedication[]>>({});
  const [showLinkModal,      setShowLinkModal]      = useState(false);
  const [linkRequests,       setLinkRequests]       = useState<any[]>([]);
  const [caregiverName,      setCaregiverName]      = useState('');
  const [profilePicture,     setProfilePicture]     = useState<string | null>(null);
  const [showEditProfile,    setShowEditProfile]    = useState(false);
  const [editPatient,        setEditPatient]        = useState<Patient | null>(null);
  const [editName,          setEditName]           = useState('');
  const [editAge,           setEditAge]            = useState('');
  const [editCondition,     setEditCondition]      = useState('');
  const [medsShowAlerts,    setMedsShowAlerts]     = useState(false);
  const [showTutorial,      setShowTutorial]       = useState(false);
  const [tutorialIdx,       setTutorialIdx]        = useState(0);
  const [showLogoutModal,   setShowLogoutModal]    = useState(false);
  const [showSwitchFamily,  setShowSwitchFamily]   = useState(false);
  const [scheduleDate,      setScheduleDate]       = useState(new Date());
  const [showStatistics,    setShowStatistics]     = useState(false);
  const [showInventory,     setShowInventory]      = useState(false);
  const [selectedPatientForInventory, setSelectedPatientForInventory] = useState<string | null>(null);
  const [showPillbox,       setShowPillbox]        = useState(false);
  const [selectedPatientForPillbox, setSelectedPatientForPillbox] = useState<string | null>(null);
  const [pillboxStatus, setPillboxStatus] = useState<{ connected: boolean; device_id?: string }>({ connected: false });
  const [mlProfiles, setMlProfiles] = useState<Record<string, IntelligenceProfile>>({});
  const [mlLoading, setMlLoading] = useState<Record<string, boolean>>({});
  const [schedulePatientUid, setSchedulePatientUid] = useState<string | null>(null);
  const [showLinkedPatients, setShowLinkedPatients] = useState(false);
  const patientsScrollY = useRef(new Animated.Value(0)).current;
  const [showOfflinePatientModal, setShowOfflinePatientModal] = useState(false);
  const [savingOfflinePatient, setSavingOfflinePatient] = useState(false);

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
    else Alert.alert(title, message);
  }, []);

  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable;

  const fetchPatients = useCallback(async (quiet?: boolean) => {
    if (!quiet) setLoading(true);
    try {
      const res = await getLinkedPatients(uid);
      const list = Array.isArray(res.data) ? res.data : [];
      
      // Load offline patients from AsyncStorage
      const offlinePatientsKey = `offline_patients_${uid}`;
      const offlineData = await AsyncStorage.getItem(offlinePatientsKey);
      const offlinePatients = (offlineData ? JSON.parse(offlineData) : [])
        .map((p: any) => {
          const full_name = (p.full_name || p.name || '').trim();
          const id = p.id || p.firebase_uid || `offline_${Date.now()}`;
          return {
            ...p,
            id,
            firebase_uid: p.firebase_uid || id,
            full_name,
            isOffline: true,
          };
        })
        .filter((p: any) => p.full_name);
      
      // Combine online and offline patients
      const allPatients = [...list, ...offlinePatients];
      setPatients(allPatients);
      await cachePatients(uid, list);
      if (!quiet) setLoading(false);

      const offlineMedMap: Record<string, PatientMedication[]> = {};
      offlinePatients.forEach((p: any) => {
        offlineMedMap[p.firebase_uid] = p.medications.map((med: any) => ({
          id: `${p.firebase_uid}_${med.name}`,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          time: med.time,
          taken: false,
          missed: false,
          suspended: false,
        }));
      });

      const onlineMedEntries = await Promise.all(
        list.map(async (p) => {
          try {
            const mres = await getMedications(p.firebase_uid);
            const rows = Array.isArray(mres.data) ? mres.data : [];
            return [p.firebase_uid, await mapMedicationRows(rows)] as const;
          } catch {
            return [p.firebase_uid, []] as const;
          }
        }),
      );

      setScheduleByPatient(prev => ({
        ...prev,
        ...Object.fromEntries(onlineMedEntries),
        ...offlineMedMap,
      }));
    } catch {
      const cached = await getCachedPatients(uid);
      if (cached?.length) {
        setPatients(cached as Patient[]);
      } else if (!quiet) {
        showAlert('Error', 'Could not load patients. Check your connection.');
      }
    } finally { if (!quiet) setLoading(false); }
  }, [uid, showAlert]);

  useEffect(() => {
    if (patients.length === 0) {
      setPillboxStatus({ connected: false });
      return;
    }
    getPillboxStatus(patients[0].firebase_uid)
      .then(res => setPillboxStatus(res.data))
      .catch(() => setPillboxStatus({ connected: false }));
  }, [patients]);

  useEffect(() => {
    if (patients.length === 0) {
      setMlProfiles({});
      setMlLoading({});
      return;
    }
    const initialLoading: Record<string, boolean> = {};
    patients.forEach(p => { initialLoading[p.firebase_uid] = true; });
    setMlLoading(initialLoading);

    patients.forEach(p => {
      getIntelligenceProfile(p.firebase_uid)
        .then(res => {
          setMlProfiles(prev => ({ ...prev, [p.firebase_uid]: res.data as IntelligenceProfile }));
        })
        .catch(() => {})
        .finally(() => {
          setMlLoading(prev => ({ ...prev, [p.firebase_uid]: false }));
        });
    });
  }, [patients]);

  useEffect(() => {
    if (online) flushOfflineQueue().then(n => { if (n > 0) fetchPatients(true); });
  }, [online, fetchPatients]);

  useEffect(() => {
    getUser(uid)
      .then(r => {
        setCaregiverName((r.data?.full_name as string | undefined)?.trim() || '');
        setProfilePicture((r.data?.profile_picture as string | undefined) ?? null);
      })
      .catch(() => {});
    registerAndSavePushTokenIfNeeded(uid);
    isTutorialDone('caregiver', uid).then(done => {
      if (!done) {
        setTutorialIdx(0);
        setShowTutorial(true);
      }
    });
  }, [uid]);

  useEffect(() => {
    if (!showTutorial) return;
    const step = CAREGIVER_TUTORIAL[tutorialIdx];
    if (step?.tab) setActiveTab(step.tab as CaretakerTab);
  }, [showTutorial, tutorialIdx]);

  const handleSendReminder = useCallback(async (patient: Patient) => {
    try {
      const res = await sendPatientReminder({
        caretaker_uid: uid,
        patient_uid: patient.firebase_uid,
        message: `Reminder from your caregiver: please take your medication.`,
      });
      const pushSent = res.data?.push_sent;
      const pushErr = res.data?.push_error;
      const msg = pushSent
        ? `Reminder sent to ${patient.full_name ?? patient.email}. They should get a notification with sound.`
        : `Reminder saved. ${pushErr || 'Patient must open the installed GabayRa app once to enable push notifications.'}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(pushSent ? 'Reminder sent' : 'Reminder recorded', msg);
    } catch {
      if (Platform.OS === 'web') window.alert('Could not send reminder.');
      else Alert.alert('Error', 'Could not send reminder.');
    }
  }, [uid]);

  const handleExportData = useCallback(async () => {
    try {
      const exportDate = new Date().toISOString().slice(0, 10);
      const allMeds = Object.values(scheduleByPatient).flat();
      const stats = {
        total: allMeds.length,
        taken: allMeds.filter(m => m.taken && !m.suspended).length,
        missed: allMeds.filter(m => m.missed && !m.suspended).length,
        late: 0,
        pending: allMeds.filter(m => !m.taken && !m.missed && !m.suspended).length,
        complianceRate: allMeds.length > 0 
          ? Math.round((allMeds.filter(m => m.taken && !m.suspended).length / allMeds.length) * 100) 
          : 0,
      };

      const exportData = {
        exportDate,
        user: {
          name: caregiverName,
          email: '',
          role: 'caretaker',
        },
        medications: allMeds.map(m => ({
          date: exportDate,
          medicationName: m.name,
          dosage: m.dosage,
          time: m.time,
          status: m.taken ? 'taken' as const : m.missed ? 'missed' as const : 'pending' as const,
        })),
        connectedAccounts: patients.map(p => ({
          id: p.firebase_uid,
          name: p.full_name || p.email || 'Unknown',
          type: 'patient' as const,
          email: p.email || '',
        })),
        statistics: stats,
      };

      const exported = await confirmAndExportCSV(exportData);
      if (!exported) return;
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
  }, [scheduleByPatient, caregiverName, patients]);

  const handleSaveOfflinePatient = useCallback(async (patientData: OfflinePatientData) => {
    setSavingOfflinePatient(true);
    try {
      // Store offline patients in AsyncStorage
      const trimmedName = patientData.name.trim();
      if (!trimmedName) {
        Alert.alert('Required', 'Please enter a patient name.');
        return;
      }

      const offlinePatientsKey = `offline_patients_${uid}`;
      const existingData = await AsyncStorage.getItem(offlinePatientsKey);
      const existingPatients = existingData ? JSON.parse(existingData) : [];

      const patientId = `offline_${Date.now()}`;
      const newPatient = {
        id: patientId,
        firebase_uid: patientId,
        full_name: trimmedName,
        name: trimmedName,
        age: patientData.age,
        healthCondition: patientData.healthCondition,
        medications: patientData.medications,
        isOffline: true,
        createdAt: new Date().toISOString(),
      };
      
      const updatedPatients = [...existingPatients, newPatient];
      await AsyncStorage.setItem(offlinePatientsKey, JSON.stringify(updatedPatients));
      
      // Reload patients to include offline patients
      await fetchPatients();
      
      if (Platform.OS === 'web') {
        window.alert(`Offline patient "${patientData.name}" saved with ${patientData.medications.length} medications.`);
      } else {
        Alert.alert('Success', `Offline patient "${patientData.name}" saved with ${patientData.medications.length} medications.`);
      }
      setShowOfflinePatientModal(false);
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Failed to save offline patient');
      } else {
        Alert.alert('Error', 'Failed to save offline patient');
      }
    } finally {
      setSavingOfflinePatient(false);
    }
  }, [uid, fetchPatients]);

  useEffect(() => { fetchPatients(false); }, [fetchPatients]);

  const patientUidKey = patients.map(p => p.firebase_uid).sort().join(',');

  useEffect(() => {
    if (!patientUidKey) return;
    return subscribeCaretakerOverview(
      patients.map(p => p.firebase_uid),
      {
        onOverviewChange: () => { fetchPatients(true); },
        onPatientMeds: (patientUid, meds) => {
          setScheduleByPatient(prev => ({ ...prev, [patientUid]: meds }));
        },
      },
    );
  }, [patientUidKey, fetchPatients]);

  useEffect(() => {
    if (!selectedPatient) {
      setPatientMedications([]);
      setLoadingMeds(false);
      return;
    }
    setLoadingMeds(true);
    const unsub = subscribePatientMedications(selectedPatient.firebase_uid, meds => {
      setPatientMedications(meds);
      setLoadingMeds(false);
    });
    return () => unsub();
  }, [selectedPatient?.firebase_uid]);

  const fetchLinkRequests = useCallback(async () => {
    try {
      const res = await getIncomingLinkRequests(uid);
      setLinkRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLinkRequests([]);
    }
  }, [uid]);

  useEffect(() => {
    fetchLinkRequests();
  }, [fetchLinkRequests]);

  useEffect(() => {
    const id = setInterval(fetchLinkRequests, 15000);
    return () => clearInterval(id);
  }, [fetchLinkRequests]);

  const loadPatientMedications = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab('Medications');
  };

  const filtered = patients.filter(p => {
    const status = getPatientStatus(p);
    const matchFilter = activeFilter === 'All' || status === activeFilter;
    return matchFilter && patientMatchesSearch(p, search);
  });

  const stats = {
    total:     patients.length,
    active:    patients.filter(p => getPatientStatus(p) === 'Active').length,
    missed:    patients.reduce((sum, p) => sum + Number(p.missed_doses ?? 0), 0),
    attention: patients.filter(p => getPatientStatus(p) === 'Needs Attention').length,
  };

  // ── HOME SCREEN (render fn — not a nested component, keeps TextInput focus stable) ──
  const renderHomeTab = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      <View style={styles.homeGreeting}>
        <View style={styles.homeGreetingIcon}>
          <AppIcon name="hand-left-outline" size={26} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.homeGreetingTitle}>
            Welcome back{caregiverName ? `, ${caregiverName.split(/\s+/)[0]}` : ''}!
          </Text>
          <Text style={styles.homeGreetingSub}>Here's a quick overview of your patients.</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatTile icon="people-outline" value={stats.total} label="Total Patients" accent={GREEN} />
        <StatTile icon="checkmark-circle-outline" value={stats.active} label="Active" accent={GREEN} />
        <StatTile icon="alert-circle-outline" value={stats.missed} label="Missed Doses" accent="#e65100" iconBg="#fff3e0" />
        <StatTile icon="warning-outline" value={stats.attention} label="Needs Attention" accent="#c62828" iconBg="#fce4ec" />
      </View>

      <MenuRow icon="people-outline" label="View all patients" sub="Open your patient list" onPress={() => setActiveTab('Patients')} />
      <MenuRow
        icon="medical-outline"
        label="Patient medications"
        sub="Browse meds by patient"
        onPress={() => { setSelectedPatient(null); setPatientMedications([]); setActiveTab('Medications'); }}
      />
      <MenuRow
        icon="notifications-outline"
        label="Check alerts"
        sub="See who needs follow-up"
        onPress={() => { setMedsShowAlerts(true); setActiveTab('Medications'); }}
      />

      <View style={styles.homeTipCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <AppIcon name="bulb-outline" size={18} color="#f57f17" />
          <Text style={styles.homeTipTitle}>Tip</Text>
        </View>
        <Text style={styles.homeTipText}>
          Patients with 5+ missed doses are flagged as "Needs Attention". Reach out to them with a reminder.
        </Text>
      </View>
    </ScrollView>
  );

  // ── PATIENTS SCREEN ──
  const PatientRow = ({ patient }: { patient: Patient }) => {
    const isExpanded  = expandedId === patient.firebase_uid;
    const status      = getPatientStatus(patient);
    const statusColor = STATUS_COLORS[status] ?? { bg: '#eee', text: '#333' };

    return (
      <View style={styles.patientCard}>
        <TouchableOpacity
          style={styles.patientRow}
          onPress={() => setExpandedId(isExpanded ? null : patient.firebase_uid)}
          activeOpacity={0.8}
        >
          <View style={[styles.patientLeft, styles.colPatient]}>
            <Text style={styles.chevron}>{isExpanded ? '▼' : '▶'}</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(patient.full_name ?? patient.email ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.patientName}>{patient.full_name ?? patient.email}</Text>
              <Text style={styles.patientSub}>{patient.age ? `Age ${patient.age}` : 'Age unknown'}</Text>
            </View>
          </View>
          {isTablet ? (
            <View style={styles.patientMeta}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaText, { color: (patient.missed_doses ?? 0) > 0 ? '#e65100' : GREEN }]}>
                  {patient.missed_doses ?? 0} missed
                </Text>
              </View>
              <View style={styles.metaCol}>
                <View style={[styles.compliancePill, { backgroundColor: (patient.compliance ?? 0) >= 80 ? GREEN_LIGHT : (patient.compliance ?? 0) >= 60 ? '#fff3e0' : '#fce4ec' }]}>
                  <Text style={[styles.complianceText, { color: (patient.compliance ?? 0) >= 80 ? GREEN : (patient.compliance ?? 0) >= 60 ? '#e65100' : '#c62828' }]}>
                    {Math.round(Number(patient.compliance ?? 0))}%
                  </Text>
                </View>
              </View>
              <View style={styles.metaCol}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                  <Text style={[styles.statusText, { color: statusColor.text }]}>{status}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>{status}</Text>
            </View>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.expandedStats}>
              {[
                { num: patient.missed_doses ?? 0,     label: 'Missed Doses' },
                { num: `${Math.round(Number(patient.compliance ?? 0))}%`, label: 'Compliance'   },
                { num: patient.age ?? '—',             label: 'Age'          },
              ].map((s, i) => (
                <View key={i} style={styles.expandedStat}>
                  <Text style={styles.expandedStatNum}>{s.num}</Text>
                  <Text style={styles.expandedStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            {mlLoading[patient.firebase_uid] ? (
              <View style={[styles.mlInsightCard, { borderColor: '#bdbdbd' }]}>
                <View style={styles.mlInsightHeader}>
                  <Text style={styles.mlInsightLabel}>ML risk</Text>
                  <ActivityIndicator size="small" color={GREEN} />
                </View>
                <Text style={styles.mlInsightAction}>Loading risk profile…</Text>
              </View>
            ) : mlProfiles[patient.firebase_uid] && (() => {
              const profile = mlProfiles[patient.firebase_uid];
              const learning = isSampleInsufficient(profile);
              const riskLevel = getRiskLevel(profile);
              const riskColor = learning ? '#757575' : getRiskColor(riskLevel);
              return (
                <View style={[styles.mlInsightCard, { borderColor: riskColor }]}>
                  <View style={styles.mlInsightHeader}>
                    <Text style={styles.mlInsightLabel}>ML risk</Text>
                    {!learning && (
                      <View style={[styles.riskBadge, { backgroundColor: getRiskBg(riskLevel) }]}>
                        <Text style={[styles.riskBadgeText, { color: riskColor }]}>{riskLevel}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.mlInsightAction}>
                    {learning
                      ? getLearningPatternMessage()
                      : `Action: ${getRecommendedActionForProfile(profile)}`}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.expandedActions}>
              <TouchableOpacity
                style={styles.actionBtnGreen}
                onPress={() => loadPatientMedications(patient)}
              >
                <AppIcon name="medical-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>View medications</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnOutline}
                onPress={() => {
                  setSchedulePatientUid(patient.firebase_uid);
                  setActiveTab('Schedule');
                }}
              >
                <AppIcon name="calendar-outline" size={18} color={GREEN} />
                <Text style={styles.actionBtnOutlineText}>Schedule</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { marginTop: 8 }]}
              onPress={() => {
                setSelectedPatientForInventory(patient.firebase_uid);
                setShowInventory(true);
              }}
            >
              <AppIcon name="cube-outline" size={18} color={GREEN} />
              <Text style={styles.actionBtnOutlineText}>View inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { marginTop: 8 }]}
              onPress={() => {
                setEditPatient(patient);
                setEditName((patient.full_name || '').trim());
                setEditAge(patient.age != null ? String(patient.age) : '');
                setEditCondition((patient.health_condition || '').trim());
              }}
            >
              <AppIcon name="create-outline" size={18} color={GREEN} />
              <Text style={styles.actionBtnOutlineText}>Edit patient info</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { marginTop: 8 }]}
              onPress={() => handleSendReminder(patient)}
            >
              <AppIcon name="notifications-outline" size={18} color={GREEN} />
              <Text style={styles.actionBtnOutlineText}>Send reminder</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderPatientsTab = () => {
    const statsTranslateY = patientsScrollY.interpolate({
      inputRange: [0, 80],
      outputRange: [0, -24],
      extrapolate: 'clamp',
    });

    return (
    <Animated.ScrollView
      style={styles.mainContent}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: patientsScrollY } } }],
        { useNativeDriver: true },
      )}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Animated.View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          gap: 10,
          transform: [{ translateY: statsTranslateY }],
        }}
      >
        <View style={styles.statsRow}>
          <StatTile compact icon="people-outline" value={stats.total} label="Total Patients" accent={GREEN} />
          <StatTile compact icon="checkmark-circle-outline" value={stats.active} label="Active" accent={GREEN} />
          <StatTile compact icon="alert-circle-outline" value={stats.missed} label="Missed Doses" accent="#e65100" iconBg="#fff3e0" />
          <StatTile compact icon="warning-outline" value={stats.attention} label="Needs Attention" accent="#c62828" iconBg="#fce4ec" />
        </View>

        <View style={styles.searchFilterContainer}>
          <PatientSearchBar value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTabCompact, activeFilter === f && styles.filterTabActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {linkRequests.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.screenTitle}>Pending link requests</Text>
            {linkRequests.map((lr: any) => (
              <View key={lr.id} style={styles.requestCard}>
                <Text style={styles.requestTitle}>{lr.patient_name || lr.patient_email}</Text>
                <Text style={styles.requestSub}>Wants to connect with you</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={styles.requestAccept}
                    onPress={async () => {
                      try {
                        await acceptLinkRequest(lr.id, uid);
                        await fetchPatients(true);
                        await fetchLinkRequests();
                      } catch {
                        showAlert('Error', 'Could not accept.');
                      }
                    }}
                  >
                    <Text style={styles.requestAcceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.requestReject}
                    onPress={async () => {
                      try {
                        await rejectLinkRequest(lr.id, { caretaker_uid: uid });
                        await fetchLinkRequests();
                      } catch {
                        showAlert('Error', 'Could not decline.');
                      }
                    }}
                  >
                    <Text style={styles.requestRejectText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {isTablet && (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colPatient]}>Patient</Text>
            <Text style={[styles.tableHeaderText, styles.colMeta]}>Missed</Text>
            <Text style={[styles.tableHeaderText, styles.colMeta]}>Compliance</Text>
            <Text style={[styles.tableHeaderText, styles.colMeta]}>Status</Text>
          </View>
        )}
      </Animated.View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading patients...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>No patients linked yet</Text>
          <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>
            Ask patients to link their account to yours
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 0 }}>
          {filtered.map(p => <PatientRow key={p.firebase_uid} patient={p} />)}
        </View>
      )}
    </Animated.ScrollView>
    );
  };

  // ── MEDICATIONS SCREEN ──
  const MedicationsTab = () => {
    if (medsShowAlerts) {
      return (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={ct.backBtn} onPress={() => setMedsShowAlerts(false)}>
            <Text style={ct.backBtnText}>← Back to medications</Text>
          </TouchableOpacity>
          {renderAlertsTab()}
        </View>
      );
    }

    // Patient selected — show their meds
    if (selectedPatient) {
      return (
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={ct.backBtn}
            onPress={() => { setSelectedPatient(null); setPatientMedications([]); }}
          >
            <Text style={ct.backBtnText}>← Back to patients</Text>
          </TouchableOpacity>

          {loadingMeds ? (
            <View style={ct.loadingWrap}>
              <ActivityIndicator size="large" color={GREEN} />
              <Text style={ct.loadingText}>Loading medications…</Text>
            </View>
          ) : (
            <MedicationsScreen
              medications={patientMedications}
              patientName={selectedPatient.full_name ?? selectedPatient.email}
              readOnly
            />
          )}
        </View>
      );
    }

    // No patient selected — show picker list
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#f0f4f0' }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
      >
        {/* Header banner */}
        <View style={ct.medsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={ct.medsHeaderTitle}>Patient medications</Text>
            <Text style={ct.medsHeaderSub}>Select a patient · Alerts live here too</Text>
          </View>
          <TouchableOpacity style={ct.alertsChip} onPress={() => setMedsShowAlerts(true)}>
            <AppIcon name="notifications-outline" size={18} color="#fff" />
            <Text style={ct.alertsChipText}>Alerts</Text>
          </TouchableOpacity>
        </View>

        {/* Summary stats */}
        <View style={ct.summaryRow}>
          <View style={[ct.summaryCard, { backgroundColor: GREEN_LIGHT }]}>
            <Text style={[ct.summaryNum, { color: GREEN }]}>{patients.length}</Text>
            <Text style={[ct.summaryLabel, { color: GREEN }]}>Patients</Text>
          </View>
          <View style={[ct.summaryCard, { backgroundColor: '#fff3e0' }]}>
            <Text style={[ct.summaryNum, { color: '#e65100' }]}>{stats.missed}</Text>
            <Text style={[ct.summaryLabel, { color: '#e65100' }]}>Missed Doses</Text>
          </View>
          <View style={[ct.summaryCard, { backgroundColor: '#fce4ec' }]}>
            <Text style={[ct.summaryNum, { color: '#c62828' }]}>{stats.attention}</Text>
            <Text style={[ct.summaryLabel, { color: '#c62828' }]}>Need Attention</Text>
          </View>
        </View>

        <Text style={ct.pickerSectionTitle}>SELECT A PATIENT</Text>

        {loading ? (
          <View style={{ gap: 10 }}>
            <SkeletonPatientRow />
            <SkeletonPatientRow />
          </View>
        ) : patients.length === 0 ? (
          <View style={ct.emptyCard}>
            <Text style={ct.emptyIcon}>👥</Text>
            <Text style={ct.emptyTitle}>No patients linked yet</Text>
            <Text style={ct.emptySub}>Patients will appear here once they link their account</Text>
          </View>
        ) : (
          patients.map(p => {
            const status      = getPatientStatus(p);
            const statusColor = STATUS_COLORS[status] ?? { bg: '#eee', text: '#333' };
            return (
              <TouchableOpacity
                key={p.firebase_uid}
                style={ct.patientMedRow}
                onPress={() => loadPatientMedications(p)}
                activeOpacity={0.8}
              >
                <View style={ct.avatar}>
                  <Text style={ct.avatarText}>
                    {(p.full_name ?? p.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={ct.patientName}>{p.full_name ?? p.email}</Text>
                  <Text style={ct.patientSub}>
                    {p.age ? `Age ${p.age}` : 'Age unknown'} · {p.missed_doses ?? 0} missed dose{(p.missed_doses ?? 0) !== 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={[ct.compBadge, { backgroundColor: statusColor.bg }]}>
                  <Text style={[ct.compBadgeText, { color: statusColor.text }]}>{status}</Text>
                </View>

              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ── SCHEDULE SCREEN ──
  const renderScheduleTab = () => {
    const markedDates = patients.flatMap(p =>
      (scheduleByPatient[p.firebase_uid] || [])
        .filter(m => !m.suspended)
        .map(() => new Date().toISOString().slice(0, 10)),
    );
    const scheduleList = schedulePatientUid
      ? patients.filter(p => p.firebase_uid === schedulePatientUid)
      : patients;
    return (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      {schedulePatientUid && (
        <TouchableOpacity
          style={styles.scheduleShowAllBtn}
          onPress={() => setSchedulePatientUid(null)}
        >
          <AppIcon name="arrow-back" size={16} color={GREEN} />
          <Text style={styles.scheduleShowAllText}>Show all patients</Text>
        </TouchableOpacity>
      )}
      <WeekCalendarStrip
        selectedDate={scheduleDate}
        onSelectDate={setScheduleDate}
        markedDates={markedDates}
      />
      <View style={styles.sectionHeaderRow}>
        <AppIcon name="calendar-outline" size={22} color={GREEN} />
        <Text style={styles.screenTitle}>Patient schedules</Text>
      </View>

      {patients.length === 0 ? (
        <View style={styles.emptyState}>
          <AppIcon name="calendar-outline" size={40} color="#ccc" />
          <Text style={styles.emptyText}>No patients linked yet</Text>
        </View>
      ) : (
        scheduleList.map(p => {
          const all = (scheduleByPatient[p.firebase_uid] || []).filter(m => !m.suspended);
          const sorted = [...all].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
          return (
          <View key={p.firebase_uid} style={styles.schedulePatientCard}>
            <View style={styles.schedulePatientHeader}>
              <View style={styles.scheduleAvatar}>
                <Text style={styles.scheduleAvatarText}>
                  {(p.full_name ?? p.email ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.schedulePatientName}>{p.full_name ?? p.email}</Text>
                <Text style={styles.schedulePatientSub}>Age {p.age ?? '—'} · {getPatientStatus(p)}</Text>
              </View>
            </View>
            <View style={styles.scheduleDivider} />
            {sorted.length === 0 ? (
              <Text style={styles.scheduleSlotEmpty}>No medications scheduled</Text>
            ) : (
              sorted.map(m => (
                <View key={m.id} style={styles.scheduleListRow}>
                  <View style={styles.scheduleTimePill}>
                    <Text style={styles.scheduleTimePillText} numberOfLines={1}>
                      {parseMedicationTime(m.time)?.label ?? m.time ?? '—'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scheduleMedLineBold}>{m.name}</Text>
                    <Text style={styles.scheduleMedLineSub}>{m.dosage}</Text>
                  </View>
                  <DoseStatusBadge med={m} />
                </View>
              ))
            )}
          </View>
        );})
      )}
    </ScrollView>
    );
  };

  // ── ALERTS SCREEN ──
  const renderAlertsTab = () => {
    const alertPatients = patients.filter(p =>
      getPatientStatus(p) !== 'Active' && getPatientStatus(p) !== 'Inactive'
    );
    return (
      <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View style={styles.sectionTitleRow}>
          <AppIcon name="notifications-outline" size={22} color={GREEN} />
          <Text style={styles.screenTitle}>Alerts</Text>
        </View>

        {alertPatients.length === 0 ? (
          <View style={styles.alertAllClear}>
            <View style={styles.alertClearIconWrap}>
              <AppIcon name="checkmark-circle" size={48} color={GREEN} />
            </View>
            <Text style={styles.alertAllClearTitle}>All Clear!</Text>
            <Text style={styles.alertAllClearSub}>No patients need attention right now.</Text>
          </View>
        ) : (
          alertPatients.map(p => {
            const status   = getPatientStatus(p);
            const isUrgent = status === 'Needs Attention';
            return (
              <View key={p.firebase_uid} style={[styles.alertCard, { borderLeftColor: isUrgent ? '#c62828' : '#e65100' }]}>
                <View style={[styles.alertIconWrap, { backgroundColor: isUrgent ? '#fce4ec' : '#fff3e0' }]}>
                  <AppIcon name={isUrgent ? 'warning' : 'alert-circle'} size={24} color={isUrgent ? '#c62828' : '#e65100'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertPatientName}>{p.full_name ?? p.email}</Text>
                  <Text style={styles.alertMessage}>
                    {isUrgent
                      ? `${p.missed_doses} missed doses — immediate follow-up recommended`
                      : `${p.missed_doses} missed dose${p.missed_doses !== 1 ? 's' : ''} this period`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.alertActionBtn, { backgroundColor: isUrgent ? '#fce4ec' : '#fff3e0' }]}
                  onPress={() => handleSendReminder(p)}
                >
                  <Text style={[styles.alertActionText, { color: isUrgent ? '#c62828' : '#e65100' }]}>
                    Remind
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={styles.alertInfoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AppIcon name="information-circle-outline" size={20} color={GREEN} />
            <Text style={styles.alertInfoTitle}>Alert thresholds</Text>
          </View>
          <View style={styles.alertInfoRow}>
            <AppIcon name="alert-circle-outline" size={16} color="#e65100" />
            <Text style={styles.alertInfoText}>Missed doses — 1 to 4 missed doses</Text>
          </View>
          <View style={styles.alertInfoRow}>
            <AppIcon name="warning-outline" size={16} color="#c62828" />
            <Text style={styles.alertInfoText}>Needs attention — 5+ missed doses</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // ── MANAGE SCREEN ──
  const renderManageTab = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      <View style={styles.profileHeader}>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.profileAvatarImg} />
        ) : (
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(caregiverName || 'Caregiver').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.profileName}>{caregiverName || 'Caregiver/Family'}</Text>
        <Text style={styles.profileUid}>ID: {uid?.slice(0, 12)}...</Text>
      </View>

      <Text style={styles.manageSection}>Profile</Text>
      <MenuRow
        icon="person-outline"
        label="Edit profile"
        sub="Update your name and photo"
        onPress={() => setShowEditProfile(true)}
      />

      <Text style={styles.manageSection}>Overview</Text>
      <MenuRow icon="people-outline" label="Linked patients" sub={`${patients.length} linked`} onPress={() => setShowLinkedPatients(true)} />
      <MenuRow icon="warning-outline" iconColor="#c62828" iconBg="#fce4ec" label="Needs attention" sub={`${stats.attention} patient${stats.attention !== 1 ? 's' : ''}`} showChevron={false} />
      <MenuRow icon="checkmark-circle-outline" label="Active patients" sub={`${stats.active} patient${stats.active !== 1 ? 's' : ''}`} showChevron={false} />

      <MenuRow
        icon="medical-outline"
        label="Medications"
        sub="View all patient medications"
        onPress={() => { setSelectedPatient(null); setPatientMedications([]); setActiveTab('Medications'); }}
      />

      <MenuRow
        icon="link-outline"
        label="Link patient / family"
        sub="Redeem code or review patient requests"
        onPress={() => setShowLinkModal(true)}
      />
      <MenuRow
        icon="person-add-outline"
        label="Add offline patient"
        sub="Create medication schedule for patient without phone"
        onPress={() => setShowOfflinePatientModal(true)}
      />

      <Text style={styles.manageSection}>Settings</Text>
      {onSwitchToFamily && (
  <MenuRow
    icon="home-outline"
    label="Switch to Family view"
    sub="Simpler home for supporting a few loved ones"
    onPress={() => setShowSwitchFamily(true)}
  />
)}
      <MenuRow
        icon="cube-outline"
        label="Medication Inventory"
        sub="View and manage patient medication stock"
        onPress={() => {
          if (patients.length > 0) {
            setSelectedPatientForInventory(patients[0].firebase_uid);
            setShowInventory(true);
          } else {
            showAlert('No patients', 'Link a patient first to manage their medication inventory.');
          }
        }}
      />
      <MenuRow
        icon="hardware-chip-outline"
        label={pillboxStatus.connected ? 'View Pillbox' : 'Connect to Pillbox'}
        sub={
          pillboxStatus.connected
            ? `${pillboxStatus.device_id ?? 'Pillbox'} · Connected`
            : 'Link a smart pillbox device'
        }
        onPress={() => {
          if (patients.length > 0) {
            setSelectedPatientForPillbox(patients[0].firebase_uid);
            setShowPillbox(true);
          } else {
            showAlert('No patients', 'Link a patient first to connect a pillbox.');
          }
        }}
      />
      <MenuRow
        icon="bar-chart-outline"
        label="Statistics"
        sub="View medication statistics"
        onPress={() => setShowStatistics(true)}
      />
      <MenuRow
        icon="download-outline"
        label="Export data"
        sub="Download your medication data"
        onPress={handleExportData}
      />
      <MenuRow
        icon="notifications-outline"
        label="Notification settings"
        sub="Alert thresholds and reminder defaults"
        onPress={() => showAlert('Notifications', 'Configure push and in-app alerts in a future update. Reminders use your intelligence profile today.')}
      />
      <MenuRow
        icon="lock-closed-outline"
        label="Privacy & security"
        sub="Data and account controls"
        onPress={() => showAlert('Privacy', 'Your data is stored securely on Neon and Firebase. Contact support to export or delete your account.')}
      />
      <MenuRow
        icon="help-circle-outline"
        label="Help & support"
        sub="Guides and contact"
        onPress={() => showAlert('Help', 'Swipe bottom icons to move between sections. Use Medications → Alerts for patient warnings.')}
      />

      <MenuRow
        icon="book-outline"
        label="Show tutorial"
        sub="Learn what each tab does"
        onPress={() => { setTutorialIdx(0); setShowTutorial(true); }}
      />
      <TouchableOpacity style={styles.logoutRowBtn} onPress={() => setShowLogoutModal(true)}>
        <AppIcon name="log-out-outline" size={22} color="#c62828" />
        <Text style={styles.logoutRowText}>Log Out</Text>
      </TouchableOpacity>
      <Text style={styles.versionText}>GabayRa v1.0.1</Text>
    </ScrollView>
  );

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':        return renderHomeTab();
      case 'Patients':    return renderPatientsTab();
      case 'Schedule':    return renderScheduleTab();
      case 'Medications': return <MedicationsTab />;
      case 'Manage':      return renderManageTab();
    }
  };

  const screenTitles: Record<CaretakerTab, string> = {
    Home:        'Home',
    Patients:    'Patients',
    Schedule:    'Schedule',
    Medications: 'Medications',
    Manage:      'Manage',
  };
  const screenSubs: Record<CaretakerTab, string> = {
    Home:        '',
    Patients:    `${patients.length} linked`,
    Schedule:    'Daily view',
    Medications: 'By patient',
    Manage:      'Account',
  };

  const saveEditedPatient = async () => {
    if (!editPatient) return;
    const ageNum = parseInt(editAge, 10);
    if (!editName.trim()) {
      showAlert('Required', 'Please enter the patient name.');
      return;
    }
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) {
      showAlert('Age', 'Please enter a valid age (1–120).');
      return;
    }
    try {
      await updateLinkedPatientProfile(editPatient.firebase_uid, {
        caretaker_uid: uid,
        full_name: editName.trim(),
        age: ageNum,
        health_condition: editCondition.trim() || null,
      });
      setEditPatient(null);
      await fetchPatients(true);
    } catch {
      showAlert('Error', 'Could not save patient profile.');
    }
  };

  const editPatientModal = (
    <Modal visible={editPatient !== null} transparent animationType="fade" onRequestClose={() => setEditPatient(null)}>
      <View style={styles.editModalOverlay}>
        <View style={styles.editModalCard}>
          <Text style={styles.editModalTitle}>Edit patient</Text>
          <Text style={styles.editModalLabel}>Name</Text>
          <TextInput
            style={styles.editModalInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Full name"
            placeholderTextColor="#aaa"
          />
          <Text style={styles.editModalLabel}>Age</Text>
          <TextInput
            style={styles.editModalInput}
            value={editAge}
            onChangeText={setEditAge}
            keyboardType="number-pad"
            placeholder="Age"
            placeholderTextColor="#aaa"
          />
          <Text style={styles.editModalLabel}>Condition (optional)</Text>
          <TextInput
            style={[styles.editModalInput, { minHeight: 64, textAlignVertical: 'top' }]}
            value={editCondition}
            onChangeText={setEditCondition}
            placeholder="e.g. Diabetes"
            placeholderTextColor="#aaa"
            multiline
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={styles.editModalCancel} onPress={() => setEditPatient(null)}>
              <Text style={styles.editModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editModalSave} onPress={saveEditedPatient}>
              <Text style={styles.editModalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── TABLET LAYOUT ──
  if (isTablet) {
    return (
      <>
        <View style={[styles.tabletShell, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#dce3dc" translucent={false} />
        <View style={styles.sidebarPanel}>
          <View style={styles.sidebarLogo}>
            <AppLogo size={40} />
            <Text style={styles.sidebarLogoText}>GabayRa</Text>
          </View>
          <View style={styles.sidebarNav}>
            {SIDE_TABS.map(tab => (
              <TouchableOpacity
                key={tab.label}
                style={[styles.sidebarItem, activeTab === tab.label && styles.sidebarItemActive]}
                onPress={() => setActiveTab(tab.label)}
              >
                <AppIcon
                  name={tab.icon}
                  size={20}
                  color={activeTab === tab.label ? '#fff' : 'rgba(255,255,255,0.75)'}
                />
                <Text style={[styles.sidebarLabel, activeTab === tab.label && styles.sidebarLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.contentPanel}>
          <View style={styles.contentTitleBar}>
            <Text style={styles.contentTitle}>{screenTitles[activeTab]}</Text>
            <Text style={styles.contentSub}>{screenSubs[activeTab]}</Text>
          </View>
          {renderScreen()}
        </View>
        </View>
        <LinkPatientModal
          visible={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          caretakerUid={uid}
          onLinked={() => { fetchPatients(false); fetchLinkRequests(); }}
        />
        {editPatientModal}
        <NavTutorialOverlay
          visible={showTutorial}
          steps={CAREGIVER_TUTORIAL}
          index={tutorialIdx}
          tabs={SIDE_TABS.map(t => ({ key: t.label, icon: t.icon, label: t.label }))}
          activeTab={activeTab}
          onSkip={async () => {
            setShowTutorial(false);
            await setTutorialDone('caregiver', uid);
          }}
          onNext={async () => {
            if (tutorialIdx >= CAREGIVER_TUTORIAL.length - 1) {
              setShowTutorial(false);
              await setTutorialDone('caregiver', uid);
            } else {
              setTutorialIdx(i => i + 1);
            }
          }}
          onBack={() => setTutorialIdx(i => Math.max(0, i - 1))}
        />
        <SwitchModeModal
          visible={showSwitchFamily}
          mode="toFamily"
          onCancel={() => setShowSwitchFamily(false)}
          onConfirm={() => {
            setShowSwitchFamily(false);
            onSwitchToFamily?.();
          }}
        />
        <LogoutModal
          visible={showLogoutModal}
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={() => {
            setShowLogoutModal(false);
            onLogout();
          }}
        />
      </>
    );
  }

  // ── MOBILE LAYOUT ──
  return (
    <>
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.contentTitleBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.contentTitle}>{screenTitles[activeTab]}</Text>
        {!!screenSubs[activeTab] && (
          <Text style={styles.contentSub}>{screenSubs[activeTab]}</Text>
        )}
      </View>

      <SwipeTabHost
        tabs={SIDE_TABS.map(t => ({ key: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bottomInset={insets.bottom || 10}
        iconOnly
      >
        {renderHomeTab()}
        {renderPatientsTab()}
        {renderScheduleTab()}
        <MedicationsTab />
        {renderManageTab()}
      </SwipeTabHost>
    </View>
    <LinkPatientModal
      visible={showLinkModal}
      onClose={() => setShowLinkModal(false)}
      caretakerUid={uid}
      onLinked={() => { fetchPatients(false); fetchLinkRequests(); }}
    />
    {editPatientModal}
    <NavTutorialOverlay
      visible={showTutorial}
      steps={CAREGIVER_TUTORIAL}
      index={tutorialIdx}
      tabs={SIDE_TABS.map(t => ({ key: t.label, icon: t.icon, label: t.label }))}
      activeTab={activeTab}
      onSkip={async () => {
        setShowTutorial(false);
        await setTutorialDone('caregiver', uid);
      }}
      onNext={async () => {
        if (tutorialIdx >= CAREGIVER_TUTORIAL.length - 1) {
          setShowTutorial(false);
          await setTutorialDone('caregiver', uid);
        } else {
          setTutorialIdx(i => i + 1);
        }
      }}
      onBack={() => setTutorialIdx(i => Math.max(0, i - 1))}
    />
    <SwitchModeModal
      visible={showSwitchFamily}
      mode="toFamily"
      onCancel={() => setShowSwitchFamily(false)}
      onConfirm={() => {
        setShowSwitchFamily(false);
        onSwitchToFamily?.();
      }}
    />
    <LogoutModal
      visible={showLogoutModal}
      onCancel={() => setShowLogoutModal(false)}
      onConfirm={() => {
        setShowLogoutModal(false);
        onLogout();
      }}
    />
    <Modal
      visible={showStatistics}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowStatistics(false)}
    >
      <View style={[styles.fullscreenModal, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Statistics</Text>
          <TouchableOpacity onPress={() => setShowStatistics(false)}>
            <AppIcon name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <StatisticsScreen
          stats={{
            total: Object.values(scheduleByPatient).flat().length,
            taken: Object.values(scheduleByPatient).flat().filter(m => m.taken && !m.suspended).length,
            missed: Object.values(scheduleByPatient).flat().filter(m => m.missed && !m.suspended).length,
            pending: Object.values(scheduleByPatient).flat().filter(m => !m.taken && !m.missed && !m.suspended).length,
          }}
          connectedAccounts={patients.map(p => ({
            id: p.firebase_uid,
            name: p.full_name || p.email || 'Unknown',
            type: 'patient' as const,
            email: p.email || '',
          }))}
        />
      </View>
    </Modal>
    <MedicationInventoryScreen
      visible={showInventory}
      uid={selectedPatientForInventory || ''}
      patientName={patients.find(p => p.firebase_uid === selectedPatientForInventory)?.full_name}
      medications={selectedPatientForInventory ? scheduleByPatient[selectedPatientForInventory] || [] : []}
      onClose={() => { setShowInventory(false); setSelectedPatientForInventory(null); }}
    />
    <PillboxScreen
      visible={showPillbox}
      patientUid={selectedPatientForPillbox || ''}
      patientName={patients.find(p => p.firebase_uid === selectedPatientForPillbox)?.full_name}
      onClose={() => {
        setShowPillbox(false);
        const pid = selectedPatientForPillbox;
        setSelectedPatientForPillbox(null);
        if (pid) {
          getPillboxStatus(pid).then(res => setPillboxStatus(res.data)).catch(() => {});
        }
      }}
    />
    <LinkedPatientsScreen
      visible={showLinkedPatients}
      patients={patients}
      onClose={() => setShowLinkedPatients(false)}
      onViewInventory={(patientUid) => {
        setShowLinkedPatients(false);
        setSelectedPatientForInventory(patientUid);
        setShowInventory(true);
      }}
      onRemove={(p) => {
        Alert.alert(
          'Remove Patient',
          `Remove ${p.full_name || p.email} from your care?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                try {
                  const patient = p as Patient & { id?: string; isOffline?: boolean };
                  if (patient.isOffline || patient.firebase_uid?.startsWith('offline_')) {
                    const key = `offline_patients_${uid}`;
                    const data = await AsyncStorage.getItem(key);
                    const list = data ? JSON.parse(data) : [];
                    const updated = list.filter(
                      (op: any) => (op.id || op.firebase_uid) !== (patient.id || patient.firebase_uid),
                    );
                    await AsyncStorage.setItem(key, JSON.stringify(updated));
                    await fetchPatients(true);
                  } else {
                    await unlinkPatient({ caretaker_uid: uid, patient_uid: p.firebase_uid });
                    await fetchPatients(true);
                  }
                } catch {
                  showAlert('Error', 'Could not remove patient');
                }
              },
            },
          ],
        );
      }}
    />
    <EditProfileModal
      visible={showEditProfile}
      uid={uid}
      initialName={caregiverName || 'Caregiver'}
      initialPhotoUrl={profilePicture}
      onClose={() => setShowEditProfile(false)}
      onSaved={({ full_name, profile_picture }) => {
        setCaregiverName(full_name);
        if (profile_picture !== undefined) setProfilePicture(profile_picture ?? null);
      }}
    />
    <AddOfflinePatientModal
      visible={showOfflinePatientModal}
      onClose={() => setShowOfflinePatientModal(false)}
      onSave={handleSaveOfflinePatient}
      saving={savingOfflinePatient}
    />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CARETAKER MEDICATIONS TAB STYLES
// ─────────────────────────────────────────────────────────────
const ct = StyleSheet.create({
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: GREEN },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#aaa' },

  medsHeader: {
    backgroundColor: GREEN, borderRadius: 18, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  medsHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  medsHeaderSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  alertsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  alertsChipText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  summaryRow:  { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  summaryNum:  { fontSize: 24, fontWeight: '900' },
  summaryLabel:{ fontSize: 11, fontWeight: '700', marginTop: 2 },

  pickerSectionTitle: {
    fontSize: 11, fontWeight: '800', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 1,
  },

  emptyCard:  { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 48, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#333' },
  emptySub:   { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 24 },

  patientMedRow: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', color: GREEN },
  patientName:{ fontSize: 15, fontWeight: '700', color: '#222' },
  patientSub: { fontSize: 12, color: '#888', marginTop: 2 },
  compBadge:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  compBadgeText: { fontSize: 11, fontWeight: '800' },
  chevron:    { fontSize: 22, color: '#ccc', fontWeight: '300' },
});

// ─────────────────────────────────────────────────────────────
// MAIN STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#ffffff' },

  tabletShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#dce3dc',
    paddingHorizontal: 10,
    gap: 10,
  },
  sidebarPanel: {
    width: 228,
    backgroundColor: GREEN_DARK,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  contentPanel: {
    flex: 1,
    backgroundColor: '#f4f7f4',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  sidebar: {
    width: 200, backgroundColor: GREEN_DARK,
    paddingHorizontal: 16, paddingBottom: 24,
  },
  sidebarLogo:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  sidebarLogoIcon: { fontSize: 28 },
  sidebarLogoText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sidebarNav:      { flex: 1, gap: 4 },
  sidebarItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  sidebarItemActive:   { backgroundColor: 'rgba(255,255,255,0.15)' },
  sidebarIcon:         { fontSize: 18 },
  sidebarLabel:        { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  sidebarLabelActive:  { color: '#fff' },

  tabletHeader: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tabletHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tabletHeaderSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  mainContent: { flex: 1 },

  // Home
  homeGreeting: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderLeftWidth: 4, borderLeftColor: '#e0e0e0',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  homeGreetingIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  homeGreetingTitle: { fontSize: 18, fontWeight: '800', color: '#222' },
  homeGreetingSub:   { fontSize: 13, color: '#666', marginTop: 4 },
  contentTitleBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e8ece8',
  },
  contentTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  contentSub:   { fontSize: 13, color: '#888', marginTop: 2 },
  homeStatCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, alignItems: 'center', borderTopWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  homeStatIcon:  { fontSize: 24, marginBottom: 6 },
  homeStatNum:   { fontSize: 28, fontWeight: '800' },
  homeStatLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  homeQuickBtn:        { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  homeQuickBtnOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: GREEN },
  homeQuickBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  homeTipCard: { backgroundColor: '#fffde7', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: '#fbc02d' },
  homeTipTitle:{ fontSize: 14, fontWeight: '800', color: '#f57f17', marginBottom: 6 },
  homeTipText: { fontSize: 13, color: '#795548', lineHeight: 20 },

  // Patients
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#e8f0e8',
  },
  statIcon:  { fontSize: 20, marginBottom: 4 },
  statNum:   { fontSize: 22, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#222' },

  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterTabActive:     { backgroundColor: GREEN, borderColor: GREEN },
  filterTabText:       { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },

  tableHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: GREEN_DARK, borderRadius: 10 },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5 },

  patientCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 6, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  patientRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  patientLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 2 },
  chevron:     { fontSize: 10, color: '#aaa', width: 12 },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 14, fontWeight: '800', color: GREEN },
  patientName: { fontSize: 14, fontWeight: '700', color: '#222' },
  patientSub:  { fontSize: 11, color: '#888', marginTop: 1 },
  searchLinkRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  searchFilterContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  filterTabCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 6,
  },
  linkBtnCompact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: GREEN_DARK, borderRadius: 10, paddingHorizontal: 14,
    minHeight: 44,
  },
  linkBtnCompactText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  patientMeta: { flexDirection: 'row', alignItems: 'center', flex: 3 },
  metaCol:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  colPatient:  { flex: 2 },
  colMeta:     { flex: 1, textAlign: 'center' },
  metaText:    { fontSize: 12, color: '#555', fontWeight: '700', textAlign: 'center' },

  statusBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  compliancePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  complianceText: { fontSize: 11, fontWeight: '700' },

  expandedSection: { borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 12, backgroundColor: '#fafafa' },
  expandedStats:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  expandedStat:    { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  expandedStatNum:   { fontSize: 14, fontWeight: '800', color: '#222' },
  expandedStatLabel: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },
  mlInsightCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  mlInsightHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mlInsightLabel: { fontSize: 12, fontWeight: '700', color: '#666' },
  mlInsightAction: { fontSize: 12, color: '#444', fontWeight: '600' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  riskBadgeText: { fontSize: 11, fontWeight: '800' },
  expandedActions:   { flexDirection: 'row', gap: 10 },

  actionBtnGreen: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
  },
  actionBtnOutlineText: { color: GREEN, fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: '#aaa' },

  // Schedule
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  scheduleListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2ee',
  },
  scheduleStatusWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: 4,
  },
  scheduleTimePill: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTimePillText: { fontSize: 11, fontWeight: '800', color: '#333', textAlign: 'center' },
  scheduleMedLineBold: { fontSize: 14, fontWeight: '800', color: '#222' },
  scheduleMedLineSub: { fontSize: 12, color: '#666', marginTop: 2 },
  screenTitle:           { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 4 },
  schedulePatientCard:   { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#eef2ee', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  scheduleShowAllBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  scheduleShowAllText:   { fontSize: 14, fontWeight: '700', color: GREEN },
  schedulePatientHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  scheduleAvatar:        { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  scheduleAvatarText:    { fontSize: 14, fontWeight: '800', color: GREEN },
  schedulePatientName:   { fontSize: 17, fontWeight: '700', color: '#222' },
  schedulePatientSub:    { fontSize: 14, color: '#888', marginTop: 2 },
  scheduleDivider:       { height: 1, backgroundColor: '#f0f0f0' },
  scheduleTimeSlots:     { flexDirection: 'row', padding: 12, gap: 8 },
  scheduleSlot:          { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 10, padding: 10, alignItems: 'flex-start' },
  scheduleSlotTime:      { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 6 },
  scheduleSlotEmpty:     { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 24 },
  scheduleMedLine:       { fontSize: 14, color: '#333', alignSelf: 'stretch', textAlign: 'left', marginTop: 4, lineHeight: 20 },
  scheduleUnscheduled:     { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },

  requestCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: GREEN, marginBottom: 8 },
  requestTitle:      { fontSize: 15, fontWeight: '800', color: '#222' },
  requestSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  requestAccept:     { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  requestAcceptText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  requestReject:     { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  requestRejectText: { color: '#666', fontWeight: '700', fontSize: 13 },

  linkPatientBtn:     { backgroundColor: GREEN_DARK, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 8 },
  linkPatientBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Alerts
  alertAllClear:      { alignItems: 'center', paddingVertical: 48, backgroundColor: '#fff', borderRadius: 16 },
  alertClearIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  alertIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertAllClearTitle: { fontSize: 20, fontWeight: '800', color: '#222', marginBottom: 4 },
  alertAllClearSub:   { fontSize: 14, color: '#888' },
  alertCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  alertIcon:         { fontSize: 24 },
  alertPatientName:  { fontSize: 14, fontWeight: '700', color: '#222' },
  alertMessage:      { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 18 },
  alertActionBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  alertActionText:   { fontSize: 12, fontWeight: '700' },
  alertInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  alertInfoTitle: { fontSize: 14, fontWeight: '800', color: '#222' },
  alertInfoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  alertInfoText:  { fontSize: 13, color: '#666', flex: 1 },

  // Manage (account)
  profileHeader:     { alignItems: 'center', paddingVertical: 24 },
  profileAvatar:     { width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileAvatarImg:    { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  profileAvatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName:       { fontSize: 20, fontWeight: '800', color: '#222' },
  profileUid:        { fontSize: 12, color: '#aaa', marginTop: 4 },
  manageSection:     { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  manageRow:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  manageIconBox:     { width: 40, height: 40, borderRadius: 10, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  manageRowLabel:    { fontSize: 15, fontWeight: '700', color: '#222' },
  manageRowSub:      { fontSize: 12, color: '#888', marginTop: 2 },
  manageArrow:       { fontSize: 20, color: '#ccc' },
  logoutRowBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1.5, borderColor: '#ffcdd2' },
  logoutRowIcon:     { fontSize: 20 },
  logoutRowText:     { fontSize: 15, fontWeight: '700', color: '#c62828' },
  versionText:       { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 24 },

  editModalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  editModalCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  editModalTitle:    { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 14 },
  editModalLabel:    { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 },
  editModalInput:    { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#222', marginBottom: 12 },
  editModalCancel:   { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editModalCancelText: { fontWeight: '700', color: '#666' },

  // Patient management cards
  patientManageCard: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowRadius: 4, 
    elevation: 1,
  },
  patientManageInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  patientManageAvatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: GREEN_LIGHT, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  patientManageAvatarText: { fontSize: 16, fontWeight: '800', color: GREEN },
  patientManageName: { fontSize: 15, fontWeight: '700', color: '#222' },
  patientManageSub: { fontSize: 12, color: '#888', marginTop: 2 },
  patientDeleteBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    backgroundColor: '#fce4ec', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  editModalSave:     { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editModalSaveText: { fontWeight: '800', color: '#fff' },

  fullscreenModal: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },

  // Tab bar
  tabBar:   { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10 },
  tabItem:  { flex: 1, alignItems: 'center' },
  tabIcon:  { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
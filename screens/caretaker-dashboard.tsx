import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions, TextInput,
  ActivityIndicator, Alert, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import {
  getLinkedPatients, getMedications, getIncomingLinkRequests, getUser,
  acceptLinkRequest, rejectLinkRequest, updateLinkedPatientProfile,
  sendPatientReminder, saveExpoPushToken,
} from '@/api/index';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { subscribePatientMedications, mapMedicationRows } from '@/services/medicationRealtime';
import { subscribeCaretakerOverview } from '@/services/caretakerRealtime';
import { cachePatients, getCachedPatients } from '@/lib/offline/store';
import { flushOfflineQueue } from '@/lib/offline/sync';
import { useNetworkStatus } from '@/lib/offline/network';
import { medicationTimeBucket } from '@/utils/medicationTimeBucket';
import { patientMatchesSearch } from '@/utils/patientSearch';
import type { PatientMedication } from '@/types/medication';
import MedicationsScreen from '@/components/MedicationsScreen';
import LinkPatientModal from '@/components/Linkpatientmodal';
import PatientSearchBar from '@/components/PatientSearchBar';
import AppIcon, { TAB_ICONS } from '@/components/AppIcon';
import MenuRow from '@/components/MenuRow';
import StatTile from '@/components/StatTile';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IonName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  onLogout: () => void;
  uid: string;
  onSwitchToFamily?: () => void;
}

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

type CaretakerTab = 'Home' | 'Patients' | 'Schedule' | 'Medications' | 'Alerts' | 'Manage';

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
  { icon: TAB_ICONS.Alerts, label: 'Alerts' },
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
  const [editPatient,        setEditPatient]        = useState<Patient | null>(null);
  const [editName,          setEditName]           = useState('');
  const [editAge,           setEditAge]            = useState('');
  const [editCondition,     setEditCondition]      = useState('');

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
      setPatients(list);
      await cachePatients(uid, list);

      const next: Record<string, PatientMedication[]> = {};
      for (const p of list) {
        try {
          const mres = await getMedications(p.firebase_uid);
          const rows = Array.isArray(mres.data) ? mres.data : [];
          next[p.firebase_uid] = mapMedicationRows(rows);
        } catch {
          next[p.firebase_uid] = [];
        }
      }
      setScheduleByPatient(next);
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
    if (online) flushOfflineQueue().then(n => { if (n > 0) fetchPatients(true); });
  }, [online, fetchPatients]);

  useEffect(() => {
    getUser(uid)
      .then(r => setCaregiverName((r.data?.full_name as string | undefined)?.trim() || ''))
      .catch(() => {});
    registerForPushNotificationsAsync().then(token => {
      if (token) saveExpoPushToken(uid, token).catch(() => {});
    });
  }, [uid]);

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
      if (Platform.OS === 'web') window.alert('Could not send reminder. Check your connection.');
      else Alert.alert('Error', 'Could not send reminder. Check your connection.');
    }
  }, [uid]);

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
    missed:    patients.filter(p => (p.missed_doses ?? 0) > 0).length,
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
      <MenuRow icon="notifications-outline" label="Check alerts" sub="See who needs follow-up" onPress={() => setActiveTab('Alerts')} />

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
                    {patient.compliance ?? 0}%
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
                { num: `${patient.compliance ?? 0}%`, label: 'Compliance'   },
                { num: patient.age ?? '—',             label: 'Age'          },
              ].map((s, i) => (
                <View key={i} style={styles.expandedStat}>
                  <Text style={styles.expandedStatNum}>{s.num}</Text>
                  <Text style={styles.expandedStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.expandedActions}>
              <TouchableOpacity
                style={styles.actionBtnGreen}
                onPress={() => loadPatientMedications(patient)}
              >
                <Text style={styles.actionBtnText}>💊 View Medications</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnOutline}
                onPress={() => setActiveTab('Schedule')}
              >
                <Text style={styles.actionBtnOutlineText}>📋 Schedule</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { marginTop: 8 }]}
              onPress={() => {
                setEditPatient(patient);
                setEditName((patient.full_name || '').trim());
                setEditAge(patient.age != null ? String(patient.age) : '');
                setEditCondition((patient.health_condition || '').trim());
              }}
            >
              <Text style={styles.actionBtnOutlineText}>✏️ Edit patient info</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { marginTop: 8 }]}
              onPress={() => handleSendReminder(patient)}
            >
              <Text style={styles.actionBtnOutlineText}>Send reminder</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderPatientsTab = () => (
    <View style={styles.mainContent}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={styles.statsRow}>
          <StatTile icon="people-outline" value={stats.total} label="Total Patients" accent={GREEN} />
          <StatTile icon="checkmark-circle-outline" value={stats.active} label="Active" accent={GREEN} />
          <StatTile icon="alert-circle-outline" value={stats.missed} label="Missed Doses" accent="#e65100" iconBg="#fff3e0" />
          <StatTile icon="warning-outline" value={stats.attention} label="Needs Attention" accent="#c62828" iconBg="#fce4ec" />
        </View>

        <View style={styles.searchLinkRow}>
          <PatientSearchBar value={search} onChangeText={setSearch} style={{ flex: 1 }} />
          <TouchableOpacity style={styles.linkBtnCompact} onPress={() => setShowLinkModal(true)}>
            <AppIcon name="link" size={18} color="#fff" />
            <Text style={styles.linkBtnCompactText}>Link</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {linkRequests.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8, gap: 8 }}>
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
                      } catch (e) {
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
                      } catch (e) {
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
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading patients...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No patients linked yet</Text>
              <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>
                Ask patients to link their account to yours
              </Text>
            </View>
          ) : (
            filtered.map(p => <PatientRow key={p.firebase_uid} patient={p} />)
          )}
        </ScrollView>
      )}
    </View>
  );

  // ── MEDICATIONS SCREEN ──
  const MedicationsTab = () => {
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
          <Text style={ct.medsHeaderTitle}>💊 Patient Medications</Text>
          <Text style={ct.medsHeaderSub}>
            Select a patient to view their current medications
          </Text>
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
          <View style={ct.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
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

                <Text style={ct.chevron}>›</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ── SCHEDULE SCREEN ──
  const renderScheduleTab = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.screenTitle}>📅 Patient Schedules</Text>
      </View>

      {patients.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No patients linked yet</Text>
          <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>
            Schedules will appear here once patients are linked
          </Text>
        </View>
      ) : (
        patients.map(p => (
          <View key={p.firebase_uid} style={styles.schedulePatientCard}>
            <View style={styles.schedulePatientHeader}>
              <View style={styles.scheduleAvatar}>
                <Text style={styles.scheduleAvatarText}>
                  {(p.full_name ?? p.email ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.schedulePatientName}>{p.full_name ?? p.email}</Text>
                <Text style={styles.schedulePatientSub}>Age {p.age ?? 'unknown'} · {getPatientStatus(p)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[getPatientStatus(p)]?.bg ?? '#eee' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[getPatientStatus(p)]?.text ?? '#333' }]}>
                  {getPatientStatus(p)}
                </Text>
              </View>
            </View>
            <View style={styles.scheduleDivider} />
            <View style={styles.scheduleTimeSlots}>
              {(['Morning', 'Afternoon', 'Evening'] as const).map((slot, i) => {
                const meds = (scheduleByPatient[p.firebase_uid] || []).filter(
                  m => !m.suspended && medicationTimeBucket(m.time) === slot,
                );
                return (
                  <View key={i} style={styles.scheduleSlot}>
                    <Text style={styles.scheduleSlotTime}>{slot}</Text>
                    {meds.length === 0 ? (
                      <Text style={styles.scheduleSlotEmpty}>No meds</Text>
                    ) : (
                      meds.map(m => (
                        <Text key={m.id} style={styles.scheduleMedLine} numberOfLines={3}>
                          {m.taken ? '✓ ' : '○ '}{m.name} · {m.time || 'No time'}
                        </Text>
                      ))
                    )}
                  </View>
                );
              })}
            </View>
            {(() => {
              const unscheduled = (scheduleByPatient[p.firebase_uid] || []).filter(
                m => !m.suspended && medicationTimeBucket(m.time) === null,
              );
              if (unscheduled.length === 0) return null;
              return (
                <View style={styles.scheduleUnscheduled}>
                  <Text style={styles.scheduleSlotTime}>Unscheduled time</Text>
                  {unscheduled.map(m => (
                    <Text key={m.id} style={styles.scheduleMedLine}>
                      {m.taken ? '✓ ' : '○ '}{m.name} · {m.time || '—'}
                    </Text>
                  ))}
                </View>
              );
            })()}
          </View>
        ))
      )}
    </ScrollView>
  );

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
            <AppIcon name="information-circle" size={20} color="#1565c0" />
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
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(caregiverName || 'Caregiver').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{caregiverName || 'Caregiver/Family'}</Text>
        <Text style={styles.profileUid}>ID: {uid?.slice(0, 12)}...</Text>
      </View>

      <Text style={styles.manageSection}>Overview</Text>
      <MenuRow icon="people-outline" label="Linked patients" sub={`${patients.length} patient${patients.length !== 1 ? 's' : ''}`} showChevron={false} />
      <MenuRow icon="warning-outline" iconColor="#c62828" iconBg="#fce4ec" label="Needs attention" sub={`${stats.attention} patient${stats.attention !== 1 ? 's' : ''}`} showChevron={false} />
      <MenuRow icon="checkmark-circle-outline" label="Active patients" sub={`${stats.active} patient${stats.active !== 1 ? 's' : ''}`} showChevron={false} />
      <MenuRow
        icon="medical-outline"
        label="Medications"
        sub="View all patient medications"
        onPress={() => { setSelectedPatient(null); setPatientMedications([]); setActiveTab('Medications'); }}
      />

      <Text style={styles.manageSection}>Settings</Text>
      {onSwitchToFamily && (
        <MenuRow
          icon="home-outline"
          label="Switch to Family view"
          sub="Simpler home for supporting a few loved ones"
          onPress={onSwitchToFamily}
        />
      )}
      <MenuRow icon="notifications-outline" label="Notification settings" sub="Manage alert preferences" />
      <MenuRow icon="lock-closed-outline" label="Privacy & security" sub="Manage your data" />
      <MenuRow icon="help-circle-outline" label="Help & support" sub="Get assistance" />

      <TouchableOpacity style={styles.logoutRowBtn} onPress={onLogout}>
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
      case 'Alerts':      return renderAlertsTab();
      case 'Manage':      return renderManageTab();
    }
  };

  const screenTitles: Record<CaretakerTab, string> = {
    Home:        'Dashboard',
    Patients:    'Caregiver/Family Dashboard',
    Schedule:    'Schedules',
    Medications: 'Medications',
    Alerts:      'Alerts',
    Manage:      'Manage',
  };
  const screenSubs: Record<CaretakerTab, string> = {
    Home:        'Welcome back!',
    Patients:    "Good day! Here's your patient overview.",
    Schedule:    'View all patient medication schedules.',
    Medications: 'View medications for each patient.',
    Alerts:      'Patients that need your attention.',
    Manage:      'Your account and settings.',
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
            <AppIcon name="medical" size={26} color="#fff" />
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
        <Text style={styles.contentSub}>{screenSubs[activeTab]}</Text>
      </View>

      {renderScreen()}

      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}>
        {SIDE_TABS.map(tab => (
          <TouchableOpacity key={tab.label} style={styles.tabItem} onPress={() => setActiveTab(tab.label)}>
            <AppIcon
              name={tab.icon}
              size={22}
              color={activeTab === tab.label ? GREEN : '#aaa'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.label && { color: GREEN, fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
    <LinkPatientModal
      visible={showLinkModal}
      onClose={() => setShowLinkModal(false)}
      caretakerUid={uid}
      onLinked={() => { fetchPatients(false); fetchLinkRequests(); }}
    />
    {editPatientModal}
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
  },
  medsHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  medsHeaderSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

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
  outer: { flex: 1, backgroundColor: '#f0f4f0' },

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
    borderLeftWidth: 4, borderLeftColor: GREEN,
    borderWidth: 1, borderColor: '#eef2ee',
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

  filterScroll:        { flexGrow: 0 },
  filterTab:           { paddingHorizontal: 14, borderRadius: 20, marginRight: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', height: 32, alignItems: 'center', justifyContent: 'center' },
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
  expandedActions:   { flexDirection: 'row', gap: 10 },

  actionBtnGreen:   { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtnOutline: { flex: 1, borderWidth: 1.5, borderColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnOutlineText: { color: GREEN, fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: '#aaa' },

  // Schedule
  sectionHeaderRow:      { marginBottom: 4 },
  screenTitle:           { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 4 },
  schedulePatientCard:   { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  schedulePatientHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  scheduleAvatar:        { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  scheduleAvatarText:    { fontSize: 14, fontWeight: '800', color: GREEN },
  schedulePatientName:   { fontSize: 17, fontWeight: '700', color: '#222' },
  schedulePatientSub:    { fontSize: 14, color: '#888', marginTop: 2 },
  scheduleDivider:       { height: 1, backgroundColor: '#f0f0f0' },
  scheduleTimeSlots:     { flexDirection: 'row', padding: 12, gap: 8 },
  scheduleSlot:          { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 10, padding: 10, alignItems: 'flex-start' },
  scheduleSlotTime:      { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 6 },
  scheduleSlotEmpty:     { fontSize: 13, color: '#bbb' },
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
  alertInfoCard:     { backgroundColor: '#e3f2fd', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#1976d2' },
  alertInfoTitle: { fontSize: 14, fontWeight: '800', color: '#1565c0' },
  alertInfoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  alertInfoText:  { fontSize: 13, color: '#1565c0', flex: 1 },

  // Manage (account)
  profileHeader:     { alignItems: 'center', paddingVertical: 24 },
  profileAvatar:     { width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
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
  editModalSave:     { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editModalSaveText: { fontWeight: '800', color: '#fff' },

  // Tab bar
  tabBar:   { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10 },
  tabItem:  { flex: 1, alignItems: 'center' },
  tabIcon:  { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
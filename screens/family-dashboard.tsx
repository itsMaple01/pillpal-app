import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Alert, Platform, ActivityIndicator, Modal, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLinkedPatients, getMedications, getUser, sendPatientReminder,
  unlinkPatient, getIntelligenceProfile, getPillboxStatus,
} from '@/api/index';
import { registerAndSavePushTokenIfNeeded } from '@/lib/pushNotifications';
import { subscribeCaretakerOverview } from '@/services/caretakerRealtime';
import { mapMedicationRows } from '@/services/medicationRealtime';
import { medicationTimeBucket, parseMedicationTime } from '@/utils/medicationTimeBucket';
import DoseStatusBadge from '@/components/DoseStatusBadge';
import LinkedPatientsScreen from '@/components/LinkedPatientsScreen';
import LinkPatientModal from '@/components/Linkpatientmodal';
import AppHeader from '@/components/AppHeader';
import AppIcon from '@/components/AppIcon';
import MenuRow from '@/components/MenuRow';
import StatTile from '@/components/StatTile';
import SwipeTabHost from '@/components/SwipeTabHost';
import NavTutorialOverlay from '@/components/NavTutorialOverlay';
import SwitchModeModal from '@/components/SwitchModeModal';
import WeekCalendarStrip from '@/components/WeekCalendarStrip';
import LogoutModal from '@/components/LogoutModal';
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
import { APP_NAME } from '@/lib/branding';
import { TEXT } from '@/lib/typography';
import { theme } from '@/lib/theme';
import {
  isTutorialDone, setTutorialDone, FAMILY_TUTORIAL,
} from '@/lib/tutorial';
import { confirmAndExportCSV } from '@/lib/dataExport';
import type { PatientMedication } from '@/types/medication';
import type { ComponentProps } from 'react';

type Tab = 'Home' | 'Family' | 'Schedule' | 'Manage';
type IonName = ComponentProps<typeof AppIcon>['name'];

const GREEN = theme.green;
const GREEN_LIGHT = theme.greenLight;

const FAMILY_TAB_ICONS: Record<Tab, IonName> = {
  Home: 'home-outline',
  Family: 'people-outline',
  Schedule: 'calendar-outline',
  Manage: 'settings-outline',
};

interface Props {
  uid: string;
  onLogout: () => void;
  onSwitchToCaregiver: () => void;
}

interface LinkedPerson {
  firebase_uid: string;
  full_name?: string;
  email?: string;
  age?: number;
  missed_doses?: number;
  compliance?: number;
}

export default function FamilyDashboard({ uid, onLogout, onSwitchToCaregiver }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;

  const [tab, setTab] = useState<Tab>('Home');
  const [people, setPeople] = useState<LinkedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [medsByPerson, setMedsByPerson] = useState<Record<string, PatientMedication[]>>({});
  const [showLink, setShowLink] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialIdx, setTutorialIdx] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSwitchMode, setShowSwitchMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showStatistics, setShowStatistics] = useState(false);
  const [showLinkedPatients, setShowLinkedPatients] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [selectedPatientForInventory, setSelectedPatientForInventory] = useState<string | null>(null);
  const [showPillbox, setShowPillbox] = useState(false);
  const [selectedPatientForPillbox, setSelectedPatientForPillbox] = useState<string | null>(null);
  const [pillboxStatus, setPillboxStatus] = useState<{ connected: boolean; device_id?: string }>({ connected: false });
  const [mlProfiles, setMlProfiles] = useState<Record<string, IntelligenceProfile>>({});
  const [mlLoading, setMlLoading] = useState<Record<string, boolean>>({});
  const [showOfflinePatientModal, setShowOfflinePatientModal] = useState(false);
  const [savingOfflinePatient, setSavingOfflinePatient] = useState(false);

  const loadPeople = useCallback(async () => {
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
      const allPeople = [...list, ...offlinePatients];
      setPeople(allPeople);
      setLoading(false);

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
        list.map(async (p: LinkedPerson) => {
          try {
            const m = await getMedications(p.firebase_uid);
            const rows = Array.isArray(m.data) ? m.data : [];
            return [p.firebase_uid, await mapMedicationRows(rows)] as const;
          } catch {
            return [p.firebase_uid, []] as const;
          }
        }),
      );

      setMedsByPerson(prev => ({
        ...prev,
        ...Object.fromEntries(onlineMedEntries),
        ...offlineMedMap,
      }));
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadPeople();
    getUser(uid)
      .then(r => {
        setDisplayName((r.data?.full_name as string | undefined)?.trim() || 'Family member');
        setProfilePicture((r.data?.profile_picture as string | undefined) ?? null);
      })
      .catch(() => setDisplayName('Family member'));
    registerAndSavePushTokenIfNeeded(uid);
    isTutorialDone('family', uid).then(done => {
      if (!done) {
        setTutorialIdx(0);
        setShowTutorial(true);
      }
    });
  }, [uid, loadPeople]);

  useEffect(() => {
    if (!showTutorial) return;
    const step = FAMILY_TUTORIAL[tutorialIdx];
    if (step?.tab) setTab(step.tab as Tab);
  }, [showTutorial, tutorialIdx]);

  useEffect(() => {
    if (people.length === 0) return;
    return subscribeCaretakerOverview(
      people.map(p => p.firebase_uid),
      {
        onOverviewChange: () => loadPeople(),
        onPatientMeds: (patientUid, meds) => {
          setMedsByPerson(prev => ({ ...prev, [patientUid]: meds }));
        },
      },
    );
  }, [people.map(p => p.firebase_uid).sort().join(','), loadPeople]);

  useEffect(() => {
    if (people.length === 0) {
      setPillboxStatus({ connected: false });
      return;
    }
    getPillboxStatus(people[0].firebase_uid)
      .then(res => setPillboxStatus(res.data))
      .catch(() => setPillboxStatus({ connected: false }));
  }, [people]);

  useEffect(() => {
    if (people.length === 0) {
      setMlProfiles({});
      setMlLoading({});
      return;
    }
    const initialLoading: Record<string, boolean> = {};
    people.forEach(p => { initialLoading[p.firebase_uid] = true; });
    setMlLoading(initialLoading);

    people.forEach(p => {
      getIntelligenceProfile(p.firebase_uid)
        .then(res => {
          setMlProfiles(prev => ({ ...prev, [p.firebase_uid]: res.data as IntelligenceProfile }));
        })
        .catch(() => {})
        .finally(() => {
          setMlLoading(prev => ({ ...prev, [p.firebase_uid]: false }));
        });
    });
  }, [people]);

  const alert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const sendReminder = async (person: LinkedPerson) => {
    try {
      const res = await sendPatientReminder({
        caretaker_uid: uid,
        patient_uid: person.firebase_uid,
        message: `${displayName} sent you a medication reminder.`,
      });
      const pushSent = res.data?.push_sent;
      const pushErr = res.data?.push_error;
      const msg = pushSent
        ? `Reminder sent to ${person.full_name ?? person.email}. They should get a notification with sound.`
        : `Reminder saved. ${pushErr || 'Patient must open the installed GabayRa app once to enable push notifications.'}`;
      alert(pushSent ? 'Reminder sent' : 'Reminder recorded', msg);
    } catch {
      alert('Error', 'Could not send reminder.');
    }
  };

  const handleExportData = useCallback(async () => {
    try {
      const exportDate = new Date().toISOString().slice(0, 10);
      const allMeds = Object.values(medsByPerson).flat();
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
          name: displayName,
          email: '',
          role: 'family',
        },
        medications: allMeds.map(m => ({
          date: exportDate,
          medicationName: m.name,
          dosage: m.dosage,
          time: m.time,
          status: m.taken ? 'taken' as const : m.missed ? 'missed' as const : 'pending' as const,
        })),
        connectedAccounts: people.map(p => ({
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
  }, [medsByPerson, displayName, people]);

  const handleSaveOfflinePatient = useCallback(async (patientData: OfflinePatientData) => {
    setSavingOfflinePatient(true);
    try {
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
      
      // Reload people to include offline patients
      await loadPeople();
      
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
  }, [uid, loadPeople]);

  const totalMedsToday = people.reduce((sum, p) => {
    const meds = medsByPerson[p.firebase_uid] || [];
    return sum + meds.filter(m => !m.suspended).length;
  }, 0);

  const takenToday = people.reduce((sum, p) => {
    const meds = medsByPerson[p.firebase_uid] || [];
    return sum + meds.filter(m => m.taken && !m.suspended).length;
  }, 0);

  const renderPersonCard = (person: LinkedPerson, compact?: boolean) => {
    const meds = (medsByPerson[person.firebase_uid] || []).filter(m => !m.suspended);
    const pending = meds.filter(m => !m.taken).length;
    return (
      <View key={person.firebase_uid} style={styles.personCard}>
        <View style={styles.personRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(person.full_name ?? person.email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{person.full_name ?? person.email}</Text>
            <Text style={styles.personSub}>
              Age {person.age ?? '—'} · {pending} pending · {meds.length} meds
            </Text>
            {mlLoading[person.firebase_uid] ? (
              <View style={[styles.mlBadgeRow, { marginTop: 8 }]}>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={styles.mlActionText}>Loading risk profile…</Text>
              </View>
            ) : mlProfiles[person.firebase_uid] && (() => {
              const profile = mlProfiles[person.firebase_uid];
              const learning = isSampleInsufficient(profile);
              const riskLevel = getRiskLevel(profile);
              const riskColor = learning ? '#757575' : getRiskColor(riskLevel);
              return (
                <View style={[styles.mlBadgeRow, { marginTop: 8 }]}>
                  {!learning && (
                    <View style={[styles.riskBadge, { backgroundColor: getRiskBg(riskLevel) }]}>
                      <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                        {riskLevel} risk
                      </Text>
                    </View>
                  )}
                  <Text style={styles.mlActionText}>
                    {learning
                      ? getLearningPatternMessage()
                      : getRecommendedActionForProfile(profile)}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
        {!compact && (
          <View style={styles.personActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => sendReminder(person)}>
              <AppIcon name="notifications-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Send reminder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => { setSelectedId(person.firebase_uid); setTab('Schedule'); }}
            >
              <AppIcon name="calendar-outline" size={18} color={GREEN} />
              <Text style={styles.actionBtnOutlineText}>View schedule</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const ScheduleScreen = () => {
    const list = selectedId ? people.filter(p => p.firebase_uid === selectedId) : people;
    const markedDates = people.flatMap(p =>
      (medsByPerson[p.firebase_uid] || [])
        .filter(m => !m.suspended)
        .map(() => new Date().toISOString().slice(0, 10)),
    );
    if (list.length === 0) {
      return (
        <View style={styles.center}>
          <AppIcon name="calendar-outline" size={40} color="#ccc" />
          <Text style={styles.emptyTitle}>No schedules yet</Text>
          <Text style={styles.emptySub}>Link a family member to see their medication times.</Text>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.scrollPad}>
        <WeekCalendarStrip
          selectedDate={scheduleDate}
          onSelectDate={setScheduleDate}
          markedDates={markedDates}
        />
        <Text style={styles.sectionTitle}>Schedule</Text>
        {list.map(person => {
          const all = (medsByPerson[person.firebase_uid] || []).filter(m => !m.suspended);
          const sorted = [...all].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
          return (
            <View key={person.firebase_uid} style={styles.scheduleCard}>
              <Text style={styles.scheduleName}>{person.full_name ?? person.email}</Text>
              {sorted.length === 0 ? (
                <Text style={styles.slotEmpty}>No medications scheduled</Text>
              ) : (
                sorted.map(m => {
                  const bucket = medicationTimeBucket(m.time);
                  return (
                    <View key={m.id} style={styles.scheduleMedRow}>
                      <View style={styles.scheduleTimeBox}>
                        <Text style={styles.scheduleTimeText}>
                          {(parseMedicationTime(m.time)?.label ?? m.time) || '—'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scheduleMedName}>{m.name}</Text>
                        <Text style={styles.scheduleMedSub}>
                          {m.dosage}{bucket ? ` · ${bucket}` : ''}
                        </Text>
                      </View>
                      <DoseStatusBadge med={m} />
                    </View>
                  );
                })
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const HomeScreen = () => (
    <ScrollView contentContainerStyle={styles.scrollPad}>
      <View style={styles.greetingCard}>
        <View style={styles.cardAccent} />
        <View style={styles.greetingIconWrap}>
          <AppIcon name="people-outline" size={28} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingTitle}>Supporting your family</Text>
          <Text style={styles.greetingSub}>
            Hi {displayName} — keep loved ones on track with gentle reminders.
          </Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <StatTile icon="people-outline" value={String(people.length)} label="Linked people" />
        <StatTile icon="medical-outline" value={String(totalMedsToday)} label="Meds today" />
        <StatTile icon="checkmark-circle-outline" value={String(takenToday)} label="Taken" />
      </View>
      {people.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon name="link-outline" size={36} color={GREEN} />
          <Text style={styles.emptyTitle}>No family linked yet</Text>
          <Text style={styles.emptySub}>Go to Manage → Link to connect with a patient.</Text>
        </View>
      ) : (
        people.map(p => renderPersonCard(p))
      )}
      <MenuRow
        icon="calendar-outline"
        label="Schedule & calendar"
        sub="View all reminders"
        onPress={() => setTab('Schedule')}
      />
    </ScrollView>
  );

  const FamilyScreen = () => (
    <ScrollView contentContainerStyle={styles.scrollPad}>
      {people.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptySub}>No family linked yet. Use Manage → Link to connect.</Text>
        </View>
      ) : (
        people.map(p => renderPersonCard(p))
      )}
    </ScrollView>
  );

  const ManageScreen = () => (
    <ScrollView contentContainerStyle={styles.scrollPad}>
      <View style={styles.profileHeader}>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.profileAvatarImg} />
        ) : (
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(displayName || 'F').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.profileName}>{displayName || 'Family member'}</Text>
      </View>

      <MenuRow
        icon="person-outline"
        label="Edit profile"
        sub="Update your name and photo"
        onPress={() => setShowEditProfile(true)}
      />

      <MenuRow
        icon="people-outline"
        label="Linked patients"
        sub={`${people.length} family member${people.length !== 1 ? 's' : ''} linked`}
        onPress={() => setShowLinkedPatients(true)}
      />

      <Text style={styles.sectionTitle}>Account</Text>
      <MenuRow
        icon="swap-horizontal-outline"
        label="Switch to Caregiver Dashboard"
        sub="Full professional view with patients table, alerts, and analytics"
        onPress={() => setShowSwitchMode(true)}
      />
      <MenuRow
        icon="link-outline"
        label="Link family member / patient"
        sub="Code, email request, or pending patient requests"
        onPress={() => setShowLink(true)}
      />
      <MenuRow
        icon="person-add-outline"
        label="Add offline patient"
        sub="Create medication schedule for patient without phone"
        onPress={() => setShowOfflinePatientModal(true)}
      />
      <MenuRow
        icon="cube-outline"
        label="Medication Inventory"
        sub="View and manage medication stock"
        onPress={() => {
          if (people.length > 0) {
            setSelectedPatientForInventory(people[0].firebase_uid);
            setShowInventory(true);
          } else {
            Alert.alert('No patients', 'Link a family member first to manage their medication inventory.');
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
          if (people.length > 0) {
            setSelectedPatientForPillbox(people[0].firebase_uid);
            setShowPillbox(true);
          } else {
            Alert.alert('No patients', 'Link a family member first to connect a pillbox.');
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
        icon="book-outline"
        label="Show tutorial"
        sub="Learn what each tab does"
        onPress={() => { setTutorialIdx(0); setShowTutorial(true); }}
      />
      <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)}>
        <AppIcon name="log-out-outline" size={22} color="#c62828" />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
      <Text style={styles.version}>{APP_NAME} v1.0.1</Text>
    </ScrollView>
  );

  const headerTitle = tab === 'Home' ? 'Family care' : tab;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AppHeader title={headerTitle} subtitle={`Hi ${displayName}`} />
      <SwipeTabHost
          tabs={(['Home', 'Family', 'Schedule', 'Manage'] as Tab[]).map(t => ({
            key: t,
            icon: FAMILY_TAB_ICONS[t],
          }))}
          activeTab={tab}
          onTabChange={setTab}
          bottomInset={insets.bottom || 10}
          iconOnly
        >
          <HomeScreen />
          <FamilyScreen />
          <ScheduleScreen />
          <ManageScreen />
        </SwipeTabHost>
      <LinkPatientModal
        visible={showLink}
        onClose={() => { setShowLink(false); loadPeople(); }}
        caretakerUid={uid}
        onLinked={loadPeople}
      />
      <NavTutorialOverlay
        visible={showTutorial}
        steps={FAMILY_TUTORIAL}
        index={tutorialIdx}
        tabs={(['Home', 'Family', 'Schedule', 'Manage'] as Tab[]).map(t => ({
          key: t,
          icon: FAMILY_TAB_ICONS[t],
          label: t,
        }))}
        activeTab={tab}
        onSkip={async () => {
          setShowTutorial(false);
          await setTutorialDone('family', uid);
        }}
        onNext={async () => {
          if (tutorialIdx >= FAMILY_TUTORIAL.length - 1) {
            setShowTutorial(false);
            await setTutorialDone('family', uid);
          } else {
            setTutorialIdx(i => i + 1);
          }
        }}
        onBack={() => setTutorialIdx(i => Math.max(0, i - 1))}
      />
      <SwitchModeModal
        visible={showSwitchMode}
        mode="toCaregiver"
        onCancel={() => setShowSwitchMode(false)}
        onConfirm={() => {
          setShowSwitchMode(false);
          onSwitchToCaregiver();
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
              total: Object.values(medsByPerson).flat().length,
              taken: Object.values(medsByPerson).flat().filter(m => m.taken && !m.suspended).length,
              missed: Object.values(medsByPerson).flat().filter(m => m.missed && !m.suspended).length,
              pending: Object.values(medsByPerson).flat().filter(m => !m.taken && !m.missed && !m.suspended).length,
            }}
            connectedAccounts={people.map(p => ({
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
        patientName={people.find(p => p.firebase_uid === selectedPatientForInventory)?.full_name}
        medications={selectedPatientForInventory ? medsByPerson[selectedPatientForInventory] || [] : []}
        onClose={() => { setShowInventory(false); setSelectedPatientForInventory(null); }}
      />
      <PillboxScreen
        visible={showPillbox}
        patientUid={selectedPatientForPillbox || ''}
        patientName={people.find(p => p.firebase_uid === selectedPatientForPillbox)?.full_name}
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
        title="Linked family members"
        patients={people.map(p => ({
          firebase_uid: p.firebase_uid,
          full_name: p.full_name,
          email: p.email,
          age: p.age,
          missed_doses: p.missed_doses,
          compliance: p.compliance,
        }))}
        onClose={() => setShowLinkedPatients(false)}
        onViewInventory={(patientUid) => {
          setShowLinkedPatients(false);
          setSelectedPatientForInventory(patientUid);
          setShowInventory(true);
        }}
        onRemove={(p) => {
          Alert.alert(
            'Remove family member',
            `Remove ${p.full_name || p.email} from your linked list?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const person = p as LinkedPerson & { id?: string; isOffline?: boolean };
                    if (person.isOffline || person.firebase_uid?.startsWith('offline_')) {
                      const key = `offline_patients_${uid}`;
                      const data = await AsyncStorage.getItem(key);
                      const list = data ? JSON.parse(data) : [];
                      const updated = list.filter(
                        (op: any) => (op.id || op.firebase_uid) !== (person.id || person.firebase_uid),
                      );
                      await AsyncStorage.setItem(key, JSON.stringify(updated));
                      await loadPeople();
                    } else {
                      await unlinkPatient({ caretaker_uid: uid, patient_uid: p.firebase_uid });
                      await loadPeople();
                    }
                  } catch {
                    Alert.alert('Error', 'Could not remove patient');
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
        initialName={displayName || 'Family member'}
        initialPhotoUrl={profilePicture}
        onClose={() => setShowEditProfile(false)}
        onSaved={({ full_name, profile_picture }) => {
          setDisplayName(full_name);
          if (profile_picture !== undefined) setProfilePicture(profile_picture ?? null);
        }}
      />
      <AddOfflinePatientModal
        visible={showOfflinePatientModal}
        onClose={() => setShowOfflinePatientModal(false)}
        onSave={handleSaveOfflinePatient}
        saving={savingOfflinePatient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  scrollPad: { padding: 16, gap: 14, paddingBottom: 32 },
  profileHeader: { alignItems: 'center', paddingVertical: 16 },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  profileAvatarImg: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  profileAvatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#222' },
  greetingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#222' },
  greetingSub: { fontSize: TEXT.sm, color: '#666', marginTop: 4, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 10 },
  personCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  personRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: TEXT.lg, fontWeight: '800', color: GREEN },
  personName: { fontSize: TEXT.md, fontWeight: '800', color: '#222' },
  personSub: { fontSize: TEXT.sm, color: '#777', marginTop: 4 },
  mlBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  riskBadgeText: { fontSize: 11, fontWeight: '800' },
  mlActionText: { fontSize: 11, color: '#666', fontWeight: '600' },
  personActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: TEXT.sm },
  actionBtnOutline: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: GREEN,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnOutlineText: { color: GREEN, fontWeight: '800', fontSize: TEXT.sm },
  linkBanner: {
    backgroundColor: GREEN,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkBannerText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: TEXT.md },
  sectionTitle: { fontSize: TEXT.md, fontWeight: '800', color: '#444' },
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scheduleName: { fontSize: TEXT.md, fontWeight: '800', color: '#222', marginBottom: 10 },
  scheduleMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  scheduleStatusWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: 4,
  },
  scheduleTimeBox: {
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
  scheduleTimeText: { fontSize: 11, fontWeight: '800', color: '#333', textAlign: 'center' },
  scheduleMedName: { fontSize: TEXT.md, fontWeight: '800', color: '#222' },
  scheduleMedSub: { fontSize: TEXT.sm, color: theme.textSecondary, marginTop: 2 },
  slotEmpty: { fontSize: TEXT.sm, color: theme.textMuted, paddingVertical: 8 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#333' },
  emptySub: { fontSize: TEXT.sm, color: '#888', textAlign: 'center', lineHeight: 20 },
  primaryBtn: { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: TEXT.sm },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: '#c62828', fontWeight: '800', fontSize: TEXT.md },
  version: { textAlign: 'center', color: '#ccc', fontSize: TEXT.xs, marginTop: 20 },

  fullscreenModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  linkedPatientsWrap: { gap: 10, marginBottom: 8 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  patientManageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
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
    justifyContent: 'center',
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
    justifyContent: 'center',
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

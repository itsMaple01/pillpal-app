import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import {
  getLinkedPatients, getMedications, getUser, sendPatientReminder,
  saveExpoPushToken,
} from '@/api/index';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { subscribeCaretakerOverview } from '@/services/caretakerRealtime';
import { mapMedicationRows } from '@/services/medicationRealtime';
import { medicationTimeBucket, parseMedicationTime } from '@/utils/medicationTimeBucket';
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
import { APP_NAME } from '@/lib/branding';
import { TEXT } from '@/lib/typography';
import { theme } from '@/lib/theme';
import {
  isTutorialDone, setTutorialDone, FAMILY_TUTORIAL,
} from '@/lib/tutorial';
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
}

export default function FamilyDashboard({ uid, onLogout, onSwitchToCaregiver }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;

  const [tab, setTab] = useState<Tab>('Home');
  const [people, setPeople] = useState<LinkedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [medsByPerson, setMedsByPerson] = useState<Record<string, PatientMedication[]>>({});
  const [showLink, setShowLink] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialIdx, setTutorialIdx] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSwitchMode, setShowSwitchMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());

  const loadPeople = useCallback(async () => {
    try {
      const res = await getLinkedPatients(uid);
      const list = Array.isArray(res.data) ? res.data : [];
      setPeople(list.slice(0, 5));
      const medMap: Record<string, PatientMedication[]> = {};
      await Promise.all(
        list.slice(0, 5).map(async (p: LinkedPerson) => {
          try {
            const m = await getMedications(p.firebase_uid);
            const rows = Array.isArray(m.data) ? m.data : [];
            medMap[p.firebase_uid] = mapMedicationRows(rows);
          } catch {
            medMap[p.firebase_uid] = [];
          }
        }),
      );
      setMedsByPerson(medMap);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadPeople();
    getUser(uid)
      .then(r => setDisplayName((r.data?.full_name as string | undefined)?.trim() || 'Family member'))
      .catch(() => setDisplayName('Family member'));
    registerForPushNotificationsAsync().then(t => {
      if (t) saveExpoPushToken(uid, t).catch(() => {});
    });
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

  const alert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const sendReminder = async (person: LinkedPerson) => {
    try {
      await sendPatientReminder({
        caretaker_uid: uid,
        patient_uid: person.firebase_uid,
        message: `${displayName} sent you a medication reminder.`,
      });
      alert('Sent', `Reminder sent to ${person.full_name ?? person.email}.`);
    } catch {
      alert('Error', 'Could not send reminder.');
    }
  };

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
                      <AppIcon
                        name={m.taken ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={m.taken ? GREEN : '#ccc'}
                      />
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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      ) : (
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
      )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  scrollPad: { padding: 16, gap: 14, paddingBottom: 32 },
  greetingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: GREEN,
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
  scheduleTimeBox: {
    backgroundColor: theme.greenLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  scheduleTimeText: { fontSize: TEXT.sm, fontWeight: '800', color: theme.greenDark },
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
});

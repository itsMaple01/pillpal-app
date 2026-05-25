import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import {
  getLinkedPatients, getMedications, getUser, sendPatientReminder,
  saveExpoPushToken, getIncomingLinkRequests, acceptLinkRequest, rejectLinkRequest,
} from '@/api/index';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { subscribeCaretakerOverview } from '@/services/caretakerRealtime';
import { medicationTimeBucket, parseMedicationTime } from '@/utils/medicationTimeBucket';
import LinkPatientModal from '@/components/Linkpatientmodal';
import AppHeader from '@/components/AppHeader';
import AppIcon from '@/components/AppIcon';
import MenuRow from '@/components/MenuRow';
import StatTile from '@/components/StatTile';
import { APP_NAME } from '@/lib/branding';
import { TEXT } from '@/lib/typography';
import type { PatientMedication } from '@/types/medication';

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

type Tab = 'Home' | 'Family' | 'Schedule' | 'Manage';

const GREEN = '#2d7a3a';
const GREEN_LIGHT = '#e8f5e9';
const TABS: Tab[] = ['Home', 'Family', 'Schedule', 'Manage'];

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
  const [linkRequests, setLinkRequests] = useState<any[]>([]);

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
            medMap[p.firebase_uid] = Array.isArray(m.data) ? m.data : [];
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
    getIncomingLinkRequests(uid)
      .then(r => setLinkRequests(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLinkRequests([]));
  }, [uid, loadPeople]);

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
            <Text style={styles.avatarText}>{(person.full_name ?? person.email ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{person.full_name ?? person.email}</Text>
            <Text style={styles.personSub}>
              Age {person.age ?? '—'} · {pending} pending · {meds.length} meds today
            </Text>
          </View>
        </View>
        {!compact && (
          <View style={styles.personActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => sendReminder(person)}>
              <Text style={styles.actionBtnText}>Send reminder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={() => { setSelectedId(person.firebase_uid); setTab('Schedule'); }}>
              <Text style={styles.actionBtnOutlineText}>View schedule</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSchedule = () => {
    const list = selectedId ? people.filter(p => p.firebase_uid === selectedId) : people;
    return (
      <ScrollView contentContainerStyle={styles.scrollPad}>
        <Text style={styles.sectionTitle}>Today&apos;s schedules</Text>
        {list.map(person => (
          <View key={person.firebase_uid} style={styles.scheduleCard}>
            <Text style={styles.scheduleName}>{person.full_name ?? person.email}</Text>
            <View style={styles.slotRow}>
              {(['Morning', 'Afternoon', 'Evening'] as const).map(slot => {
                const meds = (medsByPerson[person.firebase_uid] || []).filter(m => {
                  if (m.suspended) return false;
                  return medicationTimeBucket(m.time) === slot;
                });
                return (
                  <View key={slot} style={styles.slot}>
                    <Text style={styles.slotLabel}>{slot}</Text>
                    {meds.length === 0 ? (
                      <Text style={styles.slotEmpty}>No meds</Text>
                    ) : (
                      meds.map(m => (
                        <Text key={m.id} style={styles.slotMed}>
                          {m.taken ? '✓ ' : '○ '}{m.name} · {parseMedicationTime(m.time)?.label ?? m.time}
                        </Text>
                      ))
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const body = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      );
    }

    if (tab === 'Home') {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad}>
          <View style={styles.greetingCard}>
            <AppIcon name="people-outline" size={28} color={GREEN} />
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingTitle}>Supporting your family</Text>
              <Text style={styles.greetingSub}>Hi {displayName} — keep loved ones on track with gentle reminders.</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <StatTile icon="people-outline" value={String(people.length)} label="Linked people" />
            <StatTile icon="medical-outline" value={String(totalMedsToday)} label="Meds today" />
            <StatTile icon="checkmark-circle-outline" value={String(takenToday)} label="Taken" />
          </View>
          {people.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No family linked yet</Text>
              <Text style={styles.emptySub}>Link a patient with their code or email.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowLink(true)}>
                <Text style={styles.primaryBtnText}>Link family member</Text>
              </TouchableOpacity>
            </View>
          ) : (
            people.map(p => renderPersonCard(p))
          )}
        </ScrollView>
      );
    }

    if (tab === 'Family') {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad}>
          <TouchableOpacity style={styles.linkBanner} onPress={() => setShowLink(true)}>
            <AppIcon name="link-outline" size={22} color="#fff" />
            <Text style={styles.linkBannerText}>Link another family member</Text>
          </TouchableOpacity>
          {linkRequests.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Pending requests</Text>
              {linkRequests.map(req => (
                <View key={req.id} style={styles.reqCard}>
                  <Text style={styles.reqTitle}>Link request</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => acceptLinkRequest(req.id, uid).then(loadPeople)}
                    >
                      <Text style={styles.primaryBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => rejectLinkRequest(req.id, { caretaker_uid: uid }).then(loadPeople)}
                    >
                      <Text style={styles.actionBtnOutlineText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
          {people.map(p => renderPersonCard(p))}
        </ScrollView>
      );
    }

    if (tab === 'Schedule') return renderSchedule();

    return (
      <ScrollView contentContainerStyle={styles.scrollPad}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuRow
          icon="swap-horizontal-outline"
          label="Switch to Caregiver Dashboard"
          sub="Full professional view with patients table, alerts, and analytics"
          onPress={() => {
            Alert.alert(
              'Caregiver mode',
              'Open the full caregiver dashboard? You can return to family view anytime from Manage.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Switch', onPress: onSwitchToCaregiver },
              ],
            );
          }}
        />
        <MenuRow icon="link-outline" label="Link family member" sub="Redeem a patient link code" onPress={() => setShowLink(true)} />
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>{APP_NAME} v1.0.1</Text>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AppHeader title="Family care" subtitle={`Hi ${displayName}`} />
      <View style={[styles.body, isTablet && styles.bodyTablet]}>{body()}</View>
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <LinkPatientModal visible={showLink} onClose={() => setShowLink(false)} caretakerUid={uid} onLinked={loadPeople} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4f0' },
  body: { flex: 1 },
  bodyTablet: { maxWidth: 900, alignSelf: 'center', width: '100%' },
  scrollPad: { padding: 16, gap: 14, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  greetingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center',
    borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  greetingTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#222' },
  greetingSub: { fontSize: TEXT.sm, color: '#666', marginTop: 4, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 10 },
  personCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  personRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: TEXT.lg, fontWeight: '800', color: GREEN },
  personName: { fontSize: TEXT.md, fontWeight: '800', color: '#222' },
  personSub: { fontSize: TEXT.sm, color: '#777', marginTop: 4 },
  personActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: TEXT.sm },
  actionBtnOutline: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: GREEN, backgroundColor: '#fff',
  },
  actionBtnOutlineText: { color: GREEN, fontWeight: '800', fontSize: TEXT.sm },
  linkBanner: {
    backgroundColor: GREEN, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  linkBannerText: { color: '#fff', fontWeight: '800', fontSize: TEXT.md },
  sectionTitle: { fontSize: TEXT.md, fontWeight: '800', color: '#444' },
  scheduleCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  scheduleName: { fontSize: TEXT.md, fontWeight: '800', color: '#222', marginBottom: 10 },
  slotRow: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 10, padding: 10 },
  slotLabel: { fontSize: TEXT.sm, fontWeight: '800', color: '#444', marginBottom: 6 },
  slotEmpty: { fontSize: TEXT.xs, color: '#bbb' },
  slotMed: { fontSize: TEXT.sm, color: '#333', marginTop: 4, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#333' },
  emptySub: { fontSize: TEXT.sm, color: '#888', textAlign: 'center' },
  primaryBtn: { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: TEXT.sm },
  reqCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: GREEN },
  reqTitle: { fontSize: TEXT.md, fontWeight: '700', color: '#222' },
  logoutBtn: {
    marginTop: 20, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#ffcdd2', alignItems: 'center',
  },
  logoutText: { color: '#c62828', fontWeight: '800', fontSize: TEXT.md },
  version: { textAlign: 'center', color: '#ccc', fontSize: TEXT.xs, marginTop: 20 },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabLabel: { fontSize: TEXT.sm, color: '#aaa', fontWeight: '600' },
  tabLabelActive: { color: GREEN, fontWeight: '800' },
});

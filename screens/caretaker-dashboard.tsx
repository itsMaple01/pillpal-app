import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions, TextInput,
  ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { getLinkedPatients } from '@/api/index';

interface Props {
  onLogout: () => void;
  uid: string;
}

const GREEN = '#2d7a3a';
const GREEN_DARK = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

type CaretakerTab = 'Home' | 'Patients' | 'Schedule' | 'Alerts' | 'Profile';

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
}

function getPatientStatus(patient: Patient): string {
  if (patient.link_status === 'inactive') return 'Inactive';
  if ((patient.missed_doses ?? 0) >= 5) return 'Needs Attention';
  if ((patient.missed_doses ?? 0) > 0) return 'Missed Doses';
  return 'Active';
}

const SIDE_TABS: { icon: string; label: CaretakerTab }[] = [
  { icon: '🏠', label: 'Home' },
  { icon: '👥', label: 'Patients' },
  { icon: '📅', label: 'Schedule' },
  { icon: '🔔', label: 'Alerts' },
  { icon: '👤', label: 'Profile' },
];

export default function CaretakerDashboard({ onLogout, uid }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;

  const [activeTab, setActiveTab] = useState<CaretakerTab>('Patients');
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await getLinkedPatients(uid);
      setPatients(res.data);
    } catch {
      Alert.alert('Error', 'Could not load patients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = patients.filter(p => {
    const status = getPatientStatus(p);
    const matchFilter = activeFilter === 'All' || status === activeFilter;
    const matchSearch =
      (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = {
    total: patients.length,
    active: patients.filter(p => getPatientStatus(p) === 'Active').length,
    missed: patients.filter(p => (p.missed_doses ?? 0) > 0).length,
    attention: patients.filter(p => getPatientStatus(p) === 'Needs Attention').length,
  };

  // ── HOME SCREEN ──
  const HomeScreen = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      <View style={styles.homeGreeting}>
        <Text style={styles.homeGreetingTitle}>👋 Welcome back!</Text>
        <Text style={styles.homeGreetingSub}>Here's a quick overview of your patients.</Text>
      </View>

      <View style={styles.homeStatsGrid}>
        {[
          { icon: '👥', num: stats.total, label: 'Total Patients', color: GREEN },
          { icon: '✅', num: stats.active, label: 'Active', color: '#2d7a3a' },
          { icon: '⚠️', num: stats.missed, label: 'Missed Doses', color: '#e65100' },
          { icon: '🚨', num: stats.attention, label: 'Needs Attention', color: '#c62828' },
        ].map((s, i) => (
          <View key={i} style={[styles.homeStatCard, { borderTopColor: s.color }]}>
            <Text style={styles.homeStatIcon}>{s.icon}</Text>
            <Text style={[styles.homeStatNum, { color: s.color }]}>{s.num}</Text>
            <Text style={styles.homeStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.homeQuickBtn} onPress={() => setActiveTab('Patients')}>
        <Text style={styles.homeQuickBtnText}>👥 View All Patients →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.homeQuickBtn, styles.homeQuickBtnOutline]} onPress={() => setActiveTab('Alerts')}>
        <Text style={[styles.homeQuickBtnText, { color: GREEN }]}>🔔 Check Alerts →</Text>
      </TouchableOpacity>

      <View style={styles.homeTipCard}>
        <Text style={styles.homeTipTitle}>💡 Tip</Text>
        <Text style={styles.homeTipText}>
          Patients with 5+ missed doses are flagged as "Needs Attention". Reach out to them with a reminder.
        </Text>
      </View>
    </ScrollView>
  );

  // ── PATIENTS SCREEN ──
  const PatientRow = ({ patient }: { patient: Patient }) => {
    const isExpanded = expandedId === patient.firebase_uid;
    const status = getPatientStatus(patient);
    const statusColor = STATUS_COLORS[status] ?? { bg: '#eee', text: '#333' };

    return (
      <View style={styles.patientCard}>
        <TouchableOpacity
          style={styles.patientRow}
          onPress={() => setExpandedId(isExpanded ? null : patient.firebase_uid)}
          activeOpacity={0.8}
        >
          <View style={styles.patientLeft}>
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
              <Text style={[styles.metaText, { color: (patient.missed_doses ?? 0) > 0 ? '#e65100' : GREEN, fontWeight: '700' }]}>
                {patient.missed_doses ?? 0} missed
              </Text>
              <View style={[styles.compliancePill, { backgroundColor: (patient.compliance ?? 0) >= 80 ? GREEN_LIGHT : (patient.compliance ?? 0) >= 60 ? '#fff3e0' : '#fce4ec' }]}>
                <Text style={[styles.complianceText, { color: (patient.compliance ?? 0) >= 80 ? GREEN : (patient.compliance ?? 0) >= 60 ? '#e65100' : '#c62828' }]}>
                  {patient.compliance ?? 0}%
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusText, { color: statusColor.text }]}>{status}</Text>
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
                { num: patient.missed_doses ?? 0, label: 'Missed Doses' },
                { num: `${patient.compliance ?? 0}%`, label: 'Compliance' },
                { num: patient.age ?? '—', label: 'Age' },
              ].map((s, i) => (
                <View key={i} style={styles.expandedStat}>
                  <Text style={styles.expandedStatNum}>{s.num}</Text>
                  <Text style={styles.expandedStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.expandedActions}>
              <TouchableOpacity style={styles.actionBtnGreen} onPress={() => setActiveTab('Schedule')}>
                <Text style={styles.actionBtnText}>📋 View Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnOutline}>
                <Text style={styles.actionBtnOutlineText}>✉️ Send Reminder</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const PatientsScreen = () => (
    <View style={styles.mainContent}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={styles.statsRow}>
          {[
            { icon: '👥', num: stats.total, label: 'Total Patients' },
            { icon: '✅', num: stats.active, label: 'Active' },
            { icon: '⚠️', num: stats.missed, label: 'Missed Doses' },
            { icon: '🚨', num: stats.attention, label: 'Needs Attention' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statNum}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}
          contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f}
              style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
              onPress={() => setActiveFilter(f)}>
              <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isTablet && (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Patient</Text>
            <Text style={styles.tableHeaderText}>Missed</Text>
            <Text style={styles.tableHeaderText}>Compliance</Text>
            <Text style={styles.tableHeaderText}>Status</Text>
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
              <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>Ask patients to link their account to yours</Text>
            </View>
          ) : (
            filtered.map(p => <PatientRow key={p.firebase_uid} patient={p} />)
          )}
        </ScrollView>
      )}
    </View>
  );

  // ── SCHEDULE SCREEN ──
  const ScheduleScreen = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.screenTitle}>📅 Patient Schedules</Text>
      </View>

      {patients.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No patients linked yet</Text>
          <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>Schedules will appear here once patients are linked</Text>
        </View>
      ) : (
        patients.map(p => (
          <View key={p.firebase_uid} style={styles.schedulePatientCard}>
            <View style={styles.schedulePatientHeader}>
              <View style={styles.scheduleAvatar}>
                <Text style={styles.scheduleAvatarText}>{(p.full_name ?? p.email ?? '?').charAt(0).toUpperCase()}</Text>
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
              {['Morning', 'Afternoon', 'Evening'].map((slot, i) => (
                <View key={i} style={styles.scheduleSlot}>
                  <Text style={styles.scheduleSlotTime}>{slot}</Text>
                  <Text style={styles.scheduleSlotEmpty}>No meds</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ── ALERTS SCREEN ──
  const AlertsScreen = () => {
    const alertPatients = patients.filter(p => getPatientStatus(p) !== 'Active' && getPatientStatus(p) !== 'Inactive');
    return (
      <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Text style={styles.screenTitle}>🔔 Alerts</Text>

        {alertPatients.length === 0 ? (
          <View style={styles.alertAllClear}>
            <Text style={styles.alertAllClearIcon}>✅</Text>
            <Text style={styles.alertAllClearTitle}>All Clear!</Text>
            <Text style={styles.alertAllClearSub}>No patients need attention right now.</Text>
          </View>
        ) : (
          alertPatients.map(p => {
            const status = getPatientStatus(p);
            const isUrgent = status === 'Needs Attention';
            return (
              <View key={p.firebase_uid} style={[styles.alertCard, { borderLeftColor: isUrgent ? '#c62828' : '#e65100' }]}>
                <Text style={styles.alertIcon}>{isUrgent ? '🚨' : '⚠️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertPatientName}>{p.full_name ?? p.email}</Text>
                  <Text style={styles.alertMessage}>
                    {isUrgent
                      ? `${p.missed_doses} missed doses — immediate follow-up recommended`
                      : `${p.missed_doses} missed dose${p.missed_doses !== 1 ? 's' : ''} this period`}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.alertActionBtn, { backgroundColor: isUrgent ? '#fce4ec' : '#fff3e0' }]}>
                  <Text style={[styles.alertActionText, { color: isUrgent ? '#c62828' : '#e65100' }]}>
                    Remind
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={styles.alertInfoCard}>
          <Text style={styles.alertInfoTitle}>ℹ️ Alert Thresholds</Text>
          <Text style={styles.alertInfoText}>⚠️ Missed Doses — 1 to 4 missed doses</Text>
          <Text style={styles.alertInfoText}>🚨 Needs Attention — 5+ missed doses</Text>
        </View>
      </ScrollView>
    );
  };

  // ── PROFILE SCREEN ──
  const ProfileScreen = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>C</Text>
        </View>
        <Text style={styles.profileName}>Caretaker</Text>
        <Text style={styles.profileUid}>ID: {uid?.slice(0, 12)}...</Text>
      </View>

      <Text style={styles.manageSection}>Overview</Text>
      {[
        { icon: '👥', label: 'Linked Patients', sub: `${patients.length} patient${patients.length !== 1 ? 's' : ''}` },
        { icon: '🚨', label: 'Needs Attention', sub: `${stats.attention} patient${stats.attention !== 1 ? 's' : ''}` },
        { icon: '✅', label: 'Active Patients', sub: `${stats.active} patient${stats.active !== 1 ? 's' : ''}` },
      ].map((item, i) => (
        <View key={i} style={styles.manageRow}>
          <View style={styles.manageIconBox}><Text style={{ fontSize: 20 }}>{item.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageRowLabel}>{item.label}</Text>
            <Text style={styles.manageRowSub}>{item.sub}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.manageSection}>Settings</Text>
      {[
        { icon: '🔔', label: 'Notification Settings', sub: 'Manage alert preferences' },
        { icon: '🔒', label: 'Privacy & Security', sub: 'Manage your data' },
        { icon: '❓', label: 'Help & Support', sub: 'Get assistance' },
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
      case 'Patients': return <PatientsScreen />;
      case 'Schedule': return <ScheduleScreen />;
      case 'Alerts': return <AlertsScreen />;
      case 'Profile': return <ProfileScreen />;
    }
  };

  const screenTitles: Record<CaretakerTab, string> = {
    Home: '🏠 Dashboard',
    Patients: '👨‍⚕️ Caretaker Dashboard',
    Schedule: '📅 Schedules',
    Alerts: '🔔 Alerts',
    Profile: '👤 Profile',
  };
  const screenSubs: Record<CaretakerTab, string> = {
    Home: 'Welcome back, Caretaker!',
    Patients: "Good day! Here's your patient overview.",
    Schedule: 'View all patient medication schedules.',
    Alerts: 'Patients that need your attention.',
    Profile: 'Your account and settings.',
  };

  if (isTablet) {
    return (
      <View style={[styles.outer, { flexDirection: 'row' }]}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
        <View style={[styles.sidebar, { paddingTop: insets.top + 16 }]}>
          <View style={styles.sidebarLogo}>
            <Text style={styles.sidebarLogoIcon}>💊</Text>
            <Text style={styles.sidebarLogoText}>PillPal</Text>
          </View>
          <View style={styles.sidebarNav}>
            {SIDE_TABS.map(tab => (
              <TouchableOpacity key={tab.label}
                style={[styles.sidebarItem, activeTab === tab.label && styles.sidebarItemActive]}
                onPress={() => setActiveTab(tab.label)}>
                <Text style={styles.sidebarIcon}>{tab.icon}</Text>
                <Text style={[styles.sidebarLabel, activeTab === tab.label && styles.sidebarLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sidebarBottom}>
            <TouchableOpacity style={styles.sidebarLogout} onPress={onLogout}>
              <Text style={styles.sidebarIcon}>🚪</Text>
              <Text style={styles.sidebarLogoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, backgroundColor: '#f0f4f0' }}>
          <View style={[styles.tabletHeader, { paddingTop: insets.top + 12 }]}>
            <View>
              <Text style={styles.tabletHeaderTitle}>{screenTitles[activeTab]}</Text>
              <Text style={styles.tabletHeaderSub}>{screenSubs[activeTab]}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
          {renderScreen()}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>{screenTitles[activeTab]}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
      {renderScreen()}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}>
        {SIDE_TABS.map(tab => (
          <TouchableOpacity key={tab.label} style={styles.tabItem} onPress={() => setActiveTab(tab.label)}>
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.label && { color: GREEN, fontWeight: '700' }]}>
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
  sidebar: {
    width: 200, backgroundColor: GREEN_DARK,
    paddingHorizontal: 16, paddingBottom: 24,
    justifyContent: 'space-between',
  },
  sidebarLogo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  sidebarLogoIcon: { fontSize: 28 },
  sidebarLogoText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sidebarNav: { flex: 1, gap: 4 },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
  },
  sidebarItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  sidebarIcon: { fontSize: 18 },
  sidebarLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  sidebarLabelActive: { color: '#fff' },
  sidebarBottom: { marginTop: 16 },
  sidebarLogout: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  sidebarLogoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tabletHeader: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  tabletHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tabletHeaderSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  mainContent: { flex: 1 },

  // Home screen
  homeGreeting: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  homeGreetingTitle: { fontSize: 18, fontWeight: '800', color: '#222' },
  homeGreetingSub: { fontSize: 13, color: '#666', marginTop: 4 },
  homeStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  homeStatCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  homeStatIcon: { fontSize: 24, marginBottom: 6 },
  homeStatNum: { fontSize: 28, fontWeight: '800' },
  homeStatLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  homeQuickBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  homeQuickBtnOutline: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: GREEN,
  },
  homeQuickBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  homeTipCard: {
    backgroundColor: '#fffde7', borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: '#fbc02d',
  },
  homeTipTitle: { fontSize: 14, fontWeight: '800', color: '#f57f17', marginBottom: 6 },
  homeTipText: { fontSize: 13, color: '#795548', lineHeight: 20 },

  // Patients screen
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#e8f0e8',
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#222' },
  filterScroll: { flexGrow: 0 },
  filterTab: {
    paddingHorizontal: 14, borderRadius: 20, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    height: 32, alignItems: 'center', justifyContent: 'center',
  },
  filterTabActive: { backgroundColor: GREEN, borderColor: GREEN },
  filterTabText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: GREEN_DARK, borderRadius: 10,
  },
  tableHeaderText: {
    flex: 1, fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  patientCard: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 6,
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  patientRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 12,
  },
  patientLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 2 },
  chevron: { fontSize: 10, color: '#aaa', width: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: GREEN },
  patientName: { fontSize: 14, fontWeight: '700', color: '#222' },
  patientSub: { fontSize: 11, color: '#888', marginTop: 1 },
  patientMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 3, justifyContent: 'flex-end' },
  metaText: { flex: 1, fontSize: 12, color: '#555', textAlign: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  compliancePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  complianceText: { fontSize: 11, fontWeight: '700' },
  expandedSection: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 12, backgroundColor: '#fafafa',
  },
  expandedStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  expandedStat: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#eee',
  },
  expandedStatNum: { fontSize: 14, fontWeight: '800', color: '#222' },
  expandedStatLabel: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },
  expandedActions: { flexDirection: 'row', gap: 10 },
  actionBtnGreen: {
    flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtnOutline: {
    flex: 1, borderWidth: 1.5, borderColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  actionBtnOutlineText: { color: GREEN, fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#aaa' },

  // Schedule screen
  sectionHeaderRow: { marginBottom: 4 },
  screenTitle: { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 4 },
  schedulePatientCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  schedulePatientHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  scheduleAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  scheduleAvatarText: { fontSize: 14, fontWeight: '800', color: GREEN },
  schedulePatientName: { fontSize: 14, fontWeight: '700', color: '#222' },
  schedulePatientSub: { fontSize: 12, color: '#888', marginTop: 2 },
  scheduleDivider: { height: 1, backgroundColor: '#f0f0f0' },
  scheduleTimeSlots: { flexDirection: 'row', padding: 12, gap: 8 },
  scheduleSlot: {
    flex: 1, backgroundColor: '#f8f8f8', borderRadius: 10,
    padding: 10, alignItems: 'center',
  },
  scheduleSlotTime: { fontSize: 11, fontWeight: '700', color: '#444', marginBottom: 4 },
  scheduleSlotEmpty: { fontSize: 11, color: '#bbb' },

  // Alerts screen
  alertAllClear: {
    alignItems: 'center', paddingVertical: 48,
    backgroundColor: '#fff', borderRadius: 16,
  },
  alertAllClearIcon: { fontSize: 48, marginBottom: 12 },
  alertAllClearTitle: { fontSize: 20, fontWeight: '800', color: '#222', marginBottom: 4 },
  alertAllClearSub: { fontSize: 14, color: '#888' },
  alertCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  alertIcon: { fontSize: 24 },
  alertPatientName: { fontSize: 14, fontWeight: '700', color: '#222' },
  alertMessage: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 18 },
  alertActionBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  alertActionText: { fontSize: 12, fontWeight: '700' },
  alertInfoCard: {
    backgroundColor: '#e3f2fd', borderRadius: 12, padding: 16,
    borderLeftWidth: 4, borderLeftColor: '#1976d2',
  },
  alertInfoTitle: { fontSize: 14, fontWeight: '800', color: '#1565c0', marginBottom: 8 },
  alertInfoText: { fontSize: 13, color: '#1565c0', marginBottom: 4 },

  // Profile screen
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

  // Tab bar (mobile)
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
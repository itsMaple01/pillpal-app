import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

interface Props { onLogout: () => void; }

const GREEN = '#2d7a3a';
const GREEN_DARK = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

const FILTERS = ['All', 'Active', 'Inactive', 'Missed Doses', 'Upcoming', 'Needs Attention'];

const MOCK_PATIENTS = [
  {
    id: '001', name: 'Maria Santos', age: 72, status: 'Active',
    program: 'Hypertension', lastSeen: 'Today', nextMed: '2:00 PM',
    missedDoses: 0, compliance: 98, members: [
      { name: 'Rosa (Daughter)', connected: true },
      { name: 'Ben (Son-in-law)', connected: false },
    ]
  },
  {
    id: '002', name: 'Juan dela Cruz', age: 68, status: 'Missed Doses',
    program: 'Diabetes T2', lastSeen: 'Yesterday', nextMed: '8:00 AM',
    missedDoses: 3, compliance: 72, members: [
      { name: 'Carla (Wife)', connected: true },
    ]
  },
  {
    id: '003', name: 'Aling Nena', age: 80, status: 'Needs Attention',
    program: 'Arthritis', lastSeen: '2 days ago', nextMed: '6:00 PM',
    missedDoses: 5, compliance: 55, members: [
      { name: 'Marco (Son)', connected: true },
      { name: 'Luci (Daughter)', connected: true },
    ]
  },
  {
    id: '004', name: 'Roberto Reyes', age: 61, status: 'Active',
    program: 'Asthma', lastSeen: 'Today', nextMed: '12:00 PM',
    missedDoses: 0, compliance: 95, members: []
  },
  {
    id: '005', name: 'Tessie Gomez', age: 75, status: 'Inactive',
    program: 'Osteoporosis', lastSeen: '1 week ago', nextMed: '—',
    missedDoses: 0, compliance: 40, members: [
      { name: 'Danny (Son)', connected: false },
    ]
  },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Active':           { bg: '#e8f5e9', text: '#2d7a3a' },
  'Missed Doses':     { bg: '#fff3e0', text: '#e65100' },
  'Needs Attention':  { bg: '#fce4ec', text: '#c62828' },
  'Inactive':         { bg: '#f5f5f5', text: '#777' },
};

export default function CaretakerDashboard({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;

  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSideTab, setActiveSideTab] = useState('Patients');

  const SIDE_TABS = [
    { icon: '🏠', label: 'Home' },
    { icon: '👥', label: 'Patients' },
    { icon: '📅', label: 'Schedule' },
    { icon: '🔔', label: 'Alerts' },
    { icon: '👤', label: 'Profile' },
  ];

  const filtered = MOCK_PATIENTS.filter(p => {
    const matchFilter = activeFilter === 'All' || p.status === activeFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.program.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = {
    total: MOCK_PATIENTS.length,
    active: MOCK_PATIENTS.filter(p => p.status === 'Active').length,
    missed: MOCK_PATIENTS.filter(p => p.missedDoses > 0).length,
    attention: MOCK_PATIENTS.filter(p => p.status === 'Needs Attention').length,
  };

  const PatientRow = ({ patient }: { patient: typeof MOCK_PATIENTS[0] }) => {
    const isExpanded = expandedId === patient.id;
    const statusColor = STATUS_COLORS[patient.status] ?? { bg: '#eee', text: '#333' };

    return (
      <View style={styles.patientCard}>
        <TouchableOpacity
          style={styles.patientRow}
          onPress={() => setExpandedId(isExpanded ? null : patient.id)}
          activeOpacity={0.8}
        >
          <View style={styles.patientLeft}>
            <Text style={styles.chevron}>{isExpanded ? '▼' : '▶'}</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{patient.name.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.patientName}>{patient.name}</Text>
              <Text style={styles.patientSub}>Age {patient.age} · {patient.program}</Text>
            </View>
          </View>

          {isTablet ? (
            <View style={styles.patientMeta}>
              <Text style={styles.metaText}>{patient.lastSeen}</Text>
              <Text style={styles.metaText}>{patient.nextMed}</Text>
              <Text style={[styles.metaText, { color: patient.missedDoses > 0 ? '#e65100' : '#2d7a3a', fontWeight: '700' }]}>
                {patient.missedDoses} missed
              </Text>
              <View style={[styles.compliancePill, { backgroundColor: patient.compliance >= 80 ? GREEN_LIGHT : patient.compliance >= 60 ? '#fff3e0' : '#fce4ec' }]}>
                <Text style={[styles.complianceText, { color: patient.compliance >= 80 ? GREEN : patient.compliance >= 60 ? '#e65100' : '#c62828' }]}>
                  {patient.compliance}%
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusText, { color: statusColor.text }]}>{patient.status}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>{patient.status}</Text>
            </View>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.expandedStats}>
              <View style={styles.expandedStat}>
                <Text style={styles.expandedStatNum}>{patient.missedDoses}</Text>
                <Text style={styles.expandedStatLabel}>Missed Doses</Text>
              </View>
              <View style={styles.expandedStat}>
                <Text style={styles.expandedStatNum}>{patient.compliance}%</Text>
                <Text style={styles.expandedStatLabel}>Compliance</Text>
              </View>
              <View style={styles.expandedStat}>
                <Text style={styles.expandedStatNum}>{patient.nextMed}</Text>
                <Text style={styles.expandedStatLabel}>Next Dose</Text>
              </View>
              <View style={styles.expandedStat}>
                <Text style={styles.expandedStatNum}>{patient.lastSeen}</Text>
                <Text style={styles.expandedStatLabel}>Last Seen</Text>
              </View>
            </View>

            {patient.members.length > 0 && (
              <View style={styles.membersSection}>
                <Text style={styles.membersTitle}>Family Members</Text>
                {patient.members.map((m, i) => (
                  <View key={i} style={styles.memberRow}>
                    <View style={[styles.memberDot, { backgroundColor: m.connected ? GREEN : '#ccc' }]} />
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={[styles.memberStatus, { color: m.connected ? GREEN : '#aaa' }]}>
                      {m.connected ? 'Connected' : 'Not linked'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.expandedActions}>
              <TouchableOpacity style={styles.actionBtnGreen}>
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

  const MainContent = () => (
    <View style={styles.mainContent}>
      {/* Stats Row */}
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

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients or programs..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Table Header (tablet only) */}
      {isTablet && (
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Patient</Text>
          <Text style={styles.tableHeaderText}>Last Seen</Text>
          <Text style={styles.tableHeaderText}>Next Dose</Text>
          <Text style={styles.tableHeaderText}>Missed</Text>
          <Text style={styles.tableHeaderText}>Compliance</Text>
          <Text style={styles.tableHeaderText}>Status</Text>
        </View>
      )}

      {/* Patient List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No patients found</Text>
          </View>
        ) : (
          filtered.map(p => <PatientRow key={p.id} patient={p} />)
        )}
      </ScrollView>
    </View>
  );

  if (isTablet) {
    return (
      <View style={[styles.outer, { flexDirection: 'row' }]}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />

        {/* Sidebar */}
        <View style={[styles.sidebar, { paddingTop: insets.top + 16 }]}>
          <View style={styles.sidebarLogo}>
            <Text style={styles.sidebarLogoIcon}>💊</Text>
            <Text style={styles.sidebarLogoText}>PillPal</Text>
          </View>

          <View style={styles.sidebarNav}>
            {SIDE_TABS.map(tab => (
              <TouchableOpacity
                key={tab.label}
                style={[styles.sidebarItem, activeSideTab === tab.label && styles.sidebarItemActive]}
                onPress={() => setActiveSideTab(tab.label)}
              >
                <Text style={styles.sidebarIcon}>{tab.icon}</Text>
                <Text style={[styles.sidebarLabel, activeSideTab === tab.label && styles.sidebarLabelActive]}>
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

        {/* Main Area */}
        <View style={[styles.tabletMain, { paddingTop: insets.top }]}>
          <View style={styles.tabletHeader}>
            <View>
              <Text style={styles.tabletHeaderTitle}>👨‍⚕️ Caretaker Dashboard</Text>
              <Text style={styles.tabletHeaderSub}>Good day! Here's your patient overview.</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
          <MainContent />
        </View>
      </View>
    );
  }

  // Mobile layout
  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>👨‍⚕️ Caretaker</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <MainContent />

      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}>
        {SIDE_TABS.map(tab => (
          <TouchableOpacity
            key={tab.label}
            style={styles.tabItem}
            onPress={() => setActiveSideTab(tab.label)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeSideTab === tab.label && { color: GREEN }]}>
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

  // Sidebar
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
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
  },
  sidebarItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  sidebarIcon: { fontSize: 20 },
  sidebarLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  sidebarLabelActive: { color: '#fff' },
  sidebarBottom: { marginTop: 16 },
  sidebarLogout: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  sidebarLogoutText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Tablet main area
  tabletMain: { flex: 1, backgroundColor: '#f0f4f0' },
  tabletHeader: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 16, paddingTop: 16,
  },
  tabletHeaderTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  tabletHeaderSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  // Mobile header
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

  // Main content
  mainContent: { flex: 1, padding: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#222' },

  // Filter tabs
  filterScroll: { marginBottom: 12 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
  },
  filterTabActive: { backgroundColor: GREEN, borderColor: GREEN },
  filterTabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },

  // Table header
  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingVertical: 10, backgroundColor: '#e8f5e9',
    borderRadius: 10, marginBottom: 8,
  },
  tableHeaderText: {
    flex: 1, fontSize: 12, fontWeight: '700',
    color: GREEN_DARK, textTransform: 'uppercase',
  },

  // Patient card
  patientCard: {
    backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  patientRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  patientLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 2 },
  chevron: { fontSize: 10, color: '#aaa', width: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: GREEN },
  patientName: { fontSize: 15, fontWeight: '700', color: '#222' },
  patientSub: { fontSize: 12, color: '#888', marginTop: 2 },
  patientMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 3, justifyContent: 'flex-end' },
  metaText: { flex: 1, fontSize: 13, color: '#555', textAlign: 'center' },

  // Status badge
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Compliance
  compliancePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  complianceText: { fontSize: 12, fontWeight: '700' },

  // Expanded section
  expandedSection: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    padding: 14, backgroundColor: '#fafafa',
  },
  expandedStats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  expandedStat: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#eee',
  },
  expandedStatNum: { fontSize: 14, fontWeight: '800', color: '#222' },
  expandedStatLabel: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },

  // Members
  membersSection: { marginBottom: 14 },
  membersTitle: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  memberDot: { width: 8, height: 8, borderRadius: 4 },
  memberName: { flex: 1, fontSize: 13, color: '#333' },
  memberStatus: { fontSize: 12, fontWeight: '600' },

  // Expanded actions
  expandedActions: { flexDirection: 'row', gap: 10 },
  actionBtnGreen: {
    flex: 1, backgroundColor: GREEN, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtnOutline: {
    flex: 1, borderWidth: 1.5, borderColor: GREEN,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  actionBtnOutlineText: { color: GREEN, fontWeight: '700', fontSize: 13 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#aaa' },

  // Mobile tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
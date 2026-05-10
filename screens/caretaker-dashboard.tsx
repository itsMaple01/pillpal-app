import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform
} from 'react-native';

interface Props { onLogout: () => void; }

const GREEN = '#2d7a3a';
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

export default function CaretakerDashboard({ onLogout }: Props) {
  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.header, { paddingTop: STATUSBAR_HEIGHT + 14 }]}>
        <Text style={styles.headerTitle}>👨‍⚕️ Caretaker Dashboard</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.greetingCard}>
          <Text style={styles.greetingIcon}>👋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>Good day, Caretaker!</Text>
            <Text style={styles.greetingSub}>Monitor your patients' medication today.</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Patients</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⚠️</Text>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Missed Doses</Text>
          </View>
        </View>

        <View style={styles.alertsCard}>
          <View style={styles.alertsHeader}>
            <Text style={styles.alertsTitle}>🔔 Alerts</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>0 total</Text>
            </View>
          </View>
          <Text style={styles.emptyText}>No alerts right now</Text>
        </View>

        <TouchableOpacity style={[styles.actionCard, styles.actionCardWhite]}>
          <Text style={styles.actionIcon}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: '#222' }]}>Manage Patients</Text>
            <Text style={[styles.actionSub, { color: '#888' }]}>Add or view linked patients</Text>
          </View>
          <Text style={[styles.arrow, { color: '#222' }]}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Schedule</Text>
            <Text style={styles.actionSub}>View patient schedules</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, { color: GREEN }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>👥</Text>
          <Text style={styles.tabLabel}>Patients</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={styles.tabLabel}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  greetingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4, borderLeftColor: GREEN
  },
  greetingIcon: { fontSize: 32 },
  greetingText: { fontSize: 16, fontWeight: '700', color: '#222' },
  greetingSub: { fontSize: 13, color: '#666', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'center'
  },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statNum: { fontSize: 28, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  alertsCard: { backgroundColor: GREEN, borderRadius: 16, padding: 16 },
  alertsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12
  },
  alertsTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4
  },
  badgeText: { color: '#fff', fontSize: 12 },
  emptyText: {
    color: 'rgba(255,255,255,0.75)', textAlign: 'center',
    fontSize: 14, paddingVertical: 16
  },
  actionCard: {
    backgroundColor: GREEN, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12
  },
  actionCardWhite: { backgroundColor: '#fff' },
  actionIcon: { fontSize: 24 },
  actionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  arrow: { color: '#fff', fontSize: 18 },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 10
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
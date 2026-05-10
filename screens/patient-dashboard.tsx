import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props { onLogout: () => void; }

const GREEN = '#2d7a3a';

export default function PatientDashboard({ onLogout }: Props) {
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
          💊 Medicine Reminder
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={[
        styles.bodyContent,
        isTablet && styles.bodyContentTablet
      ]}>
        <View style={styles.greetingCard}>
          <Text style={styles.greetingIcon}>☀️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>Good day, Patient!</Text>
            <Text style={styles.greetingSub}>Stay on track with your medication today.</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💊</Text>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Today's Meds</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Taken Today</Text>
          </View>
        </View>

        <View style={styles.remindersCard}>
          <View style={styles.remindersHeader}>
            <Text style={styles.remindersTitle}>📋 Today's Reminders</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>0 total</Text>
            </View>
          </View>
          <Text style={styles.emptyText}>No reminders scheduled for today</Text>
        </View>

        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>➕</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Set Reminder</Text>
            <Text style={styles.actionSub}>Add a new medication</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionCard, styles.actionCardWhite]}>
          <Text style={styles.actionIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: '#222' }]}>Calendar</Text>
            <Text style={[styles.actionSub, { color: '#888' }]}>View your schedule</Text>
          </View>
          <Text style={[styles.arrow, { color: '#222' }]}>→</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, { color: GREEN }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>➕</Text>
          <Text style={styles.tabLabel}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={styles.tabLabel}>Calendar</Text>
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
  headerTitleTablet: { fontSize: 20 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  bodyContentTablet: { padding: 24, maxWidth: 900, alignSelf: 'center', width: '100%' },
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
  remindersCard: { backgroundColor: GREEN, borderRadius: 16, padding: 16 },
  remindersHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12
  },
  remindersTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
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
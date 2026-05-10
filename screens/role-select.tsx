import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, Dimensions,
  ScrollView, StatusBar, Platform
} from 'react-native';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface Props {
  uid: string;
  onRoleSelected: (role: 'patient' | 'caretaker') => void;
  onBack: () => void;
}

const GREEN = '#2d7a3a';
const GREEN_DARK = '#1e5c28';
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

export default function RoleSelectScreen({ uid, onRoleSelected, onBack }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;

  const selectRole = async (role: 'patient' | 'caretaker') => {
    setLoading(role);
    try { onRoleSelected(role); } finally { setLoading(null); }
  };

  const handleBack = async () => {
    await signOut(auth);
    onBack();
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.safeTop, { paddingTop: STATUSBAR_HEIGHT }]}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            {isTablet && <Text style={styles.logoEmoji}>💊</Text>}
            {isTablet && <Text style={styles.appName}>PillPal</Text>}
            <Text style={styles.title}>Who are you?</Text>
            <Text style={styles.subtitle}>Choose your account type to continue</Text>
          </View>

          <View style={[styles.cardsContainer, isTablet && styles.cardsRow]}>
            <View style={[styles.card, styles.patientCard, isTablet && styles.cardTablet]}>
              <View style={styles.iconCircle}>
                <Text style={styles.cardIcon}>💊</Text>
              </View>
              <Text style={styles.cardTitle}>Patient</Text>
              <Text style={styles.cardDescLight}>
                Track your medications, set reminders, and monitor your health schedule.
              </Text>
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => selectRole('patient')}
                disabled={loading !== null}
              >
                {loading === 'patient'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.selectBtnText}>Select as Patient →</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={[styles.card, styles.caretakerCard, isTablet && styles.cardTablet]}>
              <View style={[styles.iconCircle, { backgroundColor: '#e8f5e9' }]}>
                <Text style={styles.cardIcon}>👨‍⚕️</Text>
              </View>
              <Text style={[styles.cardTitle, { color: GREEN_DARK }]}>Caretaker</Text>
              <Text style={[styles.cardDescLight, { color: '#555' }]}>
                Monitor linked patients, track compliance, and manage medication schedules.
              </Text>
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: GREEN }]}
                onPress={() => selectRole('caretaker')}
                disabled={loading !== null}
              >
                {loading === 'caretaker'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.selectBtnText}>Select as Caretaker →</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footer}>
            You can switch roles anytime from your profile 💚
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: GREEN },
  safeTop: { flex: 1 },
  bgCircle1: {
    position: 'absolute', top: -80, left: -80,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.07)'
  },
  bgCircle2: {
    position: 'absolute', bottom: -60, right: -60,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  backBtn: {
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: 8, alignSelf: 'flex-start'
  },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' },
  scroll: {
    flexGrow: 1, alignItems: 'center',
    justifyContent: 'center', padding: 20,
    paddingTop: 8, paddingBottom: 40
  },
  topSection: { alignItems: 'center', marginBottom: 24 },
  logoEmoji: { fontSize: 48, marginBottom: 6 },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  cardsContainer: { width: '100%', alignItems: 'center', gap: 16 },
  cardsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' },
  card: {
    width: '100%', maxWidth: 400, borderRadius: 24, padding: 24,
    alignItems: 'center', shadowColor: '#000',
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
  },
  cardTablet: { width: 320, maxWidth: 320 },
  patientCard: { backgroundColor: '#1e5c28' },
  caretakerCard: { backgroundColor: '#fff' },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  cardIcon: { fontSize: 38 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  cardDescLight: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 260
  },
  selectBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, width: '100%', alignItems: 'center', minHeight: 50,
  },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 28, textAlign: 'center' },
});
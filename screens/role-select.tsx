import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
  ScrollView, StatusBar, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Check if auth is initialized
if (!auth) {
  console.error('Firebase auth not initialized in role-select screen');
}
import { syncUser } from '@/api/index';
import AppLogo from '@/components/AppLogo';
import AppIcon from '@/components/AppIcon';
import { APP_NAME } from '@/lib/branding';

interface Props {
  uid: string;
  email: string;
  signupProfile?: { full_name: string; age: number; health_condition: string | null } | null;
  onRoleSelected: (role: 'patient' | 'caretaker') => void;
  onBack: () => void;
}

const GREEN = '#2d7a3a';
const GREEN_DARK = '#1e5c28';

export default function RoleSelectScreen({ uid, email, signupProfile, onRoleSelected, onBack }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  const insets = useSafeAreaInsets();

  const selectRole = async (role: 'patient' | 'caretaker') => {
    setLoading(role);
    try {
      await syncUser({
        firebase_uid: uid,
        email,
        role,
        full_name: signupProfile?.full_name,
        age: signupProfile?.age,
        health_condition: signupProfile?.health_condition ?? undefined,
      });
    } catch (err: any) {
      const msg = String(err?.response?.data?.error ?? err?.message ?? '');
      const isNetwork = msg.includes('Network') || err?.code === 'ECONNABORTED' || !err?.response;
      if (isNetwork) {
        Alert.alert(
          'Saved on device',
          'Could not reach the server right now. Your role is saved on this device — we will sync when you are back online.',
        );
      } else {
        Alert.alert('Error', msg.length < 120 ? msg : 'Could not save your role. Please try again.');
        setLoading(null);
        return;
      }
    } finally {
      setLoading(null);
    }
    onRoleSelected(role);
  };

  const handleBack = async () => {
    if (auth) {
      await signOut(auth);
    }
    onBack();
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />
      <View style={[styles.safeTop, { paddingTop: insets.top }]}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <AppLogo size={72} style={{ marginBottom: 12 }} />
            <Text style={styles.title}>Who are you?</Text>
            <Text style={styles.subtitle}>Pick the account that fits how you use GabayRa</Text>
          </View>

          <View style={[styles.cardsContainer, isTablet && styles.cardsRow]}>
            <View style={[styles.card, styles.patientCard, isTablet && styles.cardTablet]}>
              <View style={styles.iconCircle}>
                <AppIcon name="person-outline" size={32} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Patient</Text>
              <Text style={styles.cardDescLight}>
                I take medications and want reminders, a calendar, and an easy way to link my family.
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
                <AppIcon name="people-outline" size={32} color={GREEN_DARK} />
              </View>
              <Text style={[styles.cardTitle, { color: GREEN_DARK }]}>Family / Caregiver</Text>
              <Text style={[styles.cardDescLight, { color: '#555' }]}>
                I support someone else&apos;s meds — start with a simple family view, or switch to the full caregiver dashboard anytime.
              </Text>
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: GREEN }]}
                onPress={() => selectRole('caretaker')}
                disabled={loading !== null}
              >
                {loading === 'caretaker'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.selectBtnText}>Select as Family / Caregiver →</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footer}>
            You can switch roles anytime from the Manage tab
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
  header: {
    width: '100%', paddingHorizontal: 20,
    paddingTop: 12, paddingBottom: 8,
  },
  headerTablet: { paddingTop: 16, paddingBottom: 12 },
  backBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 20,
    paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scroll: {
    flexGrow: 1, alignItems: 'center',
    justifyContent: 'center', padding: 20,
    paddingTop: 8, paddingBottom: 40
  },
  scrollTablet: { paddingTop: 20 },
  topSection: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
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
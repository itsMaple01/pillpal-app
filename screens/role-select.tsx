import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
  ScrollView, StatusBar, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

if (!auth) {
  console.error('Firebase auth not initialized in role-select screen');
}
import { syncUser } from '@/api/index';
import AppLogo from '@/components/AppLogo';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';

interface Props {
  uid: string;
  email: string;
  signupProfile?: { full_name: string; age: number; health_condition: string | null } | null;
  onRoleSelected: (role: 'patient' | 'caretaker') => void;
  onBack: () => void;
}

const GREEN = theme.green;
const GREEN_DARK = theme.greenDark;

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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <View style={[styles.safeTop, { paddingTop: insets.top }]}>
        <View style={styles.header}>
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
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.iconCircle}>
                <AppIcon name="person-outline" size={32} color={GREEN} />
              </View>
              <Text style={styles.cardTitle}>Patient</Text>
              <Text style={styles.cardDesc}>
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

            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.iconCircle}>
                <AppIcon name="people-outline" size={32} color={GREEN} />
              </View>
              <Text style={styles.cardTitle}>Family / Caregiver</Text>
              <Text style={styles.cardDesc}>
                I support someone else&apos;s meds — start with a simple family view, or switch to the full caregiver dashboard anytime.
              </Text>
              <TouchableOpacity
                style={styles.selectBtn}
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
  outer: { flex: 1, backgroundColor: '#ffffff' },
  safeTop: { flex: 1 },
  header: {
    width: '100%', paddingHorizontal: 20,
    paddingTop: 12, paddingBottom: 8,
  },
  backBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 20,
    paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: theme.border,
    backgroundColor: '#fff',
  },
  backText: { color: GREEN_DARK, fontSize: 18, fontWeight: '700' },
  scroll: {
    flexGrow: 1, alignItems: 'center',
    justifyContent: 'center', padding: 20,
    paddingTop: 8, paddingBottom: 40
  },
  scrollTablet: { paddingTop: 20 },
  topSection: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  cardsContainer: { width: '100%', alignItems: 'center', gap: 16 },
  cardsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' },
  card: {
    width: '100%', maxWidth: 400, borderRadius: 16, padding: 24,
    alignItems: 'center', backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: theme.border,
  },
  cardTablet: { width: 320, maxWidth: 320 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.greenLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: GREEN_DARK, marginBottom: 10, textAlign: 'center' },
  cardDesc: {
    fontSize: 14, color: theme.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 260
  },
  selectBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, width: '100%', alignItems: 'center', minHeight: 50,
  },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { color: theme.textMuted, fontSize: 13, marginTop: 28, textAlign: 'center' },
});

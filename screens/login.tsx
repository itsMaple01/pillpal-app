import { useState, type ComponentProps } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AppIcon from '@/components/AppIcon';
import { validateAge, validateEmail } from '@/utils/algorithms/linear';

interface Props {
  onAuthSuccess: (
    uid: string,
    email: string,
    isNewUser: boolean,
    signupProfile?: { full_name: string; age: number; health_condition: string | null } | null,
  ) => void;
}

function FieldLabel({ icon, text }: { icon: ComponentProps<typeof AppIcon>['name']; text: string }) {
  return (
    <View style={labelStyles.row}>
      <AppIcon name={icon} size={16} color="#2d7a3a" />
      <Text style={labelStyles.text}>{text}</Text>
    </View>
  );
}

const labelStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  text: { fontSize: 14, fontWeight: '600', color: '#444' },
});

export default function LoginScreen({ onAuthSuccess }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [healthCondition, setHealthCondition] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (tab === 'signup' && !fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (tab === 'signup' && !validateAge(age)) {
      Alert.alert('Error', 'Please enter a valid age between 1 and 120');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'signup') {
        const ageNum = parseInt(age, 10);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        onAuthSuccess(result.user.uid, result.user.email ?? '', true, {
          full_name: fullName.trim(),
          age: ageNum,
          health_condition: healthCondition.trim() || null,
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(result.user.uid, result.user.email ?? '', false, null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.circleTopLeft} />
        <View style={styles.circleBottomRight} />

        <View style={styles.header}>
          <View style={styles.logoBox}>
            <AppIcon name="medical" size={44} color="#fff" />
          </View>
          <Text style={styles.appName}>PillPal</Text>
          <Text style={styles.tagline}>Your Medication Companion</Text>
        </View>

        <View style={styles.card}>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, tab === 'login' && styles.tabActive]}
              onPress={() => setTab('login')}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'signup' && styles.tabActive]}
              onPress={() => setTab('signup')}
            >
              <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {tab === 'signup' && (
            <>
              <View style={styles.fieldGroup}>
                <FieldLabel icon="person-outline" text="Full Name" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#aaa"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
              <View style={styles.fieldGroup}>
                <FieldLabel icon="calendar-outline" text="Age" />
                <TextInput
                  style={styles.input}
                  placeholder="Your age (required)"
                  placeholderTextColor="#aaa"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.fieldGroup}>
                <FieldLabel icon="heart-outline" text="Current condition (optional)" />
                <TextInput
                  style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                  placeholder="e.g. hypertension — skip if you prefer not to say"
                  placeholderTextColor="#aaa"
                  value={healthCondition}
                  onChangeText={setHealthCondition}
                  multiline
                />
              </View>
            </>
          )}
          <View style={styles.fieldGroup}>
            <FieldLabel icon="mail-outline" text="Email" />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.fieldGroup}>
            <FieldLabel icon="lock-closed-outline" text="Password" />
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <AppIcon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>
            </View>
          </View>

          {tab === 'login' && (
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleAuth} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {tab === 'login' ? 'Log In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setTab(tab === 'login' ? 'signup' : 'login')}>
            <Text style={styles.toggleText}>
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {tab === 'login' ? 'Sign up' : 'Log in'}
              </Text>
            </Text>
          </TouchableOpacity>

        </View>

        <Text style={styles.footer}>
          Helping you stay healthy, one reminder at a time
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#2d7a3a';

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: GREEN },
  scroll: {
    flexGrow: 1, alignItems: 'center',
    justifyContent: 'center', padding: 24,
  },
  circleTopLeft: {
    position: 'absolute', top: -40, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  circleBottomRight: {
    position: 'absolute', bottom: 60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  header: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  appName: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: '#fff',
    borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowRadius: 16, elevation: 8,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#f0f0f0',
    borderRadius: 12, padding: 4, marginBottom: 24,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 4, elevation: 2,
  },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: GREEN, fontWeight: '700' },
  fieldGroup: { marginBottom: 16 },
  input: {
    backgroundColor: '#f7f7f7', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#222',
    borderWidth: 1, borderColor: '#eee', width: '100%',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: { position: 'absolute', right: 12 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -8 },
  forgotText: { color: GREEN, fontSize: 13, fontWeight: '500' },
  submitBtn: {
    backgroundColor: GREEN, borderRadius: 14,
    padding: 16, alignItems: 'center',
    marginBottom: 20, marginTop: 4,
    shadowColor: GREEN, shadowOpacity: 0.4,
    shadowRadius: 8, elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggleText: { textAlign: 'center', fontSize: 14, color: '#666' },
  toggleLink: { color: GREEN, fontWeight: '700' },
  footer: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13, marginTop: 28, textAlign: 'center',
  },
});

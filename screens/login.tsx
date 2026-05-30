import { useState, useEffect, type ComponentProps } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import WelcomeBackground from '@/components/WelcomeBackground';
import { APP_NAME, APP_TAGLINE } from '@/lib/branding';
import { validateEmail } from '@/utils/algorithms/linear';
import DateOfBirthField, { ageFromDateOfBirth } from '@/components/DateOfBirthField';
import { theme } from '@/lib/theme';

interface Props {
  initialTab?: 'login' | 'signup';
  onBack?: () => void;
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
      <AppIcon name={icon} size={16} color={theme.green} />
      <Text style={labelStyles.text}>{text}</Text>
    </View>
  );
}

const labelStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  text: { fontSize: 14, fontWeight: '600', color: '#444' },
});

export default function LoginScreen({ initialTab = 'login', onBack, onAuthSuccess }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [healthCondition, setHealthCondition] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
    if (tab === 'signup' && !dateOfBirth) {
      Alert.alert('Error', 'Please choose your date of birth');
      return;
    }
    const ageNum = dateOfBirth ? ageFromDateOfBirth(dateOfBirth) : 0;
    if (tab === 'signup' && (ageNum < 1 || ageNum > 120)) {
      Alert.alert('Error', 'Please enter a valid date of birth');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'signup') {
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

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed || !validateEmail(trimmed)) {
      Alert.alert(
        'Reset password',
        'Enter the email address for your account in the Email field, then tap Forgot password again.',
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmed);
      Alert.alert(
        'Check your email',
        `We sent a password reset link to ${trimmed}. Open the link to choose a new password.`,
      );
    } catch (error: any) {
      Alert.alert('Could not send reset email', error?.message ?? 'Please try again.');
    }
  };

  const passwordField = (
    <View style={styles.fieldGroup}>
      <FieldLabel icon="lock-closed-outline" text="Password" />
      <View style={styles.passwordWrap}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="At least 6 characters"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPassword(!showPassword)}
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        >
          <AppIcon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WelcomeBackground />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <AppLogo size={72} style={{ marginBottom: 12 }} />
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
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

          {tab === 'login' ? (
            <View>
              <View style={styles.fieldGroupTight}>
                <FieldLabel icon="mail-outline" text="Email" />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {passwordField}
              <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.fieldGroupTight}>
                <FieldLabel icon="person-outline" text="Full name" />
                <TextInput
                  style={styles.input}
                  placeholder="Last name, first name"
                  placeholderTextColor="#aaa"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
              <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} />
              <View style={styles.fieldGroup}>
                <FieldLabel icon="heart-outline" text="Health note (optional)" />
                <TextInput
                  style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                  placeholder="e.g. hypertension"
                  placeholderTextColor="#aaa"
                  value={healthCondition}
                  onChangeText={setHealthCondition}
                  multiline
                />
              </View>
              <View style={styles.fieldGroupTight}>
                <FieldLabel icon="mail-outline" text="Email" />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {passwordField}
            </View>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#ffffff' },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  appName: { fontSize: 30, fontWeight: '800', color: theme.greenDark, marginBottom: 4 },
  tagline: { fontSize: 14, color: theme.textSecondary },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: theme.green, fontWeight: '700' },
  fieldGroup: { marginBottom: 16 },
  fieldGroupTight: { marginBottom: 12 },
  input: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#222',
    borderWidth: 1,
    borderColor: '#eee',
    width: '100%',
  },
  passwordWrap: { position: 'relative', width: '100%' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: theme.green, fontSize: 13, fontWeight: '600' },
  submitBtn: {
    backgroundColor: theme.green,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 16,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggleText: { textAlign: 'center', fontSize: 14, color: '#666' },
  toggleLink: { color: theme.green, fontWeight: '700' },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  backText: { color: theme.text, fontSize: 15, fontWeight: '600' },
});

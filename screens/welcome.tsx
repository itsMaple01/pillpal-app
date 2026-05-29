import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLogo from '@/components/AppLogo';
import { APP_NAME, APP_TAGLINE } from '@/lib/branding';
import { theme } from '@/lib/theme';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function WelcomeScreen({ onGetStarted, onLogin }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.top, { paddingTop: insets.top + 32 }]}>
        <AppLogo size={88} />
        <Text style={styles.brand}>{APP_NAME}</Text>
        <Text style={styles.tagline}>{APP_TAGLINE}</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.headline}>
          Stay on track with reminders that keep you and your family connected.
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onLogin} style={styles.loginRow}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to our Terms and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  top: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  brand: { fontSize: 32, fontWeight: '800', color: theme.greenDark, marginTop: 16 },
  tagline: { fontSize: 15, color: theme.textSecondary, marginTop: 6 },
  bottom: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 16,
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: theme.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  loginRow: { alignItems: 'center', paddingVertical: 4 },
  loginText: { color: theme.textSecondary, fontSize: 15 },
  loginLink: { fontWeight: '800', color: theme.green },
  legal: {
    textAlign: 'center',
    fontSize: 11,
    color: theme.textMuted,
    lineHeight: 16,
    marginTop: 4,
  },
});

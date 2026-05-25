import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppIcon from '@/components/AppIcon';
import { APP_NAME } from '@/lib/branding';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
}

const GREEN = '#2d7a3a';
const GREEN_DARK = '#1e5c28';

export default function WelcomeScreen({ onGetStarted, onLogin }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get('window');
  const heroHeight = Math.min(height * 0.52, 420);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />
      <View style={[styles.hero, { height: heroHeight }]}>
        <ImageBackground
          source={require('@/assets/welcome-hero.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
        </ImageBackground>
        <View style={[styles.heroContent, { paddingTop: insets.top + 16 }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <AppIcon name="medical" size={28} color="#fff" />
            </View>
            <Text style={styles.brand}>{APP_NAME}</Text>
          </View>
        </View>
      </View>

      <View style={styles.lower}>
        <Text style={styles.headline}>
          Join families already taking control of their medications
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>GET STARTED</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onLogin} style={styles.loginRow}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log In</Text>
          </Text>
        </TouchableOpacity>

        <Text style={[styles.legal, { paddingBottom: insets.bottom + 12 }]}>
          By continuing, you agree to our Terms and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_DARK },
  hero: { width: '100%', overflow: 'hidden' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30,92,40,0.78)',
  },
  heroContent: { flex: 1, paddingHorizontal: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 26, fontWeight: '800', color: '#fff' },
  lower: {
    flex: 1,
    backgroundColor: GREEN,
    paddingHorizontal: 28,
    paddingTop: 28,
    justifyContent: 'flex-start',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loginRow: { alignItems: 'center', marginBottom: 24 },
  loginText: { color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  loginLink: { fontWeight: '800', color: '#fff' },
  legal: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 16,
  },
});

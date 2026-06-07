import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';
import { resolveUserRole } from '@/lib/resolveUserRole';
import { getCareMode, setCareMode } from '@/lib/careMode';
import WelcomeScreen from './screens/welcome';
import LoginScreen from './screens/login';
import RoleSelectScreen from './screens/role-select';
import PatientDashboard from './screens/patient-dashboard';
import FamilyDashboard from './screens/family-dashboard';
import CaretakerDashboard from './screens/caretaker-dashboard';
import OfflineBanner from './components/OfflineBanner';
import { setupNotifications } from './lib/pushNotifications';
import AppLogo from './components/AppLogo';
import { theme } from './lib/theme';

type SignupProfile = { full_name: string; age: number; health_condition: string | null };

type Screen =
  | 'loading'
  | 'welcome'
  | 'login'
  | 'roleSelect'
  | 'patientDash'
  | 'familyDash'
  | 'caretakerDash';
type LoginTab = 'login' | 'signup';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function routeAuthenticatedUser(
  userId: string,
  userEmail: string | null,
  setRole: (r: 'patient' | 'caretaker') => void,
  setScreen: (s: Screen) => void,
) {
  const cachedRole = await AsyncStorage.getItem(`role_${userId}`);
  if (cachedRole === 'patient') {
    setRole('patient');
    setScreen('patientDash');
    return;
  }
  if (cachedRole === 'caretaker') {
    setRole('caretaker');
    const mode = await getCareMode(userId);
    setScreen(mode === 'professional' ? 'caretakerDash' : 'familyDash');
    return;
  }

  const dbRole = await withTimeout(resolveUserRole(userId, userEmail), 12000);
  if (dbRole === 'patient' || dbRole === 'caretaker') {
    setRole(dbRole);
    await AsyncStorage.setItem(`role_${userId}`, dbRole);
    if (dbRole === 'patient') {
      setScreen('patientDash');
    } else {
      await setCareMode(userId, 'family');
      setScreen('familyDash');
    }
    return;
  }
  setScreen('roleSelect');
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<'patient' | 'caretaker' | null>(null);
  const [signupProfile, setSignupProfile] = useState<SignupProfile | null>(null);
  const [loginTab, setLoginTab] = useState<LoginTab>('login');

  useEffect(() => {
    try {
      setupNotifications().catch((error) => {
        console.error('Error setting up notifications:', error);
      });
    } catch (error) {
      console.error('Error in notification setup effect:', error);
    }
  }, []);

  useEffect(() => {
    try {
      if (!auth) {
        console.warn('Firebase auth not initialized, showing welcome screen');
        setScreen('welcome');
        return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        try {
          if (user) {
            setUid(user.uid);
            setEmail(user.email);
            try {
              await routeAuthenticatedUser(user.uid, user.email, setRole, setScreen);
            } catch (error) {
              console.error('Error routing authenticated user:', error);
              setScreen('roleSelect');
            }
          } else {
            setScreen('welcome');
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          setScreen('welcome');
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
      setScreen('welcome');
    }
  }, []);

  const handleAuthSuccess = async (
    userId: string,
    userEmail: string,
    isNewUser: boolean,
    profile?: SignupProfile | null,
  ) => {
    setUid(userId);
    setEmail(userEmail);
    setSignupProfile(isNewUser && profile ? profile : null);

    if (!isNewUser) {
      setSignupProfile(null);
      try {
        await routeAuthenticatedUser(userId, userEmail, setRole, setScreen);
        return;
      } catch {}
    }

    setScreen('roleSelect');
  };

  const handleRoleSelected = async (selectedRole: 'patient' | 'caretaker') => {
    setRole(selectedRole);
    setSignupProfile(null);
    if (uid) {
      await AsyncStorage.setItem(`role_${uid}`, selectedRole);
      if (selectedRole === 'caretaker') {
        await setCareMode(uid, 'family');
        setScreen('familyDash');
        return;
      }
    }
    setScreen(selectedRole === 'patient' ? 'patientDash' : 'familyDash');
  };

  const switchToCaregiver = async () => {
    if (uid) {
      await setCareMode(uid, 'professional');
      setScreen('caretakerDash');
    }
  };

  const switchToFamily = async () => {
    if (uid) {
      await setCareMode(uid, 'family');
      setScreen('familyDash');
    }
  };

  const handleLogout = () => {
    /* dashboards show their own confirmation modal */
  };

  const performLogout = async () => {
    if (uid) {
      await AsyncStorage.removeItem(`role_${uid}`);
    }
    if (auth) {
      await signOut(auth);
    }
    setRole(null);
    setUid(null);
    setEmail(null);
    setSignupProfile(null);
    setScreen('welcome');
  };

  return (
    <SafeAreaProvider>
      {screen !== 'loading' && screen !== 'welcome' && screen !== 'login' && <OfflineBanner />}
      {screen === 'loading' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <AppLogo size={72} />
          <ActivityIndicator size="large" color={theme.green} style={{ marginTop: 24 }} />
          <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 14 }}>Loading GabayRa…</Text>
        </View>
      )}
      {screen === 'welcome' && (
        <WelcomeScreen
          onGetStarted={() => {
            setLoginTab('signup');
            setScreen('login');
          }}
          onLogin={() => {
            setLoginTab('login');
            setScreen('login');
          }}
        />
      )}
      {screen === 'login' && (
        <LoginScreen
          key={loginTab}
          initialTab={loginTab}
          onBack={() => setScreen('welcome')}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
      {screen === 'roleSelect' && (
        <RoleSelectScreen
          uid={uid!}
          email={email!}
          signupProfile={signupProfile}
          onRoleSelected={handleRoleSelected}
          onBack={() => {
            setUid(null);
            setEmail(null);
            setSignupProfile(null);
            setScreen('welcome');
          }}
        />
      )}
      {screen === 'patientDash' && (
        <PatientDashboard onLogout={performLogout} uid={uid!} email={email!} />
      )}
      {screen === 'familyDash' && (
        <FamilyDashboard
          uid={uid!}
          onLogout={performLogout}
          onSwitchToCaregiver={switchToCaregiver}
        />
      )}
      {screen === 'caretakerDash' && (
        <CaretakerDashboard
          onLogout={performLogout}
          uid={uid!}
          onSwitchToFamily={switchToFamily}
        />
      )}
    </SafeAreaProvider>
  );
}

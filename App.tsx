import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
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
import LogoutModal from './components/LogoutModal';
import OfflineBanner from './components/OfflineBanner';
import { setupNotifications } from './lib/pushNotifications';

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

  const dbRole = await resolveUserRole(userId, userEmail);
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [signupProfile, setSignupProfile] = useState<SignupProfile | null>(null);
  const [loginTab, setLoginTab] = useState<LoginTab>('login');

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        setEmail(user.email);
        try {
          await routeAuthenticatedUser(user.uid, user.email, setRole, setScreen);
        } catch {
          setScreen('roleSelect');
        }
      } else {
        setScreen('welcome');
      }
    });
    return unsubscribe;
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
    setShowLogoutModal(true);
  };

  const performLogout = async () => {
    setShowLogoutModal(false);
    if (uid) {
      await AsyncStorage.removeItem(`role_${uid}`);
    }
    await signOut(auth);
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2d7a3a' }}>
          <ActivityIndicator size="large" color="#fff" />
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
        <PatientDashboard onLogout={handleLogout} uid={uid!} email={email!} />
      )}
      {screen === 'familyDash' && (
        <FamilyDashboard
          uid={uid!}
          onLogout={handleLogout}
          onSwitchToCaregiver={switchToCaregiver}
        />
      )}
      {screen === 'caretakerDash' && (
        <CaretakerDashboard
          onLogout={handleLogout}
          uid={uid!}
          onSwitchToFamily={switchToFamily}
        />
      )}

      <LogoutModal
        visible={showLogoutModal}
        onConfirm={performLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </SafeAreaProvider>
  );
}

import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';
import { getUser } from '@/api/index';
import LoginScreen from './screens/login';
import RoleSelectScreen from './screens/role-select';
import PatientDashboard from './screens/patient-dashboard';
import CaretakerDashboard from './screens/caretaker-dashboard';

type Screen = 'loading' | 'login' | 'roleSelect' | 'patientDash' | 'caretakerDash';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<'patient' | 'caretaker' | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        setEmail(user.email);
        try {
          const cachedRole = await AsyncStorage.getItem(`role_${user.uid}`);
          if (cachedRole === 'patient' || cachedRole === 'caretaker') {
            setRole(cachedRole);
            setScreen(cachedRole === 'patient' ? 'patientDash' : 'caretakerDash');
            return;
          }
          const res = await getUser(user.uid);
          const dbRole = res.data?.role;
          if (dbRole === 'patient' || dbRole === 'caretaker') {
            setRole(dbRole);
            await AsyncStorage.setItem(`role_${user.uid}`, dbRole);
            setScreen(dbRole === 'patient' ? 'patientDash' : 'caretakerDash');
            return;
          }
          setScreen('roleSelect');
        } catch {
          setScreen('roleSelect');
        }
      } else {
        setScreen('login');
      }
    });
    return unsubscribe;
  }, []);

  const handleAuthSuccess = async (userId: string, userEmail: string, isNewUser: boolean) => {
    setUid(userId);
    setEmail(userEmail);

    if (!isNewUser) {
      try {
        const cachedRole = await AsyncStorage.getItem(`role_${userId}`);
        if (cachedRole === 'patient' || cachedRole === 'caretaker') {
          setRole(cachedRole);
          setScreen(cachedRole === 'patient' ? 'patientDash' : 'caretakerDash');
          return;
        }
        const res = await getUser(userId);
        const dbRole = res.data?.role;
        if (dbRole === 'patient' || dbRole === 'caretaker') {
          setRole(dbRole);
          await AsyncStorage.setItem(`role_${userId}`, dbRole);
          setScreen(dbRole === 'patient' ? 'patientDash' : 'caretakerDash');
          return;
        }
      } catch {}
    }

    setScreen('roleSelect');
  };

  const handleRoleSelected = async (selectedRole: 'patient' | 'caretaker') => {
    setRole(selectedRole);
    if (uid) {
      await AsyncStorage.setItem(`role_${uid}`, selectedRole);
    }
    setScreen(selectedRole === 'patient' ? 'patientDash' : 'caretakerDash');
  };

  const handleLogout = async () => {
    if (uid) {
      await AsyncStorage.removeItem(`role_${uid}`);
    }
    setRole(null);
    setUid(null);
    setEmail(null);
    setScreen('login');
  };

  return (
    <SafeAreaProvider>
      {screen === 'loading' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2d7a3a' }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      {screen === 'login' && (
        <LoginScreen onAuthSuccess={handleAuthSuccess} />
      )}
      {screen === 'roleSelect' && (
        <RoleSelectScreen
          uid={uid!}
          email={email!}
          onRoleSelected={handleRoleSelected}
          onBack={() => {
            setUid(null);
            setEmail(null);
            setScreen('login');
          }}
        />
      )}
      {screen === 'patientDash' && (
        <PatientDashboard onLogout={handleLogout} uid={uid!} />
      )}
      {screen === 'caretakerDash' && (
        <CaretakerDashboard onLogout={handleLogout} uid={uid!} />
      )}
    </SafeAreaProvider>
  );
}
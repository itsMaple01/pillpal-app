import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        setEmail(user.email);
        if (role) {
          setScreen(role === 'patient' ? 'patientDash' : 'caretakerDash');
        } else {
          setScreen('roleSelect');
        }
      } else {
        setScreen('login');
      }
    });
    return unsubscribe;
  }, [role]);

  const handleAuthSuccess = (userId: string, userEmail: string, isNewUser: boolean) => {
    setUid(userId);
    setEmail(userEmail);
    setScreen('roleSelect');
  };

  const handleRoleSelected = (selectedRole: 'patient' | 'caretaker') => {
    setRole(selectedRole);
    setScreen(selectedRole === 'patient' ? 'patientDash' : 'caretakerDash');
  };

  const handleLogout = () => {
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
        <PatientDashboard onLogout={handleLogout} />
      )}
      {screen === 'caretakerDash' && (
        <CaretakerDashboard onLogout={handleLogout} />
      )}
    </SafeAreaProvider>
  );
}
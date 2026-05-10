import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
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
  const [role, setRole] = useState<'patient' | 'caretaker' | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
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

  const handleAuthSuccess = (userId: string, isNewUser: boolean) => {
    setUid(userId);
    setScreen('roleSelect');
  };

  const handleRoleSelected = (selectedRole: 'patient' | 'caretaker') => {
    setRole(selectedRole);
    setScreen(selectedRole === 'patient' ? 'patientDash' : 'caretakerDash');
  };

  const handleLogout = () => {
    setRole(null);
    setUid(null);
    setScreen('login');
  };

  if (screen === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2d7a3a' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (screen === 'login') return <LoginScreen onAuthSuccess={handleAuthSuccess} />;
  if (screen === 'roleSelect') return <RoleSelectScreen uid={uid!} onRoleSelected={handleRoleSelected} onBack={() => setScreen('login')} />;
  if (screen === 'patientDash') return <PatientDashboard onLogout={handleLogout} />;
  if (screen === 'caretakerDash') return <CaretakerDashboard onLogout={handleLogout} />;

  return null;
}
import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCJta1P20wddbRkUZA66j8Q2LLxeWAt-Pk",
  authDomain: "pillpal-app-e68de.firebaseapp.com",
  projectId: "pillpal-app-e68de",
  storageBucket: "pillpal-app-e68de.firebasestorage.app",
  messagingSenderId: "744880894649",
  appId: "1:744880894649:web:0d7e67e8c663194cb62168"
};

let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;

try {
  app = initializeApp(firebaseConfig);
  
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // @ts-ignore
    const { getReactNativePersistence } = require('firebase/auth');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export const db = getFirestore(app);
export { auth };
export default app;
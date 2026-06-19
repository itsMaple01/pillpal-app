import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCJta1P20wddbRkUZA66j8Q2LLxeWAt-Pk",
  authDomain: "pillpal-app-e68de.firebaseapp.com",
  projectId: "pillpal-app-e68de",
  storageBucket: "pillpal-app-e68de.firebasestorage.app",
  messagingSenderId: "744880894649",
  appId: "1:744880894649:web:0d7e67e8c663194cb62168"
};

let app: FirebaseApp;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);

  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      // @ts-ignore
      const { getReactNativePersistence } = require('firebase/auth');
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (persistenceError) {
      console.warn('Firebase Auth persistence failed, using default auth:', persistenceError);
      auth = getAuth(app);
    }
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

/** Firestore instance — initialized at module load with the Firebase app. */
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export { auth };
export default app;

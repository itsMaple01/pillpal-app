import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCJta1P20wddbRkUZA66j8Q2LLxeWAt-Pk",
  authDomain: "pillpal-app-e68de.firebaseapp.com",
  projectId: "pillpal-app-e68de",
  storageBucket: "pillpal-app-e68de.firebasestorage.app",
  messagingSenderId: "744880894649",
  appId: "1:744880894649:web:0d7e67e8c663194cb62168"
};

const app = initializeApp(firebaseConfig);

// @ts-ignore
const { getReactNativePersistence } = require('firebase/auth');

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export default app;
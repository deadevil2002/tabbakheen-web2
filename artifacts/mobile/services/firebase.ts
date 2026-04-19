import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'tabbakheen-99883.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'tabbakheen-99883',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'tabbakheen-99883.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length > 0) {
      app = getApp();
      console.log('[Firebase] Using existing app instance');
    } else {
      app = initializeApp(firebaseConfig);
      console.log('[Firebase] Initialized new app instance for project:', firebaseConfig.projectId);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    console.log('[Firebase] Auth initialized');
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    console.log('[Firebase] Firestore initialized');
  }
  return db;
}

export function isFirebaseConfigured(): boolean {
  const hasApiKey = !!firebaseConfig.apiKey;
  const hasAppId = !!firebaseConfig.appId;
  const hasProjectId = !!firebaseConfig.projectId;

  if (!hasApiKey || !hasAppId) {
    console.log('[Firebase] Missing configuration. Set EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_APP_ID env vars.');
    return false;
  }

  console.log('[Firebase] Configuration valid for project:', hasProjectId ? firebaseConfig.projectId : 'unknown');
  return true;
}

export { firebaseConfig };

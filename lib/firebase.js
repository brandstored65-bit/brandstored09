
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// Add compat imports for RecaptchaVerifier support
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';


console.log('ENV FIREBASE:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};


console.log('FIREBASE CONFIG:', firebaseConfig);
const missingVars = Object.entries(firebaseConfig).filter(([k, v]) => !v).map(([k]) => k);
if (missingVars.length) {
  console.error('Missing Firebase env variables:', missingVars);
}

let app, auth, analytics;
app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
auth = getAuth(app);
if (typeof window !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.firebase = firebase;
}
try {
  analytics = typeof window !== 'undefined' ? require('firebase/analytics').getAnalytics(app) : undefined;
} catch (e) {
  analytics = undefined;
}

const googleProvider = new GoogleAuthProvider();
export { auth, googleProvider, analytics };

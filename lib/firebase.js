
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// Add compat imports for RecaptchaVerifier support
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD-SZQP7VFhXNCA1nH6A9RdKcvPLDyUWqY",
  authDomain: "quickfynd.firebaseapp.com",
  projectId: "quickfynd",
  storageBucket: "quickfynd.appspot.com",
  messagingSenderId: "861878384152",
  appId: "1:861878384152:web:77f8a284f5e0493895756d",
  measurementId: "G-03M3YYEZFE"
};


console.log('FIREBASE CONFIG:', firebaseConfig);
const missingVars = Object.entries(firebaseConfig).filter(([k, v]) => !v).map(([k]) => k);
if (missingVars.length) {
  console.error('Missing Firebase env variables:', missingVars);
}

let app, auth;
if (!missingVars.length) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Initialize compat app and attach to window for RecaptchaVerifier
  if (typeof window !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.firebase = firebase;
  }
} else {
  app = undefined;
  auth = undefined;
}
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  UserCredential
} from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDatabase: Database;
let firebaseStorage: FirebaseStorage;

if (!getApps().length) {
  try {
    console.log('Initializing Firebase with config:', {
      ...firebaseConfig,
      apiKey: '***' // Hide API key in logs
    });
    
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDatabase = getDatabase(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error; // Re-throw to handle initialization failures
  }
} else {
  firebaseApp = getApps()[0];
  firebaseAuth = getAuth(firebaseApp);
  firebaseDatabase = getDatabase(firebaseApp);
  firebaseStorage = getStorage(firebaseApp);
}

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const app = firebaseApp;
export const auth = firebaseAuth;
export const database = firebaseDatabase;
export const storage = firebaseStorage;
export { googleProvider }; 
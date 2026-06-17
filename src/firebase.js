import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyB0Z8wBJYzELPsk1u0KkIuEA7y1iIvattU',
  authDomain: 'ledgertrace-cc035.firebaseapp.com',
  projectId: 'ledgertrace-cc035',
  storageBucket: 'ledgertrace-cc035.firebasestorage.app',
  messagingSenderId: '642248950384',
  appId: '1:642248950384:web:2e7f3ab340f2d25fc86ab5',
  measurementId: 'G-PPSH9MED9D',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCRf_IlW8ryvFHD3cA7jcfWHjm-Uxt3Tg",
  authDomain: "cc-team-leader---agent-db.firebaseapp.com",
  projectId: "cc-team-leader---agent-db",
  storageBucket: "cc-team-leader---agent-db.firebasestorage.app",
  messagingSenderId: "672512704857",
  appId: "1:672512704857:web:977137dae7eede7b490c48",
  measurementId: "G-VZYDL73W1G"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

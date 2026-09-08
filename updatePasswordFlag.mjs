import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.filter(d => d.data().role === 'agent');
  console.log("Updating " + users.length + " agents...");
  for (const u of users) {
    await updateDoc(doc(db, 'users', u.id), { mustChangePassword: true });
  }
  console.log("Done!");
  process.exit(0);
}
run();

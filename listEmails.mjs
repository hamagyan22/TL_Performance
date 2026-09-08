import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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
  const users = snap.docs.map(d => d.data());
  const agents = users.filter(u => u.role === 'agent');
  console.log("Found " + agents.length + " agents:");
  agents.forEach(a => {
    console.log(a.agent_name + "|" + a.email + "|Password123");
  });
  process.exit(0);
}
run();

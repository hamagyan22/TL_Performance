import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log("Fetching team members...");
  const snap = await getDocs(collection(db, 'team_members'));
  const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`Found ${members.length} members. Creating accounts...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const member of members) {
    const cleanName = member.agent_name.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const email = `${cleanName}@agent.com`;
    const password = 'Password123';
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        role: 'agent',
        agent_name: member.agent_name,
        team: member.team,
        email: email
      });
      
      console.log(`Created: ${email}`);
      successCount++;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        console.log(`Skipped (already exists): ${email}`);
      } else {
        console.error(`Error creating ${email}:`, err.message);
        errorCount++;
      }
    }
  }
  
  console.log(`\nFinished! Successfully created: ${successCount}. Errors: ${errorCount}.`);
  process.exit(0);
}

run();

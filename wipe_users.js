/**
 * NUCLEAR OPTION: This script wipes all user documents from Firestore.
 * Run this with: node wipe_users.js
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

async function wipe() {
  // Use the ID from your environment
  const appId = "default-app-id"; 
  
  // !!! PASTE YOUR FIREBASE CONFIG HERE !!!
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
      console.log("❌ Error: You must paste your real Firebase Config into the script before running.");
      return;
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("⚠️ Starting Nuclear Wipe of the 'users' collection...");

  try {
    const usersPath = `artifacts/${appId}/users`;
    const usersCol = collection(db, usersPath);
    const snapshot = await getDocs(usersCol);

    const deletes = snapshot.docs.map(d => {
      console.log(`Deleting user: ${d.id}`);
      return deleteDoc(doc(db, usersPath, d.id));
    });

    await Promise.all(deletes);
    console.log(`✅ Success! ${deletes.length} users removed.`);
  } catch (err) {
    console.error("❌ Failed to wipe users:", err);
  }
}

wipe();

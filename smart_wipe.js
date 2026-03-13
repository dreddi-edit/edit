const fs = require('fs');
const { execSync } = require('child_process');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

async function run() {
    console.log("🔍 Searching your project for Firebase credentials...");
    let config;
    try {
        // Try to find the line containing the apiKey in your source code
        const search = execSync('grep -r "apiKey" dashboard/src --include="*.tsx" --include="*.ts" | grep "{" | head -n 1').toString();
        const match = search.match(/\{[\s\S]*?\}/);
        if (match) {
            // Extract and parse the config object
            const rawConfig = match[0].replace(/([a-zA-Z0-9]+):/g, '"$1":').replace(/'/g, '"').replace(/,[\s\n]*\}/, '}');
            config = JSON.parse(rawConfig);
        }
    } catch (e) {
        console.log("⚠️ Auto-search failed. Checking alternative paths...");
    }

    if (!config || !config.apiKey) {
        console.log("❌ Error: Could not find your Firebase config in dashboard/src.");
        console.log("Please run this command to fix your password instead: ");
        console.log("sed -i '' 's/(?=.*[A-Z])//g' dashboard/src/components/ResetPasswordScreen.tsx");
        return;
    }

    console.log("✅ Config found! Connecting to Firebase...");
    try {
        const app = initializeApp(config);
        const db = getFirestore(app);
        const appId = "default-app-id"; 
        const usersPath = `artifacts/${appId}/users`;
        
        const snapshot = await getDocs(collection(db, usersPath));
        console.log(`🗑️ Found ${snapshot.size} users. Deleting...`);
        
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
        console.log("✨ SUCCESS: Every user has been deleted. You can now register fresh.");
    } catch (err) {
        console.error("❌ Firebase Error:", err.message);
    }
}
run();

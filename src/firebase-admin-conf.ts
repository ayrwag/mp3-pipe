// Import the firebase-admin module
import admin from 'firebase-admin';

process.env['GCLOUD_PROJECT'] = "demo-pipe";
process.env['GOOGLE_APPLICATION_CREDENTIALS'] = "youbox-396214-f61dab858186.json";
process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] = 'localhost:9099'; // add this line
process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = 'localhost:9199'; // add this line

const useEmulators = true
const emulatorConfig = {
  projectId:"demo-pipe",
  storageBucket:"demo-pipe.appspot.com"
}

// Initialize Firebase Admin SDK with your service account credentials
if(!admin.apps.length)
admin.initializeApp(useEmulators?emulatorConfig:{
  storageBucket: 'youbox-396214.appspot.com', // Replace with your Storage bucket URL
});

// Get a reference to the Firebase Storage bucket
const bucket = admin.storage().bucket();
export const db = admin.firestore();

export default bucket;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
// Import the firebase-admin module
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// process.env['GCLOUD_PROJECT'] = "demo-pipe";
// process.env['GOOGLE_APPLICATION_CREDENTIALS'] = "application_credentials.json";
// process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
// process.env['FIREBASE_AUTH_EMULATOR_HOST'] = 'localhost:9099'; // add this line
// process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = 'localhost:9199'; // add this line
const useEmulators = false;
const emulatorConfig = {
    projectId: "demo-pipe",
    storageBucket: "demo-pipe.appspot.com"
};
// Initialize Firebase Admin SDK with your service account credentials
if (!firebase_admin_1.default.apps.length)
    firebase_admin_1.default.initializeApp(useEmulators ? emulatorConfig : {
        storageBucket: 'your-production-app.appspot.com', // Replace with your Storage bucket URL
    });
// Get a reference to the Firebase Storage bucket
const bucket = firebase_admin_1.default.storage().bucket();
exports.db = firebase_admin_1.default.firestore();
exports.default = bucket;

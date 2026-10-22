// Copy this file to config.js (not tracked by Git) and fill in your own values.

// Google tag. GTM-… embeds Google Tag Manager, G-… embeds Google Analytics (gtag.js).
// Leave it empty to embed nothing.
const GTM_ID = 'G-XXXXXXXXXX';

// Firebase (Google sign-in and saving records to Firestore).
// Set all four to enable sign-in; leave all four empty to play without it.
const FIREBASE_API_KEY = '';
const FIREBASE_AUTH_DOMAIN = '';
const FIREBASE_PROJECT_ID = '';
const FIREBASE_APP_ID = '';

// 意味かるた たいせん (Firebase Realtime Database). Needs the four values above as well.
// Leave it empty and there is no たいせん button. To set it up:
//   1. Firebase console → Realtime Database: create a database, and put its URL here
//      (https://….firebasedatabase.app)
//   2. Realtime Database → Rules: set the rules in database.rules.json. A database has only one
//      set of rules: when Wordlynx (battles) or math-quiz (mathBattles) use the same database,
//      put their entries and kanjiBattles side by side in one "rules" object.
//   3. Authentication → Sign-in method: enable Anonymous (players need no Google account)
const FIREBASE_DATABASE_URL = '';

// Development only: use the Firebase emulators on this computer
// (npx firebase-tools emulators:start --only auth,database --project demo-kanji-quiz)
// const FIREBASE_EMULATOR = true;

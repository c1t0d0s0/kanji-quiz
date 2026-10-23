// The Firebase settings, put in by vite.config.ts when the site is built (from the environment
// or config.js). null when they are not set: then there is no sign-in and no 対戦, and the
// Firebase code is never loaded.
export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    // Only for the 意味かるた たいせん (Realtime Database)
    databaseURL?: string;
}

declare const __FIREBASE_CONFIG__: FirebaseConfig | null;
declare const __FIREBASE_EMULATOR__: boolean;

export const firebaseConfig: FirebaseConfig | null = typeof __FIREBASE_CONFIG__ !== 'undefined' ? __FIREBASE_CONFIG__ : null;
// Development only: talk to the Firebase emulators on this computer
export const useEmulator: boolean = typeof __FIREBASE_EMULATOR__ !== 'undefined' && __FIREBASE_EMULATOR__;

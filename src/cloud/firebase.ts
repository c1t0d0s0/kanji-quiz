// The Firebase app and the sign-in, loaded the first time they are needed (the sync after the
// first paint, or the 対戦), so nothing is slowed down for players who never sign in.
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { firebaseConfig, useEmulator } from './config';

export interface FirebaseSdk {
    app: FirebaseApp;
    auth: Auth;
    authSdk: typeof import('firebase/auth');
    emulator: boolean;
}

let sdk: Promise<FirebaseSdk> | null = null;

// Shared by the Google sign-in (cloud/index.ts) and the 対戦 (battle-net.ts)
export function loadFirebase(): Promise<FirebaseSdk> {
    if (!firebaseConfig) return Promise.reject(new Error('Firebase is not configured'));
    const config = firebaseConfig;
    if (!sdk) {
        sdk = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appSdk, authSdk]) => {
            const app = appSdk.initializeApp(config);
            const auth = authSdk.getAuth(app);
            if (useEmulator) authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
            return { app, auth, authSdk, emulator: useEmulator };
        });
        sdk.catch(() => {
            sdk = null;
        });
    }
    return sdk;
}

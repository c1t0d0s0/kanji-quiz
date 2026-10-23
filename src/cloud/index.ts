// --- Google sign-in and Firestore sync ---
// Enabled only when the build has the four FIREBASE_* values. The Firebase SDK is loaded after
// the first paint (startCloud), so nothing is slowed down for guests.
import { reactive } from 'vue';
import * as Records from '../core/records';
import { Sync, type AuthPort, type Remote, type SyncStatus } from '../core/sync';
import { firebaseConfig } from './config';
import { loadFirebase } from './firebase';

const APP_ID = 'kanji-quiz';

export const cloudAvailable = firebaseConfig !== null;
export const battleAvailable = cloudAvailable && Boolean(firebaseConfig?.databaseURL);

// What the account box shows
export const cloudState = reactive<{ uid: string | null; status: SyncStatus }>({ uid: null, status: 'loading' });

let sync: Sync | null = null;

// Call before the first render: shows the copy of whoever was signed in last.
export function restoreRecords() {
    if (cloudAvailable) Records.use(Records.rememberedUid());
}

async function firestorePorts(): Promise<{ remote: Remote; auth: AuthPort }> {
    const [{ app, auth, authSdk, emulator }, db] = await Promise.all([loadFirebase(), import('firebase/firestore/lite')]);
    const firestore = db.getFirestore(app);
    if (emulator) db.connectFirestoreEmulator(firestore, '127.0.0.1', 8080);

    const userRef = (uid: string) => db.doc(firestore, 'users', uid);
    const appRef = (uid: string) => db.doc(firestore, 'users', uid, 'apps', APP_ID);
    const progressCol = (uid: string) => db.collection(firestore, 'users', uid, 'apps', APP_ID, 'progress');
    const progressRef = (uid: string, id: string) => db.doc(firestore, 'users', uid, 'apps', APP_ID, 'progress', id);

    async function loadSummary(uid: string) {
        const snap = await db.getDoc(appRef(uid));
        return snap.exists() ? Records.fromAppDoc(snap.data()) : null;
    }

    return {
        remote: {
            loadSummary,
            async loadAll(uid) {
                const [summary, docs] = await Promise.all([loadSummary(uid), db.getDocs(progressCol(uid))]);
                if (!summary && docs.empty) return null;
                const snapshot = summary || Records.empty();
                docs.forEach(d => {
                    const p = Records.fromProgressDoc(d.data());
                    if (p) snapshot.progress[d.id] = p;
                });
                return snapshot;
            },
            async loadProgress(uid, id) {
                const snap = await db.getDoc(progressRef(uid, id));
                return snap.exists() ? Records.fromProgressDoc(snap.data()) : null;
            },
            async saveSummary(uid, snapshot) {
                const now = Date.now();
                // Shared by all apps. No name, e-mail address or photo is stored.
                const user = await db.getDoc(userRef(uid));
                await db.setDoc(userRef(uid), { schema: Records.SCHEMA, updatedAt: now, ...(user.exists() ? {} : { createdAt: now }) }, { merge: true });
                await db.setDoc(appRef(uid), Records.toAppDoc(snapshot, now));
            },
            async saveProgress(uid, id, progress) {
                await db.setDoc(progressRef(uid, id), Records.toProgressDoc(progress));
            }
        },
        auth: {
            onUser(cb) {
                // The anonymous sign-in for a 対戦 counts as signed out: records go to
                // Firestore only for a Google account
                authSdk.onAuthStateChanged(auth, user => cb(user && !user.isAnonymous ? user.uid : null));
            },
            signIn: () => authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider()),
            signOut: () => authSdk.signOut(auth)
        }
    };
}

export interface CloudHooks {
    // The local records were replaced by the sync (redraw the screen)
    onData(): void;
    askMigrate(): boolean | Promise<boolean>;
}

// Call after the first render.
export async function startCloud(hooks: CloudHooks) {
    if (!cloudAvailable) return;
    let ports: { remote: Remote; auth: AuthPort };
    try {
        ports = await firestorePorts();
    } catch (e) {
        console.error('Firebase could not be loaded', e);
        cloudState.status = 'unavailable';
        return;
    }
    const s = new Sync(ports.remote, ports.auth, {
        onStatus() {
            cloudState.status = s.status;
            cloudState.uid = s.uid;
        },
        onData: hooks.onData,
        askMigrate: hooks.askMigrate
    });
    sync = s;
    s.start();
    // Send pending changes before the page is hidden or closed
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void s.flush();
    });
    window.addEventListener('online', () => void s.flush());
}

export async function signIn() {
    if (sync) await sync.signIn();
}

export async function signOut(force = false): Promise<'ok' | 'unsynced'> {
    return sync ? sync.signOut(force) : 'ok';
}

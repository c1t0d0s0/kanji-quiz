// --- Google sign-in and Firestore sync ---
// Enabled only when config.js has the four FIREBASE_* values. The Firebase SDK
// is loaded after the first paint, so nothing is slowed down for guests.
const Cloud = (() => {
    const FIREBASE_VERSION = '13.0.0';
    const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
    const APP_ID = 'kanji-quiz';
    const DEBOUNCE_MS = 2000;
    const RETRY_MS = 15000;

    function readConfig() {
        const value = v => (typeof v === 'string' ? v.trim() : '');
        const config = {
            apiKey: value(typeof FIREBASE_API_KEY !== 'undefined' && FIREBASE_API_KEY),
            authDomain: value(typeof FIREBASE_AUTH_DOMAIN !== 'undefined' && FIREBASE_AUTH_DOMAIN),
            projectId: value(typeof FIREBASE_PROJECT_ID !== 'undefined' && FIREBASE_PROJECT_ID),
            appId: value(typeof FIREBASE_APP_ID !== 'undefined' && FIREBASE_APP_ID)
        };
        const filled = Object.values(config).filter(Boolean).length;
        if (filled > 0 && filled < 4) {
            console.error('config.js: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID and FIREBASE_APP_ID are all required');
        }
        return filled === 4 ? config : null;
    }

    const config = readConfig();
    const available = config !== null;

    // loading: checking whether someone is signed in
    // signed-out: not signed in (records stay on this device)
    // syncing / synced: sending to, or in step with, Firestore
    // offline: some changes are not sent yet (retried later)
    // unavailable: the Firebase SDK could not be loaded
    const state = { uid: null, status: 'loading' };

    let hooks = { onStatus() {}, onData() {}, askMigrate: () => false };
    let remote = null;
    let auth = null;
    let dirtySummary = false;
    const dirtyProgress = new Set();
    let needsFull = false;
    let migrate = false;
    let interactive = false;
    let timer = null;
    let chain = Promise.resolve();

    // Call before the first render: shows the copy of whoever was signed in last.
    function restore() {
        if (available) Records.use(Records.rememberedUid());
    }

    async function loadFirebase() {
        const [appSdk, authSdk, db] = await Promise.all([
            import(`${FIREBASE_CDN}firebase-app.js`),
            import(`${FIREBASE_CDN}firebase-auth.js`),
            import(`${FIREBASE_CDN}firebase-firestore-lite.js`)
        ]);
        const app = appSdk.initializeApp(config);
        const firebaseAuth = authSdk.getAuth(app);
        const firestore = db.getFirestore(app);

        const userRef = uid => db.doc(firestore, 'users', uid);
        const appRef = uid => db.doc(firestore, 'users', uid, 'apps', APP_ID);
        const progressCol = uid => db.collection(firestore, 'users', uid, 'apps', APP_ID, 'progress');
        const progressRef = (uid, id) => db.doc(firestore, 'users', uid, 'apps', APP_ID, 'progress', id);

        async function loadSummary(uid) {
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
                    authSdk.onAuthStateChanged(firebaseAuth, user => cb(user ? user.uid : null));
                },
                signIn: () => authSdk.signInWithPopup(firebaseAuth, new authSdk.GoogleAuthProvider()),
                signOut: () => authSdk.signOut(firebaseAuth)
            }
        };
    }

    // Call after the first render.
    async function start(appHooks, ports) {
        if (!available) return;
        hooks = appHooks;
        try {
            ({ remote, auth } = ports || await loadFirebase());
        } catch (e) {
            console.error('Firebase could not be loaded', e);
            setStatus('unavailable');
            return;
        }
        Records.onChange(noteChange);
        auth.onUser(uid => enqueue(() => handleUser(uid)));
        // Send pending changes before the page is hidden or closed
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush();
        });
        window.addEventListener('online', () => flush());
    }

    // Sign-in from the button. Only then is the user asked about moving guest records.
    async function signIn() {
        interactive = true;
        try {
            await auth.signIn();
        } catch (e) {
            interactive = false;
            throw e;
        }
    }

    function hasPending() {
        return state.uid !== null && (dirtySummary || dirtyProgress.size > 0 || needsFull);
    }

    function flush() {
        clearTimeout(timer);
        timer = null;
        return enqueue(push);
    }

    // Signing out removes the user's copy from this device, so unsent changes
    // would be lost: returns 'unsynced' instead unless force is set.
    async function signOut(force) {
        await flush();
        if (hasPending() && !force) return 'unsynced';
        await auth.signOut();
        return 'ok';
    }

    // --- Internals ---

    // Jobs run one at a time, in order.
    function enqueue(job) {
        chain = chain.then(job, job);
        return chain;
    }

    function setStatus(status) {
        if (state.status === status) return;
        state.status = status;
        hooks.onStatus();
    }

    async function handleUser(uid) {
        if (uid === null) {
            // Signed out (or the session expired): drop the copy, back to guest records
            const previous = state.uid || Records.rememberedUid();
            clearTimeout(timer);
            timer = null;
            dirtySummary = false;
            dirtyProgress.clear();
            needsFull = false;
            interactive = false;
            state.uid = null;
            Records.use(null);
            Records.rememberUid(null);
            if (previous) {
                Records.clear(previous);
                hooks.onData();
            }
            setStatus('signed-out');
            return;
        }

        const shown = Records.currentUid();
        Records.use(null);
        const guestHasRecords = Records.hasRecords(Records.load());
        migrate = interactive && guestHasRecords && Boolean(await hooks.askMigrate());
        interactive = false;

        state.uid = uid;
        Records.rememberUid(uid);
        Records.use(uid);
        needsFull = true;
        // Show the copy kept on this device first (empty on a new device)
        if (shown !== uid) hooks.onData();
        await push();
    }

    function noteChange(change) {
        if (state.uid === null) return;
        if (change.startsWith('progress:')) dirtyProgress.add(change.slice('progress:'.length));
        else dirtySummary = true;
        setStatus('syncing');
        schedule(DEBOUNCE_MS);
    }

    function schedule(ms) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            enqueue(push);
        }, ms);
    }

    async function push() {
        const uid = state.uid;
        if (uid === null || !hasPending()) return;
        setStatus('syncing');
        const progressIds = [...dirtyProgress];
        const summary = dirtySummary;
        dirtyProgress.clear();
        dirtySummary = false;
        try {
            if (needsFull) await fullSync(uid);
            else await sendChanges(uid, progressIds, summary);
            if (state.uid !== uid) return; // signed out meanwhile
            setStatus(hasPending() ? 'syncing' : 'synced');
        } catch (e) {
            if (state.uid !== uid) return;
            console.error('Sync failed', e);
            // Remember what could not be sent and try again later
            progressIds.forEach(id => dirtyProgress.add(id));
            dirtySummary = dirtySummary || summary;
            setStatus('offline');
            schedule(RETRY_MS);
        }
    }

    // Merges everything in Firestore with the local copy (once after each sign-in).
    async function fullSync(uid) {
        const theirs = await remote.loadAll(uid);
        if (state.uid !== uid) return;

        const before = Records.load();
        let merged = Records.merge(theirs || Records.empty(), before);
        if (migrate) {
            Records.use(null);
            const guest = Records.load();
            Records.use(uid);
            merged = Records.merge(merged, guest);
        }
        const localChanged = !Records.same(merged, before);
        Records.save(merged, [], true);

        if (!theirs || !Records.sameSummary(merged, theirs)) await remote.saveSummary(uid, merged);
        for (const [id, p] of Object.entries(merged.progress)) {
            if (!theirs || !Records.sameProgress(theirs.progress[id], p)) await remote.saveProgress(uid, id, p);
        }

        // Guest records are removed only after they are safely in Firestore
        if (migrate) {
            Records.clear(null);
            migrate = false;
        }
        needsFull = false;
        if (localChanged && state.uid === uid) hooks.onData();
    }

    // Sends only what changed locally, merged with what another device may have written.
    async function sendChanges(uid, progressIds, summary) {
        const theirs = Records.empty();
        let theirSummary = null;
        for (const id of progressIds) {
            const p = await remote.loadProgress(uid, id);
            if (p) theirs.progress[id] = p;
        }
        if (summary) {
            theirSummary = await remote.loadSummary(uid);
            if (theirSummary) Object.assign(theirs, { activeDays: theirSummary.activeDays, collected: theirSummary.collected, words: theirSummary.words, settings: theirSummary.settings });
        }
        if (state.uid !== uid) return;

        const before = Records.load();
        // Without the remote summary, keep the local one as it is
        if (!summary) Object.assign(theirs, { activeDays: before.activeDays, collected: before.collected, words: before.words, settings: before.settings });
        const merged = Records.merge(theirs, before);
        if (!Records.same(merged, before)) {
            Records.save(merged, [], true);
            hooks.onData();
        }
        for (const id of progressIds) {
            const p = merged.progress[id];
            if (p && !Records.sameProgress(theirs.progress[id], p)) await remote.saveProgress(uid, id, p);
        }
        if (summary && (!theirSummary || !Records.sameSummary(merged, theirSummary))) await remote.saveSummary(uid, merged);
    }

    return { available, state, restore, start, signIn, signOut };
})();

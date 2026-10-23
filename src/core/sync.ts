// --- Keeping the signed-in user's records in step with Firestore ---
// The same steps as before (cloud.js), without Firebase itself: Firestore and the sign-in are
// passed in (Remote / AuthPort), so the tests can use stand-ins.
import * as Records from './records';
import type { Progress, Snapshot } from './records';

export interface Remote {
    loadAll(uid: string): Promise<Snapshot | null>;
    loadSummary(uid: string): Promise<Snapshot | null>;
    loadProgress(uid: string, id: string): Promise<Progress | null>;
    saveSummary(uid: string, snapshot: Snapshot): Promise<void>;
    saveProgress(uid: string, id: string, progress: Progress): Promise<void>;
}

export interface AuthPort {
    // Called with the uid of a Google account, or null (also for the anonymous 対戦 sign-in)
    onUser(cb: (uid: string | null) => void): void;
    signIn(): Promise<unknown>;
    signOut(): Promise<unknown>;
}

// loading: checking whether someone is signed in
// signed-out: not signed in (records stay on this device)
// syncing / synced: sending to, or in step with, Firestore
// offline: some changes are not sent yet (retried later)
// unavailable: the Firebase SDK could not be loaded
export type SyncStatus = 'loading' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'unavailable';

export interface SyncHooks {
    onStatus(): void;
    // The local records were replaced (redraw the screen)
    onData(): void;
    // Moving this device's guest records into the account? Asked only after a sign-in by button
    askMigrate(): boolean | Promise<boolean>;
}

export interface SyncOptions {
    debounceMs?: number;
    retryMs?: number;
}

export class Sync {
    uid: string | null = null;
    status: SyncStatus = 'loading';

    private dirtySummary = false;
    private readonly dirtyProgress = new Set<string>();
    private needsFull = false;
    private migrate = false;
    private interactive = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private chain: Promise<void> = Promise.resolve();
    private readonly debounceMs: number;
    private readonly retryMs: number;

    constructor(
        private readonly remote: Remote,
        private readonly auth: AuthPort,
        private readonly hooks: SyncHooks,
        options: SyncOptions = {}
    ) {
        this.debounceMs = options.debounceMs ?? 2000;
        this.retryMs = options.retryMs ?? 15000;
    }

    start() {
        Records.onChange(change => this.noteChange(change));
        this.auth.onUser(uid => void this.enqueue(() => this.handleUser(uid)));
    }

    // Sign-in from the button. Only then is the user asked about moving guest records.
    async signIn() {
        this.interactive = true;
        try {
            await this.auth.signIn();
        } catch (e) {
            this.interactive = false;
            throw e;
        }
    }

    hasPending(): boolean {
        return this.uid !== null && (this.dirtySummary || this.dirtyProgress.size > 0 || this.needsFull);
    }

    flush(): Promise<void> {
        this.clearTimer();
        return this.enqueue(() => this.push());
    }

    // Signing out removes the user's copy from this device, so unsent changes
    // would be lost: returns 'unsynced' instead unless force is set.
    async signOut(force = false): Promise<'ok' | 'unsynced'> {
        await this.flush();
        if (this.hasPending() && !force) return 'unsynced';
        await this.auth.signOut();
        return 'ok';
    }

    // --- Internals ---

    // Jobs run one at a time, in order.
    private enqueue(job: () => Promise<void>): Promise<void> {
        this.chain = this.chain.then(job, job);
        return this.chain;
    }

    private clearTimer() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    setStatus(status: SyncStatus) {
        if (this.status === status) return;
        this.status = status;
        this.hooks.onStatus();
    }

    private async handleUser(uid: string | null) {
        if (uid === null) {
            // Signed out (or the session expired): drop the copy, back to guest records
            const previous = this.uid || Records.rememberedUid();
            this.clearTimer();
            this.dirtySummary = false;
            this.dirtyProgress.clear();
            this.needsFull = false;
            this.interactive = false;
            this.uid = null;
            Records.use(null);
            Records.rememberUid(null);
            if (previous) {
                Records.clear(previous);
                this.hooks.onData();
            }
            this.setStatus('signed-out');
            return;
        }

        const shown = Records.currentUid();
        Records.use(null);
        const guestHasRecords = Records.hasRecords(Records.load());
        this.migrate = this.interactive && guestHasRecords && Boolean(await this.hooks.askMigrate());
        this.interactive = false;

        this.uid = uid;
        Records.rememberUid(uid);
        Records.use(uid);
        this.needsFull = true;
        // Show the copy kept on this device first (empty on a new device)
        if (shown !== uid) this.hooks.onData();
        await this.push();
    }

    private noteChange(change: Records.Change) {
        if (this.uid === null) return;
        if (change.startsWith('progress:')) this.dirtyProgress.add(change.slice('progress:'.length));
        else this.dirtySummary = true;
        this.setStatus('syncing');
        this.schedule(this.debounceMs);
    }

    private schedule(ms: number) {
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.enqueue(() => this.push());
        }, ms);
    }

    private async push() {
        const uid = this.uid;
        if (uid === null || !this.hasPending()) return;
        this.setStatus('syncing');
        const progressIds = [...this.dirtyProgress];
        const summary = this.dirtySummary;
        this.dirtyProgress.clear();
        this.dirtySummary = false;
        try {
            if (this.needsFull) await this.fullSync(uid);
            else await this.sendChanges(uid, progressIds, summary);
            if (this.uid !== uid) return; // signed out meanwhile
            this.setStatus(this.hasPending() ? 'syncing' : 'synced');
        } catch (e) {
            if (this.uid !== uid) return;
            console.error('Sync failed', e);
            // Remember what could not be sent and try again later
            progressIds.forEach(id => this.dirtyProgress.add(id));
            this.dirtySummary = this.dirtySummary || summary;
            this.setStatus('offline');
            this.schedule(this.retryMs);
        }
    }

    // Merges everything in Firestore with the local copy (once after each sign-in).
    private async fullSync(uid: string) {
        const theirs = await this.remote.loadAll(uid);
        if (this.uid !== uid) return;

        const before = Records.load();
        let merged = Records.merge(theirs || Records.empty(), before);
        if (this.migrate) {
            Records.use(null);
            const guest = Records.load();
            Records.use(uid);
            merged = Records.merge(merged, guest);
        }
        const localChanged = !Records.same(merged, before);
        Records.save(merged, [], true);

        if (!theirs || !Records.sameSummary(merged, theirs)) await this.remote.saveSummary(uid, merged);
        for (const [id, p] of Object.entries(merged.progress)) {
            if (!theirs || !Records.sameProgress(theirs.progress[id], p)) await this.remote.saveProgress(uid, id, p);
        }

        // Guest records are removed only after they are safely in Firestore
        if (this.migrate) {
            Records.clear(null);
            this.migrate = false;
        }
        this.needsFull = false;
        if (localChanged && this.uid === uid) this.hooks.onData();
    }

    // Sends only what changed locally, merged with what another device may have written.
    private async sendChanges(uid: string, progressIds: string[], summary: boolean) {
        const theirs = Records.empty();
        let theirSummary: Snapshot | null = null;
        for (const id of progressIds) {
            const p = await this.remote.loadProgress(uid, id);
            if (p) theirs.progress[id] = p;
        }
        if (summary) {
            theirSummary = await this.remote.loadSummary(uid);
            if (theirSummary) copySummary(theirs, theirSummary);
        }
        if (this.uid !== uid) return;

        const before = Records.load();
        // Without the remote summary, keep the local one as it is
        if (!summary) copySummary(theirs, before);
        const merged = Records.merge(theirs, before);
        if (!Records.same(merged, before)) {
            Records.save(merged, [], true);
            this.hooks.onData();
        }
        for (const id of progressIds) {
            const p = merged.progress[id];
            if (p && !Records.sameProgress(theirs.progress[id], p)) await this.remote.saveProgress(uid, id, p);
        }
        if (summary && (!theirSummary || !Records.sameSummary(merged, theirSummary))) await this.remote.saveSummary(uid, merged);
    }
}

// The summary fields (Records.SUMMARY_FIELDS), so a new field is synced without changes here
function copySummary(to: Snapshot, from: Snapshot) {
    Object.assign(to, Object.fromEntries(Records.SUMMARY_FIELDS.map(f => [f, from[f]])));
}

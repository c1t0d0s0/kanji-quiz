// Two devices of the same user, a guest becoming that user, and Firestore in memory
import { describe, expect, it, vi } from 'vitest';
import type * as RecordsModule from '../src/core/records';
import type { Sync as SyncClass } from '../src/core/sync';
import { MemoryStorage } from './memory-storage';

interface Server {
    app: Record<string, string>;
    progress: Record<string, Record<string, string>>;
    writes: number;
    fail: boolean;
}

// A device: its own copy of the modules (so its own records and storage), joined to the server
async function device(server: Server) {
    vi.resetModules();
    const R: typeof RecordsModule = await import('../src/core/records');
    const { Sync } = await import('../src/core/sync');
    const storage = new MemoryStorage();
    R.useStorage(storage);
    let userCb: (uid: string | null) => void = () => {};
    let migrateAnswer = false;
    const log: string[] = [];
    const net = () => {
        if (server.fail) throw new Error('net');
    };
    const remote = {
        async loadSummary(uid: string) {
            net();
            return server.app[uid] ? R.fromAppDoc(JSON.parse(server.app[uid])) : null;
        },
        async loadAll(uid: string) {
            const s = await remote.loadSummary(uid);
            const ps = server.progress[uid] || {};
            if (!s && Object.keys(ps).length === 0) return null;
            const snap = s || R.empty();
            for (const [id, doc] of Object.entries(ps)) {
                const p = R.fromProgressDoc(JSON.parse(doc));
                if (p) snap.progress[id] = p;
            }
            return snap;
        },
        async loadProgress(uid: string, id: string) {
            net();
            const doc = (server.progress[uid] || {})[id];
            return doc ? R.fromProgressDoc(JSON.parse(doc)) : null;
        },
        async saveSummary(uid: string, s: RecordsModule.Snapshot) {
            net();
            server.writes++;
            server.app[uid] = JSON.stringify(R.toAppDoc(s, Date.now()));
        },
        async saveProgress(uid: string, id: string, p: RecordsModule.Progress) {
            net();
            server.writes++;
            (server.progress[uid] ||= {})[id] = JSON.stringify(R.toProgressDoc(p));
        }
    };
    const auth = {
        onUser(cb: (uid: string | null) => void) {
            userCb = cb;
        },
        async signIn() {
            userCb('u1');
        },
        async signOut() {
            userCb(null);
        }
    };
    const sync: SyncClass = new Sync(remote, auth, {
        onStatus: () => log.push(sync.status),
        onData: () => log.push('data'),
        askMigrate: () => migrateAnswer
    }, { debounceMs: 20, retryMs: 50 });
    sync.start();
    return {
        R, sync, storage, log,
        user: (uid: string | null) => userCb(uid),
        answerMigrate: (yes: boolean) => { migrateAnswer = yes; }
    };
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Sync', () => {
    it('moves guest records into the account, and keeps two devices in step', async () => {
        const server: Server = { app: {}, progress: {}, writes: 0, fail: false };
        const a = await device(server);
        a.user(null);
        await wait(5);
        expect(a.sync.status).toBe('signed-out');

        // The guest plays
        const id = a.R.itemId('k-to-y', 'all', 10);
        a.R.recordResult(id, 7, 10);
        a.R.recordResult(null, 1, 1, ['一'], ['学校', '天気']);
        a.R.recordResult(null, 1, 1, ['二'], [], 'kaki');
        a.R.setSettings({ grade: '3' });
        expect(server.writes).toBe(0);

        // Signs in and moves the guest records
        a.answerMigrate(true);
        await a.sync.signIn();
        await wait(20);
        expect(a.sync.status).toBe('synced');
        expect(a.storage.has('kanji-quiz:v1')).toBe(false);
        const doc = JSON.parse(server.app.u1);
        expect(doc.completed).toEqual(expect.arrayContaining(['yomi:一', 'kaki:二', 'jukugo:学校', 'jukugo:天気']));
        expect(JSON.parse(server.progress.u1[id]).data.best).toBe(7);

        // A second device signs in: it gets the records and writes nothing
        const b = await device(server);
        const writes = server.writes;
        b.user('u1');
        await wait(20);
        expect(b.R.getBest(id)?.best).toBe(7);
        expect(b.R.getSettings().grade).toBe('3');
        expect(b.R.getCollected('kaki').has('二')).toBe(true);
        expect(b.R.getCollected('yomi').has('二')).toBe(false);
        expect(server.writes).toBe(writes);
        expect(b.log).toContain('data');

        // Both play; each sees what the other did
        b.R.recordResult(id, 9, 10);
        b.R.recordResult(null, 1, 1, [], ['音楽']);
        b.R.setSettings({ count: 20, outfit: ['ribbon', 'scarf'] });
        a.R.recordResult(a.R.itemId('y-to-k', '1', 5), 5, 5, ['五'], [], 'kaki');
        await wait(80);
        expect(a.sync.status).toBe('synced');
        expect(b.sync.status).toBe('synced');
        expect(JSON.parse(server.progress.u1[id]).data.best).toBe(9);
        expect(JSON.parse(server.progress.u1['y-to-k-g1-n5']).status).toBe('done');

        // Offline on a: the change waits, and signing out asks first
        server.fail = true;
        a.R.setSettings({ grade: '5' });
        await wait(40);
        expect(a.sync.status).toBe('offline');
        expect(await a.sync.signOut()).toBe('unsynced');
        server.fail = false;
        expect(await a.sync.signOut()).toBe('ok');
        await wait(5);
        expect(a.sync.status).toBe('signed-out');
        expect(a.storage.has('kanji-quiz:u:u1')).toBe(false);
        expect(a.R.getBest(id)).toBeNull();

        const settings = JSON.parse(server.app.u1).settings;
        expect(settings).toMatchObject({ grade: '5', count: 20, outfit: ['ribbon', 'scarf'] });

        // a signs in again: everything comes back, including what b did
        await a.sync.signIn();
        await wait(20);
        expect(a.R.getBest(id)?.best).toBe(9);
        expect(a.R.getCollectedWords().has('音楽')).toBe(true);
        expect([...a.R.getCollected('kaki')].sort()).toEqual(['二', '五']);
    });

    it('does not ask about guest records when the sign-in was not by the button', async () => {
        const server: Server = { app: {}, progress: {}, writes: 0, fail: false };
        const a = await device(server);
        a.R.recordResult(null, 1, 1, ['一']);
        a.answerMigrate(true);
        a.user('u1'); // e.g. still signed in from last time
        await wait(20);
        expect(a.storage.has('kanji-quiz:v1')).toBe(true);
        expect(a.R.getCollected('yomi').size).toBe(0);
    });
});

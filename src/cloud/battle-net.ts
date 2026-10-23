// --- 意味かるた たいせん: talking to Firebase Realtime Database ---
// The only place the 対戦 uses Firebase (the same way as math-quiz's battle-net).
// The SDK is loaded the first time the 対戦 connects.
import type { OnDisconnect } from 'firebase/database';
import * as Battle from '../core/battle';
import type { Room } from '../core/battle';
import { loadFirebase } from './firebase';

// The rooms of this app, apart from Wordlynx's battles and math-quiz's mathBattles
const ROOT = 'kanjiBattles';

// Realtime Database returns the seats (0..7) as an array sometimes: always { seat: player }
export function normalizeRoom(val: unknown): Room | null {
    if (!val || typeof val !== 'object') return null;
    const raw = val as Record<string, unknown>;
    const players: Room['players'] = {};
    Object.entries((raw.players as Record<string, Room['players'][string]>) ?? {}).forEach(([seat, p]) => {
        if (p) players[seat] = p;
    });
    const faults: Room['faults'] = {};
    Object.entries((raw.faults as Record<string, Record<string, boolean>>) ?? {}).forEach(([q, seats]) => {
        if (seats) faults[q] = Object.fromEntries(Object.entries(seats).filter(([, v]) => v));
    });
    const takes: Room['takes'] = {};
    Object.entries((raw.takes as Record<string, Room['takes'][string]>) ?? {}).forEach(([q, take]) => {
        if (take) takes[q] = take;
    });
    return { ...(raw as unknown as Room), players, faults, takes };
}

export type JoinResult = 'ok' | 'missing' | 'started' | 'full' | 'version';

export interface BattleNet {
    uid: string;
    serverNow(): number;
    seatIn(code: string): string | null;
    create(grade: string, count: number, name: string): Promise<string>;
    join(code: string, name: string): Promise<JoinResult>;
    watch(code: string, cb: (room: Room | null) => void): () => void;
    take(code: string, round: number, q: number): Promise<boolean>;
    fault(code: string, q: number): Promise<void>;
    start(code: string): Promise<void>;
    advance(code: string, q: number): Promise<void>;
    end(code: string): Promise<void>;
    rematch(code: string, round: number): Promise<void>;
    leave(code: string): Promise<void>;
}

let connecting: Promise<BattleNet> | null = null;

// Signs in anonymously unless someone is signed in, and returns the 対戦's API
export function connectBattle(): Promise<BattleNet> {
    if (!connecting) {
        connecting = open();
        connecting.catch(() => {
            connecting = null;
        });
    }
    return connecting;
}

async function open(): Promise<BattleNet> {
    const { app, auth, authSdk, emulator } = await loadFirebase();
    const rtdb = await import('firebase/database');
    await auth.authStateReady();
    if (!auth.currentUser) await authSdk.signInAnonymously(auth);
    const uid = auth.currentUser!.uid;
    const d = rtdb.getDatabase(app);
    if (emulator) rtdb.connectDatabaseEmulator(d, '127.0.0.1', 9000);
    const { ref, get, set, update, remove, onValue, onDisconnect, runTransaction, serverTimestamp } = rtdb;
    const roomRef = (code: string) => ref(d, `${ROOT}/${code}`);
    const seatRef = (code: string, seat: string) => ref(d, `${ROOT}/${code}/players/${seat}`);

    let offset = 0;
    onValue(ref(d, '.info/serverTimeOffset'), snap => {
        offset = Number(snap.val()) || 0;
    });
    const serverNow = () => Date.now() + offset;

    // My seat in each room. Back online after a reconnection, offline when the tab closes
    const mySeat = new Map<string, string>();
    const disconnects = new Map<string, OnDisconnect>();
    onValue(ref(d, '.info/connected'), snap => {
        if (snap.val() !== true) return;
        mySeat.forEach((seat, code) => void markOnline(code, seat));
    });

    async function markOnline(code: string, seat: string) {
        const r = ref(d, `${ROOT}/${code}/players/${seat}/online`);
        const od = onDisconnect(r);
        disconnects.set(code, od);
        await od.set(false);
        await set(r, true).catch(() => {});
    }

    const freshPlayer = (name: string) => ({ uid, name, joinedAt: serverNow(), online: true });

    return {
        uid,
        serverNow,
        seatIn: code => mySeat.get(code) ?? null,

        // Makes a room and sits down in it. Returns the 対戦 code
        async create(grade, count, name) {
            for (let tries = 0; tries < 20; tries++) {
                const code = Battle.makeCode();
                const room = {
                    app: 'kanji-quiz',
                    hostUid: uid,
                    createdAt: serverTimestamp(),
                    grade: grade === 'all' ? 0 : Number(grade),
                    count,
                    version: Battle.dataVersion(),
                    round: 1,
                    seed: '',
                    status: 'waiting',
                    players: { 0: freshPlayer(name) }
                };
                // Only a number not in use (or a room older than a day)
                const now = serverNow();
                const result = await runTransaction(
                    roomRef(code),
                    current => (current && current.createdAt >= now - Battle.ROOM_TTL_MS ? undefined : room),
                    { applyLocally: false }
                );
                if (!result.committed) continue;
                mySeat.set(code, '0');
                await markOnline(code, '0');
                return code;
            }
            throw new Error('対戦コードを作れませんでした');
        },

        // Joins a room (back to the same seat if already in it)
        async join(code, name) {
            for (let tries = 0; tries < 10; tries++) {
                const room = normalizeRoom((await get(roomRef(code))).val());
                if (!room) return 'missing';
                if (room.version !== Battle.dataVersion()) return 'version';
                const mine = Battle.seatOf(room, uid);
                if (mine) {
                    mySeat.set(code, mine);
                    await update(seatRef(code, mine), { name });
                    await markOnline(code, mine);
                    return 'ok';
                }
                if (room.status !== 'waiting') return 'started';
                const seat = Battle.freeSeat(room);
                if (!seat) return 'full';
                try {
                    await set(seatRef(code, seat), freshPlayer(name));
                    mySeat.set(code, seat);
                    await markOnline(code, seat);
                    return 'ok';
                } catch {
                    // Someone sat in the same seat at almost the same time: look for another
                }
            }
            return 'full';
        },

        // Follows the room. null when it is gone. Returns a function that stops following
        watch(code, cb) {
            return onValue(roomRef(code), snap => cb(normalizeRoom(snap.val())), () => cb(null));
        },

        // Takes the card of question q, unless someone was faster. Returns true when it is mine
        async take(code, round, q) {
            const seat = mySeat.get(code);
            if (!seat) return false;
            const result = await runTransaction(
                ref(d, `${ROOT}/${code}/takes/${q}`),
                current => (current ? undefined : { seat, round, at: serverTimestamp() }),
                { applyLocally: false }
            ).catch(() => null);
            const take = result?.snapshot.val();
            return Boolean(result?.committed && take && take.seat === seat);
        },

        // おてつき on question q
        async fault(code, q) {
            const seat = mySeat.get(code);
            if (seat) await set(ref(d, `${ROOT}/${code}/faults/${q}/${seat}`), true).catch(() => {});
        },

        // Host only: a new field, then the countdown
        async start(code) {
            const startAt = serverNow() + Battle.COUNTDOWN_MS;
            await update(roomRef(code), { seed: Battle.makeSeed(), status: 'playing', startAt, q: 0, qAt: startAt, takes: null, faults: null });
        },

        // Host only: the next meaning, after the answer has been shown
        async advance(code, q) {
            await update(roomRef(code), { q, qAt: serverNow() + Battle.REVEAL_MS });
        },

        // Host only: the round is over (also when someone is still playing)
        async end(code) {
            await set(ref(d, `${ROOT}/${code}/status`), 'finished');
        },

        // Host only: back to the waiting screen of the same room
        async rematch(code, round) {
            await update(roomRef(code), { round: round + 1, status: 'waiting', seed: '', takes: null, faults: null });
        },

        // Leaves the room. The host's room is removed
        async leave(code) {
            const seat = mySeat.get(code);
            mySeat.delete(code);
            await disconnects.get(code)?.cancel().catch(() => {});
            disconnects.delete(code);
            const room = normalizeRoom((await get(roomRef(code)).catch(() => null))?.val());
            if (!room) return;
            if (room.hostUid === uid) {
                await remove(roomRef(code)).catch(() => {});
            } else if (seat && room.players?.[seat]?.uid === uid) {
                // While waiting the seat is freed; during a round the cards taken stay on the table
                if (room.status === 'waiting') await remove(seatRef(code, seat)).catch(() => {});
                else await update(seatRef(code, seat), { online: false }).catch(() => {});
            }
        }
    };
}

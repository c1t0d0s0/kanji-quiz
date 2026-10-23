// --- 意味かるた たいせん: the rules ---
// 2〜8 people share one field. Everyone sees the same meaning at the same time, and whoever
// takes the right card first gets it. A wrong card (おてつき) sits out that question.
// Only functions that do not touch the network or the page (the same idea as math-quiz).
//
// kanjiBattles/{code}                   code = 5 digits, not starting with 0
//   app: 'kanji-quiz', hostUid, createdAt, grade: 0 (全学年) | 1..6, count: 5 | 10 | 20, version
//   round: 1, 2, …                       goes up with もう一度
//   seed, status: 'waiting' | 'playing' | 'finished', startAt
//   q: the question being asked (0-based), qAt: when it is shown (server time)
//   players/{seat}: { uid, name, joinedAt, online }      seat = 0..7
//   takes/{q}: { seat, round, at }                       the first one to take the card
//   faults/{q}/{seat}: true                              おてつき
import { jukugoDatabase } from '../data/jukugo';
import * as Karuta from './karuta';
import type { KarutaGame, Shuffle } from './karuta';

export const MAX_PLAYERS = 8;
export const NAME_MAX = 10;
// From スタート to the first meaning: time to look over the field (暗記時間)
export const COUNTDOWN_MS = 5000;
// The answer stays on the screen this long before the next meaning (as in the one-player quiz)
export const REVEAL_MS = 1900;
// A room this old may be taken over by anyone (the same value as database.rules.json)
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const COUNTS = [5, 10, 20] as const;
// Raise this whenever the way the questions and the field are chosen changes (karuta.ts,
// makeGame, the shuffle), so players with the old page are asked to reload it.
export const RULES_VERSION = 2;

export interface Player {
    uid: string;
    name: string;
    joinedAt?: number;
    online?: boolean;
}

export interface Take {
    seat: string;
    round: number;
    at?: number;
}

export interface Room {
    app?: string;
    hostUid: string;
    createdAt?: number;
    grade: number;
    count: number;
    version?: string;
    round: number;
    seed: string;
    status: 'waiting' | 'playing' | 'finished';
    startAt?: number;
    q?: number;
    qAt?: number;
    players: Record<string, Player>;
    takes: Record<string, Take>;
    faults: Record<string, Record<string, boolean>>;
}

export function freeSeat(room: Room): string | null {
    for (let i = 0; i < MAX_PLAYERS; i++) if (!room.players?.[i]) return String(i);
    return null;
}

export function seatOf(room: Room, uid: string): string | null {
    const found = Object.entries(room.players ?? {}).find(([, p]) => p.uid === uid);
    return found ? found[0] : null;
}

export function makeCode(random: () => number = Math.random): string {
    return String(10000 + Math.floor(random() * 90000));
}

// Accepts full-width digits, spaces and hyphens
export function parseCode(input: string): string | null {
    const s = String(input).replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[\s\-ー－]/g, '');
    return /^[1-9]\d{4}$/.test(s) ? s : null;
}

export function makeSeed(random: () => number = Math.random): string {
    let s = '';
    for (let i = 0; i < 10; i++) s += Math.floor(random() * 36).toString(36);
    return s;
}

// No control characters, one space at a time, at most NAME_MAX characters
export function cleanName(input: string): string {
    const s = String(input).replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').replace(/\s+/g, ' ').trim();
    return [...s].slice(0, NAME_MAX).join('');
}

// FNV-1a, as 8 hex digits
export function hash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

// The same seed gives the same numbers on every device (mulberry32)
export function createRng(seed: string): () => number {
    let a = parseInt(hash(String(seed)), 16);
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function seededShuffle(rng: () => number): Shuffle {
    return <T>(array: T[]) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };
}

// Changes whenever the words or the way the field is chosen change. Players with another
// version would see another field, so they are asked to reload the page.
let version: string | null = null;
export function dataVersion(): string {
    if (!version) {
        const words = jukugoDatabase.map(item => `${item.word}|${item.meaning}|${item.grade}`).join('\n');
        version = `k${RULES_VERSION}-${hash(words + JSON.stringify(Karuta.FIELD_SIZE))}`;
    }
    return version;
}

export const gradeOf = (room: Pick<Room, 'grade'>): 'all' | number => (room.grade === 0 ? 'all' : room.grade);

// The questions and the field of the room's current round
export function makeGame(room: Pick<Room, 'grade' | 'count' | 'seed' | 'round'>): KarutaGame {
    return Karuta.makeGame(gradeOf(room), room.count, seededShuffle(createRng(`${room.seed}:${room.round}`)));
}

export interface SeatedPlayer extends Player {
    seat: string;
}

export function playersList(room: Room): SeatedPlayer[] {
    return Object.entries(room.players ?? {})
        .map(([seat, p]) => ({ seat, ...p }))
        .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
}

// The take of question q in this round, or null
export function takeOf(room: Room, q: number): Take | null {
    const take = room.takes?.[q];
    return take && take.round === room.round ? take : null;
}

export const faulted = (room: Room, q: number, seat: string | null) => seat !== null && room.faults?.[q]?.[seat] === true;

// Is question q over: taken, or everyone still here took a wrong card
export function settled(room: Room, q: number): boolean {
    if (takeOf(room, q)) return true;
    const here = playersList(room).filter(p => p.online);
    return here.length > 0 && here.every(p => faulted(room, q, p.seat));
}

export interface Standing {
    seat: string;
    uid: string;
    name: string;
    online: boolean;
    cards: number;
    faults: number;
    words: string[];
    rank: number | null;
}

// The table: most cards first, then fewest おてつき (the same numbers share a rank).
// People who left are put last, without a rank.
export function standings(room: Room): Standing[] {
    const rows: Standing[] = playersList(room).map(p => ({
        seat: p.seat, uid: p.uid, name: p.name, online: Boolean(p.online), cards: 0, faults: 0, words: [], rank: null
    }));
    const bySeat = new Map(rows.map(row => [row.seat, row]));
    const questions = room.seed ? makeGame(room).questions : [];
    for (let q = 0; q < room.count; q++) {
        const take = takeOf(room, q);
        const row = take && bySeat.get(take.seat);
        if (row) {
            row.cards++;
            if (questions[q]) row.words.push(questions[q].word);
        }
        Object.keys(room.faults?.[q] ?? {}).forEach(seat => {
            const faultRow = bySeat.get(seat);
            if (faultRow && faulted(room, q, seat)) faultRow.faults++;
        });
    }
    rows.sort((a, b) => Number(b.online) - Number(a.online) || b.cards - a.cards || a.faults - b.faults);
    let prev: Standing | null = null;
    rows.forEach((row, i) => {
        if (!row.online) return;
        row.rank = prev && prev.cards === row.cards && prev.faults === row.faults ? prev.rank : i + 1;
        prev = row;
    });
    return rows;
}

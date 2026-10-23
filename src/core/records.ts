// --- Local records (personal bests, practice days, collected kanji and words, last selection) ---
// Guest records live under GUEST_KEY. While signed in, a per-user copy of the
// Firestore records is kept under userKey(uid) and removed on sign-out.

export const SCHEMA = 1;
const GUEST_KEY = 'kanji-quiz:v1';
const USER_KEY_PREFIX = 'kanji-quiz:u:';
const ACTIVE_UID_KEY = 'kanji-quiz:auth-uid';
const GRADES = ['all', '1', '2', '3', '4', '5', '6'] as const;
const COUNTS = [5, 10, 20] as const;
// The app document's `completed` list holds everything collected, told apart by a prefix:
// "yomi:一" (漢字から読み), "kaki:一" (読みから漢字), "jukugo:学校" (熟語).
// A kanji without a prefix was collected before 読み and 書き were separated, and counts for both.
const WORD_PREFIX = 'jukugo:';
export const KANJI_KINDS = ['yomi', 'kaki'] as const;
// The parts of the records kept in the app document (the rest are progress documents)
export const SUMMARY_FIELDS = ['activeDays', 'yomi', 'kaki', 'words', 'settings'] as const;

export type Grade = (typeof GRADES)[number];
export type Count = (typeof COUNTS)[number];
// 'yomi': collected in 漢字から読み, 'kaki': in 読みから漢字
export type KanjiKind = (typeof KANJI_KINDS)[number];

export interface Settings {
    grade: Grade | null;
    count: Count | null;
    // What the lynx wears (item ids from lynx.ts). null until something was chosen
    outfit: string[] | null;
    at: number;
}

export interface Progress {
    best: number;
    total: number;
    at: number;
}

export interface Snapshot {
    activeDays: string[];
    yomi: string[];
    kaki: string[];
    words: string[];
    settings: Settings;
    progress: Record<string, Progress>;
}

// 'summary' or 'progress:<itemId>'
export type Change = string;

let key = GUEST_KEY;
let listener: ((change: Change) => void) | null = null;
const watchers = new Set<() => void>();
// The browser's localStorage, unless another one is given (the tests use one per device)
let storage: Storage | null = null;
const store = (): Storage => storage ?? localStorage;

export function useStorage(s: Storage) {
    storage = s;
}

const userKey = (uid: string) => USER_KEY_PREFIX + uid;

export function empty(): Snapshot {
    return {
        activeDays: [],
        yomi: [],
        kaki: [],
        words: [],
        settings: { grade: null, count: null, outfit: null, at: 0 },
        progress: {}
    };
}

// --- Validation (stored / remote data may be malformed) ---
type Raw = Record<string, unknown> | null | undefined;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const normalizeDays = (days: unknown): string[] => [...new Set(asArray(days).filter(isDate))].sort();
// Kanji answered correctly at least once (the 漢字ずかん, 読み and 書き)
const isKanji = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 2;
const normalizeCollected = (list: unknown): string[] => [...new Set(asArray(list).filter(isKanji))].sort();
// 熟語 built correctly at least once (the 熟語ずかん)
const isWord = (v: unknown): v is string => typeof v === 'string' && [...v].length >= 2 && [...v].length <= 4;
const normalizeWords = (list: unknown): string[] => [...new Set(asArray(list).filter(isWord))].sort();

function normalizeSettings(raw: unknown): Settings {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
        grade: (GRADES as readonly unknown[]).includes(s.grade) ? (s.grade as Grade) : null,
        count: (COUNTS as readonly unknown[]).includes(s.count) ? (s.count as Count) : null,
        outfit: Array.isArray(s.outfit)
            ? [...new Set(s.outfit.filter((id): id is string => typeof id === 'string' && /^[a-z]{1,20}$/.test(id)))].slice(0, 8)
            : null,
        at: typeof s.at === 'number' ? s.at : 0
    };
}

function normalizeProgress(raw: unknown): Progress | null {
    const p = raw as Record<string, unknown> | null;
    if (!p || !Number.isInteger(p.best) || !Number.isInteger(p.total)) return null;
    const best = p.best as number;
    const total = p.total as number;
    if (total <= 0 || best < 0 || best > total) return null;
    return { best, total, at: typeof p.at === 'number' ? p.at : 0 };
}

export function normalize(raw: Raw): Snapshot {
    const s = empty();
    if (!raw) return s;
    s.activeDays = normalizeDays(raw.activeDays);
    // Older records have one `collected` list, from before 読み and 書き were separated: it goes to both
    s.yomi = normalizeCollected([...asArray(raw.yomi), ...asArray(raw.collected)]);
    s.kaki = normalizeCollected([...asArray(raw.kaki), ...asArray(raw.collected)]);
    s.words = normalizeWords(raw.words);
    s.settings = normalizeSettings(raw.settings);
    for (const [id, value] of Object.entries((raw.progress as Record<string, unknown>) || {})) {
        const p = normalizeProgress(value);
        if (p) s.progress[id] = p;
    }
    return s;
}

// --- Merge ---
// Every merge is idempotent and commutative, so merging the same data twice
// or in a different order never loses or duplicates records.

// Higher rate wins, then the longer quiz, then the earlier date.
export function mergeProgress(a: Progress | null | undefined, b: Progress | null | undefined): Progress | null {
    if (!a || !b) return a || b || null;
    const rate = a.best * b.total - b.best * a.total;
    if (rate !== 0) return rate > 0 ? a : b;
    if (a.total !== b.total) return a.total > b.total ? a : b;
    return a.at <= b.at ? a : b;
}

// Newer selection wins. Unset values are filled from the other side.
function mergeSettings(a: Settings, b: Settings): Settings {
    const aFirst = a.at !== b.at ? a.at > b.at : JSON.stringify(a) <= JSON.stringify(b);
    const [newer, older] = aFirst ? [a, b] : [b, a];
    return {
        grade: newer.grade ?? older.grade,
        count: newer.count ?? older.count,
        outfit: newer.outfit ?? older.outfit,
        at: Math.max(a.at, b.at)
    };
}

export function merge(a: Snapshot, b: Snapshot): Snapshot {
    const progress: Record<string, Progress> = {};
    for (const id of [...new Set([...Object.keys(a.progress), ...Object.keys(b.progress)])].sort()) {
        progress[id] = mergeProgress(a.progress[id], b.progress[id]) as Progress;
    }
    return {
        activeDays: normalizeDays([...a.activeDays, ...b.activeDays]),
        yomi: normalizeCollected([...a.yomi, ...b.yomi]),
        kaki: normalizeCollected([...a.kaki, ...b.kaki]),
        words: normalizeWords([...a.words, ...b.words]),
        settings: mergeSettings(a.settings, b.settings),
        progress
    };
}

export const sameProgress = (a: Progress | null | undefined, b: Progress | null | undefined) =>
    JSON.stringify(a || null) === JSON.stringify(b || null);
export const sameSummary = (a: Snapshot, b: Snapshot) =>
    JSON.stringify(SUMMARY_FIELDS.map(f => a[f])) === JSON.stringify(SUMMARY_FIELDS.map(f => b[f]));
export const same = (a: Snapshot, b: Snapshot) => JSON.stringify(merge(a, a)) === JSON.stringify(merge(b, b));

// Settings alone do not count as records.
export const hasRecords = (s: Snapshot) =>
    SUMMARY_FIELDS.some(f => Array.isArray(s[f]) && (s[f] as unknown[]).length > 0) || Object.keys(s.progress).length > 0;

// --- Storage ---
// localStorage may be unavailable (e.g. private browsing); failures are ignored.
function readKey(storageKey: string): Raw {
    try {
        const raw = store().getItem(storageKey);
        return raw ? (JSON.parse(raw) as Raw) : null;
    } catch {
        return null;
    }
}

function removeKey(storageKey: string) {
    try {
        store().removeItem(storageKey);
    } catch {
        /* ignore */
    }
}

export function load(): Snapshot {
    return normalize(readKey(key));
}

// Changes coming from the cloud pass silent = true so they are not sent back.
export function save(snapshot: Snapshot, changed: Change[], silent = false) {
    try {
        store().setItem(key, JSON.stringify(snapshot));
    } catch {
        /* keep going even if it cannot be saved */
    }
    if (!silent && listener) changed.forEach(change => listener?.(change));
    watchers.forEach(fn => fn());
}

// Switches whose records are read and written. null = guest records.
export function use(uid: string | null) {
    key = uid ? userKey(uid) : GUEST_KEY;
    watchers.forEach(fn => fn());
}

export function currentUid(): string | null {
    return key === GUEST_KEY ? null : key.slice(USER_KEY_PREFIX.length);
}

// The user who was last signed in on this device, so their copy can be
// shown right away on the next visit without waiting for the network.
export function rememberedUid(): string | null {
    try {
        return store().getItem(ACTIVE_UID_KEY);
    } catch {
        return null;
    }
}

export function rememberUid(uid: string | null) {
    try {
        if (uid) store().setItem(ACTIVE_UID_KEY, uid);
        else store().removeItem(ACTIVE_UID_KEY);
    } catch {
        /* ignore */
    }
}

export function clear(uid: string | null) {
    removeKey(uid ? userKey(uid) : GUEST_KEY);
    watchers.forEach(fn => fn());
}

// cb receives 'summary' or 'progress:<itemId>' whenever local records change (for the sync).
export function onChange(cb: ((change: Change) => void) | null) {
    listener = cb;
}

// fn is called after every save or switch, also the silent ones (for the screen).
export function watch(fn: () => void): () => void {
    watchers.add(fn);
    return () => watchers.delete(fn);
}

// --- App API ---
export const itemId = (mode: string, grade: string, count: number) => `${mode}-g${grade}-n${count}`;

// The date in Japan (YYYY-MM-DD).
export const today = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function getSettings(): Settings {
    return load().settings;
}

export function setSettings(values: Partial<Omit<Settings, 'at'>>) {
    const snapshot = load();
    snapshot.settings = normalizeSettings({ ...snapshot.settings, ...values, at: Date.now() });
    save(snapshot, ['summary']);
}

export function getBest(id: string): Progress | null {
    return load().progress[id] || null;
}

export function activeDayCount(): number {
    return load().activeDays.length;
}

export function getCollected(kind: KanjiKind): Set<string> {
    return new Set(load()[kind] || []);
}

export function getCollectedWords(): Set<string> {
    return new Set(load().words);
}

export interface RecordResult {
    previous: Progress | null;
    isBest: boolean;
    newlyCollected: string[];
    newlyCollectedWords: string[];
}

// Records a finished quiz and the kanji (or 熟語) answered correctly in it. id is null
// for a review of missed questions, which is not a personal best. kanjiKind says which
// 漢字ずかん the kanji go to ('yomi' or 'kaki'). Returns the previous best, whether it
// was beaten and what was added to the 漢字ずかん / 熟語ずかん.
export function recordResult(
    id: string | null,
    score: number,
    total: number,
    correctKanji: string[] = [],
    correctWords: string[] = [],
    kanjiKind: KanjiKind = 'yomi'
): RecordResult {
    const snapshot = load();
    const previous = id ? snapshot.progress[id] || null : null;
    const result: Progress = { best: score, total, at: Date.now() };
    const changed: Change[] = [];
    const isBest = id !== null && mergeProgress(previous, result) === result;
    if (isBest && id !== null) {
        snapshot.progress[id] = result;
        changed.push(`progress:${id}`);
    }
    const day = today();
    if (!snapshot.activeDays.includes(day)) {
        snapshot.activeDays = normalizeDays([...snapshot.activeDays, day]);
        changed.push('summary');
    }
    const kind: KanjiKind = (KANJI_KINDS as readonly string[]).includes(kanjiKind) ? kanjiKind : 'yomi';
    const owned = new Set(snapshot[kind]);
    const newlyCollected = [...new Set(correctKanji.filter(k => isKanji(k) && !owned.has(k)))];
    if (newlyCollected.length > 0) {
        snapshot[kind] = normalizeCollected([...snapshot[kind], ...newlyCollected]);
        if (!changed.includes('summary')) changed.push('summary');
    }
    const ownedWords = new Set(snapshot.words);
    const newlyCollectedWords = [...new Set(correctWords.filter(w => isWord(w) && !ownedWords.has(w)))];
    if (newlyCollectedWords.length > 0) {
        snapshot.words = normalizeWords([...snapshot.words, ...newlyCollectedWords]);
        if (!changed.includes('summary')) changed.push('summary');
    }
    if (changed.length > 0) save(snapshot, changed);
    return { previous, isBest, newlyCollected, newlyCollectedWords };
}

// --- Firestore documents (shape shared by the learning apps) ---
//   users/{uid}/apps/{appId}                   summary of the app's records
//   users/{uid}/apps/{appId}/progress/{itemId} one document per quiz setting
export interface AppDoc {
    schema: number;
    updatedAt: number;
    activeDays: string[];
    completed: string[];
    inventory: Record<string, never>;
    spent: Record<string, never>;
    settings: Settings;
}

export interface ProgressDoc {
    schema: number;
    updatedAt: number;
    status: 'done' | 'playing';
    data: { best: number; total: number };
}

export function toAppDoc(snapshot: Snapshot, now: number): AppDoc {
    return {
        schema: SCHEMA,
        updatedAt: now,
        activeDays: snapshot.activeDays,
        // Everything collected in the ずかん, with prefixes (see WORD_PREFIX)
        // (a perfect score is status "done" on the progress document)
        completed: [
            ...KANJI_KINDS.flatMap(kind => snapshot[kind].map(k => `${kind}:${k}`)),
            ...snapshot.words.map(w => WORD_PREFIX + w)
        ],
        inventory: {},
        spent: {},
        settings: snapshot.settings
    };
}

export function fromAppDoc(doc: Record<string, unknown> | null | undefined): Snapshot {
    const completed = asArray(doc?.completed).filter((v): v is string => typeof v === 'string');
    const withPrefix = (prefix: string) => completed.filter(v => v.startsWith(prefix)).map(v => v.slice(prefix.length));
    return normalize({
        activeDays: doc?.activeDays,
        yomi: withPrefix('yomi:'),
        kaki: withPrefix('kaki:'),
        // No prefix: collected before 読み and 書き were separated (normalize puts it in both)
        collected: completed.filter(v => !v.includes(':')),
        words: withPrefix(WORD_PREFIX),
        settings: doc?.settings
    });
}

export function toProgressDoc(p: Progress): ProgressDoc {
    return {
        schema: SCHEMA,
        updatedAt: p.at,
        status: p.best === p.total ? 'done' : 'playing',
        data: { best: p.best, total: p.total }
    };
}

export function fromProgressDoc(doc: Record<string, unknown> | null | undefined): Progress | null {
    const data = doc?.data as Record<string, unknown> | undefined;
    return normalizeProgress(data ? { ...data, at: doc?.updatedAt } : null);
}

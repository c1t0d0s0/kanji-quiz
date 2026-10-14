// --- Local records (personal bests, practice days, last selection) ---
// Guest records live under GUEST_KEY. While signed in, a per-user copy of the
// Firestore records is kept under userKey(uid) and removed on sign-out.
const Records = (() => {
    const GUEST_KEY = 'kanji-quiz:v1';
    const USER_KEY_PREFIX = 'kanji-quiz:u:';
    const ACTIVE_UID_KEY = 'kanji-quiz:auth-uid';
    const SCHEMA = 1;
    const GRADES = ['all', '1', '2', '3', '4', '5', '6'];
    const COUNTS = [5, 10, 20];

    let key = GUEST_KEY;
    let listener = null;

    const userKey = uid => USER_KEY_PREFIX + uid;

    function empty() {
        return {
            activeDays: [],
            settings: { grade: null, count: null, at: 0 },
            progress: {}
        };
    }

    // --- Validation (stored / remote data may be malformed) ---
    const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const normalizeDays = days => [...new Set((Array.isArray(days) ? days : []).filter(isDate))].sort();

    function normalizeSettings(raw) {
        const s = raw || {};
        return {
            grade: GRADES.includes(s.grade) ? s.grade : null,
            count: COUNTS.includes(s.count) ? s.count : null,
            at: typeof s.at === 'number' ? s.at : 0
        };
    }

    function normalizeProgress(raw) {
        if (!raw || !Number.isInteger(raw.best) || !Number.isInteger(raw.total)) return null;
        if (raw.total <= 0 || raw.best < 0 || raw.best > raw.total) return null;
        return { best: raw.best, total: raw.total, at: typeof raw.at === 'number' ? raw.at : 0 };
    }

    function normalize(raw) {
        const s = empty();
        if (!raw) return s;
        s.activeDays = normalizeDays(raw.activeDays);
        s.settings = normalizeSettings(raw.settings);
        for (const [id, value] of Object.entries(raw.progress || {})) {
            const p = normalizeProgress(value);
            if (p) s.progress[id] = p;
        }
        return s;
    }

    // --- Merge ---
    // Every merge is idempotent and commutative, so merging the same data twice
    // or in a different order never loses or duplicates records.

    // Higher rate wins, then the longer quiz, then the earlier date.
    function mergeProgress(a, b) {
        if (!a || !b) return a || b;
        const rate = a.best * b.total - b.best * a.total;
        if (rate !== 0) return rate > 0 ? a : b;
        if (a.total !== b.total) return a.total > b.total ? a : b;
        return a.at <= b.at ? a : b;
    }

    // Newer selection wins. Unset values are filled from the other side.
    function mergeSettings(a, b) {
        const aFirst = a.at !== b.at ? a.at > b.at : JSON.stringify(a) <= JSON.stringify(b);
        const [newer, older] = aFirst ? [a, b] : [b, a];
        return {
            grade: newer.grade ?? older.grade,
            count: newer.count ?? older.count,
            at: Math.max(a.at, b.at)
        };
    }

    function merge(a, b) {
        const progress = {};
        for (const id of [...new Set([...Object.keys(a.progress), ...Object.keys(b.progress)])].sort()) {
            progress[id] = mergeProgress(a.progress[id], b.progress[id]);
        }
        return {
            activeDays: normalizeDays([...a.activeDays, ...b.activeDays]),
            settings: mergeSettings(a.settings, b.settings),
            progress
        };
    }

    const sameProgress = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
    const sameSummary = (a, b) =>
        JSON.stringify([a.activeDays, a.settings]) === JSON.stringify([b.activeDays, b.settings]);
    const same = (a, b) => JSON.stringify(merge(a, a)) === JSON.stringify(merge(b, b));

    // Settings alone do not count as records.
    const hasRecords = s => s.activeDays.length > 0 || Object.keys(s.progress).length > 0;

    // --- Storage ---
    // localStorage may be unavailable (e.g. private browsing); failures are ignored.
    function readKey(storageKey) {
        try {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function removeKey(storageKey) {
        try {
            localStorage.removeItem(storageKey);
        } catch (e) {
            /* ignore */
        }
    }

    function load() {
        return normalize(readKey(key));
    }

    // Changes coming from the cloud pass silent = true so they are not sent back.
    function save(snapshot, changed, silent) {
        try {
            localStorage.setItem(key, JSON.stringify(snapshot));
        } catch (e) {
            /* keep going even if it cannot be saved */
        }
        if (!silent && listener) changed.forEach(change => listener(change));
    }

    // Switches whose records are read and written. null = guest records.
    function use(uid) {
        key = uid ? userKey(uid) : GUEST_KEY;
    }

    function currentUid() {
        return key === GUEST_KEY ? null : key.slice(USER_KEY_PREFIX.length);
    }

    // The user who was last signed in on this device, so their copy can be
    // shown right away on the next visit without waiting for the network.
    function rememberedUid() {
        try {
            return localStorage.getItem(ACTIVE_UID_KEY);
        } catch (e) {
            return null;
        }
    }

    function rememberUid(uid) {
        try {
            if (uid) localStorage.setItem(ACTIVE_UID_KEY, uid);
            else localStorage.removeItem(ACTIVE_UID_KEY);
        } catch (e) {
            /* ignore */
        }
    }

    function clear(uid) {
        removeKey(uid ? userKey(uid) : GUEST_KEY);
    }

    // cb receives 'summary' or 'progress:<itemId>' whenever local records change.
    function onChange(cb) {
        listener = cb;
    }

    // --- App API ---
    const itemId = (mode, grade, count) => `${mode}-g${grade}-n${count}`;

    // The date in Japan (YYYY-MM-DD).
    const today = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    function getSettings() {
        return load().settings;
    }

    function setSettings(values) {
        const snapshot = load();
        snapshot.settings = normalizeSettings({ ...snapshot.settings, ...values, at: Date.now() });
        save(snapshot, ['summary']);
    }

    function getBest(id) {
        return load().progress[id] || null;
    }

    function activeDayCount() {
        return load().activeDays.length;
    }

    // Records a finished quiz. Returns the previous best and whether it was beaten.
    function recordResult(id, score, total) {
        const snapshot = load();
        const previous = snapshot.progress[id] || null;
        const result = { best: score, total, at: Date.now() };
        const changed = [];
        const isBest = mergeProgress(previous, result) === result;
        if (isBest) {
            snapshot.progress[id] = result;
            changed.push(`progress:${id}`);
        }
        const day = today();
        if (!snapshot.activeDays.includes(day)) {
            snapshot.activeDays = normalizeDays([...snapshot.activeDays, day]);
            changed.push('summary');
        }
        if (changed.length > 0) save(snapshot, changed);
        return { previous, isBest };
    }

    // --- Firestore documents (shape shared by the learning apps) ---
    //   users/{uid}/apps/{appId}                   summary of the app's records
    //   users/{uid}/apps/{appId}/progress/{itemId} one document per quiz setting
    function toAppDoc(snapshot, now) {
        return {
            schema: SCHEMA,
            updatedAt: now,
            activeDays: snapshot.activeDays,
            // Not used by this app: a perfect score is status "done" on the progress document
            completed: [],
            inventory: {},
            spent: {},
            settings: snapshot.settings
        };
    }

    function fromAppDoc(doc) {
        return normalize({ activeDays: doc && doc.activeDays, settings: doc && doc.settings });
    }

    function toProgressDoc(p) {
        return {
            schema: SCHEMA,
            updatedAt: p.at,
            status: p.best === p.total ? 'done' : 'playing',
            data: { best: p.best, total: p.total }
        };
    }

    function fromProgressDoc(doc) {
        return normalizeProgress(doc && doc.data ? { ...doc.data, at: doc.updatedAt } : null);
    }

    return {
        SCHEMA,
        empty, merge, mergeProgress, same, sameSummary, sameProgress, hasRecords,
        load, save, use, currentUid, rememberedUid, rememberUid, clear, onChange,
        itemId, today, getSettings, setSettings, getBest, activeDayCount, recordResult,
        toAppDoc, fromAppDoc, toProgressDoc, fromProgressDoc
    };
})();

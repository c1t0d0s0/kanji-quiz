// --- Local records (personal bests, practice days, collected kanji and words, last selection) ---
// Guest records live under GUEST_KEY. While signed in, a per-user copy of the
// Firestore records is kept under userKey(uid) and removed on sign-out.
const Records = (() => {
    const GUEST_KEY = 'kanji-quiz:v1';
    const USER_KEY_PREFIX = 'kanji-quiz:u:';
    const ACTIVE_UID_KEY = 'kanji-quiz:auth-uid';
    const SCHEMA = 1;
    const GRADES = ['all', '1', '2', '3', '4', '5', '6'];
    const COUNTS = [5, 10, 20];
    // The app document's `completed` list holds everything collected, told apart by a prefix:
    // "yomi:一" (漢字から読み), "kaki:一" (読みから漢字), "jukugo:学校" (熟語).
    // A kanji without a prefix was collected before 読み and 書き were separated, and counts for both.
    const WORD_PREFIX = 'jukugo:';
    const KANJI_KINDS = ['yomi', 'kaki'];
    // The parts of the records kept in the app document (the rest are progress documents)
    const SUMMARY_FIELDS = ['activeDays', 'yomi', 'kaki', 'words', 'settings'];

    let key = GUEST_KEY;
    let listener = null;

    const userKey = uid => USER_KEY_PREFIX + uid;

    function empty() {
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
    const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const normalizeDays = days => [...new Set((Array.isArray(days) ? days : []).filter(isDate))].sort();
    // Kanji answered correctly at least once (the 漢字ずかん, 読み and 書き)
    const isKanji = v => typeof v === 'string' && v.length > 0 && v.length <= 2;
    const normalizeCollected = list => [...new Set((Array.isArray(list) ? list : []).filter(isKanji))].sort();
    // 熟語 built correctly at least once (the 熟語ずかん)
    const isWord = v => typeof v === 'string' && [...v].length >= 2 && [...v].length <= 4;
    const normalizeWords = list => [...new Set((Array.isArray(list) ? list : []).filter(isWord))].sort();

    function normalizeSettings(raw) {
        const s = raw || {};
        return {
            grade: GRADES.includes(s.grade) ? s.grade : null,
            count: COUNTS.includes(s.count) ? s.count : null,
            // What the lynx wears (item ids from lynx.js). null until something was chosen
            outfit: Array.isArray(s.outfit) ? [...new Set(s.outfit.filter(id => typeof id === 'string' && /^[a-z]{1,20}$/.test(id)))].slice(0, 8) : null,
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
        // Older records have one `collected` list, from before 読み and 書き were separated: it goes to both
        s.yomi = normalizeCollected([...(Array.isArray(raw.yomi) ? raw.yomi : []), ...(Array.isArray(raw.collected) ? raw.collected : [])]);
        s.kaki = normalizeCollected([...(Array.isArray(raw.kaki) ? raw.kaki : []), ...(Array.isArray(raw.collected) ? raw.collected : [])]);
        s.words = normalizeWords(raw.words);
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
            outfit: newer.outfit ?? older.outfit,
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
            yomi: normalizeCollected([...a.yomi, ...b.yomi]),
            kaki: normalizeCollected([...a.kaki, ...b.kaki]),
            words: normalizeWords([...a.words, ...b.words]),
            settings: mergeSettings(a.settings, b.settings),
            progress
        };
    }

    const sameProgress = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
    const sameSummary = (a, b) =>
        JSON.stringify(SUMMARY_FIELDS.map(f => a[f])) === JSON.stringify(SUMMARY_FIELDS.map(f => b[f]));
    const same = (a, b) => JSON.stringify(merge(a, a)) === JSON.stringify(merge(b, b));

    // Settings alone do not count as records.
    const hasRecords = s =>
        SUMMARY_FIELDS.some(f => Array.isArray(s[f]) && s[f].length > 0) || Object.keys(s.progress).length > 0;

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

    // kind: 'yomi' (漢字から読み) or 'kaki' (読みから漢字)
    function getCollected(kind) {
        return new Set(load()[kind] || []);
    }

    function getCollectedWords() {
        return new Set(load().words);
    }

    // Records a finished quiz and the kanji (or 熟語) answered correctly in it. id is null
    // for a review of missed questions, which is not a personal best. kanjiKind says which
    // 漢字ずかん the kanji go to ('yomi' or 'kaki'). Returns the previous best, whether it
    // was beaten and what was added to the 漢字ずかん / 熟語ずかん.
    function recordResult(id, score, total, correctKanji = [], correctWords = [], kanjiKind = 'yomi') {
        const snapshot = load();
        const previous = id ? snapshot.progress[id] || null : null;
        const result = { best: score, total, at: Date.now() };
        const changed = [];
        const isBest = id !== null && mergeProgress(previous, result) === result;
        if (isBest) {
            snapshot.progress[id] = result;
            changed.push(`progress:${id}`);
        }
        const day = today();
        if (!snapshot.activeDays.includes(day)) {
            snapshot.activeDays = normalizeDays([...snapshot.activeDays, day]);
            changed.push('summary');
        }
        const kind = KANJI_KINDS.includes(kanjiKind) ? kanjiKind : 'yomi';
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
    function toAppDoc(snapshot, now) {
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

    function fromAppDoc(doc) {
        const completed = Array.isArray(doc && doc.completed) ? doc.completed.filter(v => typeof v === 'string') : [];
        const withPrefix = prefix => completed.filter(v => v.startsWith(prefix)).map(v => v.slice(prefix.length));
        return normalize({
            activeDays: doc && doc.activeDays,
            yomi: withPrefix('yomi:'),
            kaki: withPrefix('kaki:'),
            // No prefix: collected before 読み and 書き were separated (normalize puts it in both)
            collected: completed.filter(v => !v.includes(':')),
            words: withPrefix(WORD_PREFIX),
            settings: doc && doc.settings
        });
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
        SCHEMA, SUMMARY_FIELDS,
        empty, merge, mergeProgress, same, sameSummary, sameProgress, hasRecords,
        load, save, use, currentUid, rememberedUid, rememberUid, clear, onChange,
        itemId, today, getSettings, setSettings, getBest, activeDayCount, getCollected, getCollectedWords, recordResult,
        toAppDoc, fromAppDoc, toProgressDoc, fromProgressDoc
    };
})();

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
const Battle = (() => {
    const MAX_PLAYERS = 8;
    const NAME_MAX = 10;
    // From スタート to the first meaning: time to look over the field (暗記時間)
    const COUNTDOWN_MS = 5000;
    // The answer stays on the screen this long before the next meaning (as in the one-player quiz)
    const REVEAL_MS = 1900;
    // A room this old may be taken over by anyone (the same value as database.rules.json)
    const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
    const COUNTS = [5, 10, 20];

    function freeSeat(room) {
        for (let i = 0; i < MAX_PLAYERS; i++) if (!room.players?.[i]) return String(i);
        return null;
    }

    function seatOf(room, uid) {
        const found = Object.entries(room.players ?? {}).find(([, p]) => p.uid === uid);
        return found ? found[0] : null;
    }

    function makeCode(random = Math.random) {
        return String(10000 + Math.floor(random() * 90000));
    }

    // Accepts full-width digits, spaces and hyphens
    function parseCode(input) {
        const s = String(input).replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[\s\-ー－]/g, '');
        return /^[1-9]\d{4}$/.test(s) ? s : null;
    }

    function makeSeed(random = Math.random) {
        let s = '';
        for (let i = 0; i < 10; i++) s += Math.floor(random() * 36).toString(36);
        return s;
    }

    // No control characters, one space at a time, at most NAME_MAX characters
    function cleanName(input) {
        const s = String(input).replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').replace(/\s+/g, ' ').trim();
        return [...s].slice(0, NAME_MAX).join('');
    }

    // FNV-1a, as 8 hex digits
    function hash(text) {
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16).padStart(8, '0');
    }

    // The same seed gives the same numbers on every device (mulberry32)
    function createRng(seed) {
        let a = parseInt(hash(String(seed)), 16);
        return () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function seededShuffle(rng) {
        return array => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };
    }

    // Changes whenever the words or the way the field is chosen change. Players with another
    // version would see another field, so they are asked to reload the page.
    let version = null;
    function dataVersion() {
        if (!version) {
            const words = jukugoDatabase.map(item => `${item.word}|${item.meaning}|${item.grade}`).join('\n');
            version = `k1-${hash(words + JSON.stringify(Karuta.FIELD_SIZE) + Karuta.pickWords + Karuta.fieldFor + Karuta.makeGame)}`;
        }
        return version;
    }

    const gradeOf = room => (room.grade === 0 ? 'all' : room.grade);

    // The questions and the field of the room's current round
    function makeGame(room) {
        return Karuta.makeGame(gradeOf(room), room.count, seededShuffle(createRng(`${room.seed}:${room.round}`)));
    }

    function playersList(room) {
        return Object.entries(room.players ?? {})
            .map(([seat, p]) => ({ seat, ...p }))
            .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
    }

    // The take of question q in this round, or null
    function takeOf(room, q) {
        const take = room.takes?.[q];
        return take && take.round === room.round ? take : null;
    }

    const faulted = (room, q, seat) => room.faults?.[q]?.[seat] === true;

    // Is question q over: taken, or everyone still here took a wrong card
    function settled(room, q) {
        if (takeOf(room, q)) return true;
        const here = playersList(room).filter(p => p.online);
        return here.length > 0 && here.every(p => faulted(room, q, p.seat));
    }

    // The table: most cards first, then fewest おてつき (the same numbers share a rank).
    // People who left are put last, without a rank.
    function standings(room) {
        const rows = playersList(room).map(p => ({ seat: p.seat, uid: p.uid, name: p.name, online: p.online, cards: 0, faults: 0, words: [], rank: null }));
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
                if (bySeat.has(seat) && faulted(room, q, seat)) bySeat.get(seat).faults++;
            });
        }
        rows.sort((a, b) => Number(b.online) - Number(a.online) || b.cards - a.cards || a.faults - b.faults);
        let prev = null;
        rows.forEach((row, i) => {
            if (!row.online) return;
            row.rank = prev && prev.cards === row.cards && prev.faults === row.faults ? prev.rank : i + 1;
            prev = row;
        });
        return rows;
    }

    return {
        MAX_PLAYERS, NAME_MAX, COUNTDOWN_MS, REVEAL_MS, ROOM_TTL_MS, COUNTS,
        freeSeat, seatOf, makeCode, parseCode, makeSeed, cleanName,
        createRng, seededShuffle, dataVersion, gradeOf, makeGame,
        playersList, takeOf, faulted, settled, standings
    };
})();

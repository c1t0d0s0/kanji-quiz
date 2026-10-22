// --- 意味かるた: choosing the cards ---
// Shared by the one-player quiz (script.js) and the 対戦 (battle.js), so both lay out the
// field the same way. No DOM here: the shuffle is passed in (seeded for a 対戦).
const Karuta = (() => {
    // The cards on the field for each question count (the rest are never asked)
    const FIELD_SIZE = { 5: 20, 10: 30, 20: 50 };
    const MAX_FIELD = 50;

    const fieldSize = count => FIELD_SIZE[count] || Math.min(MAX_FIELD, Math.max(20, count * 3));
    // More time to look for a card on a bigger field
    const timeLimit = size => (size <= 20 ? 15 : size <= 30 ? 20 : 25);

    // grade: 'all' or 1..6
    function wordsFor(grade) {
        if (grade === 'all') return [...jukugoDatabase];
        const target = Number(grade);
        return jukugoDatabase.filter(item => item.grade === target);
    }

    // Takes up to count words from pool, leaving out any whose word or meaning is already
    // taken (in taken or picked before), so every meaning on the field points to one card only.
    function pickWords(pool, taken, count) {
        const words = new Set(taken.map(item => item.word));
        const meanings = new Set(taken.map(item => item.meaning));
        const picked = [];
        for (const item of pool) {
            if (picked.length >= count) break;
            if (words.has(item.word) || meanings.has(item.meaning)) continue;
            words.add(item.word);
            meanings.add(item.meaning);
            picked.push(item);
        }
        return picked;
    }

    // The cards for the questions asked, plus cards never asked, in the order they lie on the field
    function fieldFor(questions, pool, shuffle) {
        const extra = pickWords(shuffle([...pool]), questions, fieldSize(questions.length) - questions.length);
        return shuffle([...questions, ...extra]);
    }

    // A whole game: the questions in the order asked, and the field
    function makeGame(grade, count, shuffle) {
        const pool = wordsFor(grade);
        const questions = pickWords(shuffle([...pool]), [], count);
        return { questions, cards: fieldFor(questions, pool, shuffle) };
    }

    return { FIELD_SIZE, fieldSize, timeLimit, wordsFor, pickWords, fieldFor, makeGame };
})();

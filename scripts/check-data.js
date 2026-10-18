// Checks jukugo-data.js against kanji-data.js. Run: node scripts/check-data.js [--verbose]
// Exits with 1 when something must be fixed, so the deploy stops on broken data.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = {};
vm.createContext(context);
for (const file of ['kanji-data.js', 'jukugo-data.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const { kanjiDatabase, jukugoDatabase } = vm.runInContext('({ kanjiDatabase, jukugoDatabase })', context);

const MIN_WORDS_PER_KANJI = 2;
const MIN_WORDS_PER_GRADE = 20; // the longest quiz is 20 questions

// Kanji that cannot appear twice in words made only of kanji up to their own grade.
// Keep this list as short as possible, with the reason.
const COVERAGE_EXCEPTIONS = {
    貝: '1年の字だけでできた熟語は 赤貝 くらい',
    姉: '2年までの字では 姉妹 くらい',
    思: '2年までの字では 思考 くらい',
    買: '2年までの字では 売買 くらい',
    鳴: '2年までの字では 送りがなのない熟語が作れない',
    央: '3年までの字では 中央 くらい',
    拾: '3年までの字では 送りがなのない熟語が作れない',
    昭: '昭和 にしか使わない',
    茨: '茨城 にしか使わない',
    媛: '愛媛 にしか使わない',
    潟: '4年までの字では 新潟 くらい',
    泣: '4年までの字では 号泣 くらい',
    埼: '埼玉 にしか使わない',
    栃: '栃木 にしか使わない',
    阜: '岐阜 にしか使わない',
    富: '4年までの字では 富山 くらい',
    蚕: '6年までの字では 養蚕 くらい',
    暮: '6年までの字では 送りがなのない熟語が作れない',
};

// Readings used in compounds that kanji-data.js does not list. Only used for this check:
// the readings in kanji-data.js are also used for the quiz choices, so they stay as they are.
const EXTRA_READINGS = {
    一: ['いつ'], 雨: ['あま'], 音: ['いん'], 下: ['もと'], 金: ['かな'], 女: ['にょ'], 小: ['お'], 上: ['うわ'], 正: ['まさ'],
    生: ['き'], 石: ['しゃく'], 早: ['さっ'], 日: ['に'], 入: ['いり'], 白: ['しら'], 文: ['も'], 木: ['こ'], 立: ['たち'],
    引: ['ひき'], 羽: ['わ'], 夏: ['げ'], 家: ['や'], 海: ['うな'], 形: ['かた'], 語: ['かたり'], 合: ['あい', 'が', 'かっ'],
    秋: ['しゅう'], 春: ['しゅん'], 書: ['かき'], 新: ['にい'], 切: ['きっ', 'きり'], 鳥: ['とっ'], 弟: ['で'], 当: ['あて'], 内: ['だい'],
    馬: ['ま'], 指: ['さし'], 守: ['もり'], 取: ['とり', 'とっ'], 神: ['かん', 'か'], 待: ['まち'], 度: ['たく'], 愛: ['え'],
    媛: ['ひめ'], 岐: ['ぎ'], 結: ['ゆい'], 最: ['さい'], 滋: ['し'], 初: ['はつ'], 城: ['き'], 井: ['じょう'], 達: ['たち'],
    置: ['おき'], 包: ['つつみ'], 良: ['ら'], 応: ['のう'], 織: ['おり'], 貸: ['かし'], 干: ['ひ'], 供: ['とも'], 皇: ['のう'],
    存: ['ぞん'], 届: ['とどけ'], 納: ['なっ']
};

const errors = [];
const gradeOf = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
const readingsOf = new Map(kanjiDatabase.map(item => [item.kanji, [...item.readings, ...(EXTRA_READINGS[item.kanji] || [])]]));

// --- Format, grade and duplicates ---
// The section a word is written under ("# 3年生") must be its grade, to keep the file tidy.
const sections = [];
let section = 0;
for (const line of fs.readFileSync(path.join(root, 'jukugo-data.js'), 'utf8').split('\n')) {
    const heading = line.match(/^#\s*([1-6])年生/);
    if (heading) section = Number(heading[1]);
    else if (/^\S+\s+[ぁ-ゖー]+(\s+\*)?\s*(\|.*)?$/.test(line.trim()) && !line.includes('//')) sections.push(section);
}
if (sections.length !== jukugoDatabase.length) errors.push(`could not match sections to words (${sections.length} / ${jukugoDatabase.length})`);

const seen = new Set();
jukugoDatabase.forEach((item, i) => {
    const chars = [...item.word];
    if (chars.length < 2 || chars.length > 4) errors.push(`${item.word}: must be 2 to 4 kanji`);
    const unknown = chars.filter(k => !gradeOf.has(k));
    if (unknown.length > 0) errors.push(`${item.word}: not taught in grade school: ${unknown.join('')}`);
    if (!/^[ぁ-ゖー]+$/.test(item.reading)) errors.push(`${item.word}: reading must be hiragana: ${item.reading}`);
    if (seen.has(item.word)) errors.push(`${item.word}: listed twice`);
    seen.add(item.word);
    if (unknown.length === 0 && sections[i] !== item.grade) errors.push(`${item.word}: grade ${item.grade} word written under ${sections[i]}年生`);
});

// --- Meanings ---
// The meaning is a hint shown while the word is asked: it must not give the answer away
// (no kanji of the word, not its reading), and its kanji must be ones already learned.
const MAX_MEANING = 32;
jukugoDatabase.forEach(item => {
    const m = item.meaning;
    if (!m) {
        errors.push(`${item.word}: no meaning (write "${item.word} ${item.reading} | いみ")`);
        return;
    }
    if ([...m].length > MAX_MEANING) errors.push(`${item.word}: meaning longer than ${MAX_MEANING}: ${m}`);
    const own = [...item.word].filter(k => m.includes(k));
    if (own.length > 0) errors.push(`${item.word}: meaning shows the answer (${own.join('')}): ${m}`);
    if (item.reading.length >= 2 && m.includes(item.reading)) errors.push(`${item.word}: meaning contains the reading: ${m}`);
    const later = [...m].filter(k => /[\u4e00-\u9fff]/.test(k) && !((gradeOf.get(k) || 9) <= item.grade));
    if (later.length > 0) errors.push(`${item.word}: meaning uses kanji not learned by ${item.grade}年生 (${[...new Set(later)].join('')}): ${m}`);
});

// --- Readings ---
// The reading must split into a reading of each kanji, allowing 連濁 (か→が, は→ば/ぱ)
// and 促音化 (がく→がっ). Words marked "*" (熟字訓) are skipped.
const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢじ', つ: 'づず', て: 'で', と: 'ど', は: 'ばぱ', ひ: 'びぴ', ふ: 'ぶぷ', へ: 'べぺ', ほ: 'ぼぽ' };

function variants(reading, first, last) {
    const out = new Set([reading]);
    const starts = first ? [reading] : [reading, ...[...(VOICED[reading[0]] || '')].map(v => v + reading.slice(1))];
    for (const r of starts) {
        out.add(r);
        if (!last && r.length >= 2 && 'つくちき'.includes(r[r.length - 1])) out.add(r.slice(0, -1) + 'っ');
    }
    return [...out];
}

function splits(chars, reading, i = 0) {
    if (i === chars.length) return reading === '';
    return (readingsOf.get(chars[i]) || []).some(base =>
        variants(base, i === 0, i === chars.length - 1).some(v => reading.startsWith(v) && splits(chars, reading.slice(v.length), i + 1)));
}

const unsplit = jukugoDatabase.filter(item => !item.jukujikun && [...item.word].every(k => gradeOf.has(k)) && !splits([...item.word], item.reading));
unsplit.forEach(item => errors.push(`${item.word} ${item.reading}: reading does not split into the kanji's readings (fix it, add to EXTRA_READINGS, or mark 熟字訓 with *)`));

// --- Coverage ---
const counts = new Map(kanjiDatabase.map(item => [item.kanji, 0]));
jukugoDatabase.forEach(item => {
    new Set(item.word).forEach(k => {
        if (gradeOf.get(k) === item.grade) counts.set(k, counts.get(k) + 1);
    });
});
const short = kanjiDatabase.filter(item => counts.get(item.kanji) < MIN_WORDS_PER_KANJI && !(item.kanji in COVERAGE_EXCEPTIONS));
for (let g = 1; g <= 6; g++) {
    const list = short.filter(item => item.grade === g);
    if (list.length > 0) errors.push(`${g}年生: in fewer than ${MIN_WORDS_PER_KANJI} words of their grade: ${list.map(item => `${item.kanji}(${counts.get(item.kanji)})`).join(' ')}`);
}
Object.keys(COVERAGE_EXCEPTIONS).forEach(k => {
    if (counts.get(k) >= MIN_WORDS_PER_KANJI) errors.push(`${k}: no longer needs to be in COVERAGE_EXCEPTIONS`);
});

// --- Summary ---
const byReading = new Map();
jukugoDatabase.forEach(item => byReading.set(item.reading, [...(byReading.get(item.reading) || []), item.word]));
const homophones = [...byReading].filter(([, words]) => words.length > 1);

console.log('Words per grade:');
for (let g = 1; g <= 6; g++) {
    const n = jukugoDatabase.filter(item => item.grade === g).length;
    console.log(`  ${g}年生 ${n}`);
    if (n < MIN_WORDS_PER_GRADE) errors.push(`${g}年生: only ${n} words (at least ${MIN_WORDS_PER_GRADE})`);
}
console.log(`  total ${jukugoDatabase.length}`);
const verbose = process.argv.includes('--verbose');
const jukujikun = jukugoDatabase.filter(item => item.jukujikun);
console.log(`熟字訓 (*): ${jukujikun.length}`);
if (verbose) console.log(`  ${jukujikun.map(item => `${item.word}(${item.reading})`).join(' ')}`);
console.log(`Same reading, either one is accepted: ${homophones.length} groups`);
if (verbose) console.log(`  ${homophones.map(([r, words]) => `${r}=${words.join('/')}`).join(' ')}`);
console.log(`Coverage exceptions: ${Object.keys(COVERAGE_EXCEPTIONS).length}`);
if (verbose) Object.entries(COVERAGE_EXCEPTIONS).forEach(([k, why]) => console.log(`  ${k}: ${why}`));

if (errors.length > 0) {
    console.error(`\n${errors.length} problem(s):`);
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
}
console.log('\nOK');

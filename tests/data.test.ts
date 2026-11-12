// The 熟語 list (src/data/jukugo.txt) against the kanji list (src/data/kanji.ts).
// It used to be scripts/check-data.js; `npm test` runs it before every deploy.
import { describe, expect, it } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { jukugoDatabase, jukugoText } from '../src/data/jukugo';
import { reibunList, reibunText } from '../src/data/reibun';
import { phraseMeaning } from '../src/core/quiz';
import { bushuList, douonList, gojiList, kankenTexts, okuriganaList, pairList, yojiList } from '../src/data/kanken';

const MIN_WORDS_PER_KANJI = 2;
const MIN_WORDS_PER_GRADE = 20; // the longest quiz is 20 questions
const MAX_MEANING = 32;

// Kanji that cannot appear twice in words made only of kanji up to their own grade.
// Keep this list as short as possible, with the reason.
const COVERAGE_EXCEPTIONS: Record<string, string> = {
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
const EXTRA_READINGS: Record<string, string[]> = {
    一: ['いつ'], 雨: ['あま'], 音: ['いん'], 下: ['もと'], 金: ['かな'], 女: ['にょ'], 小: ['お'], 上: ['うわ'], 正: ['まさ'],
    生: ['き'], 石: ['しゃく'], 早: ['さっ'], 日: ['に'], 入: ['いり'], 白: ['しら'], 文: ['も'], 木: ['こ'], 立: ['たち'],
    引: ['ひき'], 羽: ['わ'], 夏: ['げ'], 家: ['や'], 海: ['うな'], 形: ['かた'], 語: ['かたり'], 合: ['あい', 'が', 'かっ'],
    秋: ['しゅう'], 春: ['しゅん'], 書: ['かき'], 新: ['にい'], 切: ['きっ', 'きり'], 鳥: ['とっ'], 弟: ['で'], 当: ['あて'], 内: ['だい'],
    馬: ['ま'], 指: ['さし'], 守: ['もり'], 取: ['とり', 'とっ'], 神: ['かん', 'か'], 待: ['まち'], 度: ['たく'], 愛: ['え'],
    媛: ['ひめ'], 岐: ['ぎ'], 結: ['ゆい'], 最: ['さい'], 滋: ['し'], 初: ['はつ'], 城: ['き'], 井: ['じょう'], 達: ['たち'],
    置: ['おき'], 包: ['つつみ'], 良: ['ら'], 応: ['のう'], 織: ['おり'], 貸: ['かし'], 干: ['ひ'], 供: ['とも'], 皇: ['のう'],
    存: ['ぞん'], 届: ['とどけ'], 納: ['なっ']
};

// A reading as it may sound inside a word: 連濁 (か→が, は→ば/ぱ) unless it comes first,
// and 促音化 (がく→がっ) unless it comes last
const VOICED: Record<string, string> = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢじ', つ: 'づず', て: 'で', と: 'ど', は: 'ばぱ', ひ: 'びぴ', ふ: 'ぶぷ', へ: 'べぺ', ほ: 'ぼぽ' };
const variants = (reading: string, first: boolean, last: boolean) => {
    const out = new Set([reading]);
    const starts = first ? [reading] : [reading, ...[...(VOICED[reading[0]] || '')].map(v => v + reading.slice(1))];
    for (const r of starts) {
        out.add(r);
        if (!last && r.length >= 2 && 'つくちき'.includes(r[r.length - 1])) out.add(r.slice(0, -1) + 'っ');
    }
    return [...out];
};

const gradeOf = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
const readingsOf = new Map(kanjiDatabase.map(item => [item.kanji, [...item.readings, ...(EXTRA_READINGS[item.kanji] || [])]]));

describe('熟語 list', () => {
    it('each word: 2 to 4 kanji taught in grade school, a hiragana reading, listed once, under its grade', () => {
        // The section a word is written under ("# 3年生") must be its grade, to keep the file tidy.
        const sections: number[] = [];
        let section = 0;
        for (const line of jukugoText.split('\n')) {
            const heading = line.match(/^#\s*([1-6])年生/);
            if (heading) section = Number(heading[1]);
            else if (line.trim() && !line.trim().startsWith('#')) sections.push(section);
        }
        expect(sections).toHaveLength(jukugoDatabase.length);
        const errors: string[] = [];
        const seen = new Set<string>();
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
        expect(errors).toEqual([]);
    });

    // The meaning is a hint shown while the word is asked: it must not give the answer away
    // (no kanji of the word, not its reading), and its kanji must be ones already learned.
    it('each meaning: short, without the answer, with kanji already learned', () => {
        const errors: string[] = [];
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
        expect(errors).toEqual([]);
    });

    // The reading must split into a reading of each kanji, allowing 連濁 (か→が, は→ば/ぱ)
    // and 促音化 (がく→がっ). Words marked "*" (熟字訓) are skipped.
    it('each reading splits into readings of its kanji (fix it, add to EXTRA_READINGS, or mark 熟字訓 with *)', () => {
        const splits = (chars: string[], reading: string, i = 0): boolean => {
            if (i === chars.length) return reading === '';
            return (readingsOf.get(chars[i]) || []).some(base =>
                variants(base, i === 0, i === chars.length - 1).some(v => reading.startsWith(v) && splits(chars, reading.slice(v.length), i + 1)));
        };
        const unsplit = jukugoDatabase
            .filter(item => !item.jukujikun && [...item.word].every(k => gradeOf.has(k)) && !splits([...item.word], item.reading))
            .map(item => `${item.word} ${item.reading}`);
        expect(unsplit).toEqual([]);
    });

    it(`every kanji appears in at least ${MIN_WORDS_PER_KANJI} words of its own grade (or is in COVERAGE_EXCEPTIONS)`, () => {
        const counts = new Map(kanjiDatabase.map(item => [item.kanji, 0]));
        jukugoDatabase.forEach(item => {
            new Set(item.word).forEach(k => {
                if (gradeOf.get(k) === item.grade) counts.set(k, (counts.get(k) ?? 0) + 1);
            });
        });
        const short = kanjiDatabase
            .filter(item => (counts.get(item.kanji) ?? 0) < MIN_WORDS_PER_KANJI && !(item.kanji in COVERAGE_EXCEPTIONS))
            .map(item => `${item.grade}年生 ${item.kanji}(${counts.get(item.kanji)})`);
        expect(short).toEqual([]);
        const notNeeded = Object.keys(COVERAGE_EXCEPTIONS).filter(k => (counts.get(k) ?? 0) >= MIN_WORDS_PER_KANJI);
        expect(notNeeded, 'no longer needs to be in COVERAGE_EXCEPTIONS').toEqual([]);
    });

    it(`at least ${MIN_WORDS_PER_GRADE} words in every grade`, () => {
        for (let g = 1; g <= 6; g++) expect(jukugoDatabase.filter(item => item.grade === g).length).toBeGreaterThanOrEqual(MIN_WORDS_PER_GRADE);
    });
});

describe('例文 for the 手書き', () => {
    it('every kanji has 1 to 3 phrases, under its grade', () => {
        const sections = new Map<string, number>();
        let section = 0;
        for (const line of reibunText.split('\n')) {
            const heading = line.match(/^#\s*([1-6])年生/);
            if (heading) section = Number(heading[1]);
            else if (line.trim()) sections.set(line.split('|')[0].trim(), section);
        }
        expect(kanjiDatabase.filter(k => !reibunList.has(k.kanji)).map(k => k.kanji).join('')).toBe('');
        expect([...reibunList.keys()].filter(k => !gradeOf.has(k))).toEqual([]);
        expect(reibunList.size).toBe(kanjiDatabase.length);
        const wrong = kanjiDatabase.filter(k => sections.get(k.kanji) !== k.grade || !(reibunList.get(k.kanji)!.length >= 1 && reibunList.get(k.kanji)!.length <= 3));
        expect(wrong.map(k => k.kanji).join('')).toBe('');
    });

    // The phrase must make the kanji clear without showing it: a reading of the kanji in brackets,
    // the rest in kana (the okurigana too), at most 16 characters
    it('each phrase: a reading of the kanji in brackets, the rest in kana', () => {
        const errors: string[] = [];
        for (const [kanji, phrases] of reibunList) {
            for (const p of phrases) {
                const text = `${p.before}(${p.reading})${p.after}`;
                if (!p.reading) {
                    errors.push(`${kanji}: no reading in brackets: ${p.before}`);
                    continue;
                }
                const readings = readingsOf.get(kanji) || [];
                const ok = readings.some(r => variants(r, p.before === '', false).includes(p.reading) || variants(r, p.before === '', true).includes(p.reading));
                if (!ok) errors.push(`${kanji}: (${p.reading}) is not a reading of ${kanji} (${readings.join('・')}): ${text}`);
                if (!/^[ぁ-ゖァ-ヺー、。]*$/.test(p.before + p.reading + p.after)) errors.push(`${kanji}: only kana outside the brackets: ${text}`);
                if ([...p.before + p.reading + p.after].length > 16) errors.push(`${kanji}: longer than 16: ${text}`);
            }
            const shown = phrases.map(p => p.before + p.reading + p.after);
            if (new Set(shown).size !== shown.length) errors.push(`${kanji}: the same phrase twice`);
        }
        expect(errors).toEqual([]);
    });

    // The same question for two kanji would have two right answers
    it('no two kanji share a question', () => {
        const owner = new Map<string, string>();
        const shared: string[] = [];
        for (const [kanji, phrases] of reibunList) {
            for (const p of phrases) {
                const question = `${p.before}(${p.reading})${p.after}`;
                if (owner.has(question)) shared.push(`${question}: ${owner.get(question)} ${kanji}`);
                owner.set(question, kanji);
            }
        }
        expect(shared).toEqual([]);
    });

    // A phrase that sounds like a 熟語 written with another kanji in its place (じ(どう): 児童 or 自動)
    // must spell a 熟語 of its own kanji too, whose meaning is then shown as a hint
    it('a phrase that sounds like another word has a meaning to tell them apart', () => {
        const wordsOf = new Map<string, string[]>();
        jukugoDatabase.forEach(item => wordsOf.set(item.reading, [...(wordsOf.get(item.reading) || []), item.word]));
        const reads = (k: string, reading: string) => (readingsOf.get(k) || []).some(r => variants(r, false, false).includes(reading) || variants(r, true, false).includes(reading));
        const unclear: string[] = [];
        for (const [kanji, phrases] of reibunList) {
            for (const p of phrases) {
                const others = (wordsOf.get(p.before + p.reading + p.after) || []).filter(word => !word.includes(kanji) && [...word].some(k => reads(k, p.reading)));
                if (others.length > 0 && phraseMeaning(kanji, p) === null) unclear.push(`${kanji}: ${p.before}(${p.reading})${p.after} (${others.join('・')})`);
            }
        }
        expect(unclear).toEqual([]);
    });
});

// --- 漢検もぎ試験 (src/data/kanken/*.txt) ---
const isSchoolKanji = (k: string) => gradeOf.has(k);
const hanOf = (text: string) => [...text].filter(c => /\p{Script=Han}/u.test(c));
// A reading of the kanji, or (for a 訓 with okurigana inside the kanji's reading) one that starts the same
const hasReading = (k: string, reading: string, loose = false) =>
    (readingsOf.get(k) || []).some(r => r === reading || (loose && (reading.startsWith(r) || r.startsWith(reading))));

describe('漢検: 部首', () => {
    it('every kanji has one 部首 and 部首名', () => {
        const seen = new Map<string, number>();
        for (const line of kankenTexts.bushu.split('\n')) {
            if (!line.trim() || line.startsWith('#')) continue;
            const [bushu, name, kanji] = line.split('|').map(p => p.trim());
            expect(bushu, line).toBeTruthy();
            expect(name, line).toMatch(/^[ぁ-ゖー]+$/);
            for (const k of kanji) seen.set(k, (seen.get(k) || 0) + 1);
        }
        expect([...seen].filter(([, n]) => n > 1).map(([k]) => k)).toEqual([]);
        expect(kanjiDatabase.filter(item => !seen.has(item.kanji)).map(item => item.kanji)).toEqual([]);
        expect([...seen.keys()].filter(k => !isSchoolKanji(k))).toEqual([]);
        expect(bushuList.size).toBe(kanjiDatabase.length);
    });
});

describe('漢検: 送り仮名', () => {
    it('one kanji, a reading of it, and at least 3 wrong ways to split the okurigana', () => {
        const errors: string[] = [];
        const words = new Set<string>();
        for (const item of okuriganaList) {
            if (words.has(item.word)) errors.push(`${item.word}: listed twice`);
            words.add(item.word);
            if (!isSchoolKanji(item.kanji) || hanOf(item.word).length !== 1) errors.push(`${item.word}: one school kanji, then kana`);
            if (!/^[ぁ-ゖ]+$/.test(item.reading) || !item.reading.endsWith(item.word.slice(1))) errors.push(`${item.word}: the reading must end in the okurigana: ${item.reading}`);
            if (!hasReading(item.kanji, item.stem)) errors.push(`${item.word}: ${item.stem} is not a reading of ${item.kanji}`);
            if (item.reading.length < 4) errors.push(`${item.word}: too short to make 3 wrong choices`);
        }
        expect(errors).toEqual([]);
    });
});

describe('漢検: 対義語・類義語', () => {
    it('two different words of school kanji, each pair once', () => {
        const errors: string[] = [];
        const seen = new Set<string>();
        for (const pair of pairList) {
            const key = `${pair.kind}:${[pair.a, pair.b].sort().join('|')}`;
            if (seen.has(key)) errors.push(`${pair.a} | ${pair.b}: listed twice`);
            seen.add(key);
            if (!pair.a || !pair.b || pair.a === pair.b) errors.push(`${pair.a} | ${pair.b}: two different words`);
            const later = hanOf(pair.a + pair.b).filter(k => !isSchoolKanji(k));
            if (later.length > 0) errors.push(`${pair.a} | ${pair.b}: not taught in grade school: ${later.join('')}`);
        }
        expect(errors).toEqual([]);
    });
});

describe('漢検: 同音・同訓異字', () => {
    it('the reading in brackets is shared by the answer and the wrong kanji', () => {
        const errors: string[] = [];
        for (const item of douonList) {
            const where = `${item.answer} ${item.before}(${item.reading})${item.after}`;
            if (!item.reading || !/^[ぁ-ゖ]+$/.test(item.reading)) errors.push(`${where}: one reading in brackets`);
            if (!hasReading(item.answer, item.reading, item.kun)) errors.push(`${where}: ${item.reading} is not a reading of ${item.answer}`);
            const min = item.kun ? 1 : 3;
            if (item.wrong.length < min || item.wrong.length > 3) errors.push(`${where}: ${min} to 3 wrong kanji`);
            if (new Set([item.answer, ...item.wrong]).size !== item.wrong.length + 1) errors.push(`${where}: the kanji must differ`);
            for (const k of item.wrong) if (!hasReading(k, item.reading, item.kun)) errors.push(`${where}: ${item.reading} is not a reading of ${k}`);
            const later = hanOf(item.before + item.after + item.answer + item.wrong.join('')).filter(k => !isSchoolKanji(k));
            if (later.length > 0) errors.push(`${where}: not taught in grade school: ${later.join('')}`);
        }
        expect(errors).toEqual([]);
    });
});

describe('漢検: 誤字訂正', () => {
    it('the wrong kanji is in the sentence, sounds like the right one, and there are 4 kanji to choose from', () => {
        const errors: string[] = [];
        for (const item of gojiList) {
            const kanji = hanOf(item.sentence);
            if (!kanji.includes(item.wrong)) errors.push(`${item.sentence}: ${item.wrong} is not in it`);
            if (new Set(kanji).size < 4) errors.push(`${item.sentence}: at least 4 kanji`);
            if (!(readingsOf.get(item.wrong) || []).some(r => hasReading(item.right, r))) errors.push(`${item.sentence}: ${item.wrong} and ${item.right} must share a reading`);
            const later = [...kanji, item.right].filter(k => !isSchoolKanji(k));
            if (later.length > 0) errors.push(`${item.sentence}: not taught in grade school: ${later.join('')}`);
        }
        expect(errors).toEqual([]);
    });
});

describe('漢検: 四字熟語', () => {
    it('4 school kanji; the blank is one of them, read as given, with 3 other kanji of that reading', () => {
        const errors: string[] = [];
        for (const item of yojiList) {
            const chars = [...item.word];
            if (chars.length !== 4 || !chars.every(isSchoolKanji)) errors.push(`${item.word}: 4 school kanji`);
            if (chars.filter(c => c === item.blank).length !== 1) errors.push(`${item.word}: the blank ${item.blank} must be in it once`);
            if (!hasReading(item.blank, item.blankReading)) errors.push(`${item.word}: ${item.blankReading} is not a reading of ${item.blank}`);
            if (!item.reading.includes(item.blankReading)) errors.push(`${item.word}: ${item.blankReading} is not in ${item.reading}`);
            const others = kanjiDatabase.filter(k => k.kanji !== item.blank && !chars.includes(k.kanji) && k.readings.includes(item.blankReading));
            if (others.length < 3) errors.push(`${item.word}: only ${others.length} other kanji read ${item.blankReading}`);
        }
        expect(errors).toEqual([]);
    });
});

// Enough of each kind that the 漢検もぎ試験 does not ask the same questions every time
// (9級 asks 10 対義語 of 2年生 kanji; 5級 to 7級 ask 10 to 18 of each kind)
describe('漢検: enough questions of each kind', () => {
    it('many items of each kind, also of the low grades', () => {
        const upTo = (items: readonly { grade: number }[], grade: number) => items.filter(item => item.grade <= grade).length;
        const taigi = pairList.filter(p => p.kind === 'taigi');
        const counts = {
            taigi2: upTo(taigi, 2), taigi3: upTo(taigi, 3), taigi: taigi.length,
            ruigi: pairList.filter(p => p.kind === 'ruigi').length,
            goji: gojiList.length, yoji: yojiList.length, okurigana: okuriganaList.length,
            douon: douonList.filter(d => !d.kun).length, dokun: douonList.filter(d => d.kun).length
        };
        expect(counts.taigi2).toBeGreaterThanOrEqual(60);
        expect(counts.taigi3).toBeGreaterThanOrEqual(120);
        expect(counts.taigi).toBeGreaterThanOrEqual(280);
        expect(counts.ruigi).toBeGreaterThanOrEqual(160);
        expect(counts.goji).toBeGreaterThanOrEqual(300);
        expect(counts.yoji).toBeGreaterThanOrEqual(140);
        expect(counts.okurigana).toBeGreaterThanOrEqual(230);
        expect(counts.douon).toBeGreaterThanOrEqual(500);
        expect(counts.dokun).toBeGreaterThanOrEqual(140);
    });
});

// The 熟語 list (src/data/jukugo.txt) against the kanji list (src/data/kanji.ts).
// It used to be scripts/check-data.js; `npm test` runs it before every deploy.
import { describe, expect, it } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { jukugoDatabase, jukugoText } from '../src/data/jukugo';

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

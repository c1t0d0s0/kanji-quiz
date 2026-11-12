// --- 漢検もぎ試験: making the questions of an exam (see kanken.ts for the levels) ---
// Loaded when an exam starts, with the data of src/data/kanken, so the home screen does not wait.
import { kanjiDatabase, type KanjiItem } from '../data/kanji';
import { jukugoDatabase, type JukugoItem } from '../data/jukugo';
import { reibunList, type Reibun } from '../data/reibun';
import { bushuList, douonList, gojiList, okuriganaList, pairList, yojiList, type Bushu, type WordPair } from '../data/kanken';
import { kanjiByReading, kanjiReadings, phraseMeaning, shuffle, tegakiQuestion, wordsByReading, type Random } from './quiz';
import { strokes as kanjiStrokes } from '../data/kanjivg';
import { examLevel, mixed, withRuigi, type ChoiceQuestion, type GojiQuestion, type KakiQuestion, type KankenQuestion, type ExamMode, type Kyu, type Level, type SectionType } from './kanken';

const kanjiGrade = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
const gradeOfKanji = (k: string) => kanjiGrade.get(k) ?? 7;

// count items, mostly of the level's own grade (2 in 3), the rest from any grade up to it
function pick<T extends { grade: number }>(items: readonly T[], grade: number, count: number, random: Random): T[] {
    const own = shuffle(items.filter(item => item.grade === grade), random);
    const main = own.slice(0, Math.ceil((count * 2) / 3));
    const rest = shuffle([...own.slice(main.length), ...items.filter(item => item.grade < grade)], random);
    return [...main, ...rest].slice(0, count);
}

// The right answer and up to `wrong` others, in a random order
function choicesOf(answer: string, others: readonly string[], random: Random, wrong = 3): string[] {
    const picked = [...new Set(others)].filter(o => o !== answer).slice(0, wrong);
    return shuffle([answer, ...picked], random);
}

// --- 読み ---
// How a reading may sound inside a word: 連濁 (か→が) unless it comes first, 促音化 (がく→がっ) unless last
const VOICED: Record<string, string> = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ばぱ', ひ: 'びぴ', ふ: 'ぶぷ', へ: 'べぺ', ほ: 'ぼぽ' };
function sounds(reading: string, first: boolean, last: boolean): string[] {
    const out = new Set([reading]);
    const starts = first ? [reading] : [reading, ...[...(VOICED[reading[0]] || '')].map(v => v + reading.slice(1))];
    for (const r of starts) {
        out.add(r);
        if (!last && r.length >= 2 && 'つくちき'.includes(r[r.length - 1])) out.add(r.slice(0, -1) + 'っ');
    }
    return [...out];
}

// The reading of each kanji of the word (学校 がっこう → がっ・こう), or null when it does not split
export function splitReading(word: string, reading: string): string[] | null {
    const chars = [...word];
    const go = (i: number, rest: string): string[] | null => {
        if (i === chars.length) return rest === '' ? [] : null;
        for (const base of kanjiReadings.get(chars[i]) || []) {
            for (const r of sounds(base, i === 0, i === chars.length - 1)) {
                if (!rest.startsWith(r)) continue;
                const tail = go(i + 1, rest.slice(r.length));
                if (tail) return [r, ...tail];
            }
        }
        return null;
    };
    return go(0, reading);
}

const readingsOfWord = new Map<string, Set<string>>();
jukugoDatabase.forEach(item => readingsOfWord.set(item.word, new Set([...(readingsOfWord.get(item.word) || []), item.reading])));

// Wrong readings of a word: one kanji read another way (学校 → がくこう・まなこう), then readings
// of other words of the same length that share a kanji
function wrongWordReadings(item: JukugoItem, random: Random): string[] {
    const right = readingsOfWord.get(item.word) ?? new Set([item.reading]);
    const parts = splitReading(item.word, item.reading);
    const chars = [...item.word];
    const swapped: string[] = [];
    if (parts) {
        chars.forEach((k, i) => {
            for (const other of kanjiReadings.get(k) || []) {
                if (other === parts[i]) continue;
                swapped.push([...parts.slice(0, i), other, ...parts.slice(i + 1)].join(''));
            }
        });
    }
    const sameLength = jukugoDatabase.filter(w => w.word !== item.word && w.grade <= item.grade && [...w.word].length === chars.length);
    const near = sameLength.filter(w => chars.some(k => w.word.includes(k))).map(w => w.reading);
    // Last, any word of as many kanji (a word whose reading does not split: 天皇陛下), then any word
    const any = sameLength.map(w => w.reading);
    const all = jukugoDatabase.filter(w => w.grade <= item.grade).map(w => w.reading);
    return [...shuffle(swapped, random), ...shuffle(near, random), ...shuffle(any, random), ...shuffle(all, random)].filter(r => !right.has(r));
}

function yomiFromWord(item: JukugoItem, points: number, random: Random): ChoiceQuestion {
    return {
        kind: 'choice', section: 'yomi', points, part: 0, grade: item.grade,
        prompt: { lead: '読みを えらぼう', before: '', mark: item.word, after: '' },
        choices: choicesOf(item.reading, wrongWordReadings(item, random), random),
        answer: item.reading,
        explain: `${item.word}（${item.reading}）`
    };
}

// A kanji in one of its 手書き phrases (休みじかん): the other readings of the kanji are wrong here
function yomiFromPhrase(item: KanjiItem, phrase: Reibun, points: number, random: Random): ChoiceQuestion {
    const others = shuffle(item.readings.filter(r => r !== phrase.reading), random);
    const sameLength = shuffle(kanjiDatabase.filter(k => k.grade <= item.grade && k.kanji !== item.kanji).flatMap(k => k.readings)
        .filter(r => r.length === phrase.reading.length && !item.readings.includes(r)), random);
    return {
        kind: 'choice', section: 'yomi', points, part: 0, grade: item.grade,
        prompt: { lead: '──の 漢字の 読みを えらぼう', before: phrase.before, mark: item.kanji, after: phrase.after },
        choices: choicesOf(phrase.reading, [...others.slice(0, 2), ...sameLength], random),
        answer: phrase.reading,
        explain: `${phrase.before}${item.kanji}${phrase.after}（${phrase.before}${phrase.reading}${phrase.after}）`
    };
}

// Half of the 読み in phrases (訓読み mostly), half in 熟語
function yomiQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    const inPhrase = Math.floor(count / 2);
    const phrased = kanjiDatabase.filter(item => (reibunList.get(item.kanji) || []).some(p => item.readings.includes(p.reading)));
    const fromPhrases = pick(phrased, level.grade, inPhrase, random).map(item => {
        const phrase = shuffle((reibunList.get(item.kanji) || []).filter(p => item.readings.includes(p.reading)), random)[0];
        return yomiFromPhrase(item, phrase, points, random);
    });
    const words = jukugoDatabase.filter(item => !item.jukujikun);
    const fromWords = pick(words, level.grade, count - fromPhrases.length, random).map(item => yomiFromWord(item, points, random));
    return [...fromPhrases, ...fromWords];
}

// --- 書き取り ---
function kakiQuestions(level: Level, count: number, points: number, random: Random): KakiQuestion[] {
    const items = kanjiDatabase.filter(item => (reibunList.get(item.kanji) || []).length > 0);
    return pick(items, level.grade, count, random).map(item => {
        const q = tegakiQuestion({ ...item, targetReading: item.readings[0] }, random);
        return {
            kind: 'kaki', section: 'kaki', points, part: 0, grade: item.grade, kanji: item.kanji, phrase: q.phrase,
            hint: phraseMeaning(item.kanji, q.phrase),
            explain: `${q.phrase.before}${item.kanji}${q.phrase.after}（${q.phrase.before}${q.phrase.reading}${q.phrase.after}）`
        };
    });
}

// --- 部首・部首名 ---
const bushuGroups = [...bushuList.values()];
// A radical can be shown as a choice when it is not a kanji, or a kanji already learned
const shownAt = (bushu: string, grade: number) => !kanjiGrade.has(bushu) || gradeOfKanji(bushu) <= grade;

function bushuQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    // A kanji that is its own radical (木) would be too easy
    const items = kanjiDatabase.filter(item => bushuList.has(item.kanji) && bushuList.get(item.kanji)!.bushu !== item.kanji);
    const names = mixed(level) ? Math.floor(count / 2) : 0;
    return pick(items, level.grade, count, random).map((item, i) => {
        const b = bushuList.get(item.kanji) as Bushu;
        const explain = `${item.kanji} の 部首は ${b.bushu}（${b.name}）`;
        if (i >= count - names) {
            // The other name of the same radical (き / きへん) first: it is the closest wrong answer
            const sibling = bushuGroups.filter(g => g.bushu === b.bushu && g.name !== b.name).map(g => g.name);
            const others = shuffle(bushuGroups.map(g => g.name).filter(n => n !== b.name), random);
            return {
                kind: 'choice', section: 'bushu', points, part: 0, grade: item.grade,
                prompt: { lead: '部首名を えらぼう', before: '', mark: item.kanji, after: '' },
                choices: choicesOf(b.name, [...sibling.slice(0, 1), ...others], random), answer: b.name, explain
            };
        }
        const others = shuffle(bushuGroups.map(g => g.bushu).filter(r => r !== b.bushu && shownAt(r, level.grade)), random);
        return {
            kind: 'choice', section: 'bushu', points, part: 0, grade: item.grade,
            prompt: { lead: '部首を えらぼう', before: '', mark: item.kanji, after: '' },
            choices: choicesOf(b.bushu, others, random), answer: b.bushu, explain
        };
    });
}

// --- 送り仮名 ---
function okuriganaQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    return pick(okuriganaList, level.grade, count, random).map(item => {
        // The okurigana cut at another place (新らしい, 新い …), nearest first
        const cuts = [];
        for (let k = 1; k <= item.reading.length; k++) if (k !== item.stem.length) cuts.push(k);
        cuts.sort((a, b) => Math.abs(a - item.stem.length) - Math.abs(b - item.stem.length) || random() - 0.5);
        return {
            kind: 'choice', section: 'okurigana', points, part: 0, grade: item.grade,
            prompt: { lead: '漢字と 送りがなで 正しく 書いたものを えらぼう', before: '', mark: item.reading, after: '' },
            choices: choicesOf(item.word, cuts.map(k => item.kanji + item.reading.slice(k)), random),
            answer: item.word, explain: `${item.reading} → ${item.word}`
        };
    });
}

// --- 対義語・類義語 ---
// A word looks like another when kanji and kana fall in the same places (寒い / 重い, 上流 / 東洋)
const shape = (word: string) => [...word].map(c => (/\p{Script=Han}/u.test(c) ? 'K' : c)).join('');
// The words paired with a word, in either list: never a wrong choice for it
function partners(word: string): Set<string> {
    const out = new Set([word]);
    pairList.forEach(p => {
        if (p.a === word) out.add(p.b);
        if (p.b === word) out.add(p.a);
    });
    return out;
}

function pairQuestion(pair: WordPair, level: Level, points: number, random: Random): ChoiceQuestion {
    const [shown, answer] = random() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
    const taken = new Set([...partners(shown), ...partners(answer)]);
    const words = shuffle([...new Set(pairList.filter(p => p.grade <= level.grade).flatMap(p => [p.a, p.b]))].filter(w => !taken.has(w)), random);
    // Words that look like the answer first (寒い / 重い), then words as long
    const others = [...words.filter(w => shape(w) === shape(answer)), ...words.filter(w => [...w].length === [...answer].length), ...words];
    const taigi = pair.kind === 'taigi';
    return {
        kind: 'choice', section: 'taigi', points, part: 0, grade: pair.grade,
        prompt: { lead: taigi ? '反対の 意味の ことば（対義語）を えらぼう' : 'にた 意味の ことば（類義語）を えらぼう', before: '', mark: shown, after: taigi ? ' ⇔ ？' : ' ＝ ？' },
        choices: choicesOf(answer, others, random), answer,
        explain: `${shown} ${taigi ? '⇔' : '＝'} ${answer}`
    };
}

function pairQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    const ruigi = withRuigi(level) ? Math.floor(count / 2) : 0;
    const taigi = pick(pairList.filter(p => p.kind === 'taigi'), level.grade, count - ruigi, random);
    const similar = pick(pairList.filter(p => p.kind === 'ruigi'), level.grade, ruigi, random);
    return [...taigi, ...similar].map(pair => pairQuestion(pair, level, points, random));
}

// --- 同音・同訓異字 ---
const toKatakana = (kana: string) => kana.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

// More wrong kanji for a 同訓異字 with only 2 or 3 kanji of the reading (はや: 早 / 速): kanji of the
// same reading, then kanji with a reading as long that starts the same (あたた → 新 あたら)
function soundsLike(reading: string, answer: string, grade: number, random: Random): string[] {
    const fits = (k: KanjiItem) => k.kanji !== answer && k.grade <= grade;
    const same = kanjiDatabase.filter(k => fits(k) && k.readings.includes(reading));
    const alike = kanjiDatabase.filter(k => fits(k) && k.readings.some(r => r.length === reading.length && r[0] === reading[0]));
    return [...shuffle(same, random), ...shuffle(alike, random)].map(k => k.kanji);
}

function douonQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    const kun = mixed(level) ? Math.floor(count / 3) : 0;
    const on = pick(douonList.filter(d => !d.kun), level.grade, count - kun, random);
    const kunItems = pick(douonList.filter(d => d.kun), level.grade, kun, random);
    return [...on, ...kunItems].map(item => ({
        kind: 'choice', section: 'douon', points, part: 0, grade: item.grade,
        prompt: { lead: 'カタカナの ところに 合う 漢字を えらぼう', before: item.before, mark: toKatakana(item.reading), after: item.after },
        choices: choicesOf(item.answer, [...shuffle(item.wrong, random), ...soundsLike(item.reading, item.answer, level.grade, random)], random),
        answer: item.answer,
        explain: `${toKatakana(item.reading)} → ${item.answer}（${item.before}${item.answer}${item.after}）`
    }));
}

// --- 誤字訂正 ---
const isKanji = (c: string) => /\p{Script=Han}/u.test(c);
// Kanji that sound like the right one (and the wrong one), for the second step
function soundAlikes(right: string, wrong: string, grade: number, random: Random): string[] {
    const readings = kanjiReadings.get(right) || [];
    const alike = readings.flatMap(r => kanjiByReading.get(r) || []);
    const fill = kanjiDatabase.filter(k => k.grade === grade).map(k => k.kanji);
    return [...shuffle(alike, random), ...shuffle(fill, random)].filter(k => k !== right && k !== wrong && gradeOfKanji(k) <= grade);
}

function gojiQuestions(level: Level, count: number, points: number, random: Random): GojiQuestion[] {
    return pick(gojiList, level.grade, count, random).map(item => {
        const kanji = [...new Set([...item.sentence].filter(isKanji))];
        return {
            kind: 'goji', section: 'goji', points, part: 0, grade: item.grade,
            sentence: item.sentence, wrong: item.wrong, right: item.right,
            find: choicesOf(item.wrong, shuffle(kanji, random), random),
            fix: choicesOf(item.right, soundAlikes(item.right, item.wrong, level.grade, random), random),
            explain: `${item.wrong} → ${item.right}（${item.sentence.replace(item.wrong, item.right)}）`
        };
    });
}

// --- 四字熟語 ---
function yojiQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    return pick(yojiList, level.grade, count, random).map(item => {
        const others = shuffle((kanjiByReading.get(item.blankReading) || []).filter(k => !item.word.includes(k) && gradeOfKanji(k) <= level.grade), random);
        return {
            kind: 'choice', section: 'yoji', points, part: 0, grade: item.grade,
            prompt: { lead: '□に 入る 漢字を えらぼう', before: '', mark: item.word.replace(item.blank, '□'), after: `（${item.reading}）` },
            choices: choicesOf(item.blank, others, random), answer: item.blank,
            explain: `${item.word}（${item.reading}）`
        };
    });
}

// --- 画数 ---
// The total number of strokes, from the strokes of KanjiVG (the same as taught in school)
function kakusuQuestions(level: Level, count: number, points: number, random: Random): ChoiceQuestion[] {
    const items = kanjiDatabase.filter(item => (kanjiStrokes[item.kanji]?.length ?? 0) > 0);
    return pick(items, level.grade, count, random).map(item => {
        const n = kanjiStrokes[item.kanji].length;
        // The numbers next to the right one are the likely mistakes
        // Numbers alone, and the question in kana: 画 is a kanji of 2年生
        const near = shuffle([n - 1, n + 1, n - 2, n + 2, n + 3].filter(x => x > 0), random).map(String);
        return {
            kind: 'choice', section: 'kakusu', points, part: 0, grade: item.grade,
            prompt: { lead: 'ぜんぶで なんかくで かくか えらぼう', before: '', mark: item.kanji, after: '' },
            choices: choicesOf(String(n), near, random),
            answer: String(n),
            explain: `${item.kanji} は ${n}かく`
        };
    });
}

// --- 熟語作り・三字熟語 ---
// A word of the list with one kanji left out (校□ こうてい): the kanji that fits, with kanji of the
// same sound that make no word of that reading (校体, 校定 …)
function wordQuestions(length: number, section: 'jukugo' | 'sanji') {
    return (level: Level, count: number, points: number, random: Random): ChoiceQuestion[] => {
        const words = jukugoDatabase.filter(item => !item.jukujikun && [...item.word].length === length && splitReading(item.word, item.reading));
        return pick(words, level.grade, count, random).map(item => {
            const chars = [...item.word];
            const parts = splitReading(item.word, item.reading) as string[];
            const at = Math.floor(random() * chars.length);
            const right = chars[at];
            const sameReading = new Set(wordsByReading.get(item.reading) || []);
            const fits = (k: string) => k !== right && gradeOfKanji(k) <= level.grade &&
                !sameReading.has([...chars.slice(0, at), k, ...chars.slice(at + 1)].join(''));
            const alike = (kanjiByReading.get(parts[at]) || []).filter(fits);
            const any = kanjiDatabase.filter(k => k.grade === level.grade).map(k => k.kanji).filter(fits);
            const blanked = [...chars.slice(0, at), '□', ...chars.slice(at + 1)].join('');
            return {
                kind: 'choice', section, points, part: 0, grade: item.grade,
                prompt: { lead: '□に 入る 漢字を えらんで 熟語を 作ろう', before: '', mark: blanked, after: `（${item.reading}）` },
                choices: choicesOf(right, [...shuffle(alike, random), ...shuffle(any, random)], random),
                answer: right,
                explain: `${item.word}（${item.reading}）`
            };
        });
    };
}

const BUILDERS: Record<SectionType, (level: Level, count: number, points: number, random: Random) => KankenQuestion[]> = {
    yomi: yomiQuestions, kaki: kakiQuestions, bushu: bushuQuestions, okurigana: okuriganaQuestions,
    taigi: pairQuestions, douon: douonQuestions, goji: gojiQuestions, yoji: yojiQuestions,
    kakusu: kakusuQuestions, jukugo: wordQuestions(2, 'jukugo'), sanji: wordQuestions(3, 'sanji')
};

// The whole exam, section by section, in the order of the real one. The questions of one kind are
// made together (no question twice, also when two sections ask the same kind with other points)
// and then dealt to its sections, each with its own points
export function buildExam(kyu: Kyu, random: Random = Math.random, mode: ExamMode = 'full'): KankenQuestion[] {
    const level = examLevel(kyu, mode);
    const made = new Map<SectionType, KankenQuestion[]>();
    for (const type of new Set(level.sections.map(section => section.type))) {
        const count = level.sections.filter(section => section.type === type).reduce((n, section) => n + section.count, 0);
        const points = level.sections.find(section => section.type === type)!.points;
        made.set(type, shuffle(BUILDERS[type](level, count, points, random), random));
    }
    return level.sections.flatMap((section, part) =>
        (made.get(section.type) as KankenQuestion[]).splice(0, section.count).map(q => ({ ...q, part, points: section.points })));
}

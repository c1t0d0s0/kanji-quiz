// --- 漢検もぎ試験: the levels, the questions and the marking (nothing about the screen) ---
// 10級 (1年生) to 5級 (6年生), shaped like the real 漢検 (the sample exams of 2026, 第1回): as
// many questions, the same points per section, 150 points and 40 minutes for 10級 to 8級, 200
// points and 60 minutes for 7級 to 5級, passing at 80% and 70%.
// Kinds of question the app cannot make (筆順, 同じ漢字の読み, 音読み・訓読み, 熟語の構成) are
// asked as the nearest kind it can: 画数, 読み, 熟語作り. Each section keeps its count and points.
// A question only shows kanji of the level's grade or lower, and asks the level's own grade first.
// The questions themselves are made in kanken-exam.ts, loaded when an exam starts.
import type { Reibun } from '../data/reibun';
import type { Progress } from './records';

export type Kyu = 10 | 9 | 8 | 7 | 6 | 5;
// kakusu: 画数 (総画数), jukugo: 熟語作り (□に 入る 漢字), sanji: 三字熟語
export type SectionType = 'yomi' | 'kakusu' | 'bushu' | 'okurigana' | 'taigi' | 'douon' | 'jukugo' | 'sanji' | 'goji' | 'yoji' | 'kaki';

export interface Section {
    type: SectionType;
    count: number;
    points: number;
}

export interface Level {
    kyu: Kyu;
    grade: number;
    // The full score, and the lowest score that passes
    max: number;
    pass: number;
    // The time allowed, in minutes
    minutes: number;
    sections: Section[];
}

const s = (type: SectionType, count: number, points: number): Section => ({ type, count, points });

// The sections in the order of the real exam; in brackets the real section where the app asks
// another kind (see above)
export const KANKEN_LEVELS: readonly Level[] = [
    // 81問: 読み 20×2, 筆順 12×1 (画数), 同じ漢字の読み 8×2, 読みの 正しい方 5×2, ひらがな 一字 6×2 (読み),
    // 漢字 10×2, 書き取り 20×2
    { kyu: 10, grade: 1, max: 150, pass: 120, minutes: 40, sections: [s('yomi', 20, 2), s('kakusu', 12, 1), s('yomi', 19, 2), s('kaki', 30, 2)] },
    // 108問: 読み 26×1, 筆順 10×1 (画数), ひらがな 一字 8×1, 同じ漢字の読み 10×1 (読み), 正しい 漢字 6×1 (熟語作り),
    // おなじ なかまの 漢字 10×2 (書き取り), 反対の 意味 10×2, 書き取り 25×2
    { kyu: 9, grade: 2, max: 150, pass: 120, minutes: 40, sections: [s('yomi', 26, 1), s('kakusu', 10, 1), s('yomi', 18, 1), s('jukugo', 6, 1), s('taigi', 10, 2), s('kaki', 35, 2)] },
    // 100問: 読み 30×1, 筆順・画数 10×1, 対義語 5×2, 部首 10×2, 同音異字 10×2, 送り仮名 5×2,
    // 同じ漢字の読み 10×1 (読み), 書き取り 20×2
    { kyu: 8, grade: 3, max: 150, pass: 120, minutes: 40, sections: [s('yomi', 30, 1), s('kakusu', 10, 1), s('taigi', 5, 2), s('bushu', 10, 2), s('douon', 10, 2), s('okurigana', 5, 2), s('yomi', 10, 1), s('kaki', 20, 2)] },
    // 120問: 読み 20×1 + 10×1, 漢字えらび 10×2 (同音異字), 画数 10×1, 音読み・訓読み 10×2 (読み), 対義語 5×2,
    // 送り仮名 7×2, 同じ部首の漢字 10×2, 同じ読みの漢字 8×2, 熟語作り 10×2, 書き取り 20×2
    { kyu: 7, grade: 4, max: 200, pass: 140, minutes: 60, sections: [s('yomi', 30, 1), s('douon', 10, 2), s('kakusu', 10, 1), s('yomi', 10, 2), s('taigi', 5, 2), s('okurigana', 7, 2), s('bushu', 10, 2), s('douon', 8, 2), s('jukugo', 10, 2), s('kaki', 20, 2)] },
    // 120問: 読み 20×1, 送り仮名 5×2, 部首名と部首 10×1, 画数 10×1, 熟語の構成 10×2 (熟語作り), 三字熟語 10×2,
    // 対義語・類義語 10×2, 熟語作り 6×2, 音と訓 10×2 (読み), 同じ読みの漢字 9×2, 書き取り 20×2
    { kyu: 6, grade: 5, max: 200, pass: 140, minutes: 60, sections: [s('yomi', 20, 1), s('okurigana', 5, 2), s('bushu', 10, 1), s('kakusu', 10, 1), s('jukugo', 10, 2), s('sanji', 10, 2), s('taigi', 10, 2), s('jukugo', 6, 2), s('yomi', 10, 2), s('douon', 9, 2), s('kaki', 20, 2)] },
    // 120問: 読み 20×1, 部首と部首名 10×1, 画数 10×1, 送り仮名 5×2, 音と訓 10×2 (読み), 四字熟語 10×2,
    // 対義語・類義語 10×2, 熟語作り 5×2, 熟語の構成 10×2 (熟語作り), 同じ読みの漢字 10×2, 書き取り 20×2
    { kyu: 5, grade: 6, max: 200, pass: 140, minutes: 60, sections: [s('yomi', 20, 1), s('bushu', 10, 1), s('kakusu', 10, 1), s('okurigana', 5, 2), s('yomi', 10, 2), s('yoji', 10, 2), s('taigi', 10, 2), s('jukugo', 15, 2), s('douon', 10, 2), s('kaki', 20, 2)] }
];
export const KYUS: readonly Kyu[] = KANKEN_LEVELS.map(level => level.kyu);
const LEVEL = new Map(KANKEN_LEVELS.map(level => [level.kyu, level]));
export const levelOf = (kyu: Kyu): Level => LEVEL.get(kyu) as Level;
export const isKyu = (n: unknown): n is Kyu => LEVEL.has(n as Kyu);

// The level of a grade chosen on the home screen: 1年生 → 10級 … 6年生 → 5級 (全学年: 5級)
export function kyuForGrade(grade: string): Kyu {
    const g = parseInt(grade, 10);
    return g >= 1 && g <= 6 ? ((11 - g) as Kyu) : 5;
}

// From 7級 the sections ask two kinds (部首 and 部首名, 同音 and 同訓); 類義語 come at 6級
export const mixed = (level: Level) => level.grade >= 4;
export const withRuigi = (level: Level) => level.grade >= 5;

export function sectionLabel(type: SectionType, level: Level): string {
    switch (type) {
        case 'yomi': return '読み';
        case 'kaki': return '書き取り';
        case 'bushu': return mixed(level) ? '部首・部首名' : '部首';
        case 'okurigana': return '送り仮名';
        case 'taigi': return withRuigi(level) ? '対義語・類義語' : '対義語';
        case 'douon': return mixed(level) ? '同音・同訓異字' : '同音異字';
        case 'goji': return '誤字訂正';
        case 'yoji': return '四字熟語';
        case 'kakusu': return '画数';
        case 'jukugo': return '熟語作り';
        case 'sanji': return '三字熟語';
    }
}

// --- Questions ---
// The question text: an instruction, and a sentence with the part asked about marked
export interface Prompt {
    lead: string;
    before: string;
    mark: string;
    after: string;
}

interface Base {
    section: SectionType;
    // Which section of the level (its index), for the points per section
    part: number;
    points: number;
    grade: number;
    // The answer, to show on the result
    explain: string;
}

// 4択 (3択 for a few 同訓異字)
export interface ChoiceQuestion extends Base {
    kind: 'choice';
    prompt: Prompt;
    choices: string[];
    answer: string;
}

// 誤字訂正: find the wrong kanji in the sentence, then choose the right one. Both must be right.
export interface GojiQuestion extends Base {
    kind: 'goji';
    sentence: string;
    wrong: string;
    right: string;
    find: string[];
    fix: string[];
}

// 書き取り: write the kanji of the reading in brackets, by hand
export interface KakiQuestion extends Base {
    kind: 'kaki';
    kanji: string;
    phrase: Reibun;
    hint: string | null;
}

export type KankenQuestion = ChoiceQuestion | GojiQuestion | KakiQuestion;

// --- Marking and the title ---
// "v2": the records of the exams of 100 points (before they were shaped like the real 漢検) are not mixed in
export const recordId = (kyu: Kyu) => `kanken2-k${kyu}`;

export function scoreOf(questions: readonly KankenQuestion[], right: readonly boolean[]): number {
    return questions.reduce((sum, q, i) => sum + (right[i] ? q.points : 0), 0);
}

export const passes = (level: Level, score: number) => score >= level.pass;

// The points of each kind of question, for the result (sections of the same kind together)
export function sectionScores(kyu: Kyu, questions: readonly KankenQuestion[], right: readonly boolean[]) {
    const level = levelOf(kyu);
    const rows = new Map<string, { label: string; got: number; max: number }>();
    level.sections.forEach((section, part) => {
        const label = sectionLabel(section.type, level);
        const row = rows.get(label) ?? { label, got: 0, max: 0 };
        row.max += section.count * section.points;
        row.got += questions.filter((q, i) => q.part === part && right[i]).reduce((n, q) => n + q.points, 0);
        rows.set(label, row);
    });
    return [...rows.values()];
}

// The highest level passed, from the best scores: "漢検5級相当", or null
export function kankenTitle(getBest: (id: string) => Progress | null): string | null {
    const passed = [...KANKEN_LEVELS].sort((a, b) => a.kyu - b.kyu).find(level => {
        const best = getBest(recordId(level.kyu));
        return Boolean(best && best.total === level.max && passes(level, best.best));
    });
    return passed ? `漢検${passed.kyu}級相当` : null;
}

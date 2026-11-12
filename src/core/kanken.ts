// --- 漢検もぎ試験: the levels, the questions and the marking (nothing about the screen) ---
// 10級 (1年生) to 5級 (6年生), 100 points each. As in the real 漢検, the kinds of question grow
// with the level: 10級・9級 are 読み and 書き取り only; 部首, 送り仮名, 対義語 and 同音異字 come
// at 8級; 部首名, 類義語 and 同訓異字 at 7級; 誤字訂正 at 6級; 四字熟語 at 5級.
// A question only shows kanji of the level's grade or lower, and asks the level's own grade first.
// The questions themselves are made in kanken-exam.ts, loaded when an exam starts.
import type { Reibun } from '../data/reibun';
import type { Progress } from './records';

export type Kyu = 10 | 9 | 8 | 7 | 6 | 5;
export type SectionType = 'yomi' | 'bushu' | 'okurigana' | 'taigi' | 'douon' | 'goji' | 'yoji' | 'kaki';

export interface Section {
    type: SectionType;
    count: number;
    points: number;
}

export interface Level {
    kyu: Kyu;
    grade: number;
    // The lowest score that passes (of 100)
    pass: number;
    sections: Section[];
}

const s = (type: SectionType, count: number, points: number): Section => ({ type, count, points });

export const KANKEN_LEVELS: readonly Level[] = [
    { kyu: 10, grade: 1, pass: 80, sections: [s('yomi', 10, 5), s('kaki', 10, 5)] },
    { kyu: 9, grade: 2, pass: 80, sections: [s('yomi', 10, 5), s('kaki', 10, 5)] },
    { kyu: 8, grade: 3, pass: 80, sections: [s('yomi', 7, 4), s('bushu', 3, 4), s('okurigana', 3, 4), s('taigi', 3, 4), s('douon', 3, 4), s('kaki', 6, 4)] },
    { kyu: 7, grade: 4, pass: 70, sections: [s('yomi', 6, 4), s('bushu', 3, 4), s('okurigana', 3, 4), s('taigi', 3, 4), s('douon', 3, 4), s('kaki', 7, 4)] },
    { kyu: 6, grade: 5, pass: 70, sections: [s('yomi', 5, 4), s('bushu', 3, 4), s('okurigana', 3, 4), s('taigi', 3, 4), s('douon', 3, 4), s('goji', 2, 4), s('kaki', 6, 4)] },
    { kyu: 5, grade: 6, pass: 70, sections: [s('yomi', 5, 4), s('bushu', 2, 4), s('okurigana', 2, 4), s('taigi', 3, 4), s('douon', 3, 4), s('goji', 2, 4), s('yoji', 2, 4), s('kaki', 6, 4)] }
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

// From 7級 the sections ask two kinds (部首 and 部首名, 対義語 and 類義語, 同音 and 同訓)
export const mixed = (level: Level) => level.grade >= 4;

export function sectionLabel(type: SectionType, level: Level): string {
    switch (type) {
        case 'yomi': return '読み';
        case 'kaki': return '書き取り';
        case 'bushu': return mixed(level) ? '部首・部首名' : '部首';
        case 'okurigana': return '送り仮名';
        case 'taigi': return mixed(level) ? '対義語・類義語' : '対義語';
        case 'douon': return mixed(level) ? '同音・同訓異字' : '同音異字';
        case 'goji': return '誤字訂正';
        case 'yoji': return '四字熟語';
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
export const recordId = (kyu: Kyu) => `kanken-k${kyu}`;
export const MAX_SCORE = 100;

export function scoreOf(questions: readonly KankenQuestion[], right: readonly boolean[]): number {
    return questions.reduce((sum, q, i) => sum + (right[i] ? q.points : 0), 0);
}

export const passes = (level: Level, score: number) => score >= level.pass;

// The points of each section, for the result
export function sectionScores(kyu: Kyu, questions: readonly KankenQuestion[], right: readonly boolean[]) {
    const level = levelOf(kyu);
    return level.sections.map(section => {
        const mine = questions.map((q, i) => ({ q, ok: right[i] })).filter(x => x.q.section === section.type);
        return { label: sectionLabel(section.type, level), got: mine.filter(x => x.ok).reduce((n, x) => n + x.q.points, 0), max: section.count * section.points };
    });
}

// The highest level passed, from the best scores: "漢検5級相当", or null
export function kankenTitle(getBest: (id: string) => Progress | null): string | null {
    const passed = [...KANKEN_LEVELS].sort((a, b) => a.kyu - b.kyu).find(level => {
        const best = getBest(recordId(level.kyu));
        return Boolean(best && best.total === MAX_SCORE && passes(level, best.best));
    });
    return passed ? `漢検${passed.kyu}級相当` : null;
}

import { describe, expect, it } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { createRng } from '../src/core/battle';
import {
    KANKEN_LEVELS, KYUS, kankenTitle, kyuForGrade, levelOf, passes, recordId, scoreOf, sectionScores, type KankenQuestion, type Kyu
} from '../src/core/kanken';
import { buildExam, splitReading } from '../src/core/kanken-exam';
import type { Progress } from '../src/core/records';

const gradeOf = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
// Every kanji the child sees in a question (choices too). The choices of a 部首 question are
// shapes, not words: 寺 is asked at 8級 with its 部首 寸, as in the real 漢検.
function shownText(q: KankenQuestion): string {
    if (q.kind === 'choice') return q.prompt.before + q.prompt.mark + q.prompt.after + (q.section === 'bushu' ? '' : q.choices.join(''));
    if (q.kind === 'goji') return q.sentence + q.find.join('') + q.fix.join('');
    return q.phrase.before + q.phrase.after;
}

describe('漢検: the levels', () => {
    it('10級 (1年生) to 5級 (6年生), 100 points each', () => {
        expect(KYUS).toEqual([10, 9, 8, 7, 6, 5]);
        for (const level of KANKEN_LEVELS) {
            expect(level.grade).toBe(11 - level.kyu);
            expect(level.sections.reduce((n, s) => n + s.count * s.points, 0)).toBe(100);
        }
    });

    it('passes with 80 from 10級 to 8級, with 70 from 7級 to 5級', () => {
        expect(KANKEN_LEVELS.map(l => l.pass)).toEqual([80, 80, 80, 70, 70, 70]);
        expect(passes(levelOf(8), 80)).toBe(true);
        expect(passes(levelOf(8), 79)).toBe(false);
        expect(passes(levelOf(7), 70)).toBe(true);
        expect(passes(levelOf(7), 69)).toBe(false);
    });

    it('asks the kinds of the real 漢検 at each level', () => {
        const kinds = (kyu: Kyu) => levelOf(kyu).sections.map(s => s.type);
        expect(kinds(10)).toEqual(['yomi', 'kaki']);
        expect(kinds(9)).toEqual(['yomi', 'kaki']);
        expect(kinds(8)).toEqual(['yomi', 'bushu', 'okurigana', 'taigi', 'douon', 'kaki']);
        expect(kinds(7)).toEqual(kinds(8));
        expect(kinds(6)).toEqual(['yomi', 'bushu', 'okurigana', 'taigi', 'douon', 'goji', 'kaki']);
        expect(kinds(5)).toEqual(['yomi', 'bushu', 'okurigana', 'taigi', 'douon', 'goji', 'yoji', 'kaki']);
    });

    it('the grade chosen on the home screen gives the level', () => {
        expect(['1', '2', '3', '4', '5', '6', 'all'].map(kyuForGrade)).toEqual([10, 9, 8, 7, 6, 5, 5]);
    });
});

describe('漢検: the exam', () => {
    for (const kyu of KYUS) {
        it(`${kyu}級: every question can be answered, with kanji of the grade or lower`, () => {
            const level = levelOf(kyu);
            for (let seed = 0; seed < 40; seed++) {
                const qs = buildExam(kyu, createRng(`${kyu}${seed}`));
                expect(qs).toHaveLength(level.sections.reduce((n, s) => n + s.count, 0));
                expect(qs.reduce((n, q) => n + q.points, 0)).toBe(100);
                for (const q of qs) {
                    const where = `${kyu}級 ${q.section} ${q.explain}`;
                    const later = [...shownText(q)].filter(c => (gradeOf.get(c) ?? 0) > level.grade);
                    expect(later, where).toEqual([]);
                    if (q.kind === 'choice') {
                        expect(new Set(q.choices).size, where).toBe(q.choices.length);
                        expect(q.choices.filter(c => c === q.answer), where).toHaveLength(1);
                        expect(q.choices.length, where).toBe(4);
                    } else if (q.kind === 'goji') {
                        expect(q.find, where).toContain(q.wrong);
                        expect(q.fix, where).toContain(q.right);
                        expect(new Set(q.find).size, where).toBe(4);
                        expect(new Set(q.fix).size, where).toBe(4);
                        expect(q.fix, where).not.toContain(q.wrong);
                    } else {
                        expect(q.phrase.reading, where).toBeTruthy();
                    }
                }
                // No question twice
                expect(new Set(qs.map(q => `${q.section}:${q.explain}`)).size).toBe(qs.length);
            }
        });
    }

    it('asks mostly the kanji of the level\'s own grade', () => {
        const qs = buildExam(5, createRng('own'));
        expect(qs.filter(q => q.grade === 6).length).toBeGreaterThan(qs.length / 2);
    });

    it('splits the reading of a 熟語 into the readings of its kanji', () => {
        expect(splitReading('学校', 'がっこう')).toEqual(['がっ', 'こう']);
        expect(splitReading('学校', 'あいう')).toBeNull();
    });
});

describe('漢検: marking and the title', () => {
    it('adds up the points of the right answers, and per section', () => {
        const qs = buildExam(8, createRng('mark'));
        const right = qs.map((_, i) => i % 2 === 0);
        const score = scoreOf(qs, right);
        expect(score).toBe(qs.filter((_, i) => i % 2 === 0).reduce((n, q) => n + q.points, 0));
        const sections = sectionScores(8, qs, right);
        expect(sections.map(s => s.label)).toEqual(['読み', '部首', '送り仮名', '対義語', '同音異字', '書き取り']);
        expect(sections.reduce((n, s) => n + s.got, 0)).toBe(score);
        expect(sections.reduce((n, s) => n + s.max, 0)).toBe(100);
    });

    it('the title is the highest level passed', () => {
        const bests = new Map<string, Progress>();
        const getBest = (id: string) => bests.get(id) ?? null;
        expect(kankenTitle(getBest)).toBeNull();
        bests.set(recordId(10), { best: 79, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBeNull();
        bests.set(recordId(10), { best: 80, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検10級相当');
        bests.set(recordId(7), { best: 70, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検7級相当');
        bests.set(recordId(5), { best: 69, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検7級相当');
        bests.set(recordId(5), { best: 100, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検5級相当');
    });
});

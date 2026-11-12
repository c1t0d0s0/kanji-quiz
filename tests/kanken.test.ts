import { describe, expect, it } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { createRng } from '../src/core/battle';
import {
    KANKEN_LEVELS, KYUS, examLevel, kankenTitle, partName, kyuForGrade, levelOf, passes, recordId, scoreOf, sectionScores, type KankenQuestion, type Kyu
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
    // As the sample exams of the real 漢検 (2026, 第1回)
    it('as many questions, points and minutes as the real 漢検', () => {
        expect(KYUS).toEqual([10, 9, 8, 7, 6, 5]);
        const shape = KANKEN_LEVELS.map(level => [
            level.kyu, level.sections.reduce((n, s) => n + s.count, 0), level.sections.reduce((n, s) => n + s.count * s.points, 0), level.max, level.minutes
        ]);
        expect(shape).toEqual([[10, 81, 150, 150, 40], [9, 105, 150, 150, 40], [8, 100, 150, 150, 40], [7, 120, 200, 200, 60], [6, 120, 200, 200, 60], [5, 120, 200, 200, 60]]);
        for (const level of KANKEN_LEVELS) expect(level.grade).toBe(11 - level.kyu);
    });

    it('passes at 80% from 10級 to 8級, at 70% from 7級 to 5級', () => {
        expect(KANKEN_LEVELS.map(l => l.pass / l.max)).toEqual([0.8, 0.8, 0.8, 0.7, 0.7, 0.7]);
        expect(passes(levelOf(8), 120)).toBe(true);
        expect(passes(levelOf(8), 119)).toBe(false);
        expect(passes(levelOf(7), 140)).toBe(true);
        expect(passes(levelOf(7), 139)).toBe(false);
    });

    it('asks the kinds of the real 漢検 at each level (or the nearest the app can make)', () => {
        const kinds = (kyu: Kyu) => [...new Set(levelOf(kyu).sections.map(s => s.type))];
        expect(kinds(10)).toEqual(['yomi', 'kakusu', 'kaki']);
        expect(kinds(9)).toEqual(['yomi', 'kakusu', 'jukugo', 'taigi', 'kaki']);
        expect(kinds(8)).toEqual(['yomi', 'kakusu', 'taigi', 'bushu', 'douon', 'okurigana', 'kaki']);
        expect(kinds(7)).toEqual(['yomi', 'douon', 'kakusu', 'taigi', 'okurigana', 'bushu', 'jukugo', 'kaki']);
        expect(kinds(6)).toEqual(['yomi', 'okurigana', 'bushu', 'kakusu', 'jukugo', 'sanji', 'taigi', 'douon', 'kaki']);
        expect(kinds(5)).toEqual(['yomi', 'bushu', 'kakusu', 'okurigana', 'yoji', 'taigi', 'jukugo', 'goji', 'douon', 'kaki']);
    });

    it('the ミニ試験: about a quarter of the questions, every kind, out of 100 in about 10 minutes', () => {
        const mini = (kyu: Kyu) => examLevel(kyu, 'mini').sections.map(s => `${s.type}${s.count}`).join(' ');
        expect(mini(10)).toBe('yomi10 kakusu3 kaki7');
        expect(mini(9)).toBe('yomi8 kakusu2 jukugo1 taigi2 kaki7');
        expect(mini(8)).toBe('yomi8 kakusu2 taigi1 bushu2 douon2 okurigana1 kaki4');
        expect(mini(7)).toBe('yomi8 douon4 kakusu2 taigi1 okurigana2 bushu2 jukugo2 kaki4');
        expect(mini(6)).toBe('yomi6 okurigana1 bushu2 kakusu2 jukugo4 sanji2 taigi2 douon2 kaki4');
        expect(mini(5)).toBe('yomi7 bushu2 kakusu2 okurigana1 yoji2 taigi2 jukugo2 goji1 douon2 kaki4');
        const shape = KYUS.map(kyu => {
            const level = examLevel(kyu, 'mini');
            return [kyu, level.sections.reduce((n, s) => n + s.count, 0), level.sections.reduce((n, s) => n + s.count * s.points, 0), level.pass, level.minutes];
        });
        expect(shape).toEqual([[10, 20, 100, 80, 10], [9, 20, 100, 80, 10], [8, 20, 100, 80, 10], [7, 25, 100, 70, 12], [6, 25, 100, 70, 12], [5, 25, 100, 70, 12]]);
        // The same kinds, in the same order, as the real exam
        for (const kyu of KYUS) expect(examLevel(kyu, 'mini').sections.map(s => s.type)).toEqual([...new Set(levelOf(kyu).sections.map(s => s.type))]);
        expect(examLevel(8)).toBe(levelOf(8));
    });

    it('the sections are numbered as on the exam paper', () => {
        expect([1, 2, 9, 10, 11, 20].map(partName)).toEqual(['（一）', '（二）', '（九）', '（十）', '（十一）', '（二十）']);
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
                expect(qs.reduce((n, q) => n + q.points, 0)).toBe(level.max);
                // Each section: its count, with its points
                level.sections.forEach((section, part) => {
                    const mine = qs.filter(q => q.part === part);
                    expect(mine, `${kyu}級 section ${part}`).toHaveLength(section.count);
                    for (const q of mine) expect([q.section, q.points]).toEqual([section.type, section.points]);
                });
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

    for (const kyu of KYUS) {
        it(`${kyu}級 ミニ試験: its questions and points, with kanji of the grade or lower, no question twice`, () => {
            const level = examLevel(kyu, 'mini');
            for (let seed = 0; seed < 20; seed++) {
                const qs = buildExam(kyu, createRng(`mini${kyu}${seed}`), 'mini');
                expect(qs).toHaveLength(level.sections.reduce((n, s) => n + s.count, 0));
                expect(qs.reduce((n, q) => n + q.points, 0)).toBe(100);
                for (const q of qs) expect([...shownText(q)].filter(c => (gradeOf.get(c) ?? 0) > level.grade), `${kyu}級 ${q.explain}`).toEqual([]);
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
        const sections = sectionScores(levelOf(8), qs, right);
        expect(sections.map(s => s.label)).toEqual(['読み', '画数', '対義語', '部首', '同音異字', '送り仮名', '書き取り']);
        expect(sections.reduce((n, s) => n + s.got, 0)).toBe(score);
        expect(sections.reduce((n, s) => n + s.max, 0)).toBe(150);
    });

    it('the title is the highest level passed', () => {
        const bests = new Map<string, Progress>();
        const getBest = (id: string) => bests.get(id) ?? null;
        expect(kankenTitle(getBest)).toBeNull();
        bests.set(recordId(10), { best: 119, total: 150, at: 0 });
        expect(kankenTitle(getBest)).toBeNull();
        bests.set(recordId(10), { best: 120, total: 150, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検10級相当');
        bests.set(recordId(7), { best: 140, total: 200, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検7級相当');
        bests.set(recordId(5), { best: 139, total: 200, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検7級相当');
        bests.set(recordId(5), { best: 200, total: 200, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検5級相当');
        // The ミニ試験 is recorded on its own and does not count for the title
        expect(recordId(6, 'mini')).not.toBe(recordId(6));
        bests.delete(recordId(10)); bests.delete(recordId(7)); bests.delete(recordId(5));
        bests.set(recordId(5, 'mini'), { best: 100, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBeNull();
        bests.set(recordId(5), { best: 200, total: 200, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検5級相当');
        // A score of the old exams of 100 points does not count
        bests.set(recordId(6), { best: 100, total: 100, at: 0 });
        expect(kankenTitle(getBest)).toBe('漢検5級相当');
    });
});

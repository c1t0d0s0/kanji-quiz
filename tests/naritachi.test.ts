// なりたち: the pictures (src/data/naritachi.ts) against the kanji and their strokes of KanjiVG,
// where their parts go, and the quiz waiting while it is looked at
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { strokes as models } from '../src/data/kanjivg';
import { NARITACHI, naritachiList } from '../src/data/naritachi';
import { PATH_COMMANDS, morphTransforms, pathPoints, strokesBox } from '../src/core/naritachi';
import { MemoryStorage } from './memory-storage';

describe('なりたち data', () => {
    it('kanji of the list, each once, with a text', () => {
        const known = new Set(kanjiDatabase.map(k => k.kanji));
        naritachiList.forEach(n => {
            expect(known.has(n.kanji), n.kanji).toBe(true);
            expect(n.text.trim(), n.kanji).not.toBe('');
            expect(n.parts.length, n.kanji).toBeGreaterThan(0);
        });
        expect(NARITACHI.size).toBe(naritachiList.length);
        expect(NARITACHI.get('休')?.text).toContain('木');
    });

    it('the parts take every stroke of the kanji once', () => {
        naritachiList.forEach(n => {
            const taken = n.parts.flatMap(p => p.strokes).sort((a, b) => a - b);
            expect(taken, n.kanji).toEqual(models[n.kanji].map((_, i) => i));
        });
    });

    it('pictures of absolute M, L, Q, C and Z only, inside the box', () => {
        naritachiList.forEach(n => n.parts.forEach(p => p.paths.forEach(d => {
            const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
            tokens.forEach(t => expect(PATH_COMMANDS.test(t), `${n.kanji}: ${t} in ${d}`).toBe(true));
            expect(d.startsWith('M'), d).toBe(true);
            // Every command has whole points
            expect((d.match(/-?\d+(?:\.\d+)?/g) ?? []).length % 2, d).toBe(0);
            pathPoints(d).forEach(([x, y]) => {
                expect(x, `${n.kanji}: ${d}`).toBeGreaterThanOrEqual(0);
                expect(x, `${n.kanji}: ${d}`).toBeLessThanOrEqual(109);
                expect(y, `${n.kanji}: ${d}`).toBeGreaterThanOrEqual(0);
                expect(y, `${n.kanji}: ${d}`).toBeLessThanOrEqual(109);
            });
        })));
    });
});

describe('なりたち morph', () => {
    // The end transform applied by hand: translate(tx, ty) scale(sx, sy), the turn round the middle
    function apply(end: string, [x, y]: [number, number]): [number, number] {
        const n = (end.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
        const [tx, ty, sx, sy, cx, cy, deg] = n;
        const r = (deg * Math.PI) / 180;
        const dx = x - cx, dy = y - cy;
        const rx = cx + dx * Math.cos(r) - dy * Math.sin(r), ry = cy + dx * Math.sin(r) + dy * Math.cos(r);
        return [tx + rx * sx, ty + ry * sy];
    }

    it('each part ends on the box of its strokes', () => {
        naritachiList.forEach(n => n.parts.forEach(p => {
            const { start, end } = morphTransforms(p, models[n.kanji]);
            // The same functions, so it moves smoothly
            expect(start.replace(/[-\d.e]+/g, '0')).toBe(end.replace(/[-\d.e]+/g, '0'));
            const target = strokesBox(models[n.kanji], p.strokes);
            const moved = p.paths.flatMap(pathPoints).map(pt => apply(end, pt));
            const xs = moved.map(m => m[0]), ys = moved.map(m => m[1]);
            const mid = (a: number[]) => (Math.min(...a) + Math.max(...a)) / 2;
            expect(Math.abs(mid(xs) - (target.x + target.w / 2)), n.kanji).toBeLessThan(1);
            expect(Math.abs(mid(ys) - (target.y + target.h / 2)), n.kanji).toBeLessThan(1);
        }));
    });

    it('休: the person goes to イ, the tree to 木', () => {
        const [person, tree] = NARITACHI.get('休')!.parts;
        expect(person.strokes).toEqual([0, 1]);
        expect(tree.strokes).toEqual([2, 3, 4, 5]);
        expect(strokesBox(models['休'], person.strokes).x).toBeLessThan(strokesBox(models['休'], tree.strokes).x);
    });
});

describe('なりたち in the quiz', () => {
    let S: typeof import('../src/app/session');
    let view: typeof import('../src/app/quiz-view');

    beforeAll(async () => {
        Object.assign(globalThis, { window: { location: { search: '' }, scrollTo() {} }, alert() {} });
        const Records = await import('../src/core/records');
        Records.useStorage(new MemoryStorage());
        S = await import('../src/app/session');
        view = await import('../src/app/quiz-view');
        // Only after Vue is loaded (it looks for a real document): what blurActive reads
        Object.assign(globalThis, { document: { activeElement: null } });
    });

    afterEach(() => {
        S.stopQuiz();
        vi.useRealTimers();
    });

    it('the next question waits while it is open, and comes after it is closed', () => {
        vi.useFakeTimers();
        S.startQuiz('k-to-y');
        const first = view.quiz.question;
        const turn = view.quiz.turn;
        S.choose(0);
        expect(view.quiz.note?.kind).toBe('kanji');
        S.pauseNext();
        vi.advanceTimersByTime(60_000);
        expect(view.quiz.turn).toBe(turn);
        expect(view.quiz.question).toBe(first);
        S.resumeNext();
        vi.advanceTimersByTime(1000);
        expect(view.quiz.turn).toBe(turn + 1);
        // Once only
        S.resumeNext();
        vi.advanceTimersByTime(5000);
        expect(view.quiz.turn).toBe(turn + 1);
    });

    it('before an answer, nothing is held', () => {
        vi.useFakeTimers();
        S.startQuiz('k-to-y');
        const turn = view.quiz.turn;
        S.pauseNext();
        S.resumeNext();
        vi.advanceTimersByTime(1000);
        expect(view.quiz.turn).toBe(turn);
    });
});

import { describe, expect, it } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { strokes as models } from '../src/data/kanjivg';
import { LIMITS, fromKanjiVG, judge, minimumPairing, traceStroke, type Stroke } from '../src/core/handwriting';
import { createRng } from '../src/core/battle';
import { MESS, joinStrokes, scribble } from './helpers/scribble';

const GRADES = [1, 2, 3, 4, 5, 6];
const rate = (list: readonly { kanji: string }[], write: (k: string) => Stroke[], grade: (k: string) => number) =>
    list.filter(k => judge(write(k.kanji), models[k.kanji], grade(k.kanji)).ok).length / list.length;
const gradeOf = new Map(kanjiDatabase.map(k => [k.kanji, k.grade]));
const every3 = kanjiDatabase.filter((_, i) => i % 3 === 0);

describe('KanjiVG data', () => {
    it('every kanji of the list has its strokes', () => {
        expect(kanjiDatabase.filter(k => !models[k.kanji]?.length).map(k => k.kanji)).toEqual([]);
    });

    it('a few stroke counts as taught in school', () => {
        expect(Object.fromEntries(['一', '口', '赤', '九', '書', '飛', '必'].map(k => [k, models[k].length])))
            .toEqual({ 一: 1, 口: 3, 赤: 7, 九: 2, 書: 10, 飛: 9, 必: 5 });
    });
});

describe('judging handwriting', () => {
    it('the model itself is right in every grade', () => {
        for (const k of every3) for (const g of GRADES) expect(judge(fromKanjiVG(models[k.kanji]), models[k.kanji], g).ok, k.kanji).toBe(true);
    });

    it('a neat child\'s kanji is right in its own grade (all 1,026)', () => {
        const wrong = kanjiDatabase.filter(k => !judge(scribble(models[k.kanji], MESS.small, k.kanji), models[k.kanji], k.grade).ok).map(k => k.kanji);
        expect(wrong.length, wrong.join('')).toBeLessThanOrEqual(5);
    }, 120000);

    it('the limits get stricter grade by grade', () => {
        const keys = ['shape', 'strokes', 'worst', 'flips', 'meets', 'joins'] as const;
        for (let g = 2; g <= 6; g++) for (const key of keys) expect(LIMITS[g][key]).toBeLessThanOrEqual(LIMITS[g - 1][key]);
        // The same messy writing: accepted far more often in 1年生 than in 6年生
        const messy = (k: string) => scribble(models[k], MESS.large, k);
        const first = rate(every3, messy, () => 1), sixth = rate(every3, messy, () => 6);
        expect(first).toBeGreaterThan(0.85);
        expect(sixth).toBeLessThan(0.35);
    }, 120000);

    it('young children may join or break strokes', () => {
        const many = every3.filter(k => models[k.kanji].length > 2);
        const joined = (k: string) => joinStrokes(scribble(models[k], MESS.medium, k), 0);
        const broken = (k: string) => {
            const s = scribble(models[k], MESS.medium, k);
            const half = Math.floor(s[0].length / 2);
            return [s[0].slice(0, half), s[0].slice(half), ...s.slice(1)];
        };
        expect(rate(many, joined, () => 1)).toBeGreaterThan(0.9);
        expect(rate(many, broken, () => 1)).toBeGreaterThan(0.9);
        // A stroke written backwards is fine too
        const backwards = (k: string) => scribble(models[k], MESS.small, k).map((s, i) => (i === 0 ? [...s].reverse() : s));
        expect(rate(every3, backwards, k => gradeOf.get(k)!)).toBeGreaterThan(0.95);
    }, 120000);

    // 8 children write a kanji neatly, but not the one asked
    const SEEDS = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const acceptedBy = (pair: string, g: number) => {
        const [a, b] = [...pair];
        return SEEDS.filter(seed => judge(scribble(models[a], MESS.small, a + seed), models[b], g).ok).length;
    };

    it('another kanji is wrong: always from 3年生 on, nearly always before', () => {
        const pairs = ['日目', '目日', '王玉', '玉王', '人入', '入人', '山川', '大犬', '犬大', '大太', '太大', '右石', '休体', '体休', '木本', '本木', '口日', '白百', '田由', '貝見', '見貝'];
        for (const pair of pairs) {
            for (const g of [1, 2]) expect(acceptedBy(pair, g), `${pair} ${g}`).toBeLessThanOrEqual(3);
            for (const g of [3, 4, 5, 6]) expect(acceptedBy(pair, g), `${pair} ${g}`).toBe(0);
        }
    });

    // Young children's lines are often too long or too short, and poke out a little, so these
    // are told apart only in the higher grades
    it('look-alikes that differ in which line is longer are wrong from 3年生 on', () => {
        for (const pair of ['未末', '末未', '土士', '士土']) {
            for (const g of [3, 4, 5, 6]) expect(acceptedBy(pair, g), `${pair} ${g}`).toBe(0);
        }
    });

    it('look-alikes that differ in a line poking out are wrong from 5年生 on', () => {
        for (const pair of ['牛午', '午牛', '矢失', '失矢', '千干', '天夫', '夫天', '刀力', '力刀', '石右']) {
            for (const g of [5, 6]) expect(acceptedBy(pair, g), `${pair} ${g}`).toBe(0);
        }
    });

    it('nothing, a dot, one stroke or a scribble is wrong', () => {
        const red = models['赤'];
        expect(judge([], red, 1).reason).toBe('empty');
        expect(judge([[{ x: 5, y: 5 }]], red, 1).reason).toBe('empty');
        expect(judge([[{ x: 0, y: 0 }, { x: 100, y: 100 }]], red, 1).ok).toBe(false);
        const rng = createRng('scribble');
        const scrawl = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => ({ x: rng() * 300, y: rng() * 300 })));
        expect(judge(scrawl, red, 1).ok).toBe(false);
        // The size and place on the canvas do not matter
        const small = scribble(red, MESS.small, 'x', 80).map(s => s.map(p => ({ x: p.x + 200, y: p.y + 10 })));
        expect(judge(small, red, 6).ok).toBe(true);
    });

    it('Hungarian method finds the cheapest pairing', () => {
        expect(minimumPairing([[4, 1, 3], [2, 0, 5], [3, 2, 2]]).total).toBe(5);
    });
});

describe('judging the stroke order (when it is turned on)', () => {
    const ON = { strokeOrder: true };

    it('a kanji written in order is still right, also with two strokes in one go', () => {
        const lost = kanjiDatabase.filter(k => {
            const w = scribble(models[k.kanji], MESS.medium, k.kanji);
            return judge(w, models[k.kanji], k.grade).ok && !judge(w, models[k.kanji], k.grade, ON).ok;
        });
        expect(lost.map(k => k.kanji).join('')).toBe('');
        const many = every3.filter(k => models[k.kanji].length > 2);
        const joined = (k: string) => joinStrokes(scribble(models[k], MESS.small, k), 0);
        for (const k of many) {
            const w = joined(k.kanji);
            if (judge(w, models[k.kanji], 1).ok) expect(judge(w, models[k.kanji], 1, ON).ok, k.kanji).toBe(true);
        }
    }, 120000);

    // Each grade where the shape is right (with the order off): wrong with the order on
    it('two strokes written the other way round: wrong in every grade, and which stroke', () => {
        let checked = 0;
        for (const k of every3.filter(k => models[k.kanji].length >= 2)) {
            const m = models[k.kanji];
            const at = Math.max(0, Math.floor(m.length / 2) - 1);
            const w = scribble(m, MESS.small, k.kanji);
            [w[at], w[at + 1]] = [w[at + 1], w[at]];
            for (const g of GRADES) {
                if (!judge(w, m, g).ok) continue;
                checked++;
                expect(judge(w, m, g, ON), `${k.kanji} ${g}`).toMatchObject({ ok: false, reason: 'order', order: { kind: 'order', stroke: at + 1 } });
            }
        }
        expect(checked).toBeGreaterThan(1900);
    }, 300000);

    it('a stroke written backwards: wrong, and which stroke', () => {
        for (const k of every3) {
            const m = models[k.kanji];
            const w = scribble(m, MESS.small, k.kanji);
            const longest = w.reduce((best, s, i) => (s.length > w[best].length ? i : best), 0);
            w[longest] = [...w[longest]].reverse();
            expect(judge(w, m, 1).ok, k.kanji).toBe(true);
            expect(judge(w, m, 1, ON), k.kanji).toMatchObject({ ok: false, reason: 'order', order: { kind: 'direction', stroke: longest + 1 } });
        }
    });

    it('a wrong shape is still said to be the shape', () => {
        expect(judge(scribble(models['山'], MESS.small, 'x'), models['川'], 1, ON).reason).not.toBe('order');
    });
});

describe('なぞり練習: one stroke traced over the model', () => {
    // A careful child tracing on a square of 300 x 300 pixels
    const TRACE = { scale: 0.03, turn: 0.02, lean: 0.02, move: 2, stretch: 0.08, wave: 1.2, shake: 0.5 };

    it('every stroke of every kanji, traced with a little wobble, is right', () => {
        const wrong: string[] = [];
        for (const k of kanjiDatabase) {
            const m = models[k.kanji];
            scribble(m, TRACE, k.kanji).forEach((s, i) => {
                if (traceStroke(s, m, i, 300) !== 'ok') wrong.push(`${k.kanji}${i + 1}`);
            });
        }
        expect(wrong).toEqual([]);
    });

    it('the stroke before (not the one asked) is wrong, and backwards is said to be backwards', () => {
        let other = 0, otherWrong = 0, back = 0, backCaught = 0;
        for (const k of every3) {
            const m = models[k.kanji];
            scribble(m, TRACE, k.kanji).forEach((s, i) => {
                if (i > 0) {
                    other++;
                    if (traceStroke(s, m, i - 1, 300) !== 'ok') otherWrong++;
                }
                if (Math.hypot(s[0].x - s[s.length - 1].x, s[0].y - s[s.length - 1].y) > 40) {
                    back++;
                    if (traceStroke([...s].reverse(), m, i, 300) === 'direction') backCaught++;
                }
            });
        }
        expect(otherWrong / other).toBeGreaterThan(0.99);
        expect(backCaught / back).toBeGreaterThan(0.99);
    });

    it('where it is drawn matters (not its size or place in a box)', () => {
        const one = models['一'];
        const line = (dx: number, dy: number) => [{ x: (11 + dx) * 3, y: (54 + dy) * 3 }, { x: (97 + dx) * 3, y: (50 + dy) * 3 }];
        expect(traceStroke(line(0, 0), one, 0, 327)).toBe('ok');
        expect(traceStroke(line(0, 30), one, 0, 327)).toBe('off');
        expect(traceStroke([...line(0, 0)].reverse(), one, 0, 327)).toBe('direction');
        expect(traceStroke([], one, 0, 327)).toBe('off');
        // The dot of 犬 goes from the top left too
        const inu = models['犬'];
        const dot = fromKanjiVG(inu)[3].map(p => ({ x: p.x * 3, y: p.y * 3 }));
        expect(traceStroke(dot, inu, 3, 327)).toBe('ok');
        expect(traceStroke([...dot].reverse(), inu, 3, 327)).toBe('direction');
    });
});


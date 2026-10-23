// The なぞり練習: trace stroke by stroke, then write without the model; nothing is recorded
import { beforeAll, describe, expect, it } from 'vitest';
import { strokes as models } from '../src/data/kanjivg';
import { fromKanjiVG, type Stroke } from '../src/core/handwriting';
import { MemoryStorage } from './memory-storage';

// The little of the browser the screens use
Object.assign(globalThis, { window: { location: { search: '' }, scrollTo() {} }, alert() {} });

type Practice = typeof import('../src/app/practice');
let P: Practice;
let screen: { value: string };
let Records: typeof import('../src/core/records');

beforeAll(async () => {
    Records = await import('../src/core/records');
    Records.useStorage(new MemoryStorage());
    P = await import('../src/app/practice');
    screen = (await import('../src/app/state')).screen;
});

// The model drawn on a square of 327 pixels (3 per unit of KanjiVG)
const SIZE = 327;
const drawn = (kanji: string): Stroke[] => fromKanjiVG(models[kanji]).map(s => s.map(p => ({ x: p.x * 3, y: p.y * 3 })));

describe('なぞり練習', () => {
    it('chosen from the list: trace, write, back to the list; nothing recorded', async () => {
        const before = JSON.stringify(Records.load());
        P.practiseKanji('赤');
        await new Promise(r => setTimeout(r, 50));
        expect(screen.value).toBe('practice');
        expect(P.practice).toMatchObject({ view: 'kanji', stage: 'trace', traced: 0, from: 'list' });
        expect(P.practice.queue[0].phrase?.reading).toBeTruthy();
        const strokes = drawn('赤');
        // The second stroke first: taken away
        expect(P.traceStroke(strokes[1], SIZE)).toBe(false);
        expect(P.practice.message).toBe('もう一度 なぞろう');
        // The first one backwards
        expect(P.traceStroke([...strokes[0]].reverse(), SIZE)).toBe(false);
        expect(P.practice.message).toBe('1画目は 書く 向きに 気をつけよう');
        // Every stroke in turn
        strokes.forEach((s, i) => {
            expect(P.traceStroke(s, SIZE)).toBe(true);
            expect(P.practice.traced).toBe(i + 1);
        });
        expect(P.practice.stage).toBe('write');
        // Written without the model, in the wrong order: wrong, and which stroke
        const swapped = [...strokes];
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        P.submitWriting(swapped);
        expect(P.practice).toMatchObject({ stage: 'done', mark: 'incorrect', wrongStroke: 1 });
        // Trace again, then write it right
        P.retrace();
        expect(P.practice).toMatchObject({ stage: 'trace', traced: 0, mark: '' });
        strokes.forEach(s => P.traceStroke(s, SIZE));
        P.submitWriting(strokes);
        expect(P.practice).toMatchObject({ stage: 'done', mark: 'correct', message: 'よく 書けたね！' });
        expect(P.isLast()).toBe(true);
        P.nextKanji();
        expect(P.practice.view).toBe('list');
        expect(screen.value).toBe('practice');
        expect(JSON.stringify(Records.load())).toBe(before);
    });

    it('the kanji missed in a 手書き quiz, one after the other, then back to the result', async () => {
        await P.startPractice([{ kanji: '山', readings: ['やま', 'さん'], grade: 1 }, { kanji: '川', readings: ['かわ', 'せん'], grade: 1 }], 'result');
        expect(P.practice).toMatchObject({ from: 'result', index: 0, view: 'kanji' });
        P.nextKanji();
        expect(P.practice.queue[P.practice.index].kanji).toBe('川');
        expect(P.practice.stage).toBe('trace');
        P.nextKanji();
        expect(screen.value).toBe('result');
    });
});

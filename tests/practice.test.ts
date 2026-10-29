// The なぞり練習: trace stroke by stroke, then write without the model, each as many times as
// chosen; a writing counts only when it is right; nothing is recorded
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { strokes as models } from '../src/data/kanjivg';
import { fromKanjiVG, type Stroke } from '../src/core/handwriting';
import { MemoryStorage } from './memory-storage';

// The little of the browser the screens use
Object.assign(globalThis, { window: { location: { search: '' }, scrollTo() {} }, alert() {} });

let P: typeof import('../src/app/practice');
let state: typeof import('../src/app/state');
let Records: typeof import('../src/core/records');

beforeAll(async () => {
    Records = await import('../src/core/records');
    Records.useStorage(new MemoryStorage());
    P = await import('../src/app/practice');
    state = await import('../src/app/state');
});

afterEach(() => {
    vi.useRealTimers();
});

// The model drawn on a square of 327 pixels (3 per unit of KanjiVG)
const SIZE = 327;
const drawn = (kanji: string): Stroke[] => fromKanjiVG(models[kanji]).map(s => s.map(p => ({ x: p.x * 3, y: p.y * 3 })));
// Opens a kanji and lets its pauses be skipped
async function open(kanji: string) {
    P.practiseKanji(kanji);
    await vi.waitFor(() => expect(P.practice.view === 'kanji' && P.practice.queue[0]?.kanji === kanji).toBe(true));
    vi.useFakeTimers();
}
const traceAll = (strokes: Stroke[]) => strokes.forEach(s => expect(P.traceStroke(s, SIZE)).toBe(true));
const pause = () => vi.advanceTimersByTime(2000);

describe('なぞり練習', () => {
    it('once each (until chosen): trace, write, back to the list; nothing recorded', async () => {
        const before = JSON.stringify(Records.load());
        await open('赤');
        expect(state.screen.value).toBe('practice');
        expect(P.practice).toMatchObject({ stage: 'trace', traced: 0, from: 'list', traceRounds: 0, writeRounds: 0 });
        const strokes = drawn('赤');
        // The second stroke first: taken away
        expect(P.traceStroke(strokes[1], SIZE)).toBe(false);
        expect(P.practice.message).toBe('もう一度 なぞろう');
        // The first one backwards
        expect(P.traceStroke([...strokes[0]].reverse(), SIZE)).toBe(false);
        expect(P.practice.message).toBe('1画目は 書く 向きに 気をつけよう');
        traceAll(strokes);
        expect(P.practice.traceRounds).toBe(1);
        // Nothing can be written while the traced kanji is shown a moment
        expect(P.traceStroke(strokes[0], SIZE)).toBe(false);
        pause();
        expect(P.practice.stage).toBe('write');
        // Written in the wrong order: wrong, and which stroke; it does not count
        const swapped = [...strokes];
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        P.submitWriting(swapped);
        expect(P.practice).toMatchObject({ stage: 'done', mark: 'incorrect', wrongStroke: 1, writeRounds: 0, finished: false });
        // Trace once more: then back to writing
        P.retrace();
        expect(P.practice).toMatchObject({ stage: 'trace', traced: 0, mark: '' });
        traceAll(strokes);
        pause();
        expect(P.practice.stage).toBe('write');
        P.submitWriting(strokes);
        expect(P.practice).toMatchObject({ stage: 'done', mark: 'correct', finished: true, writeRounds: 1, message: 'よく 書けたね！' });
        expect(P.isLast()).toBe(true);
        P.nextKanji();
        expect(P.practice.view).toBe('list');
        expect(JSON.stringify(Records.load().progress)).toBe(JSON.stringify(JSON.parse(before).progress));
        expect(Records.load().kaki).toEqual(JSON.parse(before).kaki);
    });

    it('traced 3 times, then written right 2 times; a wrong writing is written again', async () => {
        P.setPracticeCounts(3, 2);
        await open('山');
        const strokes = drawn('山');
        for (let round = 1; round <= 3; round++) {
            expect(P.practice.stage).toBe('trace');
            traceAll(strokes);
            expect(P.practice.traceRounds).toBe(round);
            expect(P.practice.message).toBe(round < 3 ? 'よく なぞれたね！ もう一度 なぞろう' : 'よく なぞれたね！');
            pause();
        }
        expect(P.practice.stage).toBe('write');
        P.submitWriting(strokes);
        expect(P.practice).toMatchObject({ writeRounds: 1, mark: 'correct', finished: false, message: 'よく 書けたね！ あと 1回' });
        pause();
        expect(P.practice).toMatchObject({ stage: 'write', mark: '' });
        // Wrong: not counted, write again
        P.submitWriting([[{ x: 0, y: 0 }, { x: 300, y: 300 }]]);
        expect(P.practice).toMatchObject({ stage: 'done', mark: 'incorrect', writeRounds: 1 });
        P.rewrite();
        expect(P.practice.stage).toBe('write');
        P.submitWriting(strokes);
        expect(P.practice).toMatchObject({ stage: 'done', writeRounds: 2, finished: true });
    });

    it('the counts are kept (1 to 10), and fewer during a kanji moves it on', async () => {
        P.setPracticeCounts(15, 0);
        expect([state.selection.practiceTrace, state.selection.practiceWrite]).toEqual([10, 1]);
        expect(Records.getSettings()).toMatchObject({ practiceTrace: 10, practiceWrite: 1 });
        P.setPracticeCounts(3, 3);
        await open('川');
        const strokes = drawn('川');
        traceAll(strokes);
        pause();
        // Traced once of 3: now only once is asked, so on to writing
        P.setPracticeCounts(1, 3);
        expect(P.practice.stage).toBe('write');
        P.submitWriting(strokes);
        pause();
        // Written once of 3: now once is enough
        P.setPracticeCounts(1, 1);
        expect(P.practice).toMatchObject({ stage: 'done', finished: true });
        P.setPracticeCounts(1, 1);
    });

    it('chosen practice counts are stored in settings and restored on reload', () => {
        P.setPracticeCounts(7, 4);
        expect(Records.getSettings()).toMatchObject({ practiceTrace: 7, practiceWrite: 4 });

        // Simulate a new session / reload: selection starts with defaults, then restored from storage
        state.selection.practiceTrace = 1;
        state.selection.practiceWrite = 1;
        state.restoreSelection();
        expect(state.selection.practiceTrace).toBe(7);
        expect(state.selection.practiceWrite).toBe(4);
    });

    it('the kanji missed in a 手書き quiz, one after the other, then back to the result', async () => {
        await P.startPractice([{ kanji: '山', readings: ['やま', 'さん'], grade: 1 }, { kanji: '川', readings: ['かわ', 'せん'], grade: 1 }], 'result');
        expect(P.practice).toMatchObject({ from: 'result', index: 0, view: 'kanji' });
        P.nextKanji();
        expect(P.practice.queue[P.practice.index].kanji).toBe('川');
        expect(P.practice).toMatchObject({ stage: 'trace', traceRounds: 0, writeRounds: 0 });
        P.nextKanji();
        expect(state.screen.value).toBe('result');
    });
});

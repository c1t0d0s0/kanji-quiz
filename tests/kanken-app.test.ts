// The 漢検もぎ試験 as the child takes it: any question in any order (from the list), answers
// that can be changed, and nothing marked until the exam is handed in or the time is up
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './memory-storage';

Object.assign(globalThis, { window: { location: { search: '' }, scrollTo() {} }, alert() {} });
vi.mock('../src/core/sound', () => ({ initAudio() {}, playResultSound() {} }));

let K: typeof import('../src/app/kanken');

beforeAll(async () => {
    const Records = await import('../src/core/records');
    Records.useStorage(new MemoryStorage());
    K = await import('../src/app/kanken');
    // After Vue is loaded (it looks for a real document): only what moving the focus away reads
    Object.assign(globalThis, { document: { activeElement: null } });
});

afterEach(() => {
    K.quitKanken();
    vi.useRealTimers();
});

// The index of the right choice, or of a wrong one, of the question shown
function pick(ok: boolean) {
    const q = K.current();
    if (!q || q.kind !== 'choice') throw new Error('not a 4択');
    return q.choices.findIndex(c => (c === q.answer) === ok);
}
const firstChoice = () => K.exam.questions.findIndex(q => q.kind === 'choice');

describe('漢検: any order', () => {
    it('answers the question chosen, then goes on to the next one not answered', async () => {
        await K.startKanken(8, 'mini');
        expect(K.exam.view).toBe('question');
        expect(K.exam.index).toBe(0);
        K.goTo(2);
        K.choose(pick(true));
        expect(K.exam.answers[2]?.ok).toBe(true);
        expect(K.answeredCount()).toBe(1);
        expect(K.exam.index).toBe(3);
        // Question 3 is skipped when going on from question 1
        K.goTo(1);
        K.choose(pick(false));
        expect(K.exam.index).toBe(3);
        expect(K.exam.phase).toBe('exam');
    });

    it('an answer can be changed until the exam is handed in', async () => {
        await K.startKanken(8, 'mini');
        const i = firstChoice();
        K.goTo(i);
        K.choose(pick(false));
        expect(K.exam.answers[i]?.ok).toBe(false);
        K.goTo(i);
        K.choose(pick(true));
        expect(K.exam.answers[i]?.ok).toBe(true);
        expect(K.answeredCount()).toBe(1);
    });

    it('all answered: the list, not the result; handing in marks it', async () => {
        await K.startKanken(10, 'mini');
        const n = K.exam.questions.length;
        // Every question in turn: the 4択 right, the 書き取り left out (not written)
        for (let i = 0; i < n; i++) {
            K.goTo(i);
            const q = K.current()!;
            if (q.kind === 'choice') K.choose(pick(true));
            else K.exam.answers[i] = { ok: false, text: '（ちがう 字）', strokes: [] };
        }
        expect(K.answeredCount()).toBe(n);
        expect(K.exam.phase).toBe('exam');
        K.submit();
        expect(K.exam.phase).toBe('result');
        const kaki = K.exam.questions.filter(q => q.kind === 'kaki').length;
        expect(K.exam.missed).toHaveLength(kaki);
        expect(K.exam.timedOut).toBe(false);
    });

    it('handing in with questions not answered asks first; they are wrong', async () => {
        await K.startKanken(8, 'mini');
        const i = firstChoice();
        K.goTo(i);
        K.choose(pick(true));
        K.submit();
        expect(K.exam.phase).toBe('exam');
        expect([K.exam.view, K.exam.confirming]).toEqual(['list', true]);
        K.cancelSubmit();
        expect(K.exam.confirming).toBe(false);
        K.submit();
        K.submit();
        expect(K.exam.phase).toBe('result');
        expect(K.exam.missed).toHaveLength(K.exam.questions.length - 1);
        expect(K.exam.missed.every(m => m.given === K.NOT_ANSWERED)).toBe(true);
    });

    it('time up: marked as it is, the questions not answered are 時間切れ', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        await K.startKanken(8, 'mini');
        const i = firstChoice();
        K.goTo(i);
        K.choose(pick(false));
        vi.advanceTimersByTime(11 * 60_000);
        expect(K.exam.phase).toBe('result');
        expect(K.exam.timedOut).toBe(true);
        const missed = new Map(K.exam.missed.map(m => [m.question, m.given]));
        expect(missed.get(K.exam.questions[i])).not.toBe(K.TIME_UP);
        expect([...missed.values()].filter(g => g === K.TIME_UP)).toHaveLength(K.exam.questions.length - 1);
    });
});

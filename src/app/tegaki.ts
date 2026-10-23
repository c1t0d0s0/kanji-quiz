// --- 手書き and なぞり練習: the strokes of KanjiVG and the judging ---
// Loaded the first time a 手書き quiz or a 練習 starts, so the other quizzes do not wait for them.
import type { JudgeOptions, Stroke, TraceResult, Verdict } from '../core/handwriting';

export interface TegakiKit {
    strokes: Record<string, number[][]>;
    judge(writing: readonly Stroke[], model: readonly (readonly number[])[], grade: number, options?: JudgeOptions): Verdict;
    trace(written: Stroke, model: readonly (readonly number[])[], index: number, size: number): TraceResult;
}

let loading: Promise<TegakiKit> | null = null;

export function loadTegaki(): Promise<TegakiKit> {
    if (!loading) {
        loading = Promise.all([import('../data/kanjivg'), import('../core/handwriting')]).then(([data, handwriting]) => ({
            strokes: data.strokes,
            judge: handwriting.judge,
            trace: handwriting.traceStroke
        }));
        // Offline: try again next time
        loading.catch(() => {
            loading = null;
        });
    }
    return loading;
}

// The kit, or null (and a word to the child) when it could not be loaded
export async function tegakiKitOrSay(): Promise<TegakiKit | null> {
    try {
        return await loadTegaki();
    } catch (e) {
        console.error('手書き could not be loaded', e);
        alert('じゅんびが できませんでした。インターネットに つながってから、もう一度 おしてね。');
        return null;
    }
}

// Says what went wrong, so the child knows what to look at in the model
export function verdictMessage(verdict: Verdict) {
    if (verdict.reason === 'count') return `${verdict.expected}画で 書こう`;
    if (verdict.order?.kind === 'order') return `${verdict.order.stroke}画目の 書き順が ちがうよ`;
    if (verdict.order?.kind === 'direction') return `${verdict.order.stroke}画目の 書く 向きが ちがうよ`;
    return 'おしい！ お手本と くらべよう';
}

// The canvas of the quiz screen (TegakiArea.vue gives these when it is mounted)
export const tegakiPad = {
    strokes: (): Stroke[] => [],
    clear: () => {}
};

// --- 手書き and なぞり練習: the strokes of KanjiVG and the judging ---
// Loaded the first time a 手書き quiz or a 練習 starts, so the other quizzes do not wait for them.
import type { Hint, JudgeOptions, Stroke, TraceResult, Verdict } from '../core/handwriting';

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

// What a near miss got wrong, in a few words
function hintMessage(hint: Hint) {
    const n = hint.stroke;
    switch (hint.kind) {
        case 'missing': return `${n}画目が 書けていないよ`;
        case 'extra': return 'よけいな 線が あるよ';
        case 'longer': return `${n}画目を もっと 長く 書こう`;
        case 'shorter': return `${n}画目を もっと 短く 書こう`;
        case 'poke': return `${n}画目は つき出すよ`;
        case 'stop': return `${n}画目は つき出さないよ`;
        case 'place': return `${n}画目の 場所や 形を くらべよう`;
    }
}

// Says what went wrong, so the child knows what to look at in the model
export function verdictMessage(verdict: Verdict) {
    if (verdict.reason === 'count') return verdict.hint ? `${hintMessage(verdict.hint)}（${verdict.expected}画）` : `${verdict.expected}画で 書こう`;
    if (verdict.order?.kind === 'order') return `${verdict.order.stroke}画目の 書き順が ちがうよ`;
    if (verdict.order?.kind === 'direction') return `${verdict.order.stroke}画目の 書く 向きが ちがうよ`;
    if (verdict.hint) return `おしい！ ${hintMessage(verdict.hint)}`;
    return 'おしい！ お手本と くらべよう';
}

// Where to look after a wrong answer: a stroke of the model (its number), and a stroke as it was
// written (its index) when it is one the model does not have
export function verdictMarks(verdict: Verdict | null) {
    const hint = verdict?.hint;
    return {
        stroke: verdict?.order?.stroke ?? (hint && hint.kind !== 'extra' ? hint.stroke : null),
        written: hint?.kind === 'extra' ? (hint.written ?? null) : null
    };
}

// The canvas of the quiz screen (TegakiArea.vue gives these when it is mounted)
export const tegakiPad = {
    strokes: (): Stroke[] => [],
    clear: () => {}
};

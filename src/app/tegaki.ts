// --- 手書き: the strokes of KanjiVG and the judging ---
// Loaded the first time a 手書き quiz starts, so the other quizzes do not wait for them.
import type { JudgeOptions, Stroke, Verdict } from '../core/handwriting';

export interface TegakiKit {
    strokes: Record<string, number[][]>;
    judge(writing: readonly Stroke[], model: readonly (readonly number[])[], grade: number, options?: JudgeOptions): Verdict;
}

let loading: Promise<TegakiKit> | null = null;

export function loadTegaki(): Promise<TegakiKit> {
    if (!loading) {
        loading = Promise.all([import('../data/kanjivg'), import('../core/handwriting')]).then(([data, handwriting]) => ({
            strokes: data.strokes,
            judge: handwriting.judge
        }));
        // Offline: try again next time
        loading.catch(() => {
            loading = null;
        });
    }
    return loading;
}

// The canvas of the quiz screen (TegakiArea.vue gives these when it is mounted)
export const tegakiPad = {
    strokes: (): Stroke[] => [],
    clear: () => {}
};

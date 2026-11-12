// --- 漢検もぎ試験: one exam, from the first question to the result ---
// As in the real exam there is no time limit and nothing is marked until the end. 書き取り is
// written by hand and judged like the 手書き quiz (the stroke order is not judged).
import { reactive } from 'vue';
import type { Stroke } from '../core/handwriting';
import {
    MAX_SCORE, kankenTitle, levelOf, passes, recordId, scoreOf, sectionLabel, sectionScores, type KankenQuestion, type Kyu
} from '../core/kanken';
import * as Records from '../core/records';
import { initAudio, playResultSound } from '../core/sound';
import { blurActive, goHome, showScreen } from './state';
import { tegakiKitOrSay, type TegakiKit } from './tegaki';

export interface Missed {
    question: KankenQuestion;
    // What was chosen or written ('' for 「わからない」)
    given: string;
}

export const exam = reactive({
    phase: 'exam' as 'exam' | 'result',
    kyu: 10 as Kyu,
    questions: [] as KankenQuestion[],
    index: 0,
    // 誤字訂正: the kanji picked as wrong in the first step, '' before
    found: '',
    // Goes up for every question, so the writing square is cleared
    turn: 0,
    // The result
    score: 0,
    pass: 0,
    passed: false,
    sections: [] as { label: string; got: number; max: number }[],
    missed: [] as Missed[],
    bestNote: null as null | { text: string; isNew: boolean },
    // A new title won with this exam ("漢検8級相当"), '' when none
    newTitle: ''
});

let kit: TegakiKit | null = null;
let right: boolean[] = [];
let given: string[] = [];

export const current = () => exam.questions[exam.index] as KankenQuestion | undefined;
export const sectionOf = (q: KankenQuestion) => sectionLabel(q.section, levelOf(exam.kyu));

// The questions and their data, loaded with the first exam (like the models of 手書き)
let loading: Promise<typeof import('../core/kanken-exam')> | null = null;
async function examMaker() {
    loading ??= import('../core/kanken-exam');
    try {
        return await loading;
    } catch (e) {
        loading = null;
        console.error('漢検 could not be loaded', e);
        alert('じゅんびが できませんでした。インターネットに つながってから、もう一度 おしてね。');
        return null;
    }
}

export async function startKanken(kyu: Kyu) {
    initAudio();
    // 書き取り needs the models of the kanji
    if (!(kit ??= await tegakiKitOrSay())) return;
    const maker = await examMaker();
    if (!maker) return;
    exam.kyu = kyu;
    exam.questions = maker.buildExam(kyu);
    exam.index = 0;
    exam.found = '';
    exam.phase = 'exam';
    exam.turn++;
    right = [];
    given = [];
    showScreen('kanken');
}

function answer(ok: boolean, text: string) {
    blurActive();
    right[exam.index] = ok;
    given[exam.index] = text;
    exam.found = '';
    exam.index++;
    exam.turn++;
    if (exam.index >= exam.questions.length) finish();
}

// A 4択, or a step of the 誤字訂正
export function choose(i: number) {
    const q = current();
    if (!q || q.kind === 'kaki') return;
    if (q.kind === 'choice') {
        answer(q.choices[i] === q.answer, q.choices[i]);
        return;
    }
    if (!exam.found) {
        exam.found = q.find[i];
        blurActive();
        return;
    }
    answer(exam.found === q.wrong && q.fix[i] === q.right, `${exam.found} → ${q.fix[i]}`);
}

// 誤字訂正: back to the first step
export function unfind() {
    exam.found = '';
}

export function submitWriting(strokes: readonly Stroke[]) {
    const q = current();
    if (!q || q.kind !== 'kaki' || !kit || strokes.length === 0) return;
    const verdict = kit.judge(strokes, kit.strokes[q.kanji] ?? [], q.grade, { strokeOrder: false });
    answer(verdict.ok, verdict.ok ? q.kanji : '（ちがう 字）');
}

// 「わからない」: on to the next question, as wrong
export function skip() {
    answer(false, '');
}

export const modelOf = (kanji: string) => kit?.strokes[kanji] ?? [];

function finish() {
    const level = levelOf(exam.kyu);
    const score = scoreOf(exam.questions, right);
    const titleBefore = kankenTitle(Records.getBest);
    const recorded = Records.recordResult(recordId(exam.kyu), score, MAX_SCORE);
    const titleAfter = kankenTitle(Records.getBest);
    Object.assign(exam, {
        phase: 'result',
        score,
        pass: level.pass,
        passed: passes(level, score),
        sections: sectionScores(exam.kyu, exam.questions, right),
        missed: exam.questions.map((question, i) => ({ question, given: given[i] ?? '' })).filter((_, i) => !right[i]),
        bestNote: recorded.previous
            ? { text: recorded.isBest ? 'じこベスト こうしん！' : `じこベスト ${recorded.previous.best}点`, isNew: recorded.isBest }
            : null,
        newTitle: titleAfter && titleAfter !== titleBefore ? titleAfter : ''
    });
    window.scrollTo(0, 0);
    playResultSound(score);
}

export function quitKanken() {
    goHome();
}

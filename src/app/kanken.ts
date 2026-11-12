// --- 漢検もぎ試験: one exam, from the first question to the result ---
// As in the real exam there is a time limit (40 minutes for 10級 to 8級, 60 for 7級 to 5級), and
// nothing is marked until the end: when the time is up, the questions not answered are wrong.
// 書き取り is written by hand and judged like the 手書き quiz (the stroke order is not judged).
import { reactive } from 'vue';
import type { Stroke } from '../core/handwriting';
import {
    examLevel, kankenTitle, levelOf, passes, recordId, scoreOf, sectionLabel, sectionScores, type ExamMode, type KankenQuestion, type Kyu
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
    mode: 'full' as ExamMode,
    questions: [] as KankenQuestion[],
    index: 0,
    // 誤字訂正: the kanji picked as wrong in the first step, '' before
    found: '',
    // Goes up for every question, so the writing square is cleared
    turn: 0,
    // The seconds left
    left: 0,
    // The result: the score, the full score and the lowest that passes
    score: 0,
    max: 0,
    pass: 0,
    // The time ran out before the last question
    timedOut: false,
    passed: false,
    sections: [] as { label: string; got: number; max: number }[],
    missed: [] as Missed[],
    bestNote: null as null | { text: string; isNew: boolean },
    // A new title won with this exam ("漢検8級相当"), '' when none
    newTitle: ''
});

// What a question not reached in time shows as the answer given
export const TIME_UP = '（時間切れ）';

let kit: TegakiKit | null = null;
let clock: ReturnType<typeof setInterval> | undefined;
let endsAt = 0;
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

export async function startKanken(kyu: Kyu, mode: ExamMode = 'full') {
    initAudio();
    // 書き取り needs the models of the kanji
    if (!(kit ??= await tegakiKitOrSay())) return;
    const maker = await examMaker();
    if (!maker) return;
    exam.kyu = kyu;
    exam.mode = mode;
    exam.questions = maker.buildExam(kyu, Math.random, mode);
    exam.index = 0;
    exam.found = '';
    exam.phase = 'exam';
    exam.turn++;
    right = [];
    given = [];
    startClock(examLevel(kyu, mode).minutes);
    showScreen('kanken');
}

function startClock(minutes: number) {
    stopClock();
    endsAt = Date.now() + minutes * 60_000;
    exam.left = minutes * 60;
    clock = setInterval(() => {
        exam.left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        if (exam.left === 0) finish();
    }, 250);
}

function stopClock() {
    clearInterval(clock);
    clock = undefined;
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
    if (exam.phase !== 'exam') return;
    stopClock();
    // Time is up: the questions not answered are wrong
    const timedOut = exam.index < exam.questions.length;
    const level = examLevel(exam.kyu, exam.mode);
    const score = scoreOf(exam.questions, right);
    // Only the real exam counts for the title
    const titleBefore = kankenTitle(Records.getBest);
    const recorded = Records.recordResult(recordId(exam.kyu, exam.mode), score, level.max);
    const titleAfter = kankenTitle(Records.getBest);
    Object.assign(exam, {
        phase: 'result',
        score,
        max: level.max,
        timedOut,
        pass: level.pass,
        passed: passes(level, score),
        sections: sectionScores(level, exam.questions, right),
        missed: exam.questions.map((question, i) => ({ question, given: given[i] ?? (i >= exam.index ? TIME_UP : '') })).filter((_, i) => !right[i]),
        bestNote: recorded.previous
            ? { text: recorded.isBest ? 'じこベスト こうしん！' : `じこベスト ${recorded.previous.best}点`, isNew: recorded.isBest }
            : null,
        newTitle: titleAfter && titleAfter !== titleBefore ? titleAfter : ''
    });
    window.scrollTo(0, 0);
    playResultSound(Math.round((score / level.max) * 100));
}

export function quitKanken() {
    stopClock();
    goHome();
}

// --- 漢検もぎ試験: one exam, from the first question to the result ---
// As in the real exam the questions can be answered in any order (from the list of all of them),
// and an answer can be changed until the exam is handed in. Nothing is marked until then. There
// is a time limit (40 minutes for 10級 to 8級, 60 for 7級 to 5級): when the time is up the exam
// is marked as it is. A question not answered is wrong.
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

// The answer given to a question (it can still be changed)
export interface Answer {
    ok: boolean;
    // What was chosen or written, as shown in the result
    text: string;
    // 4択: the choice picked
    choice?: string;
    // 書き取り: the writing, in a square of side 1, to show it again
    strokes?: Stroke[];
}

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
    // The question shown, and the answers so far (null: not answered)
    index: 0,
    answers: [] as (Answer | null)[],
    // The question or the list of all of them; confirming: asked "hand it in?" (questions not answered)
    view: 'question' as 'question' | 'list',
    confirming: false,
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
    // The time ran out (the exam was not handed in)
    timedOut: false,
    passed: false,
    sections: [] as { label: string; got: number; max: number }[],
    missed: [] as Missed[],
    bestNote: null as null | { text: string; isNew: boolean },
    // A new title won with this exam ("漢検8級相当"), '' when none
    newTitle: ''
});

// What a question not answered shows as the answer given
export const TIME_UP = '（時間切れ）';
export const NOT_ANSWERED = '（答えなかった）';

let kit: TegakiKit | null = null;
let clock: ReturnType<typeof setInterval> | undefined;
let endsAt = 0;

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
    exam.answers = exam.questions.map(() => null);
    exam.view = 'question';
    exam.confirming = false;
    exam.found = '';
    exam.phase = 'exam';
    exam.turn++;
    startClock(examLevel(kyu, mode).minutes);
    showScreen('kanken');
}

function startClock(minutes: number) {
    stopClock();
    endsAt = Date.now() + minutes * 60_000;
    exam.left = minutes * 60;
    clock = setInterval(() => {
        exam.left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        if (exam.left === 0) finish(true);
    }, 250);
}

function stopClock() {
    clearInterval(clock);
    clock = undefined;
}

export const answeredCount = () => exam.answers.filter(Boolean).length;

// Shows a question (from the list, or one before or after)
export function goTo(i: number) {
    if (i < 0 || i >= exam.questions.length) return;
    blurActive();
    exam.index = i;
    exam.found = '';
    exam.view = 'question';
    exam.confirming = false;
    exam.turn++;
}

export const prev = () => goTo(exam.index - 1);
export const next = () => goTo(exam.index + 1);

export function openList() {
    blurActive();
    exam.found = '';
    exam.view = 'list';
    exam.confirming = false;
}

// The next question not answered after this one (from the start again), or -1
function nextOpen(from: number) {
    const n = exam.questions.length;
    for (let k = 1; k <= n; k++) {
        const i = (from + k) % n;
        if (!exam.answers[i]) return i;
    }
    return -1;
}

function answer(given: Answer) {
    exam.answers[exam.index] = given;
    // On to the next question not answered; when all are, to the list to hand the exam in
    const i = nextOpen(exam.index);
    if (i < 0) openList();
    else goTo(i);
}

// A 4択, or a step of the 誤字訂正
export function choose(i: number) {
    const q = current();
    if (!q || q.kind === 'kaki') return;
    if (q.kind === 'choice') {
        answer({ ok: q.choices[i] === q.answer, text: q.choices[i], choice: q.choices[i] });
        return;
    }
    if (!exam.found) {
        exam.found = q.find[i];
        blurActive();
        return;
    }
    answer({ ok: exam.found === q.wrong && q.fix[i] === q.right, text: `${exam.found} → ${q.fix[i]}` });
}

// 誤字訂正: back to the first step
export function unfind() {
    exam.found = '';
}

// The writing is judged now; saved (in a square of side 1) is kept to show it again
export function submitWriting(strokes: readonly Stroke[], saved: Stroke[] = []) {
    const q = current();
    if (!q || q.kind !== 'kaki' || !kit || strokes.length === 0) return;
    const verdict = kit.judge(strokes, kit.strokes[q.kanji] ?? [], q.grade, { strokeOrder: false });
    answer({ ok: verdict.ok, text: verdict.ok ? q.kanji : '（ちがう 字）', strokes: saved });
}

// 「答え合わせ」: asks first when questions are not answered
export function submit() {
    if (answeredCount() < exam.questions.length && !exam.confirming) {
        exam.view = 'list';
        exam.confirming = true;
        return;
    }
    finish(false);
}

export function cancelSubmit() {
    exam.confirming = false;
}

export const modelOf = (kanji: string) => kit?.strokes[kanji] ?? [];

function finish(timedOut: boolean) {
    if (exam.phase !== 'exam') return;
    stopClock();
    // The questions not answered are wrong
    const right = exam.answers.map(a => Boolean(a?.ok));
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
        missed: exam.questions.map((question, i) => ({ question, given: exam.answers[i]?.text ?? (timedOut ? TIME_UP : NOT_ANSWERED) })).filter((_, i) => !right[i]),
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

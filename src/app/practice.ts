// --- なぞり練習: trace the model stroke by stroke, then write the kanji without it ---
// Opened from the home screen (a kanji chosen from the list of a grade) or from the result of
// a 手書き quiz (the kanji missed, one after the other). Nothing is recorded: no じこベスト, no
// ずかん. There is no time limit. Each kanji is traced, then written, as many times as chosen
// (selection.practiceTrace / practiceWrite); a writing counts only when it is right.
import { reactive } from 'vue';
import { kanjiDatabase, type KanjiItem } from '../data/kanji';
import { reibunList, type Reibun } from '../data/reibun';
import type { Stroke, TraceResult } from '../core/handwriting';
import { initAudio, playSound } from '../core/sound';
import { choosePracticeCounts, selection, showScreen } from './state';
import { tegakiKitOrSay, verdictMessage, type TegakiKit } from './tegaki';

export interface PracticeItem extends KanjiItem {
    phrase: Reibun | null;
}

export type Stage = 'trace' | 'write' | 'done';

export const practice = reactive({
    // The list of a grade to choose from, or one kanji being practised
    view: 'list' as 'list' | 'kanji',
    listGrade: 1,
    // Where to go back to when the kanji are done
    from: 'list' as 'list' | 'result',
    queue: [] as PracticeItem[],
    index: 0,
    stage: 'trace' as Stage,
    model: [] as number[][],
    // How many strokes have been traced
    traced: 0,
    // How many times the kanji has been traced, and written right without the model
    traceRounds: 0,
    writeRounds: 0,
    // Tracing once more after a wrong writing (then back to writing)
    retracing: false,
    // A short pause to look at what was just done, before the square is cleaned
    waiting: false,
    // Traced and written as many times as chosen
    finished: false,
    message: '',
    messageKind: '' as '' | 'correct' | 'incorrect',
    // After writing without the model: right or not, and the stroke to look at again
    mark: '' as '' | 'correct' | 'incorrect',
    wrongStroke: null as number | null,
    // Goes up whenever the square must be cleaned
    turn: 0
});

let kit: TegakiKit | null = null;
let pause: ReturnType<typeof setTimeout> | undefined;
// How long the finished kanji stays before the square is cleaned for the next round
const TRACE_PAUSE_MS = 700;
const WRITE_PAUSE_MS = 1200;

const current = () => practice.queue[practice.index];

function say(text: string, kind: '' | 'correct' | 'incorrect' = '') {
    practice.message = text;
    practice.messageKind = kind;
}

// One of the phrases of the kanji, to show what it is used for
function withPhrase(item: KanjiItem): PracticeItem {
    return { ...item, phrase: reibunList.get(item.kanji)?.[0] ?? null };
}

// --- The list ---
export async function openPracticeList() {
    initAudio();
    if (!(kit ??= await tegakiKitOrSay())) return;
    const grade = Number(selection.grade);
    practice.listGrade = grade >= 1 && grade <= 6 ? grade : 1;
    practice.view = 'list';
    showScreen('practice');
}

export function practiseKanji(kanji: string) {
    const item = kanjiDatabase.find(k => k.kanji === kanji);
    if (item) void startPractice([item], 'list');
}

// --- Practising ---
export async function startPractice(items: readonly KanjiItem[], from: 'list' | 'result') {
    initAudio();
    if (!(kit ??= await tegakiKitOrSay())) return;
    practice.queue = items.map(withPhrase);
    practice.index = 0;
    practice.from = from;
    practice.view = 'kanji';
    beginKanji();
    showScreen('practice');
}

function stopPause() {
    clearTimeout(pause);
    practice.waiting = false;
}

// Waits a little, then goes on (unless something else happened in the meantime)
function after(ms: number, then: () => void) {
    stopPause();
    practice.waiting = true;
    pause = setTimeout(() => {
        practice.waiting = false;
        then();
    }, ms);
}

function beginKanji() {
    practice.model = kit?.strokes[current().kanji] ?? [];
    practice.traceRounds = 0;
    practice.writeRounds = 0;
    practice.retracing = false;
    practice.finished = false;
    startTrace();
}

function startTrace() {
    stopPause();
    practice.stage = 'trace';
    practice.traced = 0;
    practice.mark = '';
    practice.wrongStroke = null;
    practice.turn++;
    say('お手本の 1画目を なぞろう');
}

function startWrite() {
    stopPause();
    practice.stage = 'write';
    practice.retracing = false;
    practice.mark = '';
    practice.wrongStroke = null;
    practice.turn++;
    say(practice.writeRounds === 0 ? 'こんどは 見ないで 書いてみよう' : 'もう一度 見ないで 書こう', 'correct');
}

function finish() {
    stopPause();
    practice.stage = 'done';
    practice.finished = true;
    say('よく 書けたね！', 'correct');
}

// A stroke traced: kept when it follows the stroke asked, the right way round. Returns false
// when it does not (the square takes it away again)
export function traceStroke(stroke: Stroke, size: number): boolean {
    if (!kit || practice.stage !== 'trace' || practice.waiting) return false;
    const result: TraceResult = kit.trace(stroke, practice.model, practice.traced, size);
    if (result !== 'ok') {
        say(result === 'direction' ? `${practice.traced + 1}画目は 書く 向きに 気をつけよう` : 'もう一度 なぞろう', 'incorrect');
        return false;
    }
    practice.traced++;
    if (practice.traced < practice.model.length) {
        say(`${practice.traced + 1}画目を なぞろう`);
        return true;
    }
    // Every stroke traced: once more, or now without the model
    playSound(true, 1);
    practice.traceRounds = Math.min(practice.traceRounds + 1, selection.practiceTrace);
    if (!practice.retracing && practice.traceRounds < selection.practiceTrace) {
        say('よく なぞれたね！ もう一度 なぞろう', 'correct');
        after(TRACE_PAUSE_MS, startTrace);
    } else {
        say('よく なぞれたね！', 'correct');
        after(TRACE_PAUSE_MS, () => (practice.writeRounds >= selection.practiceWrite ? finish() : startWrite()));
    }
    return true;
}

// Written without the model: judged like the 手書き, always with the stroke order. Only a right
// writing counts
export function submitWriting(strokes: readonly Stroke[]) {
    if (!kit || practice.stage !== 'write' || practice.waiting || strokes.length === 0) return;
    const item = current();
    const verdict = kit.judge(strokes, practice.model, item.grade, { strokeOrder: true });
    practice.mark = verdict.ok ? 'correct' : 'incorrect';
    practice.wrongStroke = verdict.order?.stroke ?? null;
    if (!verdict.ok) {
        practice.stage = 'done';
        playSound(false);
        say(verdictMessage(verdict), 'incorrect');
        return;
    }
    playSound(true, 2);
    practice.writeRounds++;
    if (practice.writeRounds >= selection.practiceWrite) {
        finish();
        return;
    }
    say(`よく 書けたね！ あと ${selection.practiceWrite - practice.writeRounds}回`, 'correct');
    after(WRITE_PAUSE_MS, startWrite);
}

// After a wrong writing: write again (nothing counted), or trace once more and then write
export function rewrite() {
    startWrite();
}

export function retrace() {
    practice.retracing = true;
    startTrace();
}

// The strokes traced so far in this round are wiped, and the round starts again
export function restartTrace() {
    startTrace();
}

// Choose how many times to trace and to write; the kanji being practised follows at once
export function setPracticeCounts(trace: number, write: number) {
    choosePracticeCounts(trace, write);
    practice.traceRounds = Math.min(practice.traceRounds, selection.practiceTrace);
    if (practice.view !== 'kanji' || practice.waiting || practice.finished) return;
    if (practice.writeRounds >= selection.practiceWrite && (practice.stage !== 'trace' || practice.traceRounds >= selection.practiceTrace)) {
        finish();
    } else if (practice.stage === 'trace' && !practice.retracing && practice.traceRounds >= selection.practiceTrace) {
        startWrite();
    }
}

export function nextKanji() {
    stopPause();
    if (practice.index + 1 < practice.queue.length) {
        practice.index++;
        beginKanji();
    } else {
        exitPractice();
    }
}

export function exitPractice() {
    stopPause();
    if (practice.from === 'result') {
        showScreen('result');
    } else {
        practice.view = 'list';
        showScreen('practice');
    }
}

export const isLast = () => practice.index + 1 >= practice.queue.length;

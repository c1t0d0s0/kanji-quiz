// --- なぞり練習: trace the model stroke by stroke, then write the kanji without it ---
// Opened from the home screen (a kanji chosen from the list of a grade) or from the result of
// a 手書き quiz (the kanji missed, one after the other). Nothing is recorded: no じこベスト, no
// ずかん. There is no time limit.
import { reactive } from 'vue';
import { kanjiDatabase, type KanjiItem } from '../data/kanji';
import { reibunList, type Reibun } from '../data/reibun';
import type { Stroke, TraceResult } from '../core/handwriting';
import { initAudio, playSound } from '../core/sound';
import { selection, showScreen } from './state';
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
    message: '',
    messageKind: '' as '' | 'correct' | 'incorrect',
    // After writing without the model: right or not, and the stroke to look at again
    mark: '' as '' | 'correct' | 'incorrect',
    wrongStroke: null as number | null,
    // Goes up whenever the square must be cleaned
    turn: 0
});

let kit: TegakiKit | null = null;

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

function beginKanji() {
    practice.model = kit?.strokes[current().kanji] ?? [];
    practice.stage = 'trace';
    practice.traced = 0;
    practice.mark = '';
    practice.wrongStroke = null;
    practice.turn++;
    say('お手本の 1画目を なぞろう');
}

// A stroke traced: kept when it follows the stroke asked, the right way round. Returns false
// when it does not (the square takes it away again)
export function traceStroke(stroke: Stroke, size: number): boolean {
    if (!kit || practice.stage !== 'trace') return false;
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
    // Every stroke traced: now without the model
    playSound(true, 1);
    practice.stage = 'write';
    practice.turn++;
    say('こんどは 見ないで 書いてみよう', 'correct');
    return true;
}

// Written without the model: judged like the 手書き, always with the stroke order
export function submitWriting(strokes: readonly Stroke[]) {
    if (!kit || practice.stage !== 'write' || strokes.length === 0) return;
    const item = current();
    const verdict = kit.judge(strokes, practice.model, item.grade, { strokeOrder: true });
    practice.stage = 'done';
    practice.mark = verdict.ok ? 'correct' : 'incorrect';
    practice.wrongStroke = verdict.order?.stroke ?? null;
    if (verdict.ok) {
        playSound(true, 2);
        say('よく 書けたね！', 'correct');
    } else {
        playSound(false);
        say(verdictMessage(verdict), 'incorrect');
    }
}

// Back to tracing the same kanji
export function retrace() {
    beginKanji();
}

export function nextKanji() {
    if (practice.index + 1 < practice.queue.length) {
        practice.index++;
        beginKanji();
    } else {
        exitPractice();
    }
}

export function exitPractice() {
    if (practice.from === 'result') {
        showScreen('result');
    } else {
        practice.view = 'list';
        showScreen('practice');
    }
}

export const isLast = () => practice.index + 1 >= practice.queue.length;

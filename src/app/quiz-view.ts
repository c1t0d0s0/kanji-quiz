// --- What the quiz screen shows ---
// Written by the one-player quiz (session.ts) and by the 意味かるた たいせん (battle/controller.ts),
// which uses the same screen with the same field of cards.
import { reactive } from 'vue';
import type { JukugoItem } from '../data/jukugo';
import type { Reibun } from '../data/reibun';
import { kanjiReadings, type KanjiQuestion, type Mode, type Tile } from '../core/quiz';

export type CardState = '' | 'is-correct' | 'is-wrong' | 'is-answer' | 'is-picked';

export interface KarutaCard {
    item: JukugoItem;
    taken: boolean;
    state: CardState;
}

// The kanji with all its readings (the one asked is marked), or a 熟語 with the readings of its kanji
export type AnswerNote =
    | { kind: 'kanji'; kanji: string; readings: { text: string; asked: boolean }[] }
    | { kind: 'word'; word: string; reading: string; parts: string[] };

export interface ScoreRow {
    seat: string;
    name: string;
    cards: number;
    me: boolean;
    online: boolean;
}

export const quiz = reactive({
    mode: 'k-to-y' as Mode,
    battle: false,
    counter: '',
    badge: '',
    timer: '',
    timerWarning: false,
    // 0..100
    progress: 0,
    question: '',
    questionKind: 'text' as 'text' | 'kanji' | 'countdown',
    // 熟語くみたて and 手書き: the meaning of the word, as a hint
    hint: null as string | null,
    // 手書き: the phrase asking for the kanji ("(あか)いくつ"), shown instead of question
    phrase: null as Reibun | null,
    options: [] as { text: string; state: '' | 'correct' | 'incorrect' }[],
    optionsKanji: false,
    optionsLocked: false,
    build: null as null | { tiles: Tile[]; slots: (number | null)[]; locked: boolean; mark: '' | 'correct' | 'incorrect' },
    // 手書き: the model of KanjiVG (shown after the answer); the writing is kept by the canvas
    // wrongStroke: the stroke written out of order or backwards (its number), shown in the model
    tegaki: null as null | { model: number[][]; locked: boolean; mark: '' | 'correct' | 'incorrect'; wrongStroke: number | null },
    karuta: null as null | {
        cards: KarutaCard[];
        // The card of the meaning asked, -1 before the first question
        answer: number;
        locked: boolean;
        // Every card disabled (the answer is shown)
        finished: boolean;
        // A card to scroll to (the right one, when it was not taken here); count makes each request new
        scrollTo: { index: number; count: number } | null;
    },
    feedback: { text: '', kind: '' as '' | 'correct' | 'incorrect', combo: 0 },
    note: null as AnswerNote | null,
    // 意味かるた たいせん: the cards each player has taken
    scores: [] as ScoreRow[],
    // Goes up for every question, so what animates once per question starts again
    turn: 0
});

export function clearFeedback() {
    quiz.feedback = { text: '', kind: '', combo: 0 };
    quiz.note = null;
    quiz.timerWarning = false;
}

// Shows the kanji with all its readings, so every question also teaches something.
// For a 熟語, the word with its reading, and the readings of each of its kanji.
export function kanjiNote(item: KanjiQuestion): AnswerNote {
    return { kind: 'kanji', kanji: item.kanji, readings: item.readings.map(text => ({ text, asked: text === item.targetReading })) };
}

export function wordNote(item: Pick<JukugoItem, 'word' | 'reading'>): AnswerNote {
    const parts = [...new Set(item.word)].map(k => `${k} ${(kanjiReadings.get(k) || []).slice(0, 3).join('・')}`);
    return { kind: 'word', word: item.word, reading: item.reading, parts };
}

// The field of the 意味かるた (also the 対戦's, shared by everyone)
export function layField(items: JukugoItem[]) {
    quiz.karuta = { cards: items.map(item => ({ item, taken: false, state: '' })), answer: -1, locked: true, finished: false, scrollTo: null };
}

// The card of the last question leaves the field; its place stays empty, so the others do not move
export function nextCard(item: JukugoItem) {
    const k = quiz.karuta;
    if (!k) return;
    if (k.answer !== -1) k.cards[k.answer].taken = true;
    k.answer = k.cards.findIndex(card => card.item.word === item.word);
    k.cards.forEach(card => {
        card.state = '';
    });
    k.finished = false;
    k.locked = false;
}

export function showCard(index: number) {
    const k = quiz.karuta;
    if (!k) return;
    k.scrollTo = { index, count: (k.scrollTo?.count ?? 0) + 1 };
}

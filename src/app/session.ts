// --- The one-player quiz: 漢字から読み, 読みから漢字, 熟語くみたて, 意味かるた ---
import { reactive } from 'vue';
import type { JukugoItem } from '../data/jukugo';
import * as Karuta from '../core/karuta';
import * as Lynx from '../core/lynx';
import {
    KANJI_KINDS, KUMITATE_TIME_LIMIT, NEXT_QUESTION_MS, TIME_LIMIT, choicesFor, earnedRewards, formatBest, isRightWord,
    kanjiKindOf, kanjiQuestions, makeTiles, rankOf, rewardNews, shuffle, type KanjiQuestion, type Mode
} from '../core/quiz';
import * as Records from '../core/records';
import { initAudio, playResultSound, playSound } from '../core/sound';
import { blurActive, goHome, selection, showScreen } from './state';
import { clearFeedback, kanjiNote, layField, nextCard, quiz, showCard, wordNote } from './quiz-view';

export type Question = KanjiQuestion | JukugoItem;
const isWord = (item: Question): item is JukugoItem => 'word' in item;

// What the result screen shows
export const result = reactive({
    mode: 'k-to-y' as Mode,
    total: 0,
    score: 0,
    percentage: 0,
    rank: rankOf(0),
    bestNote: null as null | { text: string; isNew: boolean },
    maxCombo: 0,
    rewardLines: [] as string[],
    newKanjiTitle: '',
    newKanji: [] as string[],
    newWords: [] as string[],
    missed: [] as Question[],
    // Goes up for every result, so its animations start again
    turn: 0
});

let questions: Question[] = [];
let index = 0;
let score = 0;
let combo = 0;
let maxCombo = 0;
let missed: Question[] = [];
let correctKanji: string[] = [];
let correctWords: string[] = [];
// The record of this quiz setting (mode + grade + count); null for a review
let itemId: string | null = null;
let timeLeft = 0;
let timerInterval: ReturnType<typeof setInterval> | undefined;
let nextTimeout: ReturnType<typeof setTimeout> | undefined;

const current = () => questions[index];

// reviewItems: the questions missed last time, asked again with the same readings
export function startQuiz(mode: Mode, reviewItems?: Question[]) {
    initAudio();
    stopQuiz();
    quiz.mode = mode;
    quiz.battle = false;
    quiz.scores = [];
    index = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    missed = [];
    correctKanji = [];
    correctWords = [];

    if (reviewItems) {
        questions = shuffle([...reviewItems]);
        itemId = null;
    } else if (mode === 'karuta') {
        questions = Karuta.pickWords(shuffle(Karuta.wordsFor(selection.grade)), [], selection.count);
        itemId = Records.itemId(mode, selection.grade, selection.count);
    } else if (mode === 'kumitate') {
        const pool = shuffle(Karuta.wordsFor(selection.grade));
        questions = pool.slice(0, Math.min(selection.count, pool.length));
        itemId = Records.itemId(mode, selection.grade, selection.count);
    } else {
        questions = kanjiQuestions(selection.grade, selection.count);
        itemId = Records.itemId(mode, selection.grade, selection.count);
    }

    // The field is laid out once for the whole quiz: the words asked, and cards never asked
    if (mode === 'karuta') layField(Karuta.fieldFor(questions as JukugoItem[], Karuta.wordsFor(selection.grade), shuffle));
    else quiz.karuta = null;
    quiz.build = null;
    quiz.options = [];
    showScreen('quiz');
    displayQuestion();
}

export function review() {
    startQuiz(result.mode, result.missed);
}

export function quitQuiz() {
    stopQuiz();
    goHome();
}

export function stopQuiz() {
    clearInterval(timerInterval);
    clearTimeout(nextTimeout);
}

function resetQuestion() {
    clearInterval(timerInterval);
    clearFeedback();
    if (quiz.build) quiz.build.mark = '';
    blurActive();
}

function displayQuestion() {
    resetQuestion();
    if (index >= questions.length) {
        endQuiz();
        return;
    }
    const item = current();
    quiz.turn++;
    quiz.progress = (index / questions.length) * 100;
    quiz.counter = `第${index + 1}問 / ${questions.length}問`;
    quiz.badge = `${item.grade}年生`;
    quiz.hint = quiz.mode === 'kumitate' && isWord(item) ? item.meaning : null;

    if (quiz.mode === 'karuta' && isWord(item)) {
        quiz.question = item.meaning;
        quiz.questionKind = 'text';
        nextCard(item);
        startTimer(Karuta.timeLimit(quiz.karuta?.cards.length ?? 0));
        return;
    }
    if (quiz.mode === 'kumitate' && isWord(item)) {
        quiz.question = item.reading;
        quiz.questionKind = 'text';
        quiz.build = { tiles: makeTiles(item), slots: new Array([...item.word].length).fill(null), locked: false, mark: '' };
        startTimer(KUMITATE_TIME_LIMIT[[...item.word].length] || TIME_LIMIT);
        return;
    }
    if (isWord(item)) return;
    const mode = quiz.mode === 'y-to-k' ? 'y-to-k' : 'k-to-y';
    quiz.question = mode === 'k-to-y' ? item.kanji : item.targetReading;
    quiz.questionKind = mode === 'k-to-y' ? 'kanji' : 'text';
    quiz.optionsKanji = mode === 'y-to-k';
    quiz.options = choicesFor(mode, item).map(text => ({ text, state: '' }));
    quiz.optionsLocked = false;
    startTimer();
}

function startTimer(limit = TIME_LIMIT) {
    timeLeft = limit;
    quiz.timer = String(timeLeft);
    quiz.timerWarning = false;
    timerInterval = setInterval(() => {
        timeLeft--;
        quiz.timer = String(timeLeft);
        if (timeLeft <= 3) quiz.timerWarning = true;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
    }, 1000);
}

// A little longer than the answer takes to read
function goToNextQuestion() {
    nextTimeout = setTimeout(() => {
        index++;
        displayQuestion();
    }, NEXT_QUESTION_MS);
}

function rightAnswer() {
    quiz.feedback = { text: '正解！', kind: 'correct', combo: 0 };
    score++;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    if (combo >= 2) quiz.feedback.combo = combo;
    playSound(true, combo);
}

function wrongAnswer(item: Question, text: string) {
    quiz.feedback = { text, kind: 'incorrect', combo: 0 };
    combo = 0;
    missed.push(item);
    playSound(false);
}

// --- 漢字から読み / 読みから漢字 ---
function correctChoice(item: KanjiQuestion) {
    return quiz.mode === 'k-to-y' ? item.targetReading : item.kanji;
}

function markChoices(selected: string | null, correct: string) {
    quiz.options.forEach(option => {
        if (option.text === correct) option.state = 'correct';
        else if (option.text === selected) option.state = 'incorrect';
    });
}

export function choose(optionIndex: number) {
    if (quiz.optionsLocked) return;
    const item = current() as KanjiQuestion;
    clearInterval(timerInterval);
    blurActive();
    quiz.optionsLocked = true;
    const selected = quiz.options[optionIndex].text;
    const correct = correctChoice(item);
    if (selected === correct) {
        rightAnswer();
        correctKanji.push(item.kanji);
        markChoices(selected, correct);
    } else {
        wrongAnswer(item, '不正解...');
        markChoices(selected, correct);
    }
    quiz.note = kanjiNote(item);
    goToNextQuestion();
}

// --- 熟語くみたて ---
export function placeTile(tileIndex: number) {
    const build = quiz.build;
    if (!build) return;
    const next = build.slots.indexOf(null);
    if (build.locked || next === -1 || build.tiles[tileIndex].used) return;
    build.tiles[tileIndex].used = true;
    build.slots[next] = tileIndex;
    if (!build.slots.includes(null)) checkBuild();
}

// Puts the tile back, so a wrong pick can be fixed before the last square
export function returnTile(slotIndex: number) {
    const build = quiz.build;
    if (!build || build.locked) return;
    const tileIndex = build.slots[slotIndex];
    if (tileIndex === null) return;
    build.tiles[tileIndex].used = false;
    build.slots[slotIndex] = null;
}

function checkBuild() {
    const build = quiz.build;
    if (!build) return;
    const item = current() as JukugoItem;
    const built = build.slots.map(i => build.tiles[i as number].char).join('');
    const isCorrect = isRightWord(item, built);
    finishBuild(item, isCorrect ? built : null, isCorrect ? '正解！' : '不正解...');
}

// Shows the right word in the squares and moves on. built is the word made, or null.
function finishBuild(item: JukugoItem, built: string | null, message: string) {
    const build = quiz.build;
    if (!build) return;
    clearInterval(timerInterval);
    build.locked = true;
    if (!built) {
        // Fill the squares with the right answer, so it can be seen
        const taken: number[] = [];
        build.slots = [...item.word].map(char => {
            const i = build.tiles.findIndex((tile, j) => tile.char === char && !taken.includes(j));
            taken.push(i);
            return i;
        });
        build.tiles.forEach((tile, j) => {
            tile.used = taken.includes(j);
        });
    }
    build.mark = built ? 'correct' : 'incorrect';
    if (built) {
        rightAnswer();
        quiz.feedback.text = message;
        correctWords.push(built);
    } else {
        wrongAnswer(item, message);
    }
    quiz.note = wordNote(built ? { ...item, word: built } : item);
    goToNextQuestion();
}

// --- 意味かるた ---
// Only one card can be taken for each question; a wrong one (おてつき) ends the question
export function takeCard(cardIndex: number) {
    const k = quiz.karuta;
    if (!k || k.locked) return;
    const item = current() as JukugoItem;
    const isCorrect = cardIndex === k.answer;
    if (!isCorrect) k.cards[cardIndex].state = 'is-wrong';
    finishKaruta(item, isCorrect, isCorrect ? '正解！' : 'おてつき！');
}

function finishKaruta(item: JukugoItem, isCorrect: boolean, message: string) {
    const k = quiz.karuta;
    if (!k) return;
    clearInterval(timerInterval);
    k.locked = true;
    k.finished = true;
    k.cards[k.answer].state = isCorrect ? 'is-correct' : 'is-answer';
    // Show where the right card was, even when it is off the screen
    if (!isCorrect) showCard(k.answer);
    if (isCorrect) {
        rightAnswer();
        correctWords.push(item.word);
    } else {
        wrongAnswer(item, message);
    }
    quiz.note = wordNote(item);
    goToNextQuestion();
}

function handleTimeout() {
    const item = current();
    if (quiz.mode === 'kumitate') {
        finishBuild(item as JukugoItem, null, '時間切れ！');
        return;
    }
    if (quiz.mode === 'karuta') {
        finishKaruta(item as JukugoItem, false, '時間切れ！');
        return;
    }
    blurActive();
    quiz.optionsLocked = true;
    markChoices(null, correctChoice(item as KanjiQuestion));
    wrongAnswer(item, '時間切れ！');
    quiz.note = kanjiNote(item as KanjiQuestion);
    goToNextQuestion();
}

// --- Result ---
function endQuiz() {
    stopQuiz();
    const total = questions.length;
    const percentage = Math.round((score / total) * 100);
    const kind = kanjiKindOf(quiz.mode);

    const before = earnedRewards(Records.getCollected('yomi'), Records.getCollected('kaki'), Records.getCollectedWords());
    const recorded = Records.recordResult(itemId, score, total, correctKanji, correctWords, kind);
    const after = earnedRewards(Records.getCollected('yomi'), Records.getCollected('kaki'), Records.getCollectedWords());
    const news = rewardNews(before, after);
    // Puts the new accessories on the lynx straight away
    if (news.newItems.length > 0) {
        const worn = Lynx.normalizeOutfit(Records.getSettings().outfit).filter(id => after.items.has(id));
        Records.setSettings({ outfit: news.newItems.reduce(Lynx.wear, worn) });
    }

    Object.assign(result, {
        mode: quiz.mode,
        total,
        score,
        percentage,
        rank: rankOf(percentage),
        // Nothing to compare with on the first play, nor on a review
        bestNote: recorded.previous
            ? { text: recorded.isBest ? 'じこベスト こうしん！' : `じこベスト ${formatBest(recorded.previous)}`, isNew: recorded.isBest }
            : null,
        maxCombo,
        rewardLines: news.lines,
        newKanjiTitle: `ずかんに くわわった 漢字（${KANJI_KINDS[kind].label}）`,
        newKanji: recorded.newlyCollected,
        newWords: recorded.newlyCollectedWords,
        // The same question can be missed only once per quiz, but keep it tidy anyway
        missed: [...new Map(missed.map(item => [isWord(item) ? item.word : item.kanji, item])).values()],
        turn: result.turn + 1
    });
    showScreen('result');
    playResultSound(percentage);
}

// --- The quiz rules that do not depend on the screen ---
// Questions, the 4 choices, the tiles of the 熟語くみたて, the rank, and the rewards.
import { kanjiDatabase, type KanjiItem } from '../data/kanji';
import { jukugoDatabase, type JukugoItem } from '../data/jukugo';
import * as Lynx from './lynx';
import type { KanjiKind } from './records';

// 'k-to-y': 漢字から読み, 'y-to-k': 読みから漢字, 'kumitate': 熟語くみたて, 'karuta': 意味かるた
export type Mode = 'k-to-y' | 'y-to-k' | 'kumitate' | 'karuta';
export type Random = () => number;

export const GRADES = [1, 2, 3, 4, 5, 6] as const;
export const TIME_LIMIT = 10;
// 熟語くみたて: more time for longer words, and always 8 tiles (4 x 2)
export const KUMITATE_TIME_LIMIT: Record<number, number> = { 2: 15, 3: 18, 4: 21 };
export const TILE_COUNT = 8;
// The answer stays on the screen this long before the next question
export const NEXT_QUESTION_MS = 1900;

// A kanji question remembers the reading it asks about
export interface KanjiQuestion extends KanjiItem {
    targetReading: string;
}

export const kanjiReadings = new Map(kanjiDatabase.map(item => [item.kanji, item.readings]));
const kanjiGrade = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
// Words with the same reading (科学 / 化学): building any of them is correct
export const wordsByReading = new Map<string, string[]>();
jukugoDatabase.forEach(item => wordsByReading.set(item.reading, [...(wordsByReading.get(item.reading) || []), item.word]));
// Kanji sharing a reading make good look-alike tiles (校 こう → 高・交・考)
const kanjiByReading = new Map<string, string[]>();
kanjiDatabase.forEach(item => item.readings.forEach(r => kanjiByReading.set(r, [...(kanjiByReading.get(r) || []), item.kanji])));

export function shuffle<T>(array: T[], random: Random = Math.random): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function kanjiFor(grade: string): KanjiItem[] {
    if (grade === 'all') return [...kanjiDatabase];
    const target = parseInt(grade, 10);
    return kanjiDatabase.filter(item => item.grade === target);
}

// The kanji questions of a quiz, each with one of its readings to ask about
export function kanjiQuestions(grade: string, count: number, random: Random = Math.random): KanjiQuestion[] {
    const pool = shuffle(kanjiFor(grade), random);
    return pool.slice(0, Math.min(count, pool.length)).map(item => {
        const targetReading = item.readings[Math.floor(random() * item.readings.length)];
        return { ...item, targetReading };
    });
}

// The 4 choices: the right answer and 3 others that cannot also be right
export function choicesFor(mode: 'k-to-y' | 'y-to-k', item: KanjiQuestion, random: Random = Math.random): string[] {
    const correct = mode === 'k-to-y' ? item.targetReading : item.kanji;
    const options = [correct];
    const pool = mode === 'k-to-y'
        ? kanjiDatabase.flatMap(entry => entry.readings).filter(r => !item.readings.includes(r))
        : kanjiDatabase.filter(entry => !entry.readings.includes(item.targetReading)).map(entry => entry.kanji);
    while (options.length < 4 && pool.length > 0) {
        const option = pool[Math.floor(random() * pool.length)];
        if (!options.includes(option)) options.push(option);
    }
    return shuffle(options, random);
}

export interface Tile {
    char: string;
    used: boolean;
}

// The tiles: the kanji of the word, then look-alikes that share a reading with them,
// then any kanji of the same grade or below. Kanji that could build another word with
// the same reading are left out, so only one order of the tiles is right.
export function makeTiles(item: JukugoItem, random: Random = Math.random): Tile[] {
    const chars = [...item.word];
    const used = new Set(chars);
    (wordsByReading.get(item.reading) || []).forEach(word => [...word].forEach(k => used.add(k)));
    const fits = (k: string) => !used.has(k) && (kanjiGrade.get(k) || 7) <= item.grade;
    const similar = shuffle([...new Set(chars.flatMap(k => (kanjiReadings.get(k) || []).flatMap(r => kanjiByReading.get(r) || [])))].filter(fits), random);
    const others = shuffle(kanjiDatabase.map(entry => entry.kanji).filter(fits), random);
    const extra = [...new Set([...similar.slice(0, 3), ...others])].slice(0, TILE_COUNT - chars.length);
    return shuffle([...chars, ...extra], random).map(char => ({ char, used: false }));
}

// Is the built word right: the word itself, or another word with the same reading
export const isRightWord = (item: JukugoItem, built: string) =>
    built === item.word || (wordsByReading.get(item.reading) || []).includes(built);

export interface Rank {
    label: string;
    className: string;
    message: string;
}

export function rankOf(percentage: number): Rank {
    if (percentage === 100) return { label: 'RANK S', className: 'rank-s', message: 'おめでとう！パーフェクト！君は漢字マスターだ！' };
    if (percentage >= 80) return { label: 'RANK A', className: 'rank-a', message: '素晴らしい！あと少しでパーフェクト！' };
    if (percentage >= 60) return { label: 'RANK B', className: 'rank-b', message: 'よく頑張ったね！この調子で練習しよう！' };
    if (percentage >= 40) return { label: 'RANK C', className: 'rank-c', message: 'まだまだ伸びしろがあるぞ！もう一度挑戦しよう！' };
    return { label: 'RANK D', className: 'rank-d', message: 'お疲れ様！次はもっと点数が伸びるはず！' };
}

export const formatBest = (best: { best: number; total: number }) => `${best.total}問中 ${best.best}問正解`;
export const readingsText = (item: KanjiItem) => item.readings.join('・');

// The 漢字ずかん each mode fills: 読み is collected in 漢字から読み, 書き in 読みから漢字
export const KANJI_KINDS: Record<KanjiKind, { label: string }> = {
    yomi: { label: '漢字から読み' },
    kaki: { label: '読みから漢字' }
};
export const kanjiKindOf = (mode: Mode): KanjiKind => (mode === 'y-to-k' ? 'kaki' : 'yomi');

// --- Rewards: accessories for the lynx, and はなまる in the ずかん ---
// A grade's kanji all collected in both 読み and 書き, or 100 of a grade's 熟語 collected,
// gives an accessory. Each 漢字ずかん gets its own はなまる for a complete grade.
// Rewards are worked out from the collected kanji and words every time, so only what
// the lynx wears is saved (in the settings, which are synced).
export const WORD_REWARD_COUNT = 100;

export interface Reward {
    item: string;
    kind: 'kanji' | 'words';
    grade: number;
}

export const REWARDS: Reward[] = GRADES.flatMap((grade, i) => [
    { item: Lynx.ITEMS[i * 2].id, kind: 'kanji' as const, grade },
    { item: Lynx.ITEMS[i * 2 + 1].id, kind: 'words' as const, grade }
]);
export const KANJI_BY_GRADE = new Map<number, KanjiItem[]>(GRADES.map(grade => [grade, kanjiDatabase.filter(item => item.grade === grade)]));
export const WORDS_BY_GRADE = new Map<number, JukugoItem[]>(GRADES.map(grade => [grade, jukugoDatabase.filter(item => item.grade === grade)]));

export interface Earned {
    items: Set<string>;
    yomiDone: Set<number>;
    kakiDone: Set<number>;
    kanjiDone: Set<number>;
    words100: Set<number>;
    wordsDone: Set<number>;
}

export function earnedRewards(yomi: Set<string>, kaki: Set<string>, words: Set<string>): Earned {
    const doneIn = (kanji: Set<string>) =>
        new Set<number>(GRADES.filter(grade => (KANJI_BY_GRADE.get(grade) ?? []).every(item => kanji.has(item.kanji))));
    const yomiDone = doneIn(yomi);
    const kakiDone = doneIn(kaki);
    const kanjiDone = new Set<number>([...yomiDone].filter(grade => kakiDone.has(grade)));
    const wordCount = (grade: number) => (WORDS_BY_GRADE.get(grade) ?? []).filter(item => words.has(item.word)).length;
    const words100 = new Set<number>(GRADES.filter(grade => wordCount(grade) >= WORD_REWARD_COUNT));
    const wordsDone = new Set<number>(GRADES.filter(grade => wordCount(grade) === (WORDS_BY_GRADE.get(grade) ?? []).length));
    const items = new Set(REWARDS.filter(r => (r.kind === 'kanji' ? kanjiDone : words100).has(r.grade)).map(r => r.item));
    return { items, yomiDone, kakiDone, kanjiDone, words100, wordsDone };
}

export function rewardHint(reward: Reward): string {
    return reward.kind === 'kanji'
        ? `${reward.grade}年生の 漢字を「漢字から読み」でも「読みから漢字」でも ぜんぶ あつめる`
        : `${reward.grade}年生の 熟語を ${WORD_REWARD_COUNT}こ あつめる`;
}

// What was won between before and after: the lines to show, and the new accessories
export function rewardNews(before: Earned, after: Earned): { lines: string[]; newItems: string[] } {
    const added = (a: Set<number>, b: Set<number>) => [...b].filter(x => !a.has(x));
    const lines = [
        ...added(before.yomiDone, after.yomiDone).map(grade => `${grade}年生の 漢字（漢字から読み）が ぜんぶ そろった！ はなまる！`),
        ...added(before.kakiDone, after.kakiDone).map(grade => `${grade}年生の 漢字（読みから漢字）が ぜんぶ そろった！ はなまる！`),
        ...added(before.words100, after.words100).map(grade => `${grade}年生の 熟語を ${WORD_REWARD_COUNT}こ あつめた！`),
        ...added(before.wordsDone, after.wordsDone).map(grade => `${grade}年生の 熟語が ぜんぶ そろった！ はなまる！`)
    ];
    const newItems = REWARDS.map(r => r.item).filter(id => after.items.has(id) && !before.items.has(id));
    newItems.forEach(id => lines.push(`ヤマネコに「${Lynx.ITEM.get(id)?.name}」を つけたよ。`));
    return { lines, newItems };
}

// The spiral flower a teacher draws with a red pen (inside a 100 x 100 box)
export function hanamaruPoints(): string {
    const pts: string[] = [];
    for (let i = 0; i <= 140; i++) {
        const t = i / 140;
        const a = t * 3 * Math.PI * 2 - Math.PI / 2;
        const r = 3 + t * 24;
        pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
    }
    for (let i = 1; i <= 120; i++) {
        const t = i / 120;
        const a = t * Math.PI * 2 - Math.PI / 2;
        const r = 27 + 13 * Math.abs(Math.sin(t * Math.PI * 6));
        pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
}

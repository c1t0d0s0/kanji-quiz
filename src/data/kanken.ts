// --- The questions of the 漢検もぎ試験 that are not in kanji.ts, jukugo.txt or reibun.txt ---
// One file per kind, one item per line, "#" for comments. All are written by hand and checked by
// tests/data.test.ts. The grade of an item is the highest grade among the kanji it shows (as for
// the 熟語), so a question never shows a kanji the child has not learned yet.
import { kanjiDatabase } from './kanji';
import bushuText from './kanken/bushu.txt?raw';
import okuriganaText from './kanken/okurigana.txt?raw';
import taigigoText from './kanken/taigigo.txt?raw';
import ruigigoText from './kanken/ruigigo.txt?raw';
import douonText from './kanken/douon.txt?raw';
import gojiText from './kanken/goji.txt?raw';
import yojiText from './kanken/yoji.txt?raw';

const gradeOf = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
const isKanjiChar = (c: string) => /\p{Script=Han}/u.test(c);
// The highest grade among the kanji of the texts. A kanji not taught in grade school counts as 7,
// so the item is never asked (and the data test complains).
export function gradeOfText(...texts: string[]): number {
    return Math.max(1, ...texts.flatMap(t => [...t].filter(isKanjiChar).map(k => gradeOf.get(k) ?? 7)));
}

const lines = (source: string) => source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
const fields = (line: string) => line.split('|').map(part => part.trim());

// 部首: "亻 | にんべん | 休体作…". A radical has another name on the left side (木: き / きへん),
// so it can have more than one line.
export interface Bushu {
    kanji: string;
    bushu: string;
    name: string;
}

export function parseBushu(source: string): Map<string, Bushu> {
    const list = new Map<string, Bushu>();
    for (const line of lines(source)) {
        const [bushu, name, kanji = ''] = fields(line);
        for (const k of kanji) list.set(k, { kanji: k, bushu, name });
    }
    return list;
}

// 送り仮名: "新しい あたらしい": one kanji, then the okurigana; the reading is a reading of the kanji
// (the stem) and the okurigana
export interface Okurigana {
    word: string;
    kanji: string;
    reading: string;
    stem: string;
    grade: number;
}

export function parseOkurigana(source: string): Okurigana[] {
    return lines(source).map(line => {
        const [word, reading = ''] = line.split(/\s+/);
        const okuri = word.slice(1);
        return { word, kanji: word[0], reading, stem: reading.slice(0, reading.length - okuri.length), grade: gradeOfText(word) };
    });
}

// 対義語 / 類義語: "出発 | 到着"
export type PairKind = 'taigi' | 'ruigi';

export interface WordPair {
    a: string;
    b: string;
    kind: PairKind;
    grade: number;
}

export function parsePairs(source: string, kind: PairKind): WordPair[] {
    return lines(source).map(line => {
        const [a, b = ''] = fields(line);
        return { a, b, kind, grade: gradeOfText(a, b) };
    });
}

// 同音異字 / 同訓異字: "会 | がっきゅう(かい)ぎを ひらく | 回 海 界". The reading in brackets is
// shown in katakana; the wrong kanji share the reading. "訓" at the start marks a 同訓異字.
export interface Douon {
    answer: string;
    before: string;
    reading: string;
    after: string;
    wrong: string[];
    kun: boolean;
    grade: number;
}

export function parseDouon(source: string): Douon[] {
    return lines(source).map(line => {
        const [head, sentence = '', wrong = ''] = fields(line);
        const kun = head.startsWith('訓');
        const answer = head.replace(/^訓\s*/, '');
        const m = sentence.match(/^([^()]*)\(([^()]+)\)([^()]*)$/);
        const [before, reading, after] = m ? [m[1], m[2], m[3]] : [sentence, '', ''];
        const wrongs = wrong.split(/\s+/).filter(Boolean);
        return { answer, before, reading, after, wrong: wrongs, kun, grade: gradeOfText(answer, before, after, ...wrongs) };
    });
}

// 誤字訂正: "管 観 | 夏休みに 星の 管察を した。": the wrong kanji in the sentence, and the right one
export interface Goji {
    wrong: string;
    right: string;
    sentence: string;
    grade: number;
}

export function parseGoji(source: string): Goji[] {
    return lines(source).map(line => {
        const [head, sentence = ''] = fields(line);
        const [wrong, right = ''] = head.split(/\s+/);
        return { wrong, right, sentence, grade: gradeOfText(sentence, right) };
    });
}

// 四字熟語: "一石二鳥 いっせきにちょう | 石 せき": the kanji to fill in, and its reading in the word
export interface Yoji {
    word: string;
    reading: string;
    blank: string;
    blankReading: string;
    grade: number;
}

export function parseYoji(source: string): Yoji[] {
    return lines(source).map(line => {
        const [head, blankPart = ''] = fields(line);
        const [word, reading = ''] = head.split(/\s+/);
        const [blank, blankReading = ''] = blankPart.split(/\s+/);
        return { word, reading, blank, blankReading, grade: gradeOfText(word) };
    });
}

export const kankenTexts = {
    bushu: bushuText, okurigana: okuriganaText, taigigo: taigigoText, ruigigo: ruigigoText,
    douon: douonText, goji: gojiText, yoji: yojiText
};
export const bushuList: ReadonlyMap<string, Bushu> = parseBushu(bushuText);
export const okuriganaList: readonly Okurigana[] = parseOkurigana(okuriganaText);
export const pairList: readonly WordPair[] = [...parsePairs(taigigoText, 'taigi'), ...parsePairs(ruigigoText, 'ruigi')];
export const douonList: readonly Douon[] = parseDouon(douonText);
export const gojiList: readonly Goji[] = parseGoji(gojiText);
export const yojiList: readonly Yoji[] = parseYoji(yojiText);

// --- 熟語 (2〜4字) for the 熟語くみたて and the 意味かるた, grouped by grade ---
// jukugo.txt has one word per line: "熟語 よみ | いみ". A "*" after the reading marks 熟字訓
// (今日 きょう *), whose reading does not split into the readings of each kanji. The meaning is
// shown as a hint while the word is asked, so it never contains the word's own kanji. The grade of
// a word is the highest grade among its kanji. tests/data.test.ts checks the list against kanji.ts.
import { kanjiDatabase } from './kanji';
import text from './jukugo.txt?raw';

export interface JukugoItem {
    word: string;
    reading: string;
    meaning: string;
    jukujikun: boolean;
    grade: number;
}

export function parseJukugo(source: string): JukugoItem[] {
    const gradeOf = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
    return source
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const [head, meaning = ''] = line.split('|').map(part => part.trim());
            const [word, reading, mark] = head.split(/\s+/);
            return { word, reading, meaning, jukujikun: mark === '*', grade: Math.max(...[...word].map(k => gradeOf.get(k) || 0)) };
        });
}

export const jukugoText: string = text;
export const jukugoDatabase: readonly JukugoItem[] = parseJukugo(text);

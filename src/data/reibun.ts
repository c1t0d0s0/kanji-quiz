// --- 例文 for the 手書き: the reading of the kanji to write, inside a short phrase ---
// reibun.txt has one kanji per line: "赤 | (あか)いくつ | (あか)ちゃん". The part in brackets is
// a reading of the kanji (the okurigana stays outside); the rest is written in kana, so the phrase
// can be read in any grade and shows which kanji is meant. tests/data.test.ts checks the list.
import text from './reibun.txt?raw';

export interface Reibun {
    before: string;
    reading: string;
    after: string;
}

export function parseReibun(source: string): Map<string, Reibun[]> {
    const list = new Map<string, Reibun[]>();
    source
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .forEach(line => {
            const [kanji, ...phrases] = line.split('|').map(part => part.trim());
            list.set(kanji, phrases.map(phrase => {
                const m = phrase.match(/^([^()]*)\(([^()]+)\)([^()]*)$/);
                return m ? { before: m[1], reading: m[2], after: m[3] } : { before: phrase, reading: '', after: '' };
            }));
        });
    return list;
}

export const reibunText: string = text;
export const reibunList: ReadonlyMap<string, readonly Reibun[]> = parseReibun(text);

// Makes src/data/lookalikes.ts: for each of the 1,026 kanji, the kanji of the list that look like
// it, as the judging sees them. B is a look-alike of A when the model of B, written as it is, would
// be accepted for A in 1年生 (where the limits are widest; every other grade is narrower).
// judge() with { lookAlikes } then tells them apart (src/core/handwriting.ts).
// Usage: npm run lookalikes   (again whenever kanjivg.ts or the limits of the judging change)
// The list is made from KanjiVG (© Ulrich Apel, CC BY-SA 3.0), so it is under the same licence.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromKanjiVG, judge } from '../src/core/handwriting.ts';
import { strokes } from '../src/data/kanjivg.ts';
import { kanjiDatabase } from '../src/data/kanji.ts';

const out = fileURLToPath(new URL('../src/data/lookalikes.ts', import.meta.url));
const kanji = kanjiDatabase.map(k => k.kanji);

const started = Date.now();
const lines = [];
let pairs = 0;
for (const asked of kanji) {
    const model = strokes[asked];
    const alike = kanji.filter(other => other !== asked && strokes[other].length === model.length && judge(fromKanjiVG(strokes[other]), model, 1).ok);
    if (alike.length === 0) continue;
    pairs += alike.length;
    lines.push(`    ${asked}: '${alike.join('')}',`);
}

writeFileSync(out, `// The kanji that look like each kanji, as the judging sees them: the model of each one listed would
// be accepted for it in 1年生 if it were not compared with them (judge with { lookAlikes }).
// Made by scripts/lookalikes.mjs (npm run lookalikes) from src/data/kanjivg.ts. Do not edit by hand.
//
// This file is made from KanjiVG and is distributed under the same licence (CC BY-SA 3.0), unlike
// the rest of this repository (MIT): see the notice in src/data/kanjivg.ts.
// KanjiVG © Ulrich Apel, https://kanjivg.tagaini.net
export const lookAlikes: Record<string, string> = {
${lines.join('\n')}
};

// The look-alikes of a kanji, as a list
export const lookAlikesOf = (kanji: string): string[] => [...(lookAlikes[kanji] ?? '')];
`);
console.log(`${lines.length} kanji with look-alikes, ${pairs} in all (${Math.round((Date.now() - started) / 1000)} s) → ${out}`);

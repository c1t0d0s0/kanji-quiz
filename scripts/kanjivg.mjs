// Makes src/data/kanjivg.ts (the strokes of the 1,026 kanji) from a release of KanjiVG.
// Usage: npm run kanjivg            (downloads the release below)
//        npm run kanjivg -- file.xml.gz
// KanjiVG is © Ulrich Apel, CC BY-SA 3.0; the file written is under the same licence.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RELEASE = 'r20260714';
const SOURCE = `https://github.com/KanjiVG/kanjivg/releases/download/${RELEASE}/kanjivg-${RELEASE.slice(1)}.xml.gz`;
// Points closer than this to the line between their neighbours are dropped (KanjiVG's box is 109 x 109)
const TOLERANCE = 0.6;

const root = new URL('..', import.meta.url);
const out = fileURLToPath(new URL('src/data/kanjivg.ts', root));
const kanjiList = [...readFileSync(fileURLToPath(new URL('src/data/kanji.ts', root)), 'utf8').matchAll(/kanji: "(.)"/g)].map(m => m[1]);

async function load() {
    const file = process.argv[2];
    if (file) return readFileSync(file);
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`${SOURCE}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

// The points of an SVG path (M, L, C, S and their lower-case forms), curves cut into short lines
function pathPoints(d) {
    const tokens = d.match(/[MmLlCcSsZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
    const pts = [];
    let i = 0, cmd = '', x = 0, y = 0, cx2 = 0, cy2 = 0, prev = '';
    const num = () => Number(tokens[i++]);
    const cubic = (x1, y1, x2, y2, x3, y3) => {
        for (let k = 1; k <= 16; k++) {
            const t = k / 16, u = 1 - t;
            pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
        }
        cx2 = x2; cy2 = y2; x = x3; y = y3;
    };
    while (i < tokens.length) {
        if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
        const rel = cmd === cmd.toLowerCase();
        const ox = rel ? x : 0, oy = rel ? y : 0;
        switch (cmd.toUpperCase()) {
            case 'M': x = ox + num(); y = oy + num(); pts.push([x, y]); cmd = rel ? 'l' : 'L'; break;
            case 'L': x = ox + num(); y = oy + num(); pts.push([x, y]); break;
            case 'C': { const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()]; cubic(...a); break; }
            case 'S': {
                // The first control point mirrors the last one of the curve before
                const x1 = /[CcSs]/.test(prev) ? 2 * x - cx2 : x, y1 = /[CcSs]/.test(prev) ? 2 * y - cy2 : y;
                const a = [ox + num(), oy + num(), ox + num(), oy + num()];
                cubic(x1, y1, ...a);
                break;
            }
            case 'Z': i++; break;
            default: throw new Error(`Unknown path command ${cmd} in ${d}`);
        }
        prev = cmd;
    }
    return pts;
}

// Ramer–Douglas–Peucker: keeps the points that matter for the shape
function simplify(pts) {
    if (pts.length <= 2) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = 0, at = 0;
    for (let k = 1; k < pts.length - 1; k++) {
        const dist = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / len;
        if (dist > far) { far = dist; at = k; }
    }
    if (far <= TOLERANCE) return [pts[0], pts[pts.length - 1]];
    return [...simplify(pts.slice(0, at + 1)).slice(0, -1), ...simplify(pts.slice(at))];
}

const xml = gunzipSync(await load()).toString('utf8');
const header = xml.match(/<!--([\s\S]*?)-->/)[1].trim();
const strokes = {};
const missing = [];
for (const kanji of kanjiList) {
    const code = kanji.codePointAt(0).toString(16).padStart(5, '0');
    // Only the standard form (not the -Kaisho and other variants)
    const block = xml.match(new RegExp(`<kanji id="kvg:kanji_${code}">([\\s\\S]*?)</kanji>`));
    if (!block) {
        missing.push(kanji);
        continue;
    }
    const paths = [...block[1].matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"[^>]* d="([^"]+)"/g)]
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .map(m => simplify(pathPoints(m[2])).flatMap(([px, py]) => [Math.round(px), Math.round(py)]));
    strokes[kanji] = paths;
}
if (missing.length) throw new Error(`Not in KanjiVG: ${missing.join('')}`);

const body = Object.entries(strokes).map(([k, s]) => `    ${k}: ${JSON.stringify(s)}`).join(',\n');
writeFileSync(out, `// The strokes of the 1,026 kanji, in stroke order, made by scripts/kanjivg.mjs (npm run kanjivg)
// from KanjiVG ${RELEASE} (https://kanjivg.tagaini.net). Do not edit by hand.
// Each stroke is a line through points [x1, y1, x2, y2, …] in KanjiVG's 109 x 109 box: the curves of
// KanjiVG were cut into short lines, the points that do not change the shape dropped, and rounded.
//
// This file is a work based on KanjiVG and is distributed under the same licence (CC BY-SA 3.0),
// unlike the rest of this repository (MIT). The notice of KanjiVG:
/*
${header}
*/
export const LICENSE = {
    name: 'KanjiVG',
    author: 'Ulrich Apel',
    url: 'https://kanjivg.tagaini.net',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/'
} as const;

export const strokes: Record<string, number[][]> = {
${body}
};
`);
const total = Object.values(strokes).reduce((n, s) => n + s.length, 0);
console.log(`${Object.keys(strokes).length} kanji, ${total} strokes → ${out}`);

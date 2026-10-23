// --- 手書き: is the kanji written on the canvas the one asked? ---
// The kanji to write is known, so nothing is recognised: the writing is compared with the
// strokes of KanjiVG (data/kanjivg.ts) and has to be close enough. Both are first put in a
// 1 x 1 box, keeping their proportions. Then:
//   joins    two strokes written in one go (or one stroke written in two) are put together,
//            when that matches the model clearly better. Young children may do it more often.
//   count    the strokes left must be as many as the model's
//   shape    how far the ink lies from the model's ink, and the model's from the ink
//   strokes  each stroke paired with a stroke of the model (Hungarian method): how far the
//            pairs are on average, a little more for a stroke written backwards
//   worst    the stroke farthest from the other's ink: a dot or a short stroke left out, or
//            a stroke the model does not have
//   flips    pairs of strokes clearly longer / shorter in the model but the other way round
//            in the writing (未 and 末, 土 and 士 differ only in that)
//   meets    pairs of strokes that clearly cross in the model but only touch or stay apart in
//            the writing, or the other way round (牛 and 午, 矢 and 失 differ only in that)
// The stroke order is not judged. Young children's kanji lean and wobble a lot, so the limits
// are wide in 1年生 and narrow step by step up to 6年生.

export interface Point {
    x: number;
    y: number;
}
export type Stroke = Point[];

export interface Limits {
    shape: number;
    strokes: number;
    worst: number;
    flips: number;
    meets: number;
    // How many times two strokes may be written in one go (or one stroke in two)
    joins: number;
    // Added to the distance of a stroke written the other way round
    reversed: number;
}

export const LIMITS: Record<number, Limits> = {
    1: { shape: 0.075, strokes: 0.14, worst: 0.15, flips: 1, meets: 3, joins: 3, reversed: 0.02 },
    2: { shape: 0.07, strokes: 0.13, worst: 0.14, flips: 1, meets: 2, joins: 3, reversed: 0.03 },
    3: { shape: 0.065, strokes: 0.12, worst: 0.13, flips: 0, meets: 1, joins: 2, reversed: 0.04 },
    4: { shape: 0.06, strokes: 0.105, worst: 0.12, flips: 0, meets: 1, joins: 2, reversed: 0.05 },
    5: { shape: 0.055, strokes: 0.095, worst: 0.11, flips: 0, meets: 0, joins: 1, reversed: 0.06 },
    6: { shape: 0.05, strokes: 0.085, worst: 0.1, flips: 0, meets: 0, joins: 1, reversed: 0.07 }
};

// A stroke without a pair costs as much as a stroke this far from its pair
const UNPAIRED = 0.35;
// A pair put together may match only this little worse than one of its two strokes alone
const JOIN_SLACK = 0.01;
// Points of each stroke, for comparing strokes
const STROKE_POINTS = 16;
// Distance between the points spread over the ink, for comparing shapes
const INK_STEP = 0.02;
// For flips: strokes shorter than this are not compared; ratios this clear in the model,
// and at least this much the other way round in the writing
const LONG_ENOUGH = 0.12;
const CLEAR_RATIO = Math.log(1.3);
const FLIPPED_RATIO = Math.log(1.1);
// For meets: how deep two strokes cut each other is how far the crossing is from the nearer of
// their ends. One crossing at least DEEP deep and the other less than SHALLOW (touching, or
// apart) is a mismatch; in between is too close to call. Strokes shorter than SHORT are left out
const DEEP = 0.15;
const SHALLOW = 0.02;
const SHORT = 0.08;

export interface Measures {
    shape: number;
    strokes: number;
    worst: number;
    flips: number;
    meets: number;
    joins: number;
    // Strokes left after the joins, and the model's
    written: number;
    expected: number;
}

export interface Verdict extends Measures {
    ok: boolean;
    // Why it was not accepted: nothing written, too many or too few strokes, or the shape
    reason: 'ok' | 'empty' | 'count' | 'shape';
}

// The model of data/kanjivg.ts ([x1, y1, x2, y2, …] per stroke) as strokes
export function fromKanjiVG(model: readonly (readonly number[])[]): Stroke[] {
    return model.map(flat => {
        const pts: Point[] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
        return pts;
    });
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function length(stroke: Stroke) {
    let n = 0;
    for (let i = 1; i < stroke.length; i++) n += dist(stroke[i - 1], stroke[i]);
    return n;
}

// The whole kanji in a 1 x 1 box, keeping its proportions, centred. null when there is nothing to see
export function normalize(strokes: readonly Stroke[]): Stroke[] | null {
    const kept = strokes.filter(s => s.length > 0);
    const pts = kept.flat();
    if (pts.length === 0) return null;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const size = Math.max(maxX - minX, maxY - minY);
    if (size === 0) return null;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return kept.map(s => s.map(p => ({ x: (p.x - cx) / size + 0.5, y: (p.y - cy) / size + 0.5 })));
}

// count points at equal distances along the stroke (a dot gives the same point count times)
export function resample(stroke: Stroke, count: number): Stroke {
    const total = length(stroke);
    if (total === 0 || stroke.length === 1) return Array.from({ length: count }, () => ({ ...stroke[0] }));
    const out: Point[] = [{ ...stroke[0] }];
    const step = total / (count - 1);
    let need = step;
    let walked = 0;
    for (let i = 1; i < stroke.length && out.length < count - 1; i++) {
        const a = stroke[i - 1], b = stroke[i];
        const seg = dist(a, b);
        while (seg > 0 && walked + seg >= need && out.length < count - 1) {
            const t = (need - walked) / seg;
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            need += step;
        }
        walked += seg;
    }
    out.push({ ...stroke[stroke.length - 1] });
    return out;
}

// Points spread evenly over a stroke, or over all the ink
const spread = (s: Stroke) => resample(s, Math.max(2, Math.ceil(length(s) / INK_STEP) + 1));
const ink = (strokes: readonly Stroke[]) => strokes.flatMap(spread);

// How far, on average, the points of a are from the nearest point of b
function reach(a: readonly Point[], b: readonly Point[]) {
    let sum = 0;
    for (const p of a) {
        let best = Infinity;
        for (const q of b) {
            const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
            if (d < best) best = d;
        }
        sum += Math.sqrt(best);
    }
    return sum / a.length;
}

// Both ways: ink far from the model, and parts of the model with no ink
export function shapeDistance(written: readonly Stroke[], model: readonly Stroke[]) {
    const a = ink(written), b = ink(model);
    return (reach(a, b) + reach(b, a)) / 2;
}

// The stroke farthest from the other's ink
export function worstStroke(written: readonly Stroke[], model: readonly Stroke[]) {
    const a = ink(written), b = ink(model);
    const farthest = (strokes: readonly Stroke[], other: Point[]) => Math.max(...strokes.map(s => reach(spread(s), other)));
    return Math.max(farthest(model, a), farthest(written, b));
}

// How far two strokes are (both of STROKE_POINTS points), either way round
function strokeCost(a: Stroke, b: Stroke, reversed: number) {
    let forward = 0, backward = 0;
    const n = a.length;
    for (let i = 0; i < n; i++) {
        forward += dist(a[i], b[i]);
        backward += dist(a[i], b[n - 1 - i]);
    }
    return Math.min(forward / n, backward / n + reversed);
}

// Hungarian method on a square cost matrix: the smallest total of one cell in each row and
// column. rowOf[column] = the row paired with that column
export function minimumPairing(cost: number[][]): { total: number; rowOf: number[] } {
    const n = cost.length;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
    const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(n + 1).fill(Infinity);
        const used = new Array(n + 1).fill(false);
        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity, j1 = 0;
            for (let j = 1; j <= n; j++) {
                if (used[j]) continue;
                const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) {
                    minv[j] = cur;
                    way[j] = j0;
                }
                if (minv[j] < delta) {
                    delta = minv[j];
                    j1 = j;
                }
            }
            for (let j = 0; j <= n; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
        } while (p[j0] !== 0);
        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0);
    }
    let total = 0;
    const rowOf = new Array(n).fill(-1);
    for (let j = 1; j <= n; j++) {
        total += cost[p[j] - 1][j - 1];
        rowOf[j - 1] = p[j] - 1;
    }
    return { total, rowOf };
}

const points = (s: Stroke) => resample(s, STROKE_POINTS);

// Puts together two strokes written in one go (two strokes of the model, next to each other in
// stroke order, against one written stroke), or one stroke written in two (two strokes written
// one after the other against one of the model). Only when the pair matches clearly better
// than either of its strokes alone, and at least as well as a stroke must match (`match`).
// At most `budget` times
export function absorbJoins(written: Stroke[], model: Stroke[], budget: number, match: number, reversed: number) {
    let w = written, m = model, joins = 0;
    while (joins < budget && w.length !== m.length) {
        // The side with more strokes has two to put together
        const [many, few] = w.length > m.length ? [w, m] : [m, w];
        const fewPoints = few.map(points);
        let best: { distance: number; merged: Stroke[] } | null = null;
        for (let k = 0; k + 1 < many.length; k++) {
            const joined = points([...many[k], ...many[k + 1]]);
            const fits = fewPoints.some(fp => {
                const cost = strokeCost(joined, fp, reversed);
                const single = Math.min(strokeCost(points(many[k]), fp, reversed), strokeCost(points(many[k + 1]), fp, reversed));
                // (a dot written in two is about as close as each half, wobbling as much as it is long: some slack)
                return cost <= match && cost < Math.max(single + JOIN_SLACK, single * 2);
            });
            if (!fits) continue;
            // Of the pairs that could be one stroke, the one that leaves all the strokes paired best
            const merged = [...many.slice(0, k), [...many[k], ...many[k + 1]], ...many.slice(k + 2)];
            const distance = many === w ? strokeDistance(merged, m, reversed).distance : strokeDistance(w, merged, reversed).distance;
            if (!best || distance < best.distance) best = { distance, merged };
        }
        if (!best) break;
        if (many === w) w = best.merged;
        else m = best.merged;
        joins++;
    }
    return { written: w, model: m, joins };
}

// The strokes paired, and how far the pairs are on average. pairs = [written, model] indexes
export function strokeDistance(written: readonly Stroke[], model: readonly Stroke[], reversed: number) {
    const a = written.map(points), b = model.map(points);
    const n = Math.max(a.length, b.length);
    const cost = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i < a.length && j < b.length ? strokeCost(a[i], b[j], reversed) : UNPAIRED)));
    const { total, rowOf } = minimumPairing(cost);
    const pairs = rowOf.map((i, j) => [i, j]).filter(([i, j]) => i < a.length && j < b.length);
    return { distance: total / n, pairs };
}

export function flippedLengths(written: readonly Stroke[], model: readonly Stroke[], pairs: number[][]) {
    const kept = pairs.filter(([i, j]) => length(written[i]) >= LONG_ENOUGH && length(model[j]) >= LONG_ENOUGH);
    let flipped = 0;
    for (let x = 0; x < kept.length; x++) {
        for (let y = x + 1; y < kept.length; y++) {
            const rm = Math.log(length(model[kept[x][1]]) / length(model[kept[y][1]]));
            const rw = Math.log(length(written[kept[x][0]]) / length(written[kept[y][0]]));
            if (Math.abs(rm) >= CLEAR_RATIO && Math.sign(rw) !== Math.sign(rm) && Math.abs(rw) >= FLIPPED_RATIO) flipped++;
        }
    }
    return flipped;
}

// Where two line segments cut each other: the fractions along each, or null
function cut(a: Point, b: Point, c: Point, d: Point): [number, number] | null {
    const r = { x: b.x - a.x, y: b.y - a.y }, q = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * q.y - r.y * q.x;
    if (den === 0) return null;
    const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den;
    const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

// How deep two strokes cut each other (0 when they do not): the distance from the crossing to
// the nearest end of either stroke. A + is deep, a T or an L is 0
export function crossingDepth(a: Stroke, b: Stroke) {
    const la = length(a), lb = length(b);
    let deepest = 0;
    let walkedA = 0;
    for (let i = 1; i < a.length; i++) {
        const segA = dist(a[i - 1], a[i]);
        let walkedB = 0;
        for (let j = 1; j < b.length; j++) {
            const segB = dist(b[j - 1], b[j]);
            const at = cut(a[i - 1], a[i], b[j - 1], b[j]);
            if (at) {
                const alongA = walkedA + at[0] * segA, alongB = walkedB + at[1] * segB;
                deepest = Math.max(deepest, Math.min(alongA, la - alongA, alongB, lb - alongB));
            }
            walkedB += segB;
        }
        walkedA += segA;
    }
    return deepest;
}

export function mismatchedMeetings(written: readonly Stroke[], model: readonly Stroke[], pairs: number[][]) {
    const kept = pairs.filter(([i, j]) => length(written[i]) >= SHORT && length(model[j]) >= SHORT);
    let mismatched = 0;
    for (let x = 0; x < kept.length; x++) {
        for (let y = x + 1; y < kept.length; y++) {
            const inModel = crossingDepth(model[kept[x][1]], model[kept[y][1]]);
            const inWriting = crossingDepth(written[kept[x][0]], written[kept[y][0]]);
            if ((inModel >= DEEP && inWriting < SHALLOW) || (inWriting >= DEEP && inModel < SHALLOW)) mismatched++;
        }
    }
    return mismatched;
}

export function limitsFor(grade: number): Limits {
    return LIMITS[Math.min(6, Math.max(1, Math.round(grade)))];
}

// All the measures, with the joins the grade allows. null when nothing was written
export function measure(writing: readonly Stroke[], model: readonly (readonly number[])[], limits: Limits): Measures | null {
    const w0 = normalize(writing);
    if (!w0) return null;
    const m0 = normalize(fromKanjiVG(model))!;
    const { written, model: target, joins } = absorbJoins(w0, m0, limits.joins, limits.strokes, limits.reversed);
    const { distance, pairs } = strokeDistance(written, target, limits.reversed);
    return {
        shape: shapeDistance(w0, m0),
        strokes: distance,
        worst: worstStroke(w0, m0),
        flips: flippedLengths(written, target, pairs),
        meets: mismatchedMeetings(written, target, pairs),
        joins,
        written: written.length,
        expected: target.length
    };
}

// Judges the writing (in any units, e.g. canvas pixels) against the model of KanjiVG
export function judge(writing: readonly Stroke[], model: readonly (readonly number[])[], grade: number): Verdict {
    const limits = limitsFor(grade);
    const m = measure(writing, model, limits);
    if (!m) return { ok: false, reason: 'empty', shape: Infinity, strokes: Infinity, worst: Infinity, flips: 0, meets: 0, joins: 0, written: 0, expected: model.length };
    if (m.written !== m.expected) return { ...m, ok: false, reason: 'count' };
    const ok = m.shape <= limits.shape && m.strokes <= limits.strokes && m.worst <= limits.worst && m.flips <= limits.flips && m.meets <= limits.meets;
    return { ...m, ok, reason: ok ? 'ok' : 'shape' };
}

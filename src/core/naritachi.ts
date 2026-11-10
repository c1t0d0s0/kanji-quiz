// --- なりたち: where each part of a picture goes when it turns into the kanji ---
// Everything in KanjiVG's 109 x 109 box. The pictures use absolute M, L, Q, C and Z only, so
// their numbers are all points (the control points too, which keep the box a little generous).
import type { NaritachiPart } from '../data/naritachi';

export interface Box { x: number; y: number; w: number; h: number; }

// A part smaller than this (one short stroke) is grown to it, so the picture is not squashed flat
const MIN_SIDE = 14;

export const PATH_COMMANDS = /^(?:[MLQCZ]|-?\d+(?:\.\d+)?)$/;

export function pathPoints(d: string): [number, number][] {
    const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const points: [number, number][] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
    return points;
}

function boxOf(points: readonly (readonly [number, number])[]): Box {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function partBox(part: NaritachiPart): Box {
    return boxOf(part.paths.flatMap(pathPoints));
}

// The box of some strokes of the kanji (strokes are flat [x1, y1, x2, y2, …])
export function strokesBox(model: readonly (readonly number[])[], indices: readonly number[]): Box {
    const points: [number, number][] = [];
    for (const i of indices) {
        const flat = model[i] ?? [];
        for (let k = 0; k + 1 < flat.length; k += 2) points.push([flat[k], flat[k + 1]]);
    }
    return boxOf(points);
}

function grow(box: Box): Box {
    const w = Math.max(box.w, MIN_SIDE), h = Math.max(box.h, MIN_SIDE);
    return { x: box.x - (w - box.w) / 2, y: box.y - (h - box.h) / 2, w, h };
}

// The CSS transforms (origin 0 0 of the box) from the picture's place to the kanji's: the same
// functions in both, so the browser goes smoothly from one to the other
export function morphTransforms(part: NaritachiPart, model: readonly (readonly number[])[]): { start: string; end: string } {
    const pic = grow(partBox(part));
    const cx = pic.x + pic.w / 2, cy = pic.y + pic.h / 2;
    const turn = part.turn ?? 0;
    // Turned a quarter, the picture's box stands the other way
    const sideways = Math.abs(turn) % 180 === 90;
    const w = sideways ? pic.h : pic.w, h = sideways ? pic.w : pic.h;
    const fromX = cx - w / 2, fromY = cy - h / 2;
    const to = grow(strokesBox(model, part.strokes));
    const sx = to.w / w, sy = to.h / h;
    const tx = to.x - fromX * sx, ty = to.y - fromY * sy;
    const around = (deg: number) => `translate(${cx}px, ${cy}px) rotate(${deg}deg) translate(${-cx}px, ${-cy}px)`;
    return {
        start: `translate(0px, 0px) scale(1, 1) ${around(0)}`,
        end: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy}) ${around(turn)}`
    };
}

// Where a part leans from: the middle of its bottom
export function leanOrigin(part: NaritachiPart): string {
    const box = partBox(part);
    return `${box.x + box.w / 2}px ${box.y + box.h}px`;
}

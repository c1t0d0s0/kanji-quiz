// A child's kanji, made from the model of KanjiVG: leaning, squashed, strokes moved and wobbling
import { createRng } from '../../src/core/battle';
import { fromKanjiVG, type Stroke } from '../../src/core/handwriting';

export interface Mess {
    // Whole kanji: scale x / y (±), turn (radians ±), lean (±)
    scale: number;
    turn: number;
    lean: number;
    // Each stroke: moved (± units of the 109 box), longer or shorter (±)
    move: number;
    stretch: number;
    // Each point: a slow wave and a little shake (units)
    wave: number;
    shake: number;
}

export const MESS: Record<'small' | 'medium' | 'large', Mess> = {
    small: { scale: 0.08, turn: 0.05, lean: 0.05, move: 2.5, stretch: 0.08, wave: 1.2, shake: 0.4 },
    medium: { scale: 0.15, turn: 0.09, lean: 0.1, move: 4.5, stretch: 0.15, wave: 2.2, shake: 0.7 },
    large: { scale: 0.22, turn: 0.14, lean: 0.16, move: 7, stretch: 0.25, wave: 3.5, shake: 1 }
};

function densify(stroke: Stroke): Stroke {
    const out: Stroke = [stroke[0]];
    for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1], b = stroke[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5));
        for (let k = 1; k <= steps; k++) out.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
    }
    return out;
}

export function scribble(model: readonly (readonly number[])[], mess: Mess, seed: string, canvas = 300): Stroke[] {
    const rng = createRng(seed);
    const r = () => rng() * 2 - 1;
    const sx = 1 + r() * mess.scale, sy = 1 + r() * mess.scale, turn = r() * mess.turn, lean = r() * mess.lean;
    const cos = Math.cos(turn), sin = Math.sin(turn);
    return fromKanjiVG(model).map(stroke => {
        const pts = densify(stroke);
        const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length, cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
        const mx = r() * mess.move, my = r() * mess.move, st = 1 + r() * mess.stretch;
        const phase = rng() * 6.28, freq = 0.05 + rng() * 0.08;
        return pts.map((p, i) => {
            let x = cx + (p.x - cx) * st + mx + Math.sin(phase + i * freq * 3) * mess.wave + r() * mess.shake;
            let y = cy + (p.y - cy) * st + my + Math.cos(phase + i * freq * 3) * mess.wave + r() * mess.shake;
            x -= 54.5; y -= 54.5;
            [x, y] = [(x * cos - y * sin + y * lean) * sx, (x * sin + y * cos) * sy];
            // On a canvas of canvas x canvas pixels
            return { x: ((x + 54.5) / 109) * canvas, y: ((y + 54.5) / 109) * canvas };
        });
    });
}

// Two strokes written as one (the pen not lifted): the stroke and the next one joined
export function joinStrokes(strokes: Stroke[], at: number): Stroke[] {
    if (at + 1 >= strokes.length) return strokes;
    return [...strokes.slice(0, at), [...strokes[at], ...strokes[at + 1]], ...strokes.slice(at + 2)];
}

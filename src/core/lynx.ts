// --- The lynx from Wordlynx, and the accessories it can wear ---
// The drawing is the same as lynxFace() and ITEMS in Wordlynx's src/ui/lynx.ts.

// Eyes and outlines keep this colour on dark screens too (the text colour would make white eyes)
const LINE = '#1c2a4a';
const RED = '#e8546a';
const YELLOW = '#ffd23f';

const sparkle = (cx: number, cy: number, r: number, fill = YELLOW) =>
    `<path fill="${fill}" d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z"/>`;

const DRAWINGS: Record<string, string> = {
    ribbon:
        `<g transform="translate(87 31) rotate(18)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" fill="${RED}">` +
        `<path d="M0 0L-14 -8.5V8.5Z"/><path d="M0 0L14 -8.5V8.5Z"/><circle r="4"/></g>`,
    glasses:
        `<g fill="rgba(255,255,255,0.3)" stroke="${LINE}" stroke-width="2.6">` +
        `<circle cx="42" cy="69" r="11.5"/><circle cx="78" cy="69" r="11.5"/>` +
        `<path fill="none" stroke-linecap="round" d="M53.5 67.5Q60 63.5 66.5 67.5M30.5 67L21 63M89.5 67L99 63"/></g>`,
    pencil:
        `<g transform="rotate(30 97 34)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
        `<rect x="93" y="12" width="8" height="6" fill="#f7a3b0"/><rect x="93" y="18" width="8" height="26" fill="${YELLOW}"/>` +
        `<path fill="#f6e0b5" d="M93 44H101L97 54Z"/><path fill="${LINE}" stroke="none" d="M95.4 50H98.6L97 54Z"/></g>`,
    hat:
        `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
        `<ellipse cx="60" cy="31" rx="43" ry="7.5" fill="#f0d27a"/>` +
        `<path fill="#f5dc8e" d="M37 30C37 6 83 6 83 30Q60 36 37 30Z"/>` +
        `<path fill="${RED}" d="M37.2 24Q60 19 82.8 24L83 30Q60 36 37 30Z"/></g>`,
    scarf:
        `<g fill="${RED}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
        `<path d="M73 110L79 129L90 125L85 107Z"/><path d="M25 97Q60 113 95 97L97 107Q60 125 23 107Z"/></g>` +
        `<path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8" d="M38 107Q60 115 82 107"/>`,
    flower:
        `<g transform="translate(88 31)" stroke="${LINE}" stroke-width="1.6">` +
        [0, 72, 144, 216, 288].map((a: number) => `<circle r="5.4" cx="0" cy="-6.6" fill="#ff9fb5" transform="rotate(${a})"/>`).join('') +
        `<circle r="4" fill="${YELLOW}"/></g>`,
    book:
        `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
        `<path fill="#fff" d="M32 100Q46 93 60 100Q74 93 88 100V120Q74 113 60 120Q46 113 32 120Z"/>` +
        `<path fill="none" d="M60 100V120"/></g>` +
        `<path fill="none" stroke="#9aa6b8" stroke-width="1.4" stroke-linecap="round" d="M38 104Q46 101 54 104M38 109Q46 106 54 109M66 104Q74 101 82 104M66 109Q74 106 82 109"/>`,
    headband:
        `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round" fill="#fff">` +
        `<path d="M97 52L112 44L110 53L114 60L98 58Z"/><path d="M21 50Q60 33 99 50L99.5 59Q60 42 20.5 59Z"/></g>` +
        `<circle cx="60" cy="44.5" r="4.4" fill="#d63c2c"/>`,
    headphones:
        `<path fill="none" stroke="${LINE}" stroke-width="8" stroke-linecap="round" d="M19 62C19 12 101 12 101 62"/>` +
        `<path fill="none" stroke="#5b79d6" stroke-width="4.5" stroke-linecap="round" d="M19 62C19 12 101 12 101 62"/>` +
        `<g fill="${RED}" stroke="${LINE}" stroke-width="2.2"><rect x="9" y="55" width="14" height="27" rx="6.5"/><rect x="97" y="55" width="14" height="27" rx="6.5"/></g>`,
    cap:
        `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
        `<path fill="#2f55a8" d="M38 33C24 33 11 37 6 44C24 45 46 41 62 35Z"/>` +
        `<path fill="#3f6fd1" d="M35 34C35 8 85 8 85 34Q60 28 35 34Z"/></g>` +
        `<circle cx="60" cy="13.5" r="2.6" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>` +
        `<path fill="none" stroke="#fff" stroke-width="1.6" opacity="0.7" d="M60 16V30"/>`,
    wizard:
        `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
        `<path fill="#5b3fa8" d="M34 33Q50 10 70 -12Q72 12 86 33Q60 39 34 33Z"/>` +
        `<ellipse cx="60" cy="33" rx="37" ry="6.5" fill="#4a3290"/></g>` +
        sparkle(57, 20, 5) +
        sparkle(69, 8, 3.2) +
        sparkle(72, 25, 2.6),
    crown:
        `<path fill="${YELLOW}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" d="M38 32L35 8L49 20L60 2L71 20L85 8L82 32Q60 26 38 32Z"/>` +
        `<circle cx="60" cy="21" r="3.6" fill="#d63c2c" stroke="${LINE}" stroke-width="1.4"/>` +
        `<circle cx="45.5" cy="24" r="2.6" fill="#4a90e2" stroke="${LINE}" stroke-width="1.2"/>` +
        `<circle cx="74.5" cy="24" r="2.6" fill="#3fb37f" stroke="${LINE}" stroke-width="1.2"/>`
};

// Where each item is worn. Only one item per place, so the drawings never overlap.
// In the order they are given as rewards: 1年生の漢字, 1年生の熟語, 2年生の漢字, … (see script.js).
export interface LynxItem {
    id: string;
    name: string;
    place: 'head' | 'face' | 'neck';
}

export const ITEMS: readonly LynxItem[] = [
    { id: 'ribbon', name: 'リボン', place: 'head' },
    { id: 'flower', name: '花かざり', place: 'head' },
    { id: 'glasses', name: 'めがね', place: 'face' },
    { id: 'pencil', name: 'えんぴつ', place: 'head' },
    { id: 'scarf', name: 'マフラー', place: 'neck' },
    { id: 'book', name: '本', place: 'neck' },
    { id: 'hat', name: 'むぎわらぼうし', place: 'head' },
    { id: 'headband', name: 'はちまき', place: 'head' },
    { id: 'headphones', name: 'ヘッドホン', place: 'head' },
    { id: 'cap', name: '野球ぼう', place: 'head' },
    { id: 'crown', name: '王冠', place: 'head' },
    { id: 'wizard', name: 'まほうの ぼうし', place: 'head' }
];
export const ITEM = new Map(ITEMS.map(item => [item.id, item]));

// Things worn over the forehead hide its stripes
const HEADWEAR = ['hat', 'headband', 'cap', 'wizard', 'crown'];

function face(items: string[]) {
    const stripes = items.some(id => HEADWEAR.includes(id))
        ? ''
        : `<path fill="none" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round" d="M53 39L54 45M60 37V44M67 39L66 45"/>`;
    const eye = (x: number) =>
        `<ellipse cx="${x}" cy="69" rx="7.5" ry="8.5" fill="${LINE}"/>` +
        `<circle cx="${x + 2.6}" cy="65.4" r="3.1" fill="#fff"/>` +
        `<circle cx="${x - 2.6}" cy="72.6" r="1.5" fill="#fff"/>`;
    return (
        `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">` +
        `<path class="lynx-fur" d="M27 52C21 38 21 24 25 13C36 19 47 27 53 36ZM93 52C99 38 99 24 95 13C84 19 73 27 67 36Z"/>` +
        `<path class="lynx-fur" d="M60 28C36 28 19 44 19 67C19 73 15 79 8 85C18 86 25 89 31 95C39 103 50 106 60 106C70 106 81 103 89 95C95 89 102 86 112 85C105 79 101 73 101 67C101 44 84 28 60 28Z"/></g>` +
        `<path class="lynx-pink" d="M30 43C28 35 28 28 30 22C36 26 41 31 45 36ZM90 43C92 35 92 28 90 22C84 26 79 31 75 36Z"/>` +
        `<path class="lynx-tuft" d="M24 15C22 10 20 6 19 1C24 4 28 8 31 12ZM96 15C98 10 100 6 101 1C96 4 92 8 89 12Z"/>` +
        `<ellipse class="lynx-light" cx="60" cy="86" rx="15" ry="11"/>` +
        `<ellipse class="lynx-pink" cx="28" cy="82" rx="6.5" ry="4" opacity="0.75"/>` +
        `<ellipse class="lynx-pink" cx="92" cy="82" rx="6.5" ry="4" opacity="0.75"/>` +
        stripes +
        eye(42) + eye(78) +
        `<path class="lynx-tongue" d="M56.8 88.5Q60 95.5 63.2 88.5Z"/>` +
        `<path class="lynx-nose" d="M56.2 79.4Q60 77.6 63.8 79.4Q62.4 83.4 60 84Q57.6 83.4 56.2 79.4Z"/>` +
        `<path fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" d="M60 84V86M60 86C58 90 53 90 51.5 87M60 86C62 90 67 90 68.5 87"/>` +
        `<path fill="none" stroke="${LINE}" stroke-width="1.4" stroke-linecap="round" d="M45 87L33 89M45.5 90.5L35 96M75 87L87 89M74.5 90.5L85 96"/>`
    );
}

// Keeps known items only, at most one per place (the later one wins)
export function normalizeOutfit(outfit: readonly string[] | null | undefined): string[] {
    const byPlace = new Map<string, string>();
    (Array.isArray(outfit) ? outfit : []).forEach(id => {
        const item = ITEM.get(id);
        if (item) byPlace.set(item.place, id);
    });
    return [...byPlace.values()];
}

// Puts an item on, taking off whatever was worn in the same place
export function wear(outfit: readonly string[] | null | undefined, id: string): string[] {
    return normalizeOutfit([...normalizeOutfit(outfit), id]);
}

// The lynx wearing the given items, as an SVG string. The view box leaves room for
// the tall hats above the ears and the scarf below the chin.
export function svg(outfit: readonly string[] | null | undefined, label = 'ヤマネコの キャラクター'): string {
    const items = normalizeOutfit(outfit);
    return `<svg viewBox="-2 -16 124 148" role="img" aria-label="${label}">${face(items)}${items.map(id => DRAWINGS[id]).join('')}</svg>`;
}

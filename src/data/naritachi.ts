// --- なりたち: the picture a kanji came from, for the animation picture → kanji ---
// The pictures are drawn here in KanjiVG's 109 x 109 box (absolute M, L, Q, C and Z only), as lines.
// Each part of a picture turns into some strokes of the kanji (their numbers in src/data/kanjivg.ts,
// from 0); together, the parts take every stroke once. More kanji can be added to the list.

export interface NaritachiPart {
    // The lines of the picture (SVG path d)
    paths: string[];
    // The strokes of the kanji this part turns into (0-based, in stroke order)
    strokes: number[];
    // Where the part comes from when the picture appears (it walks, falls … into place)
    from?: [number, number];
    // How far it leans at the end of its entrance (degrees, round the bottom middle of the part)
    lean?: number;
    // Turned (degrees) when it becomes the kanji: the eye stands up in 目
    turn?: number;
}

export interface Naritachi {
    kanji: string;
    // What the picture shows, for children
    text: string;
    parts: NaritachiPart[];
}

const f = (n: number) => String(Math.round(n * 10) / 10);

// A circle (or an ellipse) made of four curves
function circle(cx: number, cy: number, rx: number, ry = rx): string {
    const k = 0.5523, kx = rx * k, ky = ry * k;
    return [
        `M${f(cx - rx)} ${f(cy)}`,
        `C${f(cx - rx)} ${f(cy - ky)} ${f(cx - kx)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)}`,
        `C${f(cx + kx)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ky)} ${f(cx + rx)} ${f(cy)}`,
        `C${f(cx + rx)} ${f(cy + ky)} ${f(cx + kx)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)}`,
        `C${f(cx - kx)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ky)} ${f(cx - rx)} ${f(cy)}`,
        'Z'
    ].join(' ');
}

// A small tree (branches up, roots down) with its trunk at x, from top to bottom
function tree(x: number, top: number, bottom: number, w: number): string[] {
    const h = bottom - top;
    const fork = top + h * 0.35, root = top + h * 0.8;
    return [
        `M${f(x)} ${f(top)} L${f(x)} ${f(bottom)}`,
        `M${f(x)} ${f(fork)} L${f(x - w)} ${f(top + h * 0.05)}`,
        `M${f(x)} ${f(fork)} L${f(x + w)} ${f(top + h * 0.05)}`,
        `M${f(x)} ${f(root)} L${f(x - w * 0.8)} ${f(bottom)}`,
        `M${f(x)} ${f(root)} L${f(x + w * 0.8)} ${f(bottom)}`
    ];
}

// A stalk of bamboo with its knots and two leaves
function bamboo(x: number): string[] {
    return [
        `M${f(x)} 20 L${f(x)} 96`,
        `M${f(x - 5)} 45 L${f(x + 5)} 45`,
        `M${f(x - 5)} 70 L${f(x + 5)} 70`,
        `M${f(x)} 30 Q${f(x - 12)} 18 ${f(x - 22)} 22 Q${f(x - 12)} 30 ${f(x)} 30 Z`,
        `M${f(x)} 26 Q${f(x + 12)} 12 ${f(x + 22)} 14 Q${f(x + 14)} 26 ${f(x)} 26 Z`
    ];
}

export const naritachiList: readonly Naritachi[] = [
    {
        kanji: '休',
        text: '人が 木の そばで やすむ ようす',
        parts: [
            // The person walks to the tree and leans on it
            {
                paths: [circle(28, 34, 6), 'M28 40 L30 68', 'M29 48 L18 60', 'M29 48 L40 56', 'M30 68 L22 94', 'M30 68 L38 94'],
                strokes: [0, 1], from: [-30, 0], lean: 8
            },
            {
                paths: [circle(68, 32, 22, 18), 'M68 50 L68 96', 'M68 62 L56 52', 'M68 86 L56 96', 'M68 86 L80 96'],
                strokes: [2, 3, 4, 5]
            }
        ]
    },
    {
        kanji: '山',
        text: 'ならんだ 山の かたち',
        parts: [{ paths: ['M10 88 L32 52 L44 66 L55 18 L68 52 L78 40 L100 88 Z'], strokes: [0, 1, 2] }]
    },
    {
        kanji: '川',
        text: '水が ながれる 川の かたち',
        parts: [
            { paths: ['M30 16 Q20 40 30 58 Q38 74 22 90'], strokes: [0], from: [0, -15] },
            { paths: ['M55 16 Q45 40 55 58 Q63 74 50 92'], strokes: [1], from: [0, -15] },
            { paths: ['M82 16 Q72 40 82 58 Q90 76 80 96'], strokes: [2], from: [0, -15] }
        ]
    },
    {
        kanji: '日',
        text: 'かがやく おひさまの かたち',
        parts: [{
            paths: [circle(55, 56, 26), circle(55, 56, 4), 'M55 14 L55 22', 'M55 90 L55 98', 'M13 56 L21 56', 'M89 56 L97 56',
                'M25 26 L31 32', 'M79 80 L85 86', 'M85 26 L79 32', 'M31 80 L25 86'],
            strokes: [0, 1, 2, 3]
        }]
    },
    {
        kanji: '月',
        text: 'かけた お月さまの かたち',
        parts: [{ paths: ['M58 12 C22 22 22 92 62 98 C42 82 40 30 58 12 Z', 'M40 44 L48 46', 'M40 64 L49 64'], strokes: [0, 1, 2, 3], from: [0, 15] }]
    },
    {
        kanji: '木',
        text: 'えだと ねが ある 木の かたち',
        parts: [{ paths: tree(54, 12, 98, 34), strokes: [0, 1, 2, 3] }]
    },
    {
        kanji: '林',
        text: '木が 2本 ならぶと 林',
        parts: [
            { paths: tree(30, 16, 94, 18), strokes: [0, 1, 2, 3] },
            { paths: tree(76, 14, 94, 20), strokes: [4, 5, 6, 7], from: [20, 0] }
        ]
    },
    {
        kanji: '森',
        text: '木が 3本 あつまると 森',
        parts: [
            { paths: tree(54, 10, 48, 22), strokes: [0, 1, 2, 3], from: [0, -15] },
            { paths: tree(30, 50, 98, 18), strokes: [4, 5, 6, 7] },
            { paths: tree(76, 50, 98, 20), strokes: [8, 9, 10, 11] }
        ]
    },
    {
        kanji: '人',
        text: '立っている 人を よこから 見た かたち',
        parts: [{ paths: [circle(56, 20, 7), 'M55 27 L50 60', 'M53 36 L68 52', 'M53 36 L40 50', 'M50 60 L34 94', 'M50 60 L72 94'], strokes: [0, 1], from: [-25, 0] }]
    },
    {
        kanji: '口',
        text: 'ひらいた 口の かたち',
        parts: [{ paths: ['M18 56 Q55 18 92 56 Q55 92 18 56 Z', 'M26 56 Q55 44 84 56', 'M26 56 Q55 70 84 56'], strokes: [0, 1, 2] }]
    },
    {
        kanji: '目',
        text: '目を たてに した かたち',
        parts: [{ paths: ['M10 55 Q55 14 100 55 Q55 96 10 55 Z', circle(55, 55, 14), circle(55, 55, 5)], strokes: [0, 1, 2, 3, 4], turn: 90 }]
    },
    {
        kanji: '耳',
        text: '耳の かたち',
        parts: [{ paths: ['M38 18 C80 8 92 58 62 70 C52 74 58 94 42 96 C30 96 30 82 36 78', 'M46 32 C66 28 72 50 54 56'], strokes: [0, 1, 2, 3, 4, 5] }]
    },
    {
        kanji: '手',
        text: 'ゆびを ひらいた 手の かたち',
        parts: [{ paths: ['M55 98 L55 56', 'M55 56 L55 12', 'M55 56 L32 18', 'M55 56 L78 18', 'M55 56 L16 42', 'M55 56 L94 42'], strokes: [0, 1, 2, 3] }]
    },
    {
        kanji: '足',
        text: 'ひざから 足さきまでの かたち',
        parts: [{ paths: [circle(52, 28, 13), 'M52 41 L52 84', 'M52 84 L84 92', 'M52 84 L50 94 L88 96'], strokes: [0, 1, 2, 3, 4, 5, 6], from: [0, -12] }]
    },
    {
        kanji: '火',
        text: 'もえる ほのおの かたち',
        parts: [{ paths: ['M55 12 C72 40 92 56 80 82 C72 98 38 98 30 82 C20 62 42 48 55 12 Z', 'M55 56 C64 68 64 84 55 88 C46 84 46 68 55 56 Z', 'M22 32 L30 46', 'M88 30 L80 44'], strokes: [0, 1, 2, 3], from: [0, 12] }]
    },
    {
        kanji: '水',
        text: 'ながれる 水の かたち',
        parts: [{ paths: ['M55 12 Q44 36 55 56 Q66 76 55 96', 'M22 40 Q30 52 22 64', 'M34 30 Q40 40 34 50', 'M88 40 Q80 52 88 64', 'M76 30 Q70 40 76 50'], strokes: [0, 1, 2, 3], from: [0, -15] }]
    },
    {
        kanji: '田',
        text: 'あぜで くぎられた 田んぼの かたち',
        parts: [{ paths: ['M18 26 L90 24 L88 86 L22 86 Z', 'M54 25 L55 86', 'M20 55 L89 55', 'M34 44 L34 36', 'M72 44 L72 36', 'M36 76 L36 68', 'M72 76 L72 68'], strokes: [0, 1, 2, 3, 4] }]
    },
    {
        kanji: '雨',
        text: 'くもから 雨つぶが ふる かたち',
        parts: [
            { paths: ['M20 46 C10 46 10 30 24 30 C26 14 50 12 56 24 C64 12 88 16 86 32 C100 34 98 48 86 48 Z'], strokes: [0, 1, 2, 3] },
            { paths: ['M30 60 L28 68', 'M30 78 L28 86', 'M70 60 L68 68', 'M70 78 L68 86'], strokes: [4, 5, 6, 7], from: [0, -20] }
        ]
    },
    {
        kanji: '竹',
        text: 'えだと はが ついた 竹が ならぶ かたち',
        parts: [
            { paths: bamboo(32), strokes: [0, 1, 2] },
            { paths: bamboo(76), strokes: [3, 4, 5] }
        ]
    },
    {
        kanji: '貝',
        text: '貝がらの かたち（むかしは お金の かわりだった）',
        parts: [{ paths: [circle(55, 50, 28, 36), 'M55 18 L55 82', 'M44 34 L50 34', 'M44 50 L50 50', 'M44 66 L50 66', 'M60 34 L66 34', 'M60 50 L66 50', 'M60 66 L66 66', 'M40 84 L30 96', 'M70 84 L80 96'], strokes: [0, 1, 2, 3, 4, 5, 6] }]
    },
    {
        kanji: '男',
        text: '田んぼで 力しごとを する 人',
        parts: [
            { paths: ['M26 14 L82 12 L80 46 L30 46 Z', 'M54 13 L55 46', 'M28 30 L81 29'], strokes: [0, 1, 2, 3, 4] },
            // The plough (力) pulled into the field
            { paths: ['M22 60 L80 56 L74 88 L60 96', 'M54 56 L30 90', 'M74 88 L86 98'], strokes: [5, 6], from: [-30, 0] }
        ]
    },
    {
        kanji: '本',
        text: '木の ねもとに しるしを つけて、ものの「もと」を あらわす',
        parts: [
            { paths: tree(54, 12, 98, 34), strokes: [0, 1, 2, 3] },
            { paths: ['M40 74 L68 74', circle(54, 74, 6)], strokes: [4], from: [0, 20] }
        ]
    }
];

export const NARITACHI: ReadonlyMap<string, Naritachi> = new Map(naritachiList.map(n => [n.kanji, n]));

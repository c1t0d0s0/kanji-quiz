import { describe, expect, it } from 'vitest';
import * as Battle from '../src/core/battle';
import type { Room } from '../src/core/battle';
import * as Karuta from '../src/core/karuta';

const room = (over: Partial<Room> = {}): Room => ({
    hostUid: 'h', grade: 2, count: 5, round: 1, seed: 'abc', status: 'playing',
    players: {
        0: { uid: 'h', name: 'あおい', joinedAt: 1, online: true },
        1: { uid: 'k', name: 'けんた', joinedAt: 2, online: true },
        2: { uid: 'm', name: 'みさき', joinedAt: 3, online: false }
    },
    takes: {},
    faults: {},
    ...over
});

describe('意味かるた field', () => {
    it('the same seed gives the same questions and field everywhere', () => {
        const a = Battle.makeGame(room());
        const b = Battle.makeGame(room());
        expect(b).toEqual(a);
        expect(Battle.makeGame(room({ round: 2 }))).not.toEqual(a);
        expect(a.questions).toHaveLength(5);
        expect(a.cards).toHaveLength(Karuta.FIELD_SIZE[5]);
        a.questions.forEach(q => expect(a.cards).toContain(q));
    });

    it('every meaning on the field points to one card', () => {
        for (const count of [5, 10, 20]) {
            const { cards } = Karuta.makeGame('all', count, Battle.seededShuffle(Battle.createRng(`x${count}`)));
            expect(new Set(cards.map(c => c.meaning)).size).toBe(cards.length);
            expect(new Set(cards.map(c => c.word)).size).toBe(cards.length);
        }
    });

    it('a version that does not depend on how the code is built', () => {
        expect(Battle.dataVersion()).toMatch(/^k\d+-[0-9a-f]{8}$/);
    });
});

describe('room rules', () => {
    it('codes, names and seats', () => {
        expect(Battle.parseCode('１２３４５')).toBe('12345');
        expect(Battle.parseCode('12-345')).toBe('12345');
        expect(Battle.parseCode('01234')).toBeNull();
        expect(Battle.makeCode(() => 0)).toBe('10000');
        expect(Battle.cleanName('  あ\u0000い  う\u2028えおかきくけこさし ')).toBe('あい うえおかきくけ');
        expect(Battle.freeSeat(room())).toBe('3');
        expect(Battle.seatOf(room(), 'k')).toBe('1');
    });

    it('a question is settled when taken, or when everyone here took a wrong card', () => {
        expect(Battle.settled(room(), 0)).toBe(false);
        expect(Battle.settled(room({ takes: { 0: { seat: '1', round: 1 } } }), 0)).toBe(true);
        // A take of an earlier round does not count
        expect(Battle.settled(room({ takes: { 0: { seat: '1', round: 0 } } }), 0)).toBe(false);
        expect(Battle.settled(room({ faults: { 0: { 0: true, 1: true } } }), 0)).toBe(true);
    });

    it('standings: most cards, then fewest おてつき; people who left come last without a rank', () => {
        const rows = Battle.standings(room({
            takes: { 0: { seat: '1', round: 1 }, 1: { seat: '0', round: 1 }, 2: { seat: '1', round: 1 } },
            faults: { 3: { 1: true } }
        }));
        expect(rows.map(r => [r.name, r.cards, r.faults, r.rank])).toEqual([
            ['けんた', 2, 1, 1], ['あおい', 1, 0, 2], ['みさき', 0, 0, null]
        ]);
        const { questions } = Battle.makeGame(room());
        expect(rows[0].words).toEqual([questions[0].word, questions[2].word]);
    });
});

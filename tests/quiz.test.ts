import { describe, expect, it } from 'vitest';
import { kanjiDatabase } from '../src/data/kanji';
import { jukugoDatabase } from '../src/data/jukugo';
import * as Lynx from '../src/core/lynx';
import {
    KANJI_BY_GRADE, REWARDS, TILE_COUNT, WORDS_BY_GRADE, choicesFor, earnedRewards, isRightWord, kanjiQuestions,
    makeTiles, rankOf, rewardNews, wordsByReading
} from '../src/core/quiz';

describe('kanji questions and choices', () => {
    it('asks kanji of the chosen grade, each with one of its readings', () => {
        const qs = kanjiQuestions('2', 10);
        expect(qs).toHaveLength(10);
        qs.forEach(q => {
            expect(q.grade).toBe(2);
            expect(q.readings).toContain(q.targetReading);
        });
        expect(new Set(qs.map(q => q.kanji)).size).toBe(10);
    });

    it('4 different choices, and only one of them is right', () => {
        for (const q of kanjiQuestions('all', 200)) {
            const toReading = choicesFor('k-to-y', q);
            expect(new Set(toReading).size).toBe(4);
            expect(toReading.filter(r => q.readings.includes(r))).toEqual([q.targetReading]);

            const toKanji = choicesFor('y-to-k', q);
            expect(new Set(toKanji).size).toBe(4);
            const readingOf = new Map(kanjiDatabase.map(k => [k.kanji, k.readings]));
            expect(toKanji.filter(k => readingOf.get(k)?.includes(q.targetReading))).toEqual([q.kanji]);
        }
    });
});

describe('熟語くみたて tiles', () => {
    it('8 tiles with the kanji of the word, none of a later grade, and no other word of the same reading', () => {
        for (const item of jukugoDatabase) {
            const tiles = makeTiles(item).map(t => t.char);
            expect(tiles).toHaveLength(TILE_COUNT);
            [...item.word].forEach(k => expect(tiles).toContain(k));
            const gradeOf = new Map(kanjiDatabase.map(k => [k.kanji, k.grade]));
            tiles.forEach(k => expect(gradeOf.get(k)).toBeLessThanOrEqual(item.grade));
            const others = (wordsByReading.get(item.reading) || []).filter(w => w !== item.word);
            others.forEach(other => expect([...other].every(k => tiles.includes(k))).toBe(false));
        }
    });

    it('any word of the same reading is right', () => {
        const kagaku = jukugoDatabase.find(item => item.word === '科学')!;
        expect(isRightWord(kagaku, '科学')).toBe(true);
        expect(isRightWord(kagaku, '化学')).toBe(true);
        expect(isRightWord(kagaku, '学科')).toBe(false);
    });
});

describe('rank', () => {
    it('by the rate of right answers', () => {
        expect([100, 80, 79, 60, 40, 39, 0].map(p => rankOf(p).label)).toEqual(['RANK S', 'RANK A', 'RANK B', 'RANK B', 'RANK C', 'RANK D', 'RANK D']);
    });
});

describe('rewards', () => {
    const none = () => earnedRewards(new Set(), new Set(), new Set());
    const grade1 = new Set((KANJI_BY_GRADE.get(1) ?? []).map(k => k.kanji));

    it('12 accessories, one for each grade in 漢字 and in 熟語', () => {
        expect(REWARDS).toHaveLength(12);
        expect(new Set(REWARDS.map(r => r.item))).toEqual(new Set(Lynx.ITEMS.map(i => i.id)));
    });

    it('a grade of kanji gives はなまる for each ずかん, and the accessory only for both', () => {
        const yomiOnly = earnedRewards(grade1, new Set(), new Set());
        expect([...yomiOnly.yomiDone]).toEqual([1]);
        expect(yomiOnly.items.size).toBe(0);
        const both = earnedRewards(grade1, grade1, new Set());
        expect([...both.items]).toEqual(['ribbon']);
        const news = rewardNews(yomiOnly, both);
        expect(news.newItems).toEqual(['ribbon']);
        expect(news.lines).toEqual(['1年生の 漢字（読みから漢字）が ぜんぶ そろった！ はなまる！', 'ヤマネコに「リボン」を つけたよ。']);
    });

    it('100 words of a grade give an accessory', () => {
        const words = new Set((WORDS_BY_GRADE.get(1) ?? []).slice(0, 100).map(w => w.word));
        const earned = earnedRewards(new Set(), new Set(), words);
        expect([...earned.items]).toEqual(['flower']);
        expect(rewardNews(none(), earned).lines[0]).toBe('1年生の 熟語を 100こ あつめた！');
    });
});

describe('the lynx', () => {
    it('one item for each place, the later one wins', () => {
        expect(Lynx.normalizeOutfit(['ribbon', 'glasses', 'flower', 'nothing'])).toEqual(['flower', 'glasses']);
        expect(Lynx.wear(['ribbon', 'scarf'], 'crown')).toEqual(['crown', 'scarf']);
        expect(Lynx.svg(['ribbon'])).toContain('<svg');
    });
});

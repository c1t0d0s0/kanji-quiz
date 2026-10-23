import { beforeEach, describe, expect, it } from 'vitest';
import * as Records from '../src/core/records';
import { MemoryStorage } from './memory-storage';

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    Records.useStorage(storage);
    Records.use(null);
});

describe('recordResult', () => {
    it('keeps the best result and the days played', () => {
        const id = Records.itemId('k-to-y', 'all', 10);
        expect(Records.recordResult(id, 7, 10)).toMatchObject({ previous: null, isBest: true });
        expect(Records.recordResult(id, 6, 10).isBest).toBe(false);
        // The same score again is not a new best (the earlier one stays)
        expect(Records.recordResult(id, 7, 10).isBest).toBe(false);
        expect(Records.recordResult(id, 9, 10)).toMatchObject({ isBest: true, previous: { best: 7, total: 10 } });
        expect(Records.activeDayCount()).toBe(1);
    });

    it('puts the kanji in the 漢字ずかん of the mode, and the words in the 熟語ずかん', () => {
        expect(Records.recordResult(null, 1, 1, ['一', '一'], ['学校', '先生', '学校']).newlyCollected).toEqual(['一']);
        expect(Records.recordResult(null, 1, 1, ['二'], ['学校'], 'kaki')).toMatchObject({ newlyCollected: ['二'], newlyCollectedWords: [] });
        expect([...Records.getCollected('yomi')]).toEqual(['一']);
        expect([...Records.getCollected('kaki')]).toEqual(['二']);
        expect([...Records.getCollectedWords()]).toEqual(['先生', '学校']);
    });

    it('a review (no id) is not a personal best', () => {
        expect(Records.recordResult(null, 5, 5).isBest).toBe(false);
        expect(Records.load().progress).toEqual({});
    });
});

describe('older records', () => {
    it('one collected list from before 読み and 書き were separated goes to both', () => {
        storage.setItem('kanji-quiz:v1', JSON.stringify({ collected: ['三'], yomi: ['一'] }));
        expect([...Records.getCollected('yomi')]).toEqual(['一', '三']);
        expect([...Records.getCollected('kaki')]).toEqual(['三']);
    });

    it('the stroke order of 手書き is off until turned on, and kept', () => {
        expect(Records.getSettings().strokeOrder).toBeNull();
        Records.setSettings({ strokeOrder: true });
        expect(Records.getSettings().strokeOrder).toBe(true);
        Records.setSettings({ strokeOrder: false });
        expect(Records.load().settings.strokeOrder).toBe(false);
        storage.setItem('kanji-quiz:v1', JSON.stringify({ settings: { strokeOrder: 'yes' } }));
        expect(Records.getSettings().strokeOrder).toBeNull();
    });

    it('how many times to trace and to write in the 練習: 1 to 5, once until chosen', () => {
        expect(Records.getSettings()).toMatchObject({ practiceTrace: null, practiceWrite: null });
        Records.setSettings({ practiceTrace: 3, practiceWrite: 5 });
        expect(Records.getSettings()).toMatchObject({ practiceTrace: 3, practiceWrite: 5 });
        for (const broken of [0, 6, 2.5, '3']) {
            storage.setItem('kanji-quiz:v1', JSON.stringify({ settings: { practiceTrace: broken, practiceWrite: broken } }));
            expect(Records.getSettings()).toMatchObject({ practiceTrace: null, practiceWrite: null });
        }
    });

    it('settings without an outfit still load', () => {
        storage.setItem('kanji-quiz:v1', JSON.stringify({ settings: { grade: '3', count: 5, at: 1 } }));
        expect(Records.getSettings()).toEqual({ grade: '3', count: 5, outfit: null, strokeOrder: null, practiceTrace: null, practiceWrite: null, at: 1 });
    });

    it('drops what is broken', () => {
        storage.setItem('kanji-quiz:v1', JSON.stringify({
            activeDays: ['2026-10-01', 'x'], yomi: [1, '一'], words: ['学', '学校'],
            settings: { grade: '7', count: 3, outfit: ['ribbon', 'X!'] }, progress: { a: { best: 3, total: 2 }, b: { best: 1, total: 2 } }
        }));
        const s = Records.load();
        expect(s.activeDays).toEqual(['2026-10-01']);
        expect(s.yomi).toEqual(['一']);
        expect(s.words).toEqual(['学校']);
        expect(s.settings).toEqual({ grade: null, count: null, outfit: ['ribbon'], strokeOrder: null, practiceTrace: null, practiceWrite: null, at: 0 });
        expect(Object.keys(s.progress)).toEqual(['b']);
    });
});

describe('merge', () => {
    const a: Records.Snapshot = {
        ...Records.empty(),
        activeDays: ['2026-10-01'], yomi: ['一'], kaki: ['二'], words: ['学校'],
        settings: { grade: '1', count: 5, outfit: ['ribbon'], strokeOrder: null, practiceTrace: 3, practiceWrite: null, at: 2 },
        progress: { x: { best: 3, total: 5, at: 1 } }
    };
    const b: Records.Snapshot = {
        ...Records.empty(),
        activeDays: ['2026-10-02'], yomi: ['三'], kaki: [], words: ['先生'],
        settings: { grade: '2', count: null, outfit: null, strokeOrder: true, practiceTrace: 1, practiceWrite: 2, at: 1 },
        progress: { x: { best: 4, total: 5, at: 2 }, y: { best: 1, total: 5, at: 3 } }
    };

    it('the same in any order, and merging twice changes nothing', () => {
        const ab = Records.merge(a, b);
        expect(Records.merge(b, a)).toEqual(ab);
        expect(Records.merge(ab, ab)).toEqual(ab);
        expect(Records.merge(ab, a)).toEqual(ab);
    });

    it('keeps everything collected, the best results and the newer settings', () => {
        const ab = Records.merge(a, b);
        expect(ab.activeDays).toEqual(['2026-10-01', '2026-10-02']);
        expect(ab.yomi).toEqual(['一', '三']);
        expect(ab.words).toEqual(['先生', '学校']);
        expect(ab.progress.x.best).toBe(4);
        // a is newer: its grade wins; what a has not chosen (the stroke order) comes from b
        expect(ab.settings).toEqual({ grade: '1', count: 5, outfit: ['ribbon'], strokeOrder: true, practiceTrace: 3, practiceWrite: 2, at: 2 });
    });
});

describe('Firestore documents', () => {
    it('round trip, with the prefixes in completed', () => {
        const s: Records.Snapshot = { ...Records.empty(), activeDays: ['2026-10-01'], yomi: ['一'], kaki: ['二'], words: ['学校'] };
        const doc = Records.toAppDoc(s, 5);
        expect(doc.completed).toEqual(['yomi:一', 'kaki:二', 'jukugo:学校']);
        expect(Records.fromAppDoc(doc as unknown as Record<string, unknown>)).toEqual(Records.normalize(s as unknown as Record<string, unknown>));
    });

    it('a kanji without a prefix (written by an older page) counts for both', () => {
        const s = Records.fromAppDoc({ completed: ['四', 'jukugo:学校', 'kaki:五'] });
        expect([s.yomi, s.kaki, s.words]).toEqual([['四'], ['五', '四'], ['学校']]);
    });

    it('progress documents', () => {
        const p = { best: 5, total: 5, at: 9 };
        const doc = Records.toProgressDoc(p);
        expect(doc).toEqual({ schema: 1, updatedAt: 9, status: 'done', data: { best: 5, total: 5 } });
        expect(Records.fromProgressDoc(doc as unknown as Record<string, unknown>)).toEqual(p);
    });
});

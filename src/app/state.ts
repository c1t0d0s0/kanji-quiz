// --- What the screens share: the records, the selection, the screen shown, the dialogs ---
import { computed, reactive, ref } from 'vue';
import * as Lynx from '../core/lynx';
import { GRADES, earnedRewards, type Earned } from '../core/quiz';
import * as Records from '../core/records';

// --- Records ---
// Goes up whenever the records are saved or replaced (also by the sync), so what is computed
// from them is worked out again.
const recordsTick = ref(0);
Records.watch(() => {
    recordsTick.value++;
});

// Reads the records again whenever they change
export function fromRecords<T>(read: () => T) {
    return computed(() => {
        void recordsTick.value;
        return read();
    });
}

export const settings = fromRecords(() => Records.getSettings());
export const earned = fromRecords((): Earned =>
    earnedRewards(Records.getCollected('yomi'), Records.getCollected('kaki'), Records.getCollectedWords()));

// What the lynx wears: only items that were won
export const outfit = computed(() => Lynx.normalizeOutfit(settings.value.outfit).filter(id => earned.value.items.has(id)));

// --- The grade and the number of questions chosen on the home screen ---
const VALID_GRADES = ['all', ...GRADES.map(String)];
const gradeParam = new URLSearchParams(window.location.search).get('grade');
// ?grade=3 chooses the grade until another one is picked (links from a class or homework)
let urlGrade: string | null = gradeParam && VALID_GRADES.includes(gradeParam) ? gradeParam : null;

// strokeOrder: 手書き also judges the stroke order (off until turned on)
export const selection = reactive({ grade: 'all', count: 10, strokeOrder: false });

// Back to the last selection (on the first paint, back on the home screen, and after a sync)
export function restoreSelection() {
    const s = Records.getSettings();
    selection.grade = urlGrade || s.grade || selection.grade;
    selection.count = s.count || selection.count;
    selection.strokeOrder = s.strokeOrder ?? false;
}

export function chooseGrade(grade: string) {
    urlGrade = null;
    selection.grade = grade;
    Records.setSettings({ grade: grade as Records.Grade });
}

export function chooseCount(count: number) {
    selection.count = count;
    Records.setSettings({ count: count as Records.Count });
}

export function chooseStrokeOrder(on: boolean) {
    selection.strokeOrder = on;
    Records.setSettings({ strokeOrder: on });
}

// --- Screens and dialogs ---
export type Screen = 'home' | 'quiz' | 'result' | 'battle';
export const screen = ref<Screen>('home');

export function showScreen(name: Screen) {
    screen.value = name;
    window.scrollTo(0, 0);
}

export function goHome() {
    restoreSelection();
    showScreen('home');
}

// 'yomi' / 'kaki' (the 漢字ずかん) or 'words' (the 熟語ずかん); null when closed
export const zukan = ref<'yomi' | 'kaki' | 'words' | null>(null);
export const kisekaeOpen = ref(false);

// Moves the focus away, so a button just pressed on a touch screen does not stay highlighted
export function blurActive() {
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') active.blur();
}

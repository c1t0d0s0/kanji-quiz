<script setup lang="ts">
// --- The model of KanjiVG drawn in the square, with the stroke order ---
// After an answer: every stroke in red with its number; the stroke written out of order or
// backwards (wrong) under the highlighter. In the なぞり練習 (guide): the whole kanji faint,
// and the stroke to trace now under the highlighter, with a red dot where it starts and its number.
import { computed } from 'vue';

const props = defineProps<{
    model: readonly (readonly number[])[];
    // The stroke to look at again (its number), after an answer
    wrong?: number | null;
    // なぞり練習: the stroke to trace now (0-based); the model is drawn faint under the ink
    guide?: number | null;
    // なぞり練習: 'under' the ink (the faint kanji, the highlighter, the arrow) or 'over' it
    // (the red dot where the stroke starts, and its number: never hidden by the ink)
    layer?: 'under' | 'over';
}>();

const strokes = computed(() => {
    // A number goes just before the start of its stroke, moved aside when it would cover another
    const placed: { x: number; y: number }[] = [];
    return props.model.map((flat, i) => {
        const points: string[] = [];
        for (let k = 0; k + 1 < flat.length; k += 2) points.push(`${flat[k]},${flat[k + 1]}`);
        let x = flat[0] - 7, y = flat[1] + 2;
        while (placed.some(q => Math.abs(q.x - x) < 6 && Math.abs(q.y - y) < 7)) x += 7;
        placed.push({ x, y });
        return { points: points.join(' '), x, y, startX: flat[0], startY: flat[1], number: i + 1, wrong: props.wrong === i + 1 };
    });
});
// The stroke to trace now. Its number goes just left of its start (only one number is shown,
// so there is nothing to keep clear of); right of it when the start is at the left edge
const current = computed(() => {
    const s = props.guide === null || props.guide === undefined ? null : strokes.value[props.guide];
    if (!s) return null;
    return { ...s, x: s.startX >= 12 ? s.startX - 10 : s.startX + 5, y: s.startY + 3 };
});
</script>

<template>
    <!-- なぞり練習: under the ink -->
    <svg v-if="guide !== null && guide !== undefined && layer === 'over'" class="tegaki-guide" viewBox="0 0 109 109" aria-hidden="true">
        <template v-if="current">
            <circle class="guide-start" :cx="current.startX" :cy="current.startY" r="3.2" />
            <text class="guide-number" :x="current.x" :y="current.y">{{ current.number }}</text>
        </template>
    </svg>
    <svg v-else-if="guide !== null && guide !== undefined" class="tegaki-guide" viewBox="0 0 109 109" aria-hidden="true">
        <defs>
            <marker id="guide-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" />
            </marker>
        </defs>
        <polyline v-for="s in strokes" :key="s.number" class="guide-faint" :points="s.points" />
        <template v-if="current">
            <polyline class="guide-now" :points="current.points" />
            <!-- Which way to go -->
            <polyline class="guide-arrow" :points="current.points" marker-end="url(#guide-arrow)" />
        </template>
    </svg>
    <!-- After an answer: over the ink -->
    <svg v-else class="tegaki-model" viewBox="0 0 109 109" aria-hidden="true">
        <!-- The stroke written out of order or backwards, marked with the highlighter -->
        <polyline v-for="s in strokes.filter(m => m.wrong)" :key="`w${s.number}`" class="is-wrong-mark" :points="s.points" />
        <polyline v-for="s in strokes" :key="s.number" :points="s.points" />
        <text v-for="s in strokes" :key="`n${s.number}`" :class="{ 'is-wrong': s.wrong }" :x="s.x" :y="s.y">{{ s.number }}</text>
    </svg>
</template>

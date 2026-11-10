<script setup lang="ts">
// --- なりたち: the picture appears (and moves), turns into the parts of the kanji, and the kanji
// is written stroke by stroke in the order of KanjiVG. Without motion (prefers-reduced-motion):
// the picture and the kanji side by side.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { leanOrigin, morphTransforms } from '../core/naritachi';
import type { Naritachi } from '../data/naritachi';

const props = defineProps<{
    entry: Naritachi;
    model: readonly (readonly number[])[];
}>();

const svg = ref<SVGSVGElement | null>(null);
const done = ref(false);
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const parts = computed(() => props.entry.parts.map(part => ({
    part, lean: leanOrigin(part), ...morphTransforms(part, props.model)
})));
const strokes = computed(() => props.model.map(flat => {
    const points: string[] = [];
    for (let k = 0; k + 1 < flat.length; k += 2) points.push(`${flat[k]},${flat[k + 1]}`);
    return points.join(' ');
}));

// The timing (ms)
const DRAW = 900, PART_GAP = 350, ENTER = 1100, HOLD = 700, MORPH = 900, STROKE = 380, STROKE_GAP = 90;

let timer: ReturnType<typeof setTimeout> | undefined;

function stop() {
    clearTimeout(timer);
    svg.value?.getAnimations({ subtree: true }).forEach(a => a.cancel());
}

function play() {
    stop();
    done.value = false;
    const root = svg.value;
    if (!root || still) {
        done.value = true;
        return;
    }
    const groups = [...root.querySelectorAll<SVGGElement>('.nt-part')];
    let t = 0;
    parts.value.forEach((p, i) => {
        const outer = groups[i], inner = outer?.firstElementChild as SVGGElement | null;
        if (!outer || !inner) return;
        const start = i * PART_GAP;
        // The lines of the picture are drawn
        inner.querySelectorAll('path').forEach(path => {
            path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: DRAW, delay: start, easing: 'ease-out', fill: 'both' });
        });
        // It comes into its place, and leans
        const [dx, dy] = p.part.from ?? [0, 0];
        const lean = p.part.lean ?? 0;
        if (dx || dy || lean) {
            inner.animate([
                { transform: `translate(${dx}px, ${dy}px) rotate(0deg)` },
                { transform: 'translate(0px, 0px) rotate(0deg)', offset: lean ? 0.65 : 1 },
                { transform: `translate(0px, 0px) rotate(${lean}deg)` }
            ], { duration: ENTER, delay: start, easing: 'ease-in-out', fill: 'both' });
        }
        t = Math.max(t, start + Math.max(DRAW, dx || dy || lean ? ENTER : 0));
    });
    // Every part goes to the place of its strokes, and fades
    const morphAt = t + HOLD;
    parts.value.forEach((p, i) => {
        groups[i]?.animate([
            { transform: p.start, opacity: 1 },
            { transform: p.end, opacity: 0.55, offset: 0.7 },
            { transform: p.end, opacity: 0 }
        ], { duration: MORPH + 600, delay: morphAt, easing: 'ease-in-out', fill: 'both' });
    });
    // The kanji is written, stroke by stroke
    let at = morphAt + MORPH * 0.6;
    root.querySelectorAll('.nt-stroke').forEach(line => {
        line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: STROKE, delay: at, easing: 'ease-in-out', fill: 'both' });
        at += STROKE + STROKE_GAP;
    });
    timer = setTimeout(() => { done.value = true; }, at);
}

onMounted(play);
onBeforeUnmount(stop);
watch(() => [props.entry, props.model], () => void nextTick(play));

defineExpose({ play });
</script>

<template>
    <div class="naritachi-stage" :class="{ 'is-still': still }">
        <template v-if="still">
            <svg class="naritachi-svg" viewBox="0 0 109 109" role="img" :aria-label="`${entry.kanji}の もとに なった 絵`">
                <g v-for="(p, i) in parts" :key="i"><path v-for="(d, k) in p.part.paths" :key="k" class="nt-pic" :d="d" /></g>
            </svg>
            <span class="naritachi-arrow" aria-hidden="true">→</span>
            <svg class="naritachi-svg" viewBox="0 0 109 109" role="img" :aria-label="entry.kanji">
                <polyline v-for="(s, i) in strokes" :key="i" class="nt-stroke is-shown" :points="s" />
            </svg>
        </template>
        <svg v-else ref="svg" class="naritachi-svg" viewBox="0 0 109 109" role="img" :aria-label="`${entry.kanji}の なりたち`">
            <g v-for="(p, i) in parts" :key="i" class="nt-part">
                <g class="nt-enter" :style="{ transformOrigin: p.lean }">
                    <path v-for="(d, k) in p.part.paths" :key="k" class="nt-pic" :d="d" pathLength="1" />
                </g>
            </g>
            <polyline v-for="(s, i) in strokes" :key="i" class="nt-stroke" :points="s" pathLength="1" />
        </svg>
        <p class="naritachi-text" :class="{ 'is-shown': done }"><b class="naritachi-kanji">{{ entry.kanji }}</b> {{ entry.text }}</p>
    </div>
</template>

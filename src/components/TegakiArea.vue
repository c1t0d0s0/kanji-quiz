<script setup lang="ts">
// --- 手書き: write the kanji in a practice square with a finger, a pen or the mouse ---
// The writing stays here (not in the reactive state: a stroke has hundreds of points);
// session.ts reads it through tegakiPad when the time is up.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Point, Stroke } from '../core/handwriting';
import { quiz } from '../app/quiz-view';
import { tegakiPad } from '../app/tegaki';
import { submitTegaki } from '../app/session';

const props = defineProps<{ hidden: boolean }>();

const space = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
// The side of the square, in CSS pixels: as big as the space left on the screen allows
const size = ref(0);
// How many strokes are written (for the buttons)
const count = ref(0);

let strokes: Stroke[] = [];
// The pointer writing now; any other finger is ignored
let pointer: number | null = null;

const locked = computed(() => !quiz.tegaki || quiz.tegaki.locked);

function ink() {
    return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1c2a4a';
}

function context() {
    const c = canvas.value;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return null;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size.value * 0.035);
    ctx.strokeStyle = ink();
    return ctx;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    // A dot is drawn as a very short line, so it shows
    if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.01, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
    ctx.stroke();
}

function redraw() {
    const c = canvas.value;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const px = Math.round(size.value * ratio);
    if (c.width !== px) {
        c.width = px;
        c.height = px;
    }
    const ctx = context();
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size.value, size.value);
    strokes.forEach(s => drawStroke(ctx, s));
}

function clear() {
    strokes = [];
    count.value = 0;
    pointer = null;
    redraw();
}

function undo() {
    strokes = strokes.slice(0, -1);
    count.value = strokes.length;
    redraw();
}

function where(e: PointerEvent): Point {
    const box = canvas.value!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
}

function down(e: PointerEvent) {
    if (locked.value || pointer !== null || !e.isPrimary || e.button > 0) return;
    pointer = e.pointerId;
    canvas.value?.setPointerCapture(e.pointerId);
    strokes.push([where(e)]);
    count.value = strokes.length;
    const ctx = context();
    if (ctx) drawStroke(ctx, strokes[strokes.length - 1]);
}

function move(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    const stroke = strokes[strokes.length - 1];
    const ctx = context();
    // Every point the device saw since the last event, for smooth lines
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length > 0 ? events : [e]) {
        const p = where(ev);
        const last = stroke[stroke.length - 1];
        stroke.push(p);
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
    }
}

function up(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    pointer = null;
}

function answer() {
    if (strokes.length > 0) submitTegaki(strokes);
}

// The model, drawn over the writing after the answer: the strokes in red with their numbers
const model = computed(() => {
    const t = quiz.tegaki;
    if (!t || !t.locked) return [];
    // A number goes just before the start of its stroke, moved aside when it would cover another
    const placed: { x: number; y: number }[] = [];
    return t.model.map((flat, i) => {
        const points: string[] = [];
        for (let k = 0; k + 1 < flat.length; k += 2) points.push(`${flat[k]},${flat[k + 1]}`);
        let x = flat[0] - 7, y = flat[1] + 2;
        while (placed.some(q => Math.abs(q.x - x) < 6 && Math.abs(q.y - y) < 7)) x += 7;
        placed.push({ x, y });
        return { points: points.join(' '), x, y, number: i + 1, wrong: t.wrongStroke === i + 1 };
    });
});

// The square fills the space left between the question and the answer
let observer: ResizeObserver | null = null;
function fit() {
    const s = space.value;
    if (!s || props.hidden) return;
    const next = Math.floor(Math.min(s.clientWidth, s.clientHeight));
    if (next > 0 && next !== size.value) {
        size.value = next;
        // Stretch what was written to the new size
        const ratio = canvas.value && canvas.value.clientWidth ? next / canvas.value.clientWidth : 1;
        if (ratio !== 1) strokes = strokes.map(st => st.map(p => ({ x: p.x * ratio, y: p.y * ratio })));
        requestAnimationFrame(redraw);
    }
}

onMounted(() => {
    tegakiPad.strokes = () => strokes;
    tegakiPad.clear = clear;
    observer = new ResizeObserver(fit);
    if (space.value) observer.observe(space.value);
});
onBeforeUnmount(() => observer?.disconnect());

// A new question: a clean square
watch(() => quiz.turn, clear);
</script>

<template>
    <div id="tegaki-area" class="tegaki" :hidden="hidden">
        <div ref="space" class="tegaki-space">
            <div class="tegaki-pad" :class="quiz.tegaki?.mark" :style="{ width: `${size}px`, height: `${size}px` }">
                <canvas ref="canvas" class="tegaki-canvas" :class="{ 'is-locked': locked }" aria-label="ここに 漢字を 書こう"
                    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @contextmenu.prevent></canvas>
                <!-- The model of KanjiVG, with the stroke order -->
                <svg v-if="model.length" class="tegaki-model" viewBox="0 0 109 109" aria-hidden="true">
                    <!-- The stroke written out of order or backwards, marked with the highlighter -->
                    <polyline v-for="s in model.filter(m => m.wrong)" :key="`w${s.number}`" class="is-wrong-mark" :points="s.points" />
                    <polyline v-for="s in model" :key="s.number" :points="s.points" />
                    <text v-for="s in model" :key="`n${s.number}`" :class="{ 'is-wrong': s.wrong }" :x="s.x" :y="s.y">{{ s.number }}</text>
                </svg>
            </div>
        </div>
        <div class="tegaki-actions">
            <button type="button" class="btn" :disabled="locked || count === 0" @click="undo">1画 もどす</button>
            <button type="button" class="btn" :disabled="locked || count === 0" @click="clear">けす</button>
            <button type="button" class="btn btn-primary" :disabled="locked || count === 0" @click="answer">こたえる</button>
        </div>
        <p class="tegaki-credit">字の形と書き順: <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel)
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
    </div>
</template>

<script setup lang="ts">
// --- A practice square to write in with a finger, a pen or the mouse ---
// Used by the 手書き quiz and the なぞり練習. The writing stays here (not in the reactive state:
// a stroke has hundreds of points); the parent reads it through the exposed functions.
// Pictures go under the ink (slot "under": what to trace) or over it (default slot: the model).
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Point, Stroke } from '../core/handwriting';

const props = defineProps<{
    hidden?: boolean;
    // No writing (after the answer)
    locked?: boolean;
    // The writing fades (the model is drawn over it)
    faded?: boolean;
    // '' | 'correct' | 'incorrect': marked like a test paper
    mark?: string;
}>();
const emit = defineEmits<{
    // A stroke was finished, in CSS pixels of a square of the given size
    stroke: [stroke: Stroke, size: number];
    // How many strokes are written now
    count: [count: number];
}>();

const space = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
// The side of the square, in CSS pixels: as big as the space left on the screen allows
const size = ref(0);

let strokes: Stroke[] = [];
// The pointer writing now; any other finger is ignored
let pointer: number | null = null;

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

function changed() {
    emit('count', strokes.length);
}

function clear() {
    strokes = [];
    pointer = null;
    redraw();
    changed();
}

function undo() {
    strokes = strokes.slice(0, -1);
    redraw();
    changed();
}

function where(e: PointerEvent): Point {
    const box = canvas.value!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
}

function down(e: PointerEvent) {
    if (props.locked || pointer !== null || !e.isPrimary || e.button > 0) return;
    pointer = e.pointerId;
    canvas.value?.setPointerCapture(e.pointerId);
    strokes.push([where(e)]);
    const ctx = context();
    if (ctx) drawStroke(ctx, strokes[strokes.length - 1]);
    changed();
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
    emit('stroke', strokes[strokes.length - 1], size.value);
}

// The square fills the space it is given
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
    observer = new ResizeObserver(fit);
    if (space.value) observer.observe(space.value);
});
onBeforeUnmount(() => observer?.disconnect());

defineExpose({ strokes: () => strokes, clear, undo });
</script>

<template>
    <div ref="space" class="tegaki-space">
        <div class="tegaki-pad" :class="mark" :style="{ width: `${size}px`, height: `${size}px` }">
            <slot name="under"></slot>
            <canvas ref="canvas" class="tegaki-canvas" :class="{ 'is-locked': faded }" aria-label="ここに 漢字を 書こう"
                @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @contextmenu.prevent></canvas>
            <slot></slot>
        </div>
    </div>
</template>

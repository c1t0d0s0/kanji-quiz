<script setup lang="ts">
// --- 手書き: write the kanji in a practice square with a finger, a pen or the mouse ---
// session.ts reads the writing through tegakiPad when the time is up.
import { computed, onMounted, ref, watch } from 'vue';
import { quiz } from '../app/quiz-view';
import { tegakiPad } from '../app/tegaki';
import { nextTegaki, submitTegaki } from '../app/session';
import ModelStrokes from './ModelStrokes.vue';
import WritingPad from './WritingPad.vue';

defineProps<{ hidden: boolean }>();

const pad = ref<InstanceType<typeof WritingPad> | null>(null);
// How many strokes are written (for the buttons)
const count = ref(0);

const locked = computed(() => !quiz.tegaki || quiz.tegaki.locked);

function answer() {
    const strokes = pad.value?.strokes() ?? [];
    if (strokes.length > 0) submitTegaki(strokes);
}

onMounted(() => {
    tegakiPad.strokes = () => pad.value?.strokes() ?? [];
    tegakiPad.clear = () => pad.value?.clear();
});

// ?debug: the measures of the last answer against their limits (✗ = over), and the writing to copy
const debugRows = computed(() => {
    const d = quiz.tegaki?.debug;
    const v = d?.verdict;
    if (!d || !v) return [];
    const keys = ['shape', 'strokes', 'worst', 'flips', 'meets'] as const;
    return [
        `${d.kanji} ${d.grade}年生  ${v.reason}  画 ${v.written}/${v.expected}  つなぎ ${v.joins}/${d.limits.joins}`,
        ...keys.map(k => `${v[k] > d.limits[k] ? '✗' : '・'} ${k} ${Number.isInteger(v[k]) ? v[k] : v[k].toFixed(3)} / ${d.limits[k]}`),
        `hint ${JSON.stringify(v.hint)}  order ${JSON.stringify(v.order)}`
    ];
});
const copied = ref('');
async function copyWriting() {
    const d = quiz.tegaki?.debug;
    if (!d || !pad.value) return;
    const strokes = pad.value.strokes().map(s => s.map(p => [Math.round(p.x), Math.round(p.y)]));
    const text = JSON.stringify({ kanji: d.kanji, grade: d.grade, size: pad.value.size(), strokes });
    try {
        await navigator.clipboard.writeText(text);
        copied.value = 'コピーしました';
    } catch {
        copied.value = text;
    }
}
watch(() => quiz.turn, () => {
    copied.value = '';
});

// A new question: a clean square
watch(() => quiz.turn, () => pad.value?.clear());
</script>

<template>
    <div id="tegaki-area" class="tegaki" :hidden="hidden">
        <WritingPad ref="pad" :hidden="hidden" :locked="locked" :faded="locked" :mark="quiz.tegaki?.mark"
            :highlight="quiz.tegaki?.locked ? quiz.tegaki.extraStroke : null" @count="count = $event">
            <!-- The model of KanjiVG, with the stroke order, after the answer -->
            <ModelStrokes v-if="quiz.tegaki?.locked" :model="quiz.tegaki.model" :wrong="quiz.tegaki.wrongStroke" />
        </WritingPad>
        <div class="tegaki-actions">
            <button type="button" class="btn" :disabled="locked || count === 0" @click="pad?.undo()">1画 もどす</button>
            <button type="button" class="btn" :disabled="locked || count === 0" @click="pad?.clear()">けす</button>
            <button type="button" class="btn btn-primary" :disabled="locked || count === 0" @click="answer">こたえる</button>
        </div>
        <div v-if="debugRows.length" class="tegaki-debug">
            <pre>{{ debugRows.join('\n') }}</pre>
            <div class="tegaki-actions">
                <button type="button" class="btn" @click="copyWriting">書いた線を コピー</button>
                <button type="button" class="btn btn-primary" @click="nextTegaki">つぎへ</button>
            </div>
            <textarea v-if="copied && copied !== 'コピーしました'" readonly :value="copied" rows="3"></textarea>
            <p v-else-if="copied">{{ copied }}</p>
        </div>
        <p class="tegaki-credit">字の形と書き順: <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel)
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
    </div>
</template>

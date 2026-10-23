<script setup lang="ts">
// --- 手書き: write the kanji in a practice square with a finger, a pen or the mouse ---
// session.ts reads the writing through tegakiPad when the time is up.
import { computed, onMounted, ref, watch } from 'vue';
import { quiz } from '../app/quiz-view';
import { tegakiPad } from '../app/tegaki';
import { submitTegaki } from '../app/session';
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

// A new question: a clean square
watch(() => quiz.turn, () => pad.value?.clear());
</script>

<template>
    <div id="tegaki-area" class="tegaki" :hidden="hidden">
        <WritingPad ref="pad" :hidden="hidden" :locked="locked" :faded="locked" :mark="quiz.tegaki?.mark" @count="count = $event">
            <!-- The model of KanjiVG, with the stroke order, after the answer -->
            <ModelStrokes v-if="quiz.tegaki?.locked" :model="quiz.tegaki.model" :wrong="quiz.tegaki.wrongStroke" />
        </WritingPad>
        <div class="tegaki-actions">
            <button type="button" class="btn" :disabled="locked || count === 0" @click="pad?.undo()">1画 もどす</button>
            <button type="button" class="btn" :disabled="locked || count === 0" @click="pad?.clear()">けす</button>
            <button type="button" class="btn btn-primary" :disabled="locked || count === 0" @click="answer">こたえる</button>
        </div>
        <p class="tegaki-credit">字の形と書き順: <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel)
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
    </div>
</template>

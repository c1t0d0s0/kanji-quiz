<script setup lang="ts">
// --- なぞり練習: the list of a grade's kanji, and one kanji practised ---
// ① trace the model stroke by stroke (the stroke to trace is under the highlighter)
// ② write it without the model, judged with the stroke order
import { computed, ref, watch } from 'vue';
import { kanjiDatabase } from '../data/kanji';
import type { Stroke } from '../core/handwriting';
import { GRADES } from '../core/quiz';
import { goHome, screen } from '../app/state';
import { exitPractice, isLast, nextKanji, practice, practiseKanji, retrace, submitWriting, traceStroke } from '../app/practice';
import ModelStrokes from './ModelStrokes.vue';
import WritingPad from './WritingPad.vue';

const pad = ref<InstanceType<typeof WritingPad> | null>(null);
// How many strokes are written (for the buttons)
const count = ref(0);

const list = computed(() => kanjiDatabase.filter(k => k.grade === practice.listGrade));
const item = computed(() => practice.queue[practice.index]);

function onStroke(stroke: Stroke, size: number) {
    // A stroke that does not follow the model is taken away again
    if (practice.stage === 'trace' && !traceStroke(stroke, size)) pad.value?.undo();
}

function answer() {
    submitWriting(pad.value?.strokes() ?? []);
}

// A new stage or a new kanji: a clean square
watch(() => practice.turn, () => pad.value?.clear());
</script>

<template>
    <div id="practice-screen" class="screen"
        :class="[{ active: screen === 'practice' }, practice.view === 'list' ? 'result-screen practice-list' : 'game is-tegaki is-practice']">
        <!-- Which kanji to practise -->
        <div v-if="practice.view === 'list'" class="result-card">
            <header class="battle-head">
                <button type="button" class="home-btn" @click="goHome"><span aria-hidden="true">‹</span>ホーム</button>
                <h1>手書きの <ruby>練習<rt>れんしゅう</rt></ruby></h1>
            </header>
            <p class="result-sub">れんしゅうする 漢字を えらぼう。お手本を なぞってから、見ないで 書くよ。</p>
            <div class="seg practice-grades" role="group" aria-label="学年">
                <button v-for="g in GRADES" :key="g" type="button" class="seg-option" :class="{ active: practice.listGrade === g }"
                    :aria-pressed="practice.listGrade === g ? 'true' : 'false'" @click="practice.listGrade = g">{{ g }}年生</button>
            </div>
            <div class="zukan-grid practice-grid">
                <button v-for="k in list" :key="k.kanji" type="button" class="zukan-cell is-collected" :aria-label="`${k.kanji} を れんしゅうする`"
                    @click="practiseKanji(k.kanji)">{{ k.kanji }}</button>
            </div>
        </div>

        <!-- One kanji -->
        <template v-else-if="item">
            <header class="bar">
                <button type="button" class="home-btn" @click="exitPractice"><span aria-hidden="true">‹</span>もどる</button>
                <div class="header-left">
                    <span class="practice-counter">れんしゅう {{ practice.index + 1 }} / {{ practice.queue.length }}</span>
                    <span class="badge">{{ item.grade }}年生</span>
                </div>
            </header>

            <div class="practice-head">
                <p v-if="item.phrase" class="practice-phrase">{{ item.phrase.before }}<span class="phrase-reading">({{ item.phrase.reading }})</span>{{ item.phrase.after }}</p>
                <ol class="practice-steps">
                    <li :class="{ 'is-now': practice.stage === 'trace', 'is-done': practice.stage !== 'trace' }">① なぞる</li>
                    <li :class="{ 'is-now': practice.stage !== 'trace' }">② 見ないで 書く</li>
                </ol>
            </div>

            <div class="tegaki">
                <WritingPad ref="pad" :locked="practice.stage === 'done'" :faded="practice.stage === 'done'" :mark="practice.mark"
                    @stroke="onStroke" @count="count = $event">
                    <template #under>
                        <ModelStrokes v-if="practice.stage === 'trace'" :model="practice.model" :guide="practice.traced" />
                    </template>
                    <ModelStrokes v-if="practice.stage === 'trace'" :model="practice.model" :guide="practice.traced" layer="over" />
                    <ModelStrokes v-if="practice.stage === 'done'" :model="practice.model" :wrong="practice.wrongStroke" />
                </WritingPad>
                <div class="tegaki-actions">
                    <template v-if="practice.stage === 'trace'">
                        <button type="button" class="btn" :disabled="practice.traced === 0" @click="retrace">はじめから</button>
                    </template>
                    <template v-else-if="practice.stage === 'write'">
                        <button type="button" class="btn" :disabled="count === 0" @click="pad?.undo()">1画 もどす</button>
                        <button type="button" class="btn" :disabled="count === 0" @click="pad?.clear()">けす</button>
                        <button type="button" class="btn btn-primary" :disabled="count === 0" @click="answer">こたえる</button>
                    </template>
                    <template v-else>
                        <button v-if="practice.mark !== 'correct'" type="button" class="btn btn-primary" @click="retrace">もう一度 なぞる</button>
                        <button type="button" class="btn" :class="{ 'btn-primary': practice.mark === 'correct' }" @click="nextKanji">{{ isLast() ? 'おわる' : 'つぎの 字へ' }}</button>
                    </template>
                </div>
                <p class="tegaki-credit">字の形と書き順: <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel)
                    <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
            </div>

            <div class="practice-feedback" role="status">
                <p class="practice-message" :class="practice.messageKind">{{ practice.message }}</p>
                <!-- The kanji and its readings (hidden while writing without the model) -->
                <p class="answer-note" :class="{ 'is-hidden': practice.stage === 'write' }">
                    <span class="answer-kanji">{{ item.kanji }}</span> {{ item.readings.join('・') }}
                </p>
            </div>
        </template>
    </div>
</template>

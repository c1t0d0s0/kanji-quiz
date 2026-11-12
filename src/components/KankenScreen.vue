<script setup lang="ts">
// --- 漢検もぎ試験: the exam (one question at a time) and its result ---
import { computed, ref, watch } from 'vue';
import { examLevel } from '../core/kanken';
import { screen } from '../app/state';
import { TIME_UP, choose, current, exam, quitKanken, sectionOf, skip, startKanken, submitWriting, unfind } from '../app/kanken';
import Hanamaru from './Hanamaru.vue';
import WritingPad from './WritingPad.vue';

const pad = ref<InstanceType<typeof WritingPad> | null>(null);
// How many strokes are written (for the buttons)
const count = ref(0);

const q = computed(() => (exam.phase === 'exam' ? current() : undefined));
const isKaki = computed(() => q.value?.kind === 'kaki');
// A kanji alone (部首) goes in a practice square; anything longer is a sentence
const single = computed(() => q.value?.kind === 'choice' && !q.value.prompt.before && !q.value.prompt.after && [...q.value.prompt.mark].length === 1);
const options = computed(() => {
    const now = q.value;
    if (!now || now.kind === 'kaki') return [];
    if (now.kind === 'choice') return now.choices;
    return exam.found ? now.fix : now.find;
});
// Kanji choices are drawn bigger
const kanjiOptions = computed(() => options.value.every(o => [...o].length <= 2 && /\p{Script=Han}/u.test(o)));
const progress = computed(() => `${(exam.index / Math.max(1, exam.questions.length)) * 100}%`);
const level = computed(() => examLevel(exam.kyu, exam.mode));
const mini = computed(() => exam.mode === 'mini');

// A new question: a clean square
watch(() => exam.turn, () => {
    pad.value?.clear();
    count.value = 0;
});

function answerWriting() {
    const strokes = pad.value?.strokes() ?? [];
    if (strokes.length > 0) submitWriting(strokes);
}

const what = (given: string) => (given ? given : 'わからない');
// The time left, as 39:58; the last 5 minutes are marked
const clock = computed(() => `${Math.floor(exam.left / 60)}:${String(exam.left % 60).padStart(2, '0')}`);
const hurry = computed(() => exam.left <= 300);
</script>

<template>
    <div id="kanken-screen" class="screen kanken"
        :class="[{ active: screen === 'kanken' }, exam.phase === 'exam' ? 'game is-kanken' : 'result-screen', { 'is-tegaki': isKaki }]">
        <!-- The exam -->
        <template v-if="exam.phase === 'exam'">
            <header class="bar">
                <button type="button" class="home-btn" aria-label="試験を やめて ホームに もどる" @click="quitKanken"><span aria-hidden="true">‹</span>やめる</button>
                <div class="header-left">
                    <span class="kanken-counter">第{{ exam.index + 1 }}問 / {{ exam.questions.length }}問</span>
                    <span class="badge">漢検{{ exam.kyu }}級{{ mini ? ' ミニ' : '' }}</span>
                </div>
                <span class="kanken-clock" :class="{ 'is-hurry': hurry }" role="timer" aria-label="のこり時間">のこり {{ clock }}</span>
            </header>
            <div class="progress-container">
                <div class="kanken-progress" :style="{ width: progress }"></div>
            </div>

            <template v-if="q">
                <div class="kanken-question">
                    <p class="kanken-section">{{ sectionOf(q) }}<span class="kanken-points">{{ q.points }}点</span></p>
                    <!-- 書き取り: the phrase, with the reading of the kanji to write in brackets -->
                    <template v-if="q.kind === 'kaki'">
                        <p class="kanken-lead">（　）の 読みの 漢字を 書こう</p>
                        <p class="kanken-sentence">{{ q.phrase.before }}<span class="phrase-reading">({{ q.phrase.reading }})</span>{{ q.phrase.after }}</p>
                        <p class="question-hint" :hidden="!q.hint">{{ q.hint }}</p>
                    </template>
                    <!-- 誤字訂正: first the wrong kanji, then the right one -->
                    <template v-else-if="q.kind === 'goji'">
                        <p class="kanken-lead">{{ exam.found ? `「${exam.found}」の 正しい 漢字を えらぼう` : 'まちがって 使われている 漢字を えらぼう' }}</p>
                        <p class="kanken-sentence is-long">{{ q.sentence }}</p>
                    </template>
                    <template v-else>
                        <p class="kanken-lead">{{ q.prompt.lead }}</p>
                        <p class="kanken-sentence" :class="{ 'is-kanji': single }">{{ q.prompt.before }}<span :class="single ? '' : 'kanken-mark'">{{ q.prompt.mark }}</span>{{ q.prompt.after }}</p>
                    </template>
                </div>

                <div class="tegaki" :hidden="!isKaki">
                    <WritingPad ref="pad" :hidden="!isKaki" @count="count = $event" />
                    <div class="tegaki-actions">
                        <button type="button" class="btn" :disabled="count === 0" @click="pad?.undo()">1画 もどす</button>
                        <button type="button" class="btn" :disabled="count === 0" @click="pad?.clear()">けす</button>
                        <button type="button" class="btn" @click="skip">わからない</button>
                        <button type="button" class="btn btn-primary" :disabled="count === 0" @click="answerWriting">こたえる</button>
                    </div>
                </div>

                <div class="options kanken-options" :hidden="isKaki">
                    <button v-for="(text, i) in options" :key="`${exam.turn}:${exam.found}:${i}`" type="button"
                        class="option" :class="{ 'is-kanji': kanjiOptions }" @click="choose(i)">{{ text }}</button>
                </div>
                <p v-if="q.kind === 'goji' && exam.found" class="kanken-back"><button type="button" class="btn" @click="unfind">えらびなおす</button></p>
            </template>
        </template>

        <!-- The result -->
        <div v-else class="result-card kanken-result">
            <div class="result-head">
                <Hanamaru :key="exam.turn" :hidden="!exam.passed" />
                <div>
                    <h1>漢検{{ exam.kyu }}級 {{ mini ? 'ミニ試験' : 'もぎ試験' }}</h1>
                    <p class="result-sub">合格ライン {{ exam.pass }}点 / {{ exam.max }}点（{{ level.minutes }}分）</p>
                </div>
            </div>
            <div class="result-score">
                <p id="kanken-score" class="kanken-score"><b>{{ exam.score }}</b>点<span class="kanken-max"> / {{ exam.max }}</span></p>
                <div :key="exam.turn" class="rank-badge kanken-stamp" :class="{ 'is-fail': !exam.passed }">{{ exam.passed ? '合格' : 'もう少し' }}</div>
            </div>
            <p class="kanken-message">{{ exam.passed ? (mini ? '合格の 目安に とどいたよ！ 本番の 試験にも ちょうせんしよう。' : `おめでとう！ 漢検${exam.kyu}級に 合格できる 力が あるよ。`) : `あと ${exam.pass - exam.score}点で 合格！ まちがえた 問題を 見なおそう。` }}</p>
            <p class="kanken-timeout" :hidden="!exam.timedOut">時間切れ！ 答えられなかった 問題は まちがいに なるよ。</p>
            <p class="best-note" :class="{ 'is-new': exam.bestNote?.isNew }" :hidden="!exam.bestNote">{{ exam.bestNote?.text ?? '' }}</p>
            <section class="reward kanken-title-won" :hidden="!exam.newTitle">
                <div class="reward-text">
                    <h2>しょうごう ゲット！</h2>
                    <p>ヤマネコの 下に「{{ exam.newTitle }}」が つくよ。</p>
                </div>
            </section>
            <section class="result-section">
                <h2>問題ごとの 点数</h2>
                <ul class="kanken-sections">
                    <li v-for="row in exam.sections" :key="row.label" :class="{ 'is-full': row.got === row.max }">
                        <span>{{ row.label }}</span><b>{{ row.got }} / {{ row.max }}</b>
                    </li>
                </ul>
            </section>
            <section class="result-section" :hidden="exam.missed.length === 0">
                <h2>まちがえた 問題</h2>
                <ul class="kanken-missed">
                    <li v-for="(m, i) in exam.missed" :key="i">
                        <span class="kanken-missed-section">{{ sectionOf(m.question) }}</span>
                        <span class="kanken-missed-answer">{{ m.question.explain }}</span>
                        <span class="kanken-missed-given">{{ m.given === TIME_UP ? TIME_UP : `あなたの 答え: ${what(m.given)}` }}</span>
                    </li>
                </ul>
            </section>
            <div class="result-actions">
                <button type="button" class="btn" @click="startKanken(exam.kyu, exam.mode)">もう一度 受ける</button>
                <button type="button" class="btn btn-primary" @click="quitKanken">ホームに もどる</button>
            </div>
        </div>
    </div>
</template>

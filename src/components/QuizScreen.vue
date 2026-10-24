<script setup lang="ts">
import { computed } from 'vue';
import { quiz } from '../app/quiz-view';
import { screen } from '../app/state';
import { choose, placeTile, quitQuiz, returnTile, takeCard } from '../app/session';
import { playing, quitBattle, takeBattleCard } from '../app/battle';
import KarutaField from './KarutaField.vue';
import TegakiArea from './TegakiArea.vue';

const isKumitate = computed(() => quiz.mode === 'kumitate');
const isKaruta = computed(() => quiz.mode === 'karuta');
const isTegaki = computed(() => quiz.mode === 'tegaki');
const next = computed(() => (quiz.build ? quiz.build.slots.indexOf(null) : -1));

function quit() {
    if (playing()) quitBattle();
    else quitQuiz();
}

function take(index: number) {
    if (quiz.battle) takeBattleCard(index);
    else takeCard(index);
}

const optionClass = (i: number) => {
    const option = quiz.options[i];
    return ['option', quiz.optionsKanji ? 'is-kanji' : '', option?.state ?? ''].filter(Boolean).join(' ');
};
</script>

<template>
    <div id="quiz-screen" class="screen game"
        :class="{ active: screen === 'quiz', 'is-kumitate': isKumitate, 'is-karuta': isKaruta, 'is-tegaki': isTegaki, 'is-battle': quiz.battle }">
        <header class="bar" id="quiz-header">
            <button type="button" id="quit-btn" class="home-btn" aria-label="ホームにもどる" @click="quit"><span aria-hidden="true">‹</span>ホーム</button>
            <div class="header-left">
                <span id="question-counter">{{ quiz.counter }}</span>
                <span id="grade-badge" class="badge">{{ quiz.badge }}</span>
            </div>
            <div id="timer" :class="{ warning: quiz.timerWarning }" role="timer" aria-label="のこり時間">{{ quiz.timer }}</div>
        </header>

        <div class="progress-container">
            <div id="progress-bar" :style="{ width: `${quiz.progress}%` }"></div>
        </div>

        <!-- 意味かるた たいせん: the cards everyone has taken -->
        <ul id="battle-scores" class="battle-scores" aria-label="みんなの 札の 数">
            <li v-for="row in quiz.scores" :key="row.seat" class="battle-score" :class="{ 'is-me': row.me, 'is-offline': !row.online }">
                <span class="battle-score-name">{{ row.name }}</span><b class="battle-score-num">{{ row.cards }}</b>
            </li>
        </ul>

        <div id="question-area">
            <!-- 手書き: the phrase, with the reading of the kanji to write in brackets -->
            <p v-if="quiz.phrase" id="question" class="is-phrase">{{ quiz.phrase.before }}<span class="phrase-reading">({{ quiz.phrase.reading }})</span>{{ quiz.phrase.after }}</p>
            <p v-else id="question" :class="{ 'is-kanji': quiz.questionKind === 'kanji', 'is-countdown': quiz.questionKind === 'countdown' }">{{ quiz.question }}</p>
            <!-- 熟語くみたて and 手書き: the meaning of the word, as a hint -->
            <p id="question-hint" class="question-hint" :hidden="quiz.hint === null">{{ quiz.hint }}</p>
        </div>

        <!-- 熟語くみたて: tap the tiles in order to fill the squares -->
        <div id="build-area" class="build" :hidden="!isKumitate">
            <div id="build-slots" class="build-slots" :class="quiz.build?.mark" role="group" aria-label="組み立てた熟語">
                <template v-if="quiz.build">
                    <button v-for="(tileIndex, i) in quiz.build.slots" :key="i" type="button" class="slot"
                        :class="{ 'is-next': i === next && !quiz.build.locked }"
                        :disabled="quiz.build.locked || tileIndex === null"
                        :aria-label="tileIndex === null ? `${i + 1}字目 (まだ)` : `${i + 1}字目 ${quiz.build.tiles[tileIndex].char} (おすと もどす)`"
                        @click="returnTile(i)">{{ tileIndex === null ? '' : quiz.build.tiles[tileIndex].char }}</button>
                </template>
            </div>
            <div id="build-tiles" class="build-tiles" role="group" aria-label="漢字のタイル">
                <template v-if="quiz.build">
                    <button v-for="(tile, i) in quiz.build.tiles" :key="`${quiz.turn}:${i}`" type="button" class="tile" :class="{ 'is-used': tile.used }"
                        :disabled="quiz.build.locked || tile.used" @click="placeTile(i)">{{ tile.char }}</button>
                </template>
            </div>
        </div>

        <!-- 意味かるた: the cards on the field, scrolled sideways on a small screen -->
        <KarutaField :hidden="!isKaruta" @take="take" />

        <!-- 手書き: write the kanji in the square -->
        <TegakiArea :hidden="!isTegaki" />

        <div id="options-area" class="options" :hidden="isKumitate || isKaruta || isTegaki">
            <button v-for="(_, i) in 4" :key="i" type="button" :class="optionClass(i)" :disabled="quiz.optionsLocked" @click="choose(i)">{{ quiz.options[i]?.text }}</button>
        </div>

        <div id="feedback-area" role="status">
            <p id="feedback" :class="[quiz.feedback.kind, { 'is-combo': quiz.feedback.combo > 0 }]">{{ quiz.feedback.text }}<span v-if="quiz.feedback.combo > 0" class="combo">{{ quiz.feedback.combo }}れんぞく！</span></p>
            <p id="answer-note" class="answer-note">
                <template v-if="quiz.note?.kind === 'kanji'">
                    <span class="answer-kanji">{{ quiz.note.kanji }}</span>{{ ' ' }}<template v-for="(r, i) in quiz.note.readings" :key="i">{{ i > 0 ? '・' : '' }}<b v-if="r.asked">{{ r.text }}</b><template v-else>{{ r.text }}</template></template>
                </template>
                <template v-else-if="quiz.note?.kind === 'word'">
                    <span class="answer-kanji">{{ quiz.note.word }}</span>{{ ` ${quiz.note.reading}` }}<span class="answer-parts"><span v-for="part in quiz.note.parts" :key="part">{{ part }}</span></span>
                </template>
            </p>
        </div>
    </div>
</template>

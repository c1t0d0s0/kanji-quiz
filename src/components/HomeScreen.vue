<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { kanjiDatabase } from '../data/kanji';
import { jukugoDatabase } from '../data/jukugo';
import * as Lynx from '../core/lynx';
import { GRADES, REWARDS, formatBest, recordMode, type Mode } from '../core/quiz';
import * as Records from '../core/records';
import { battleAvailable } from '../cloud';
import { chooseCount, chooseGrade, chooseStrokeOrder, earned, fromRecords, kisekaeOpen, outfit, screen, selection, zukan } from '../app/state';
import { startQuiz } from '../app/session';
import { openBattle } from '../app/battle';
import AccountBox from './AccountBox.vue';

const MODES: { mode: Mode; title?: string; text: string }[] = [
    { mode: 'k-to-y', title: '漢字から読み', text: '表示された漢字の「読み」を答えよう！' },
    { mode: 'y-to-k', title: '読みから漢字', text: '表示された読みの「漢字」を答えよう！' },
    { mode: 'kumitate', text: '読みに 合う 漢字を ならべて、熟語を 作ろう！' },
    { mode: 'karuta', title: '意味かるた', text: '意味に 合う 熟語の かるたを、場から さがして とろう！' },
    { mode: 'tegaki', title: '手書き', text: '読みを 見て、漢字を 書こう！' }
];

const bests = fromRecords(() =>
    Object.fromEntries(MODES.map(({ mode }) => [mode, Records.getBest(Records.itemId(recordMode(mode, selection.strokeOrder), selection.grade, selection.count))])));
const days = fromRecords(() => Records.activeDayCount());

const counts = fromRecords(() => {
    const yomi = Records.getCollected('yomi');
    const kaki = Records.getCollected('kaki');
    const words = Records.getCollectedWords();
    return {
        yomi: kanjiDatabase.filter(item => yomi.has(item.kanji)).length,
        kaki: kanjiDatabase.filter(item => kaki.has(item.kanji)).length,
        words: jukugoDatabase.filter(item => words.has(item.word)).length
    };
});
const lynxSvg = computed(() => Lynx.svg(outfit.value));
const percent = (n: number, of: number) => `${(n / of) * 100}%`;

// On wide screens there is room for the how-to, so it starts open
const howtoOpen = ref(false);
onMounted(() => {
    howtoOpen.value = matchMedia('(min-width: 64rem)').matches;
});
</script>

<template>
    <main id="start-screen" class="screen home" :class="{ active: screen === 'home' }">
        <div class="home-main">
            <header class="hero">
                <!-- A four-choice question: which one reads "もり"? -->
                <div class="crest" aria-hidden="true">
                    <span class="crest-cell">木</span>
                    <span class="crest-cell">林</span>
                    <span class="crest-cell crest-cross">森</span>
                    <span class="crest-cell">本</span>
                </div>
                <div class="hero-text">
                    <h1 class="brand">漢字クイズ</h1>
                    <p class="lead">1〜6年生の 漢字を、4たくの クイズで おぼえよう。</p>
                </div>
                <!-- The lynx from Wordlynx (core/lynx.ts), wearing the accessories won from the ずかん -->
                <button type="button" id="lynx-btn" class="lynx" aria-label="ヤマネコの きせかえを ひらく" @click="kisekaeOpen = true" v-html="lynxSvg"></button>
            </header>

            <div class="stats">
                <p id="practice-days" class="points" :hidden="days === 0">
                    <span class="points-label">れんしゅうした 日</span>
                    <b id="practice-days-num" class="points-num">{{ days }}日</b>
                </p>
                <button type="button" id="zukan-open" class="points zukan-open zukan-open-kanji"
                    :aria-label="`漢字ずかんを ひらく (${kanjiDatabase.length}字中 漢字から読み ${counts.yomi}字・読みから漢字 ${counts.kaki}字 あつめた)`"
                    @click="zukan = 'yomi'">
                    <span class="points-label">漢字ずかん <span id="zukan-total">{{ kanjiDatabase.length }}字</span></span>
                    <span class="zukan-row">
                        <span class="zukan-count-kind">漢字から読み</span>
                        <b id="zukan-count-yomi" class="points-num">{{ counts.yomi }}</b>
                        <span class="zukan-meter" aria-hidden="true"><span id="zukan-meter-bar" :style="{ width: percent(counts.yomi, kanjiDatabase.length) }"></span></span>
                    </span>
                    <span class="zukan-row">
                        <span class="zukan-count-kind">読みから漢字</span>
                        <b id="zukan-count-kaki" class="points-num">{{ counts.kaki }}</b>
                        <span class="zukan-meter is-kaki" aria-hidden="true"><span id="zukan-meter-bar-kaki" :style="{ width: percent(counts.kaki, kanjiDatabase.length) }"></span></span>
                    </span>
                </button>
                <button type="button" id="word-zukan-open" class="points zukan-open"
                    :aria-label="`熟語ずかんを ひらく (${jukugoDatabase.length}語中 ${counts.words}語 あつめた)`"
                    @click="zukan = 'words'">
                    <span class="points-label">熟語ずかん</span>
                    <b id="word-zukan-count" class="points-num">{{ counts.words }} / {{ jukugoDatabase.length }}</b>
                    <span class="zukan-meter" aria-hidden="true"><span id="word-zukan-meter-bar" :style="{ width: percent(counts.words, jukugoDatabase.length) }"></span></span>
                </button>
                <button type="button" id="kisekae-open" class="points zukan-open"
                    :aria-label="`ヤマネコの きせかえを ひらく (${REWARDS.length}こ中 ${earned.items.size}こ もらった)`"
                    @click="kisekaeOpen = true">
                    <span class="points-label">ヤマネコの きせかえ</span>
                    <b id="kisekae-count" class="points-num">{{ earned.items.size }} / {{ REWARDS.length }}</b>
                    <span class="zukan-meter" aria-hidden="true"><span id="kisekae-meter-bar" :style="{ width: percent(earned.items.size, REWARDS.length) }"></span></span>
                </button>
            </div>

            <!-- Grade Selector -->
            <section class="selection-section" aria-labelledby="grade-title">
                <h2 id="grade-title">学年をえらぼう</h2>
                <div class="seg grade-selector" id="grade-selector" role="group" aria-labelledby="grade-title">
                    <button v-for="grade in ['all', ...GRADES.map(String)]" :key="grade" type="button" class="seg-option grade-pill"
                        :class="{ active: selection.grade === grade }" :data-grade="grade" :aria-pressed="selection.grade === grade ? 'true' : 'false'"
                        @click="chooseGrade(grade)">{{ grade === 'all' ? '全学年' : `${grade}年生` }}</button>
                </div>
            </section>

            <!-- Question Count Selector -->
            <section class="selection-section" aria-labelledby="count-title">
                <h2 id="count-title">出題数をえらぼう</h2>
                <div class="seg count-selector" id="count-selector" role="group" aria-labelledby="count-title">
                    <button v-for="count in [5, 10, 20]" :key="count" type="button" class="seg-option count-pill"
                        :class="{ active: selection.count === count }" :data-count="count" :aria-pressed="selection.count === count ? 'true' : 'false'"
                        @click="chooseCount(count)">{{ count }}問</button>
                </div>
            </section>

            <!-- Mode Selection -->
            <section class="mode-selection" aria-label="クイズのしゅるい">
                <div v-for="m in MODES" :key="m.mode" class="mode-card">
                    <div class="mode-text">
                        <h2 v-if="m.title">{{ m.title }}</h2>
                        <h2 v-else><ruby>熟語<rt>じゅくご</rt></ruby>くみたて</h2>
                        <p>{{ m.text }}</p>
                        <p :id="`best-${m.mode}`" class="best" :hidden="!bests[m.mode]">{{ bests[m.mode] ? `じこベスト ${formatBest(bests[m.mode]!)}` : '' }}</p>
                    </div>
                    <div v-if="m.mode === 'karuta'" class="mode-actions">
                        <button type="button" id="start-karuta" class="btn btn-primary start-btn" @click="startQuiz('karuta')">スタート</button>
                        <!-- Shown only when the build has FIREBASE_DATABASE_URL -->
                        <button type="button" id="battle-open" class="btn start-btn" :hidden="!battleAvailable" @click="openBattle()">たいせん</button>
                    </div>
                    <button v-else type="button" :id="`start-${m.mode}`" class="btn btn-primary start-btn" @click="startQuiz(m.mode)">スタート</button>
                    <!-- 手書き: also judge the stroke order (and the direction of each stroke) -->
                    <div v-if="m.mode === 'tegaki'" class="mode-option">
                        <button type="button" id="stroke-order" class="order-toggle"
                            :aria-pressed="selection.strokeOrder ? 'true' : 'false'" @click="chooseStrokeOrder(!selection.strokeOrder)">
                            <span class="order-toggle-switch" aria-hidden="true"></span>書き順も みる<b class="order-toggle-state">{{ selection.strokeOrder ? 'ON' : 'OFF' }}</b>
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <aside class="home-side">
            <AccountBox />
            <details class="howto" id="howto" :open="howtoOpen">
                <summary>あそびかた</summary>
                <ul>
                    <li>学年と 出題数を えらんで、「スタート」を おします。</li>
                    <li>1問 10びょうの あいだに、4つの 中から 答えを えらびます。</li>
                    <li>いちばん よかった 成績は「じこベスト」として のこります。</li>
                    <li>「熟語くみたて」では、読みに 合う 漢字を じゅんばんに おして 熟語を 作ります。まちがえた 字は、マスを おすと もどせます。</li>
                    <li>「意味かるた」では、出てきた 意味に 合う 熟語の かるたを 場から さがして おします。1問に おせるのは 1まいだけ。場は よこに スクロールできます。</li>
                    <li id="howto-battle" :hidden="!battleAvailable">「たいせん」では、2〜8人で 同じ 場の かるたを とりあいます。いちばん はやく 正しい 札を おした 人が その 札を もらえます。おてつきすると、その 問題は お休みです。</li>
                    <li>正解した 漢字と 熟語は「漢字ずかん」「熟語ずかん」に あつまります。漢字ずかんは「漢字から読み」と「読みから漢字」で べつべつに あつまります。ぜんぶ あつめよう！</li>
                    <li>学年の 漢字が「漢字から読み」でも「読みから漢字」でも ぜんぶ そろったり、学年の 熟語を 100 あつめたりすると、ヤマネコに つける ごほうびが もらえます。</li>
                    <li>「手書き」では、「(あか)いくつ」の かっこの 読みの 漢字を、マスに 指や ペンで 書いて「こたえる」を おします。1・2年生は すこし くずれても 正解に なり、学年が 上がるほど きびしく なります。「書き順も みる」を ON に すると、書き順と 書く 向きが お手本と ちがうときは 不正解に なります。</li>
                    <li>まちがえた 漢字は、けっかの 画面から もう一度 れんしゅう できます。</li>
                    <li class="howto-credit">手書きの 字の形と 書き順は <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>) を もとに しています。</li>
                </ul>
            </details>
        </aside>
    </main>
</template>

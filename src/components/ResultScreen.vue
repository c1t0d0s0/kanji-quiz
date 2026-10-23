<script setup lang="ts">
import { computed } from 'vue';
import * as Lynx from '../core/lynx';
import { readingsText } from '../core/quiz';
import { goHome, kisekaeOpen, outfit, screen } from '../app/state';
import { result, review } from '../app/session';
import Hanamaru from './Hanamaru.vue';

const what = computed(() => (result.mode === 'kumitate' || result.mode === 'karuta' ? '熟語' : '漢字'));
const lynxSvg = computed(() => Lynx.svg(outfit.value));
const chipDelay = (i: number) => ({ animationDelay: `${0.4 + i * 0.08}s` });
</script>

<template>
    <div id="result-screen" class="screen result-screen" :class="{ active: screen === 'result' }">
        <div class="result-card">
            <div class="result-head">
                <Hanamaru id="result-hanamaru" :key="result.turn" :hidden="result.percentage < 80" />
                <div>
                    <h1>結果発表</h1>
                    <p id="detail-score" class="result-sub">{{ result.total }}問中 {{ result.score }}問正解</p>
                </div>
            </div>
            <div class="result-score">
                <p id="score">正解率 <b>{{ result.percentage }}</b>%</p>
                <div id="rank-badge" :key="result.turn" :class="`rank-badge ${result.rank.className}`">{{ result.rank.label }}</div>
            </div>
            <p id="message">{{ result.rank.message }}</p>
            <p id="best-note" class="best-note" :class="{ 'is-new': result.bestNote?.isNew }" :hidden="!result.bestNote">{{ result.bestNote?.text ?? '' }}</p>
            <p id="combo-note" class="combo-note" :hidden="result.maxCombo < 3">さいこう {{ result.maxCombo }}れんぞく 正解！</p>
            <section id="reward" class="reward" :hidden="result.rewardLines.length === 0">
                <div id="reward-lynx" class="reward-lynx" v-html="lynxSvg"></div>
                <div class="reward-text">
                    <h2>ごほうび ゲット！</h2>
                    <ul id="reward-list" class="reward-list">
                        <li v-for="line in result.rewardLines" :key="line">{{ line }}</li>
                    </ul>
                    <button type="button" id="reward-kisekae" class="btn" @click="kisekaeOpen = true">きせかえる</button>
                </div>
            </section>
            <section id="new-kanji" class="result-section" :hidden="result.newKanji.length === 0">
                <h2 id="new-kanji-title">{{ result.newKanjiTitle }}</h2>
                <div id="new-kanji-list" :key="result.turn" class="new-kanji-list">
                    <span v-for="(kanji, i) in result.newKanji" :key="kanji" class="new-kanji-chip" :style="chipDelay(i)">{{ kanji }}</span>
                </div>
            </section>
            <section id="new-words" class="result-section" :hidden="result.newWords.length === 0">
                <h2>ずかんに くわわった 熟語</h2>
                <div id="new-words-list" :key="result.turn" class="new-kanji-list">
                    <span v-for="(word, i) in result.newWords" :key="word" class="new-kanji-chip new-word-chip" :style="chipDelay(i)">{{ word }}</span>
                </div>
            </section>
            <section id="missed" class="result-section" :hidden="result.missed.length === 0">
                <h2 id="missed-title">まちがえた {{ what }}</h2>
                <ul id="missed-list" class="missed-list">
                    <template v-for="item in result.missed" :key="'word' in item ? item.word : item.kanji">
                        <li v-if="'word' in item" class="missed-item is-word">
                            <span class="missed-kanji">{{ item.word }}</span><span class="missed-readings">{{ item.reading }}</span><span class="missed-meaning">{{ item.meaning }}</span>
                        </li>
                        <li v-else class="missed-item">
                            <span class="missed-kanji">{{ item.kanji }}</span><span class="missed-readings">{{ readingsText(item) }}</span>
                        </li>
                    </template>
                </ul>
            </section>
            <div class="result-actions">
                <button type="button" id="review-btn" class="btn" :hidden="result.missed.length === 0" @click="review">まちがえた {{ what }}だけ もう一度</button>
                <button type="button" id="retry-btn" class="btn btn-primary" @click="goHome">ホームに もどる</button>
            </div>
        </div>
    </div>
</template>

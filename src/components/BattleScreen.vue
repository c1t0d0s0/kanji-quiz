<script setup lang="ts">
// 意味かるた たいせん: entrance, waiting room and result (the game itself is on the quiz screen)
import { onMounted, ref } from 'vue';
import { GRADES } from '../core/quiz';
import { screen } from '../app/state';
import { battle, copyUrl, create, focus, goHome, join, leaveRoom, rematch, start } from '../app/battle';

const nameInput = ref<HTMLInputElement | null>(null);
const codeInput = ref<HTMLInputElement | null>(null);
const urlInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
    focus.name = () => nameInput.value?.focus();
    focus.code = () => codeInput.value?.focus();
});

const chipDelay = (i: number) => ({ animationDelay: `${0.4 + i * 0.08}s` });
</script>

<template>
    <div id="battle-screen" class="screen result-screen battle-screen" :class="{ active: screen === 'battle' }">
        <div class="result-card">
            <header class="battle-head">
                <button type="button" id="battle-home" class="home-btn" @click="goHome"><span aria-hidden="true">‹</span>ホーム</button>
                <h1>意味かるた たいせん</h1>
            </header>

            <section id="battle-entry" class="battle-view" :hidden="battle.view !== 'entry'">
                <label class="battle-field">
                    <span>なまえ（ニックネーム）</span>
                    <input id="battle-name" ref="nameInput" v-model="battle.name" class="battle-input" type="text" maxlength="20" autocomplete="nickname" enterkeyhint="done" placeholder="10文字まで">
                </label>
                <div id="battle-create-area" class="battle-create">
                    <div>
                        <h2 id="battle-grade-title">学年</h2>
                        <div class="seg grade-selector" id="battle-grade" role="group" aria-labelledby="battle-grade-title">
                            <button v-for="grade in ['all', ...GRADES.map(String)]" :key="grade" type="button" class="seg-option"
                                :class="{ active: battle.choice.grade === grade }" :data-grade="grade" :aria-pressed="battle.choice.grade === grade ? 'true' : 'false'"
                                @click="battle.choice.grade = grade">{{ grade === 'all' ? '全学年' : `${grade}年生` }}</button>
                        </div>
                    </div>
                    <div>
                        <h2 id="battle-count-title">出題数</h2>
                        <div class="seg count-selector" id="battle-count" role="group" aria-labelledby="battle-count-title">
                            <button v-for="count in [5, 10, 20]" :key="count" type="button" class="seg-option"
                                :class="{ active: battle.choice.count === count }" :data-count="count" :aria-pressed="battle.choice.count === count ? 'true' : 'false'"
                                @click="battle.choice.count = count">{{ count }}問</button>
                        </div>
                    </div>
                    <button type="button" id="battle-create" class="btn btn-primary battle-main-btn" :disabled="battle.busy" @click="create">部屋を 作る</button>
                </div>
                <div class="battle-join">
                    <h2>コードで 入る</h2>
                    <div class="battle-join-row">
                        <input id="battle-code" ref="codeInput" v-model="battle.code" class="battle-input battle-code-input" type="text" inputmode="numeric" maxlength="7" autocomplete="off" enterkeyhint="go" placeholder="12345" aria-label="対戦コード" @keydown.enter="join">
                        <button type="button" id="battle-join" class="btn" :disabled="battle.busy" @click="join">入る</button>
                    </div>
                </div>
            </section>

            <section id="battle-lobby" class="battle-view" :hidden="battle.view !== 'lobby'">
                <div class="battle-invite">
                    <div>
                        <p class="result-sub">対戦コード</p>
                        <p id="battle-room-code" class="battle-room-code">{{ battle.roomCode }}</p>
                        <p id="battle-room-setting" class="result-sub">{{ battle.roomSetting }}</p>
                    </div>
                    <img id="battle-qr" class="battle-qr" alt="しょうたいの QRコード" :src="battle.qr || undefined" :hidden="!battle.qr">
                </div>
                <div class="battle-url-row">
                    <input id="battle-url" ref="urlInput" class="battle-input" type="text" readonly aria-label="しょうたいの URL" :value="battle.inviteUrl">
                    <button type="button" id="battle-copy" class="btn" @click="copyUrl(() => urlInput?.select())">コピー</button>
                </div>
                <div>
                    <h2 id="battle-players-title">参加している 人</h2>
                    <ul id="battle-players" class="battle-players" aria-labelledby="battle-players-title">
                        <li v-for="p in battle.players" :key="p.seat" class="battle-player" :class="{ 'is-offline': !p.online }">{{ p.name }}<span v-if="p.host" class="battle-tag">ホスト</span><span v-if="p.me" class="battle-tag is-me">じぶん</span><span v-if="!p.online" class="battle-tag">ぬけた</span></li>
                    </ul>
                </div>
                <button type="button" id="battle-start" class="btn btn-primary battle-main-btn" :hidden="!battle.isHost" :disabled="!battle.canStart || battle.starting" @click="start">スタート</button>
            </section>

            <section id="battle-result" class="battle-view" :hidden="battle.view !== 'result'">
                <h2>結果発表</h2>
                <ol id="battle-standings" class="battle-standings">
                    <li v-for="row in battle.standings" :key="row.seat" class="battle-standing" :class="{ 'is-me': row.me, 'is-offline': !row.online }">
                        <span class="battle-rank">{{ row.rank ? `${row.rank}位` : '―' }}</span><span class="battle-standing-name">{{ row.name }}</span><span class="battle-standing-cards">{{ row.cards }}まい</span><span class="battle-standing-faults">{{ row.online ? `おてつき ${row.faults}` : 'ぬけた' }}</span>
                    </li>
                </ol>
                <section id="battle-new-words" class="result-section" :hidden="battle.newWords.length === 0">
                    <h2>ずかんに くわわった 熟語</h2>
                    <div id="battle-new-words-list" :key="battle.turn" class="new-kanji-list">
                        <span v-for="(word, i) in battle.newWords" :key="word" class="new-kanji-chip new-word-chip" :style="chipDelay(i)">{{ word }}</span>
                    </div>
                </section>
                <button type="button" id="battle-rematch" class="btn btn-primary battle-main-btn" :hidden="!battle.isHost" :disabled="battle.rematching" @click="rematch">もう一度</button>
            </section>

            <p id="battle-message" class="battle-message" role="status">{{ battle.message }}</p>
            <button type="button" id="battle-leave" class="btn" :hidden="battle.view === 'entry'" @click="leaveRoom">部屋を 出る</button>
        </div>
    </div>
</template>

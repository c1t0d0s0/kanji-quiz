<script setup lang="ts">
// --- 漢字ずかん (kanji collected by answering them correctly) and 熟語ずかん ---
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { kanjiDatabase } from '../data/kanji';
import { jukugoDatabase } from '../data/jukugo';
import { GRADES, KANJI_KINDS, WORD_REWARD_COUNT, readingsText } from '../core/quiz';
import * as Records from '../core/records';
import { fromRecords, zukan } from '../app/state';
import Hanamaru from './Hanamaru.vue';

type Kind = 'yomi' | 'kaki' | 'words';
const TABS: { kind: Kind; label: string }[] = [
    { kind: 'yomi', label: '漢字から読み' },
    { kind: 'kaki', label: '読みから漢字' },
    { kind: 'words', label: '熟語' }
];

const dialog = ref<HTMLDialogElement | null>(null);
const body = ref<HTMLElement | null>(null);
// Goes up whenever the ずかん is drawn again (opened, or another tab): the folds close again
const drawn = ref(0);
// The text under the tabs, or the kanji / word pressed
const detail = ref<string | { main: string; rest: string; meaning?: string }>('');
// 熟語ずかん: the grades opened (their words are drawn only then, as they are many)
const opened = reactive(new Set<number>());

const kind = computed<Kind>(() => zukan.value ?? 'yomi');
const collected = fromRecords(() => (kind.value === 'words' ? Records.getCollectedWords() : Records.getCollected(kind.value)));

const kanjiSections = computed(() =>
    GRADES.map(grade => {
        const list = kanjiDatabase.filter(item => item.grade === grade);
        return { grade, list, got: list.filter(item => collected.value.has(item.kanji)).length };
    }));
const wordSections = computed(() =>
    GRADES.map(grade => {
        const list = jukugoDatabase.filter(item => item.grade === grade);
        return { grade, list, got: list.filter(item => collected.value.has(item.word)).length };
    }));

const summary = computed(() => {
    if (kind.value === 'words') {
        const got = jukugoDatabase.filter(item => collected.value.has(item.word)).length;
        return got === jukugoDatabase.length ? `${got}語 ぜんぶ あつめた！ すごい！` : `${jukugoDatabase.length}語中 ${got}語 あつめたよ`;
    }
    const got = kanjiDatabase.filter(item => collected.value.has(item.kanji)).length;
    return got === kanjiDatabase.length ? `${got}字 ぜんぶ あつめた！ すごい！` : `${kanjiDatabase.length}字中 ${got}字 あつめたよ`;
});

function resetDetail() {
    detail.value = kind.value === 'words'
        ? '学年を おすと 熟語が 見られるよ。あつめた 熟語を おすと、読みが 出るよ。'
        : `「${KANJI_KINDS[kind.value].label}」で 正解した 漢字が あつまるよ。おすと、読みが 見られるよ。`;
}

async function draw() {
    resetDetail();
    opened.clear();
    drawn.value++;
    await nextTick();
    if (body.value) body.value.scrollTop = 0;
}

function showTab(k: Kind) {
    zukan.value = k;
}

watch(zukan, (now, before) => {
    const d = dialog.value;
    if (!d) return;
    if (now) {
        void draw();
        if (!before) d.showModal();
    } else if (d.open) {
        d.close();
    }
});

function pickKanji(item: (typeof kanjiDatabase)[number]) {
    if (collected.value.has(item.kanji)) detail.value = { main: item.kanji, rest: ` ${readingsText(item)}` };
    // Shown faintly, so children can see what is left to collect
    else detail.value = `「${item.kanji}」は まだ あつめていないよ。「${KANJI_KINDS[kind.value as 'yomi' | 'kaki'].label}」で 正解すると あつまるよ！`;
}

function pickWord(item: (typeof jukugoDatabase)[number]) {
    if (collected.value.has(item.word)) detail.value = { main: item.word, rest: ` ${item.reading}`, meaning: item.meaning };
    else detail.value = `「${item.word}」は まだ あつめていないよ。熟語くみたてや 意味かるたで 正解すると あつまるよ！`;
}

function onToggle(grade: number, event: Event) {
    if ((event.target as HTMLDetailsElement).open) opened.add(grade);
}

// Tapping the dark backdrop also closes it
function onClick(event: MouseEvent) {
    if (event.target === dialog.value) zukan.value = null;
}
</script>

<template>
    <dialog id="zukan" ref="dialog" class="zukan" aria-labelledby="zukan-title" @click="onClick" @close="zukan = null">
        <header class="zukan-head">
            <div>
                <h1 id="zukan-title">{{ kind === 'words' ? '熟語ずかん' : '漢字ずかん' }}</h1>
                <p id="zukan-summary" class="zukan-summary">{{ summary }}</p>
            </div>
            <button type="button" id="zukan-close" class="btn" @click="zukan = null">とじる</button>
        </header>
        <div class="seg zukan-tabs" role="group" aria-label="ずかんの しゅるい">
            <button v-for="tab in TABS" :key="tab.kind" type="button" class="seg-option" :data-zukan="tab.kind"
                :aria-pressed="kind === tab.kind ? 'true' : 'false'" @click="showTab(tab.kind)">{{ tab.label }}</button>
        </div>
        <p id="zukan-detail" class="zukan-detail" aria-live="polite">
            <template v-if="typeof detail === 'string'">{{ detail }}</template>
            <template v-else><b class="zukan-detail-kanji">{{ detail.main }}</b>{{ detail.rest }}<span v-if="detail.meaning !== undefined" class="zukan-detail-meaning">{{ detail.meaning }}</span></template>
        </p>
        <div id="zukan-body" ref="body" :key="drawn" class="zukan-body">
            <template v-if="kind !== 'words'">
                <section v-for="s in kanjiSections" :key="s.grade" class="zukan-grade">
                    <h2>{{ s.grade }}年生<span :class="s.got === s.list.length ? 'zukan-grade-count is-complete' : 'zukan-grade-count'">{{ s.got === s.list.length ? `${s.got} / ${s.list.length} コンプリート！` : `${s.got} / ${s.list.length}` }}</span><Hanamaru v-if="s.got === s.list.length" class="hanamaru-grade" /><span v-else class="zukan-reward-hint">あと {{ s.list.length - s.got }}字で はなまる</span></h2>
                    <div class="zukan-grid">
                        <button v-for="item in s.list" :key="item.kanji" type="button" :class="collected.has(item.kanji) ? 'zukan-cell is-collected' : 'zukan-cell'"
                            :aria-label="collected.has(item.kanji) ? `${item.kanji} (${readingsText(item)})` : `${item.kanji} (まだ あつめていない)`"
                            @click="pickKanji(item)">{{ item.kanji }}</button>
                    </div>
                </section>
            </template>
            <template v-else>
                <!-- The 熟語 are many, so each grade is folded and its words are drawn when it is opened -->
                <details v-for="s in wordSections" :key="s.grade" class="zukan-grade zukan-fold" @toggle="onToggle(s.grade, $event)">
                    <summary>{{ s.grade }}年生<span :class="s.got === s.list.length ? 'zukan-grade-count is-complete' : 'zukan-grade-count'">{{ s.got === s.list.length ? `${s.got} / ${s.list.length} コンプリート！` : `${s.got} / ${s.list.length}` }}</span><Hanamaru v-if="s.got === s.list.length" class="hanamaru-grade" /><span v-else-if="s.got >= WORD_REWARD_COUNT" class="zukan-reward-hint is-got">ごほうび ゲット</span><span v-else class="zukan-reward-hint">あと {{ WORD_REWARD_COUNT - s.got }}語で ごほうび</span></summary>
                    <div v-if="opened.has(s.grade)" class="zukan-grid zukan-word-grid">
                        <button v-for="item in s.list" :key="item.word" type="button" :class="collected.has(item.word) ? 'zukan-cell zukan-word is-collected' : 'zukan-cell zukan-word'"
                            :aria-label="collected.has(item.word) ? `${item.word} (${item.reading})` : `${item.word} (まだ あつめていない)`"
                            @click="pickWord(item)">{{ item.word }}</button>
                    </div>
                </details>
            </template>
        </div>
    </dialog>
</template>

<script setup lang="ts">
// --- なりたち: the picture a kanji came from, turning into the kanji (opened from the ずかん,
// the practice and the quiz) ---
import { computed, ref, watch } from 'vue';
import { NARITACHI } from '../data/naritachi';
import { loadTegaki } from '../app/tegaki';
import { naritachi } from '../app/state';
import NaritachiAnimation from './NaritachiAnimation.vue';

const dialog = ref<HTMLDialogElement | null>(null);
const animation = ref<InstanceType<typeof NaritachiAnimation> | null>(null);
// The strokes of KanjiVG for the kanji shown (loaded with the 手書き data)
const model = ref<number[][] | null>(null);
const failed = ref(false);

const entry = computed(() => (naritachi.value ? NARITACHI.get(naritachi.value) ?? null : null));

watch(naritachi, async kanji => {
    const d = dialog.value;
    if (!d) return;
    if (!kanji) {
        if (d.open) d.close();
        return;
    }
    model.value = null;
    failed.value = false;
    if (!d.open) d.showModal();
    try {
        const kit = await loadTegaki();
        if (naritachi.value === kanji) model.value = kit.strokes[kanji] ?? null;
    } catch (e) {
        console.error('なりたち could not be loaded', e);
        failed.value = true;
    }
});

// Tapping the dark backdrop also closes it
function onClick(event: MouseEvent) {
    if (event.target === dialog.value) naritachi.value = null;
}
</script>

<template>
    <dialog ref="dialog" class="zukan naritachi" aria-labelledby="naritachi-title" @click="onClick" @close="naritachi = null">
        <header class="zukan-head">
            <h1 id="naritachi-title">「{{ entry?.kanji }}」の なりたち</h1>
            <button type="button" class="btn" @click="naritachi = null">とじる</button>
        </header>
        <div class="naritachi-body">
            <NaritachiAnimation v-if="entry && model" ref="animation" :entry="entry" :model="model" />
            <p v-else-if="failed" class="zukan-detail">じゅんびが できませんでした。インターネットに つながってから、もう一度 おしてね。</p>
            <p v-else class="zukan-detail">じゅんび ちゅう…</p>
            <div class="naritachi-actions">
                <button type="button" class="btn" :disabled="!model" @click="animation?.play()">もう一度 見る</button>
            </div>
            <p class="tegaki-credit">字の形と書き順: <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel)
                <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
        </div>
    </dialog>
</template>

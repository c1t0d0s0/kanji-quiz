<script setup lang="ts">
// --- ヤマネコの きせかえ: put on and take off the accessories won ---
import { computed, ref, watch } from 'vue';
import * as Lynx from '../core/lynx';
import { REWARDS, rewardHint, type Reward } from '../core/quiz';
import * as Records from '../core/records';
import { earned, kisekaeOpen, outfit } from '../app/state';

const dialog = ref<HTMLDialogElement | null>(null);
const message = ref('');

const detail = computed(() => message.value || (earned.value.items.size > 0
    ? 'もらった ものを おすと、つけたり はずしたり できるよ。'
    : 'ずかんを あつめると、ヤマネコに つける ものが もらえるよ。「？」を おしてみてね。'));
const lynxSvg = computed(() => Lynx.svg(outfit.value));

watch(kisekaeOpen, open => {
    const d = dialog.value;
    if (!d) return;
    if (open) {
        message.value = '';
        if (!d.open) d.showModal();
    } else if (d.open) {
        d.close();
    }
});

function pick(reward: Reward) {
    const item = Lynx.ITEM.get(reward.item);
    if (!item) return;
    if (!earned.value.items.has(reward.item)) {
        message.value = `${rewardHint(reward)}と もらえるよ。`;
        return;
    }
    const isWorn = outfit.value.includes(reward.item);
    Records.setSettings({ outfit: isWorn ? outfit.value.filter(id => id !== reward.item) : Lynx.wear(outfit.value, reward.item) });
    message.value = isWorn ? `${item.name}を はずしたよ。` : `${item.name}を つけたよ！`;
}

// The accessory drawn alone, with its name (both from core/lynx.ts, no text from outside)
function itemHtml(id: string) {
    const name = Lynx.ITEM.get(id)?.name ?? '';
    return `${Lynx.svg([id], name)}<span class="kisekae-name">${name}</span>`;
}

// Tapping the dark backdrop also closes it
function onClick(event: MouseEvent) {
    if (event.target === dialog.value) kisekaeOpen.value = false;
}
</script>

<template>
    <dialog id="kisekae" ref="dialog" class="zukan kisekae" aria-labelledby="kisekae-title" @click="onClick" @close="kisekaeOpen = false">
        <header class="zukan-head">
            <div>
                <h1 id="kisekae-title">ヤマネコの きせかえ</h1>
                <p id="kisekae-summary" class="zukan-summary">{{ REWARDS.length }}こ中 {{ earned.items.size }}こ もらったよ</p>
            </div>
            <button type="button" id="kisekae-close" class="btn" @click="kisekaeOpen = false">とじる</button>
        </header>
        <div id="kisekae-lynx" class="kisekae-lynx" v-html="lynxSvg"></div>
        <p id="kisekae-detail" class="zukan-detail" aria-live="polite">{{ detail }}</p>
        <div id="kisekae-items" class="kisekae-items">
            <template v-for="reward in REWARDS" :key="reward.item">
                <button v-if="earned.items.has(reward.item)" type="button" class="kisekae-item is-earned" :class="{ 'is-worn': outfit.includes(reward.item) }"
                    :aria-pressed="outfit.includes(reward.item) ? 'true' : 'false'" @click="pick(reward)" v-html="itemHtml(reward.item)"></button>
                <button v-else type="button" class="kisekae-item" :aria-label="`まだ もらっていない (${rewardHint(reward)}と もらえる)`" @click="pick(reward)"><span class="kisekae-lock">？</span><span class="kisekae-name">まだ</span></button>
            </template>
        </div>
    </dialog>
</template>

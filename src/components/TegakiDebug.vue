<script setup lang="ts">
// --- ?debug: the measures of a writing against their limits (✗ = over), and the writing to copy ---
import { computed, ref, watch } from 'vue';
import type { TegakiDebugInfo } from '../app/tegaki';

const props = defineProps<{ info: TegakiDebugInfo }>();

const rows = computed(() => {
    const d = props.info;
    const v = d.verdict;
    if (!v) return [`${d.kanji} ${d.grade}年生  なにも 書いていない`];
    const keys = ['shape', 'strokes', 'worst', 'flips', 'meets'] as const;
    const mark = (bad: boolean) => (bad ? '✗' : '・');
    return [
        `${d.kanji} ${d.grade}年生  ${v.ok ? '正解' : '不正解'} (${v.reason})`,
        `${mark(v.written !== v.expected)} 画数 ${v.written}/${v.expected}  (つなぎ ${v.joins}/${d.limits.joins})`,
        ...keys.map(k => `${mark(v[k] > d.limits[k])} ${k} ${Number.isInteger(v[k]) ? v[k] : v[k].toFixed(3)} / ${d.limits[k]}`),
        d.strokeOrder ? `${mark(Boolean(v.order))} 書き順・向き ${v.order ? JSON.stringify(v.order) : 'OK'}` : '・ 書き順・向き (みない)',
        `hint ${JSON.stringify(v.hint)}`
    ];
});

const copied = ref('');
async function copy() {
    const d = props.info;
    const text = JSON.stringify({ kanji: d.kanji, grade: d.grade, strokeOrder: d.strokeOrder, size: d.size, strokes: d.strokes });
    try {
        await navigator.clipboard.writeText(text);
        copied.value = 'コピーしました';
    } catch {
        // No clipboard (e.g. not https): shown to be copied by hand
        copied.value = text;
    }
}
watch(() => props.info, () => {
    copied.value = '';
});
</script>

<template>
    <div class="tegaki-debug">
        <pre>{{ rows.join('\n') }}</pre>
        <div class="tegaki-actions">
            <button type="button" class="btn" @click="copy">書いた線を コピー</button>
            <slot></slot>
        </div>
        <textarea v-if="copied && copied !== 'コピーしました'" readonly :value="copied" rows="3"></textarea>
        <p v-else-if="copied">{{ copied }}</p>
    </div>
</template>

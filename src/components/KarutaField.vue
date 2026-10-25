<script setup lang="ts">
// --- 意味かるた: the cards on the field, scrolled sideways on a small screen ---
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { quiz } from '../app/quiz-view';

const props = defineProps<{ hidden: boolean }>();
const emit = defineEmits<{ take: [index: number] }>();

const field = ref<HTMLElement | null>(null);
const scrollable = ref(false);
const hint = ref('‹ よこに スクロール ›');

// Fades the edges of the field that have more cards beyond them
function updateEdges() {
    const f = field.value;
    if (!f) return;
    const max = f.scrollWidth - f.clientWidth;
    f.classList.toggle('is-start', f.scrollLeft <= 1);
    f.classList.toggle('is-end', f.scrollLeft >= max - 1);
    // Rows that do not fit (see fitRows); a few pixels into the padding do not count
    const tall = f.classList.contains('is-tall');
    scrollable.value = max > 1 || tall;
    hint.value = tall ? (max > 1 ? '‹ よこ・たてに スクロール ›' : '‹ たてに スクロール ›') : '‹ よこに スクロール ›';
}

// As many rows of cards as fit in the field's real height. The height left for the field
// depends on more than the screen (the 対戦 also shows the players' scores), so it is measured.
// In a 対戦 everyone must see the same field: the cards fill the rows column by column, so the
// number of rows decides where each card lies, and it is the same for every device.
const MAX_ROWS = 5;
const BATTLE_ROWS = 3;

// In a 対戦 the rows are fixed, so a big field (50 cards: 17 columns) is wider than most screens.
// Where the cards can be made smaller and still be read easily, they are, so the whole field fits
// across without scrolling sideways; where it would take smaller cards, the field scrolls. Only the
// size of the cards changes: every card stays in the same row and column for everyone.
const MIN_CARD_PX = 48;

function fitCardWidth(f: HTMLElement) {
    f.style.removeProperty('--card-w');
    const card = f.querySelector('.karuta-card');
    const count = quiz.karuta?.cards.length ?? 0;
    if (!quiz.battle || !card || count === 0) return;
    const style = getComputedStyle(f);
    const gap = parseFloat(style.columnGap) || 0;
    const room = f.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const columns = Math.ceil(count / BATTLE_ROWS);
    const natural = card.getBoundingClientRect().width;
    const fits = Math.floor(((room - (columns - 1) * gap) / columns) * 10) / 10;
    if (fits < natural && fits >= MIN_CARD_PX) f.style.setProperty('--card-w', `${fits}px`);
}

function fitRows() {
    const f = field.value;
    if (!f || props.hidden) return;
    fitCardWidth(f);
    const card = f.querySelector('.karuta-card');
    if (!card) return;
    const style = getComputedStyle(f);
    const gap = parseFloat(style.rowGap) || 0;
    // The cards may reach into the padding, but not past the edge
    const room = f.clientHeight;
    const cardHeight = card.getBoundingClientRect().height;
    const rows = quiz.battle ? BATTLE_ROWS : Math.max(1, Math.min(MAX_ROWS, Math.floor((room + gap) / (cardHeight + gap))));
    if (f.style.getPropertyValue('--rows') !== String(rows)) f.style.setProperty('--rows', String(rows));
    // The rows do not fit (a very short screen, or the 3 rows of a 対戦): scroll up and down, starting from the top
    f.classList.toggle('is-tall', rows * cardHeight + (rows - 1) * gap > room + 0.5);
    // And whatever the reason, the top row must never stick out above the field
    if (f.scrollTop === 0 && card.getBoundingClientRect().top < f.getBoundingClientRect().top - 0.5) {
        f.classList.add('is-tall');
    }
    updateEdges();
}

// A new field: back to its start, and the rows worked out again
watch(
    () => quiz.karuta?.cards,
    async () => {
        await nextTick();
        if (field.value) field.value.scrollLeft = 0;
        fitRows();
    }
);

// Show where the right card was, even when it is off the screen
watch(
    () => quiz.karuta?.scrollTo,
    async target => {
        if (!target) return;
        await nextTick();
        const card = field.value?.children[target.index];
        card?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
);

// Also when the field first appears, and when the scores above it change height
let observer: ResizeObserver | null = null;
onMounted(() => {
    observer = new ResizeObserver(fitRows);
    if (field.value) observer.observe(field.value);
});
onBeforeUnmount(() => observer?.disconnect());

const cardClass = (taken: boolean, state: string) => ['karuta-card', taken ? 'is-taken' : '', state].filter(Boolean).join(' ');
</script>

<template>
    <div id="karuta-area" class="karuta" :class="{ 'is-scrollable': scrollable }" :hidden="hidden">
        <div id="karuta-field" ref="field" class="karuta-field is-start" role="group" aria-label="かるたの 場" @scroll.passive="updateEdges">
            <button v-for="(card, i) in quiz.karuta?.cards ?? []" :key="`${i}:${card.item.word}`" type="button"
                :class="cardClass(card.taken, card.state)" :disabled="card.taken || quiz.karuta?.finished"
                :aria-label="card.item.word" :aria-hidden="card.taken ? 'true' : undefined" @click="emit('take', i)">
                <span :class="`karuta-word is-len-${[...card.item.word].length}`">{{ card.item.word }}</span>
            </button>
        </div>
        <p id="karuta-scroll-hint" class="karuta-scroll-hint" aria-hidden="true">{{ hint }}</p>
    </div>
</template>

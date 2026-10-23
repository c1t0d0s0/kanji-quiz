<script setup lang="ts">
// The spiral flower a teacher draws with a red pen
import { hanamaruPoints } from '../core/quiz';

const points = hanamaruPoints();
</script>

<template>
    <svg class="hanamaru" viewBox="0 0 100 100" aria-hidden="true"><polyline :points="points" pathLength="1"></polyline></svg>
</template>

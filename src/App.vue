<script setup lang="ts">
import HomeScreen from './components/HomeScreen.vue';
import QuizScreen from './components/QuizScreen.vue';
import ResultScreen from './components/ResultScreen.vue';
import BattleScreen from './components/BattleScreen.vue';
import ZukanDialog from './components/ZukanDialog.vue';
import KisekaeDialog from './components/KisekaeDialog.vue';
</script>

<template>
    <HomeScreen />
    <QuizScreen />
    <ResultScreen />
    <!-- 意味かるた たいせん: entrance, waiting room and result (the game itself is on the quiz screen) -->
    <BattleScreen />
    <ZukanDialog />
    <KisekaeDialog />
</template>

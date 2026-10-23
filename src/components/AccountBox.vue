<script setup lang="ts">
// --- Account (Google Sign-In) ---
// Shown only when the build has the Firebase settings
import { ref } from 'vue';
import { cloudAvailable, cloudState, signIn, signOut } from '../cloud';
import { ACCOUNT_TEXT } from '../app/account-text';

const signingIn = ref(false);
const signingOut = ref(false);
const error = ref('');

async function onSignIn() {
    signingIn.value = true;
    error.value = '';
    try {
        await signIn();
    } catch (err) {
        // Say nothing when the user closed the sign-in window themselves
        const code = (err as { code?: string } | null)?.code || '';
        if (!/popup-closed-by-user|cancelled-popup-request/.test(code)) {
            error.value = code ? `${ACCOUNT_TEXT.signInFailed} (${code})` : ACCOUNT_TEXT.signInFailed;
        }
    } finally {
        signingIn.value = false;
    }
}

async function onSignOut() {
    signingOut.value = true;
    if ((await signOut()) === 'unsynced') {
        if (confirm(ACCOUNT_TEXT.signOutUnsynced)) await signOut(true);
    }
    signingOut.value = false;
}

const statusText = (status: string) => (ACCOUNT_TEXT as Record<string, string>)[status] || '';
</script>

<template>
    <section id="account" class="account" aria-labelledby="account-title" :hidden="!cloudAvailable || cloudState.status === 'unavailable'">
        <h2 id="account-title">きろくの ほぞん</h2>
        <div id="account-body" class="account-body">
            <p v-if="cloudState.status === 'loading'" class="account-status">{{ ACCOUNT_TEXT.loading }}</p>
            <template v-else-if="cloudState.uid === null">
                <p class="account-note">{{ ACCOUNT_TEXT.note }}</p>
                <button type="button" class="btn btn-primary" :disabled="signingIn" @click="onSignIn">{{ ACCOUNT_TEXT.signIn }}</button>
                <p class="account-error" role="alert">{{ error }}</p>
            </template>
            <template v-else>
                <p class="account-state">
                    <b>{{ ACCOUNT_TEXT.signedIn }}</b>
                    <span :class="`account-status is-${cloudState.status}`" role="status">{{ statusText(cloudState.status) }}</span>
                </p>
                <button type="button" class="btn" :disabled="signingOut" @click="onSignOut">{{ ACCOUNT_TEXT.signOut }}</button>
            </template>
        </div>
    </section>
</template>

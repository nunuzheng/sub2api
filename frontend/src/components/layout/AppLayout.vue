<template>
  <div class="console-shell min-h-screen">
    <AppTopNav />

    <div class="console-main">
      <header v-if="pageTitle || pageDescription" class="console-heading">
        <h1 class="console-heading-title">{{ pageTitle }}</h1>
        <p v-if="pageDescription" class="console-heading-description">{{ pageDescription }}</p>
      </header>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import AppTopNav from './AppTopNav.vue'
import { usePageHeading } from './usePageHeading'

const authStore = useAuthStore()
const { pageTitle, pageDescription } = usePageHeading()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>

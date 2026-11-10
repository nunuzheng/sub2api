<template>
  <header class="console-topnav" :class="{ 'is-mobile-open': mobileOpen }">
    <div class="console-topnav-bar">
      <router-link :to="homePath" class="console-brand" @click="closeAll">
        <img v-if="settingsLoaded" :src="siteLogo || '/logo.svg'" alt="" class="console-brand-mark" />
        <span class="console-brand-name">{{ siteName }}</span>
        <VersionBadge :version="siteVersion" />
      </router-link>

      <nav class="console-daily" :aria-label="t('nav.primary')">
        <router-link
          v-for="item in nav.daily"
          :key="item.path"
          :to="item.to ?? item.path"
          class="topnav-link"
          :data-tour="item.tour"
          :aria-current="isCurrent(item.path) ? 'page' : undefined"
          @click="closeAll"
        >
          {{ item.label }}
        </router-link>
      </nav>

      <div class="console-topnav-tools">
        <AnnouncementBell v-if="user" />

        <router-link
          v-if="user"
          to="/redeem"
          class="console-balance"
          :aria-label="balanceLabel"
          @click="closeAll"
        >
          <span class="tabular-nums">{{ balanceText }}</span>
          <span v-if="frozenBalance > 0" class="console-balance-frozen tabular-nums">
            {{ t('common.frozenBalance') }} {{ frozenText }}
          </span>
        </router-link>

        <div v-if="isAdmin" ref="adminRoot" class="console-menu-anchor">
          <button
            ref="adminTrigger"
            type="button"
            class="topnav-menu-button"
            data-testid="admin-menu-button"
            :aria-expanded="adminOpen"
            aria-haspopup="menu"
            aria-controls="console-admin-menu"
            @click="toggleAdmin"
          >
            {{ t('nav.adminMenu') }}
          </button>
          <div
            v-show="adminOpen"
            id="console-admin-menu"
            ref="adminPanel"
            class="topnav-menu"
            role="menu"
            :aria-label="t('nav.adminMenu')"
            data-testid="admin-menu"
            @keydown="onMenuKeydown($event, adminTrigger, closeAdmin)"
          >
            <ConsoleMenuList
              :items="nav.admin"
              :current-path="route.path"
              stamp-ids
              @select="closeAll"
            />
          </div>
        </div>

        <div ref="accountRoot" class="console-menu-anchor">
          <button
            ref="accountTrigger"
            type="button"
            class="topnav-menu-button"
            data-testid="account-menu-button"
            :aria-expanded="accountOpen"
            aria-haspopup="menu"
            aria-controls="console-account-menu"
            @click="toggleAccount"
          >
            {{ t('nav.accountMenu') }}
          </button>
          <div
            v-show="accountOpen"
            id="console-account-menu"
            ref="accountPanel"
            class="topnav-menu"
            role="menu"
            :aria-label="t('nav.accountMenu')"
            data-testid="account-menu"
            @keydown="onMenuKeydown($event, accountTrigger, closeAccount)"
          >
            <ConsoleMenuList
              :items="nav.account"
              :current-path="route.path"
              stamp-ids
              @select="closeAll"
            />
            <div class="console-menu-extra">
              <a
                v-if="docUrl"
                :href="docUrl"
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                class="console-menu-link"
                @click="closeAll"
              >{{ t('nav.docs') }}</a>
              <a
                v-if="isAdmin"
                href="https://github.com/Wei-Shaw/sub2api"
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                class="console-menu-link"
                @click="closeAll"
              >{{ t('nav.github') }}</a>
              <button type="button" class="console-menu-link" role="menuitem" @click="toggleTheme">
                {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}
              </button>
              <div class="console-locale" role="none">
                <LocaleSwitcher />
              </div>
              <button
                v-if="showOnboarding"
                type="button"
                class="console-menu-link"
                role="menuitem"
                @click="replayGuide"
              >
                {{ t('onboarding.restartTour') }}
              </button>
              <p v-if="contactInfo" class="console-contact">
                {{ t('common.contactSupport') }}: {{ contactInfo }}
              </p>
              <button type="button" class="console-menu-link console-menu-logout" role="menuitem" @click="handleLogout">
                {{ t('nav.logout') }}
              </button>
            </div>
          </div>
        </div>

        <button
          ref="mobileTrigger"
          type="button"
          class="topnav-menu-button console-mobile-button"
          data-testid="mobile-menu-button"
          :aria-expanded="mobileOpen"
          aria-controls="console-mobile-nav"
          @click="toggleMobile"
        >
          {{ mobileOpen ? t('nav.closeNavigation') : t('nav.openNavigation') }}
        </button>
      </div>
    </div>

    <div
      v-show="mobileOpen"
      id="console-mobile-nav"
      ref="mobilePanel"
      class="console-mobile-sheet"
      data-testid="mobile-nav"
      @keydown="onMenuKeydown($event, mobileTrigger, closeMobile)"
    >
      <nav class="console-mobile-daily" :aria-label="t('nav.primary')">
        <router-link
          v-for="item in nav.daily"
          :key="`m-${item.path}`"
          :to="item.to ?? item.path"
          class="console-menu-link"
          @click="closeAll"
        >
          {{ item.label }}
        </router-link>
      </nav>
      <section v-if="isAdmin && nav.admin.length" :aria-label="t('nav.adminMenu')">
        <p class="console-mobile-label">{{ t('nav.adminMenu') }}</p>
        <ConsoleMenuList :items="nav.admin" :current-path="route.path" @select="closeAll" />
      </section>
      <section :aria-label="t('nav.accountMenu')">
        <p class="console-mobile-label">{{ t('nav.accountMenu') }}</p>
        <ConsoleMenuList :items="nav.account" :current-path="route.path" @select="closeAll" />
        <button type="button" class="console-menu-link" @click="toggleTheme">
          {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}
        </button>
        <div class="console-locale">
          <LocaleSwitcher />
        </div>
        <button type="button" class="console-menu-link console-menu-logout" @click="handleLogout">
          {{ t('nav.logout') }}
        </button>
      </section>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import VersionBadge from '@/components/common/VersionBadge.vue'
import { usesCnyCreditLedger } from '@/constants/dodoCardShop'
import { sanitizeUrl } from '@/utils/url'
import ConsoleMenuList from './ConsoleMenuList.vue'
import { useConsoleNav } from './useConsoleNav'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()
const { nav } = useConsoleNav()

const adminOpen = ref(false)
const accountOpen = ref(false)
const mobileOpen = ref(false)
const isDark = ref(document.documentElement.classList.contains('dark'))

const adminRoot = ref<HTMLElement | null>(null)
const accountRoot = ref<HTMLElement | null>(null)
const adminTrigger = ref<HTMLButtonElement | null>(null)
const accountTrigger = ref<HTMLButtonElement | null>(null)
const mobileTrigger = ref<HTMLButtonElement | null>(null)
const adminPanel = ref<HTMLElement | null>(null)
const accountPanel = ref<HTMLElement | null>(null)
const mobilePanel = ref<HTMLElement | null>(null)

const user = computed(() => authStore.user)
const isAdmin = computed(() => authStore.isAdmin)
const homePath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))
const siteName = computed(() => appStore.siteName)
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteVersion = computed(() => appStore.siteVersion)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl || ''))
const contactInfo = computed(() => appStore.contactInfo)
const showOnboarding = computed(() => !authStore.isSimpleMode && user.value?.role === 'admin')

const creditLedger = computed(() => usesCnyCreditLedger(
  appStore.publicSettingsLoaded,
  appStore.cachedPublicSettings?.payment_enabled,
))
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))

function formatAmount(value: number): string {
  const amount = Number.isFinite(value) ? value.toFixed(2) : '0.00'
  return creditLedger.value ? `¥${amount}` : `$${amount}`
}

const balanceText = computed(() => formatAmount(availableBalance.value))
const frozenText = computed(() => formatAmount(frozenBalance.value))
const balanceLabel = computed(() => balanceText.value)

function isCurrent(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function closeAdmin() {
  adminOpen.value = false
}

function closeAccount() {
  accountOpen.value = false
}

function closeMobile() {
  mobileOpen.value = false
}

function closeAll() {
  adminOpen.value = false
  accountOpen.value = false
  mobileOpen.value = false
}

async function focusFirst(panel: HTMLElement | null, isOpen: () => boolean) {
  await nextTick()
  if (!isOpen()) return
  const target = panel?.querySelector<HTMLElement>('a, button, input, select, [tabindex="0"]')
  target?.focus()
}

function toggleAdmin() {
  adminOpen.value = !adminOpen.value
  if (adminOpen.value) {
    accountOpen.value = false
    mobileOpen.value = false
    void focusFirst(adminPanel.value, () => adminOpen.value)
  }
}

function toggleAccount() {
  accountOpen.value = !accountOpen.value
  if (accountOpen.value) {
    adminOpen.value = false
    mobileOpen.value = false
    void focusFirst(accountPanel.value, () => accountOpen.value)
  }
}

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
  if (mobileOpen.value) {
    adminOpen.value = false
    accountOpen.value = false
    void focusFirst(mobilePanel.value, () => mobileOpen.value)
  }
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function replayGuide() {
  closeAll()
  onboardingStore.replay()
}

async function handleLogout() {
  closeAll()
  try {
    await authStore.logout()
  } catch (error) {
    console.error('Logout error:', error)
  }
  await router.push('/login')
}

function onMenuKeydown(event: KeyboardEvent, trigger: HTMLButtonElement | null, close: () => void) {
  if (event.key === 'Escape' || event.key === 'Esc' || event.code === 'Escape') {
    event.preventDefault()
    close()
    trigger?.focus()
    return
  }
  if (event.key !== 'Tab') return
  const root = event.currentTarget as HTMLElement
  const items = [...root.querySelectorAll<HTMLElement>('a, button, input, select, [tabindex="0"]')]
    .filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (adminRoot.value?.contains(target) || accountRoot.value?.contains(target)) return
  if (mobileTrigger.value?.contains(target) || mobilePanel.value?.contains(target)) return
  adminOpen.value = false
  accountOpen.value = false
  mobileOpen.value = false
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' && event.key !== 'Esc' && event.code !== 'Escape') return
  if (mobileOpen.value) {
    event.preventDefault()
    mobileOpen.value = false
    mobileTrigger.value?.focus()
    return
  }
  if (adminOpen.value) {
    event.preventDefault()
    adminOpen.value = false
    adminTrigger.value?.focus()
    return
  }
  if (accountOpen.value) {
    event.preventDefault()
    accountOpen.value = false
    accountTrigger.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

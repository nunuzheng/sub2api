<template>
  <AppLayout>
    <div class="balance-page">
      <section class="balance-hero" aria-labelledby="balance-heading">
        <p id="balance-heading" class="balance-kicker">{{ t('redeem.currentBalance') }}</p>
        <p
          class="balance-figure"
          :class="{ 'is-refreshing': balanceRefreshing }"
          data-testid="balance-figure"
        >
          {{ formatBalance(shownBalance) }}
          <span v-if="creditLedger" class="balance-unit">{{ t('redeem.creditUnit') }}</span>
        </p>
        <p v-if="balanceRefreshing" role="status">{{ t('redeem.balanceRefreshing') }}</p>
        <p v-if="creditLedger" class="balance-parity">{{ t('redeem.creditParity') }}</p>
        <p v-else-if="!settingsLoaded" role="status">{{ t('redeem.settingsLoading') }}</p>
        <p class="balance-concurrency">
          {{ t('redeem.concurrency') }}: {{ user?.concurrency || 0 }} {{ t('redeem.requests') }}
        </p>
      </section>

      <div class="balance-split">
        <section class="balance-pane" aria-labelledby="purchase-heading">
          <h2 id="purchase-heading">{{ creditLedger ? t('redeem.purchaseTitle') : t('redeem.onlinePurchaseTitle') }}</h2>
          <template v-if="creditLedger">
            <div data-testid="card-shop">
              <p>{{ t('redeem.purchaseLead') }}</p>
              <fieldset class="tier-list">
                <legend>{{ t('redeem.soldOnly') }}</legend>
                <label
                  v-for="tier in tiers"
                  :key="tier.id"
                  class="tier-option"
                  :class="{ 'is-selected': selectedTier === tier.id }"
                >
                  <input v-model="selectedTier" type="radio" name="card-tier" :value="tier.id" />
                  <span class="tabular-nums">¥{{ tier.priceCny }}</span>
                  <span>{{ t('redeem.tierArrive', { credits: tier.credits }) }}</span>
                </label>
              </fieldset>
              <a
                class="btn btn-primary"
                data-testid="shop-link"
                :href="shopUrl"
                target="_blank"
                rel="noopener noreferrer"
              >{{ t('redeem.shopAction') }}</a>
              <p>{{ t('redeem.shopHint') }}</p>
            </div>
          </template>
          <template v-else-if="settingsLoaded && paymentEnabled">
            <div data-testid="online-purchase">
              <p>{{ t('redeem.onlinePurchaseLead') }}</p>
              <router-link class="btn btn-primary" to="/purchase">{{ t('redeem.goToPurchase') }}</router-link>
            </div>
          </template>
          <p v-else>{{ t('redeem.settingsLoading') }}</p>
          <details class="balance-howto">
            <summary>{{ t('redeem.howTo') }}</summary>
            <ol v-if="creditLedger">
              <li>{{ t('redeem.stepShop') }}</li>
              <li>{{ t('redeem.stepCode') }}</li>
              <li>{{ t('redeem.stepRedeem') }}</li>
            </ol>
            <p v-else>{{ t('redeem.onlinePurchaseLead') }}</p>
          </details>
        </section>

        <section class="balance-pane" aria-labelledby="redeem-heading">
          <h2 id="redeem-heading">{{ t('redeem.redeemTitle') }}</h2>
          <p>{{ t('redeem.redeemLead') }}</p>
          <form @submit.prevent="handleRedeem">
            <label for="code" class="input-label">{{ t('redeem.redeemCodeLabel') }}</label>
            <input
              id="code"
              v-model="redeemCode"
              type="text"
              required
              autocomplete="off"
              :placeholder="t('redeem.redeemCodePlaceholder')"
              :disabled="submitting"
              class="input"
            />
            <p class="input-hint">{{ t('redeem.redeemCodeHint') }}</p>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="!redeemCode || submitting"
              :aria-busy="submitting"
            >
              <span v-if="submitting" class="spinner" aria-hidden="true"></span>
              {{ submitting ? t('redeem.redeeming') : t('redeem.redeemButton') }}
            </button>
          </form>

          <div role="status" aria-live="polite">
            <div v-if="redeemResult" class="balance-feedback is-success" data-testid="redeem-success">
              <h3>{{ t('redeem.redeemSuccess') }}</h3>
              <p>{{ redeemResult.message }}</p>
              <p v-if="redeemResult.type === 'balance'">
                {{ t('redeem.added') }}: {{ formatSignedBalance(redeemResult.value) }}
              </p>
              <p v-else-if="redeemResult.type === 'concurrency'">
                {{ t('redeem.added') }}: {{ redeemResult.value }} {{ t('redeem.concurrentRequests') }}
              </p>
              <p v-else-if="redeemResult.type === 'subscription'">
                {{ t('redeem.subscriptionAssigned') }}
                <span v-if="redeemResult.group_name"> - {{ redeemResult.group_name }}</span>
                <span v-if="redeemResult.validity_days">
                  ({{ t('redeem.subscriptionDays', { days: redeemResult.validity_days }) }})
                </span>
              </p>
              <p v-if="redeemResult.new_balance !== undefined">
                {{ t('redeem.newBalance') }}:
                <span class="tabular-nums">{{ formatBalance(redeemResult.new_balance) }}</span>
              </p>
              <p v-if="redeemResult.new_concurrency !== undefined">
                {{ t('redeem.newConcurrency') }}:
                {{ redeemResult.new_concurrency }} {{ t('redeem.requests') }}
              </p>
            </div>
            <div v-if="errorMessage" class="balance-feedback is-error" data-testid="redeem-error">
              <h3>{{ t('redeem.redeemFailed') }}</h3>
              <p>{{ errorMessage }}</p>
            </div>
          </div>
        </section>
      </div>

      <section class="balance-ledger" aria-labelledby="ledger-heading">
        <div class="balance-ledger-head">
          <h2 id="ledger-heading">{{ t('redeem.ledgerTitle') }}</h2>
          <p>{{ t('redeem.ledgerNote') }}</p>
        </div>
        <p v-if="loadingHistory" role="status">{{ t('redeem.historyLoading') }}</p>
        <table v-else-if="history.length > 0" class="balance-table">
          <thead>
            <tr>
              <th>{{ t('redeem.colTime') }}</th>
              <th>{{ t('redeem.colType') }}</th>
              <th>{{ t('redeem.colChange') }}</th>
              <th>{{ t('redeem.colNote') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in history" :key="item.id">
              <td>{{ formatDateTime(item.used_at) }}</td>
              <td>{{ getHistoryItemTitle(item) }}</td>
              <td class="tabular-nums">{{ formatHistoryValue(item) }}</td>
              <td>
                <span v-if="!isAdminAdjustment(item.type)">{{ item.code.slice(0, 8) }}...</span>
                <span v-else>{{ t('redeem.adminAdjustment') }}</span>
                <span v-if="item.notes"> {{ item.notes }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else>{{ t('redeem.historyWillAppear') }}</p>
        <div class="balance-pager">
          <span>{{ t('common.total') }}: {{ historyTotal }} {{ t('pagination.results') }}</span>
          <label>
            {{ t('pagination.perPage') }}
            <select
              v-model="historyPageSize"
              class="input"
              :disabled="loadingHistory || submitting"
              @change="fetchHistory(1)"
            >
              <option v-for="size in [20, 50, 100]" :key="size" :value="size">{{ size }}</option>
            </select>
          </label>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loadingHistory || submitting || historyPage <= 1"
            @click="fetchHistory(historyPage - 1)"
          >{{ t('pagination.previous') }}</button>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loadingHistory || submitting || historyPage * historyPageSize >= historyTotal"
            @click="fetchHistory(historyPage + 1)"
          >{{ t('pagination.next') }}</button>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useSubscriptionStore } from '@/stores/subscriptions'
import { redeemAPI, type RedeemHistoryItem } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import { DODO_CARD_TIERS, resolveCardShopUrl, usesCnyCreditLedger } from '@/constants/dodoCardShop'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const subscriptionStore = useSubscriptionStore()

const user = computed(() => authStore.user)
const tiers = DODO_CARD_TIERS
const selectedTier = ref(DODO_CARD_TIERS[0].id)
const displayedBalance = ref<number | null>(null)
const balanceRefreshing = ref(false)

const settingsLoaded = computed(() => appStore.publicSettingsLoaded === true)
const paymentEnabled = computed(() => appStore.cachedPublicSettings?.payment_enabled === true)
const creditLedger = computed(() => usesCnyCreditLedger(
  settingsLoaded.value,
  appStore.cachedPublicSettings?.payment_enabled,
))
const shownBalance = computed(() => displayedBalance.value ?? Number(user.value?.balance || 0))
const shopUrl = computed(() => resolveCardShopUrl(appStore.cachedPublicSettings?.custom_menu_items))

const redeemCode = ref('')
const submitting = ref(false)
const redeemResult = ref<{
  message: string
  type: string
  value: number
  new_balance?: number
  new_concurrency?: number
  group_name?: string
  validity_days?: number
} | null>(null)
const errorMessage = ref('')

const history = ref<RedeemHistoryItem[]>([])
const loadingHistory = ref(false)
const historyPage = ref(1)
const historyPageSize = ref(20)
const historyTotal = ref(0)
let historyRequest = 0
let loadedHistoryPageSize = 20

const isBalanceType = (type: string) => type === 'balance' || type === 'admin_balance'
const isSubscriptionType = (type: string) => type === 'subscription'
const isAdminAdjustment = (type: string) => type === 'admin_balance' || type === 'admin_concurrency'

function formatBalance(value: number): string {
  const amount = Number.isFinite(value) ? value.toFixed(2) : '0.00'
  return creditLedger.value ? amount : `$${amount}`
}

function formatSignedBalance(value: number): string {
  const sign = value >= 0 ? '+' : ''
  const amount = Number.isFinite(value) ? value.toFixed(2) : '0.00'
  if (creditLedger.value) return `${sign}${amount} ${t('redeem.creditUnit')}`
  return `${sign}$${amount}`
}

const getHistoryItemTitle = (item: RedeemHistoryItem) => {
  if (item.type === 'balance') return t('redeem.balanceAddedRedeem')
  if (item.type === 'admin_balance') {
    return item.value >= 0 ? t('redeem.balanceAddedAdmin') : t('redeem.balanceDeductedAdmin')
  }
  if (item.type === 'concurrency') return t('redeem.concurrencyAddedRedeem')
  if (item.type === 'admin_concurrency') {
    return item.value >= 0 ? t('redeem.concurrencyAddedAdmin') : t('redeem.concurrencyReducedAdmin')
  }
  if (item.type === 'subscription') return t('redeem.subscriptionAssigned')
  return t('common.unknown')
}

const formatHistoryValue = (item: RedeemHistoryItem) => {
  if (isBalanceType(item.type)) return formatSignedBalance(item.value)
  if (isSubscriptionType(item.type)) {
    const days = item.validity_days || Math.round(item.value)
    const groupName = item.group?.name || ''
    return groupName ? `${days}${t('redeem.days')} - ${groupName}` : `${days}${t('redeem.days')}`
  }
  const sign = item.value >= 0 ? '+' : ''
  return `${sign}${item.value} ${t('redeem.requests')}`
}

const fetchHistory = async (page = 1) => {
  const request = ++historyRequest
  const pageSize = historyPageSize.value
  loadingHistory.value = true
  try {
    const result = await redeemAPI.getHistory(page, pageSize)
    if (request !== historyRequest) return
    history.value = result.items
    historyTotal.value = result.total
    historyPage.value = page
    historyPageSize.value = pageSize
    loadedHistoryPageSize = pageSize
  } catch (error) {
    if (request !== historyRequest) return
    historyPageSize.value = loadedHistoryPageSize
    appStore.showError(t('redeem.historyLoadFailed'))
    console.error('Failed to fetch history:', error)
  } finally {
    if (request === historyRequest) loadingHistory.value = false
  }
}

const handleRedeem = async () => {
  if (submitting.value) return
  if (!redeemCode.value.trim()) {
    appStore.showError(t('redeem.pleaseEnterCode'))
    return
  }

  submitting.value = true
  errorMessage.value = ''
  redeemResult.value = null

  try {
    const result = await redeemAPI.redeem(redeemCode.value.trim())
    redeemResult.value = result

    balanceRefreshing.value = true
    try {
      const fresh = await authStore.refreshUser()
      if (typeof fresh?.balance === 'number') displayedBalance.value = fresh.balance
    } catch (error) {
      console.error('Failed to refresh user after redeem:', error)
      appStore.showWarning(t('redeem.userRefreshFailed'))
    } finally {
      balanceRefreshing.value = false
    }

    if (result.type === 'subscription') {
      try {
        await subscriptionStore.fetchActiveSubscriptions(true)
      } catch (error) {
        console.error('Failed to refresh subscriptions after redeem:', error)
        appStore.showWarning(t('redeem.subscriptionRefreshFailed'))
      }
    }

    redeemCode.value = ''
    await fetchHistory()
    appStore.showSuccess(t('redeem.codeRedeemSuccess'))
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || t('redeem.failedToRedeem')
    appStore.showError(t('redeem.redeemFailed'))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void fetchHistory()
})
</script>

<style scoped>
.balance-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.balance-hero,
.balance-pane,
.balance-ledger {
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}

.balance-kicker,
.balance-parity,
.balance-concurrency,
.balance-ledger-head p,
.tier-list legend,
.balance-pane p {
  font-size: 0.95rem;
}

.balance-figure {
  margin: 0.25rem 0;
  font-size: 2.5rem;
  line-height: 1.1;
}

.balance-unit {
  margin-left: 0.35rem;
  font-size: 1rem;
  font-weight: 400;
}

.balance-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.balance-pane h2,
.balance-ledger h2 {
  margin-bottom: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.balance-pane form,
.tier-list,
.balance-howto {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.tier-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.tier-option.is-selected {
  color: var(--accent);
}

.balance-feedback {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}

.balance-feedback.is-success {
  color: #065f46;
}

.balance-feedback.is-error {
  color: #9f1239;
}

.balance-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.balance-table th,
.balance-table td {
  padding: 0.65rem 0.4rem;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.balance-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

@media (min-width: 900px) {
  .balance-split {
    grid-template-columns: 1fr 1fr;
  }

  .balance-pane + .balance-pane {
    border-left: 1px solid var(--line);
    padding-left: 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .balance-figure {
    transition: none;
  }
}
</style>

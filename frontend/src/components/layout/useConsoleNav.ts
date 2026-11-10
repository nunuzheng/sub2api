import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'
import { buildConsoleNav, type ConsoleNavFlags } from './consoleNav'

export function useConsoleNav() {
  const { t } = useI18n()
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const adminSettingsStore = useAdminSettingsStore()
  const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

  const flags = computed<ConsoleNavFlags>(() => ({
    channelMonitor: isFeatureFlagEnabled(FeatureFlags.channelMonitor),
    payment: isFeatureFlagEnabled(FeatureFlags.payment),
    availableChannels: isFeatureFlagEnabled(FeatureFlags.availableChannels),
    subscription: isFeatureFlagEnabled(FeatureFlags.subscription),
    affiliate: isFeatureFlagEnabled(FeatureFlags.affiliate),
    batchImage: canUseBatchImage.value,
    modelPlaza: isFeatureFlagEnabled(FeatureFlags.modelPlaza),
    riskControl: isFeatureFlagEnabled(FeatureFlags.riskControl),
    pluginManagement: isFeatureFlagEnabled(FeatureFlags.pluginManagement),
    opsMonitoring: adminSettingsStore.opsMonitoringEnabled,
    adminPayment: adminSettingsStore.paymentEnabled,
  }))

  const purchaseLabel = computed(() => {
    switch (resolveSiteBillingMode(appStore.cachedPublicSettings)) {
      case 'recharge_only':
        return t('nav.recharge')
      case 'subscription_only':
        return t('nav.subscribe')
      default:
        return t('nav.buySubscription')
    }
  })

  const nav = computed(() => buildConsoleNav({
    t,
    isAdmin: authStore.isAdmin,
    isSimpleMode: authStore.isSimpleMode,
    backendMode: appStore.backendModeEnabled,
    flags: flags.value,
    purchaseLabel: purchaseLabel.value,
    userCustomItems: appStore.cachedPublicSettings?.custom_menu_items ?? [],
    adminCustomItems: adminSettingsStore.customMenuItems ?? [],
  }))

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) void adminSettingsStore.fetch()
    },
    { immediate: true },
  )

  onMounted(() => {
    void refreshBatchImageAccess()
  })

  return { nav }
}

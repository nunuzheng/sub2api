import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppTopNav from '../AppTopNav.vue'

const authState = vi.hoisted(() => ({
  isAdmin: false,
  isSimpleMode: false,
  isAuthenticated: true,
  user: { role: 'user' as string, email: 'user@example.com', username: 'ada', balance: 17.2, frozen_balance: 0 },
  logout: vi.fn(),
}))

const appState = vi.hoisted(() => ({
  siteName: 'DodoAPI',
  siteLogo: '/logo.svg',
  siteVersion: 'test',
  publicSettingsLoaded: true,
  docUrl: 'https://example.com/docs',
  contactInfo: '',
  backendModeEnabled: false,
  cachedPublicSettings: {
    payment_enabled: false,
    channel_monitor_enabled: true,
    subscription_enabled: true,
    available_channels_enabled: true,
    model_plaza_enabled: true,
    plugin_management_enabled: true,
    affiliate_enabled: true,
    risk_control_enabled: true,
    custom_menu_items: [
      { id: 'shop', label: '链动小铺', icon_svg: '', url: 'https://wzyp.cn/shop/5XL7LZDW', visibility: 'user' as const, sort_order: 0 },
    ],
  },
}))

const adminSettings = vi.hoisted(() => ({
  opsMonitoringEnabled: true,
  paymentEnabled: true,
  customMenuItems: [
    { id: 'secret', label: '内部菜单', icon_svg: '', url: '/admin-only', visibility: 'admin' as const, sort_order: 0 },
  ],
  fetch: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/redeem', name: 'Redeem', meta: {}, params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appState,
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => adminSettings,
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({ replay: vi.fn(), setReplayCallback: vi.fn() }),
}))

vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({
    canUseBatchImage: { value: false },
    refreshBatchImageAccess: vi.fn(),
  }),
}))

vi.mock('@/components/common/AnnouncementBell.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/common/LocaleSwitcher.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/common/VersionBadge.vue', () => ({ default: { template: '<div />' } }))

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: { to: { type: [String, Object], required: true } },
  template: '<a :href="typeof to === \'string\' ? to : (to.path || \'\')"><slot /></a>',
})

function mountNav() {
  return mount(AppTopNav, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

function trackFocus() {
  const focused: HTMLElement[] = []
  const original = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function focusTracked(this: HTMLElement, ...args: []) {
    focused.push(this)
    return original.apply(this, args)
  }
  return {
    focused,
    restore() {
      HTMLElement.prototype.focus = original
    },
  }
}

describe('AppTopNav', () => {
  beforeEach(() => {
    authState.isAdmin = false
    authState.user.role = 'user'
    appState.cachedPublicSettings.payment_enabled = false
    vi.clearAllMocks()
  })

  it('hides admin navigation from a regular user and keeps the shop menu', async () => {
    const wrapper = mountNav()
    await flushPromises()
    expect(wrapper.find('[data-testid="admin-menu-button"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('nav.mySubscriptions')
    expect(wrapper.text()).not.toContain('nav.channelStatus')
    expect(wrapper.text()).not.toContain('内部菜单')
    await wrapper.get('[data-testid="mobile-menu-button"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-nav"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-nav"]').text()).toContain('链动小铺')
    expect(wrapper.get('[data-testid="mobile-nav"]').text()).not.toContain('nav.users')
    expect(wrapper.get('[data-testid="mobile-nav"]').text()).not.toContain('nav.mySubscriptions')
    wrapper.unmount()
  })

  it('opens the full admin menu for an admin and closes it with Escape', async () => {
    authState.isAdmin = true
    authState.user.role = 'admin'
    appState.cachedPublicSettings.payment_enabled = true
    const focus = trackFocus()
    const wrapper = mountNav()
    await flushPromises()
    const button = wrapper.get('[data-testid="admin-menu-button"]')
    await button.trigger('click')
    const menu = wrapper.get('[data-testid="admin-menu"]')
    expect(menu.isVisible()).toBe(true)
    const labels = menu.text()
    expect(labels).toContain('nav.users')
    expect(labels).toContain('nav.accounts')
    expect(labels).toContain('nav.groups')
    expect(labels).toContain('nav.subscriptions')
    expect(labels).toContain('nav.channelMonitor')
    expect(labels).toContain('nav.promptAudit')
    expect(labels).toContain('nav.settings')
    expect(labels).toContain('nav.redeemCodes')
    expect(labels).toContain('内部菜单')
    expect(labels).not.toContain('nav.mySubscriptions')
    expect(labels).not.toContain('nav.channelStatus')
    button.element.focus()
    menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(menu.attributes('style') ?? '').toContain('display: none')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(focus.focused.at(-1)).toBe(button.element)

    await wrapper.get('[data-testid="mobile-menu-button"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-nav"]').isVisible()).toBe(true)
    const mobileButton = wrapper.get('[data-testid="mobile-menu-button"]')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.get('[data-testid="mobile-nav"]').attributes('style') ?? '').toContain('display: none')
    expect(mobileButton.attributes('aria-expanded')).toBe('false')
    expect(focus.focused.at(-1)).toBe(mobileButton.element)
    focus.restore()
    wrapper.unmount()
  })

  it('moves focus back to the account button when Escape is pressed', async () => {
    const focus = trackFocus()
    const wrapper = mountNav()
    const button = wrapper.get('[data-testid="account-menu-button"]')
    await button.trigger('click')
    const menu = wrapper.get('[data-testid="account-menu"]')
    expect(menu.text()).toContain('链动小铺')
    expect(menu.text()).not.toContain('nav.mySubscriptions')
    expect(menu.text()).not.toContain('nav.channelStatus')
    expect(menu.isVisible()).toBe(true)
    button.element.focus()
    menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(menu.attributes('style') ?? '').toContain('display: none')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(focus.focused.at(-1)).toBe(button.element)
    focus.restore()
    wrapper.unmount()
  })
})

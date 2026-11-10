import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  HIDDEN_USER_ACCOUNT_PATHS,
  buildConsoleNav,
  collectNavPaths,
  type ConsoleNavFlags,
  type ConsoleNavInput,
} from '../consoleNav'

const allFlags: ConsoleNavFlags = {
  channelMonitor: true,
  payment: true,
  availableChannels: true,
  subscription: true,
  affiliate: true,
  batchImage: true,
  modelPlaza: true,
  riskControl: true,
  pluginManagement: true,
  opsMonitoring: true,
  adminPayment: true,
}

function input(overrides: Partial<ConsoleNavInput> = {}): ConsoleNavInput {
  return {
    t: (key) => key,
    isAdmin: false,
    isSimpleMode: false,
    backendMode: false,
    flags: allFlags,
    purchaseLabel: 'nav.buySubscription',
    userCustomItems: [
      { id: 'shop', label: '链动小铺', visibility: 'user', sort_order: 1, icon_svg: '<svg></svg>' },
      { id: 'secret', label: '内部', visibility: 'admin', sort_order: 0 },
    ],
    adminCustomItems: [
      { id: 'secret', label: '内部', visibility: 'admin', sort_order: 0 },
      { id: 'shop', label: '链动小铺', visibility: 'user', sort_order: 1 },
    ],
    ...overrides,
  }
}

const adminPaths = [
  '/admin/ops',
  '/admin/users',
  '/admin/groups',
  '/admin/channels/pricing',
  '/admin/channels/monitor',
  '/admin/subscriptions',
  '/admin/accounts',
  '/admin/plugins',
  '/admin/announcements',
  '/admin/proxies',
  '/admin/risk-control',
  '/admin/prompt-audit',
  '/admin/redeem',
  '/admin/promo-codes',
  '/admin/affiliates/invites',
  '/admin/affiliates/rebates',
  '/admin/affiliates/transfers',
  '/admin/orders/dashboard',
  '/admin/orders',
  '/admin/orders/plans',
  '/admin/usage',
  '/admin/audit-logs',
  '/admin/settings',
  '/custom/secret',
]

describe('console navigation', () => {
  it('keeps channel status and my subscriptions out of every user-facing menu', () => {
    const user = buildConsoleNav(input())
    const admin = buildConsoleNav(input({ isAdmin: true }))
    const userPaths = [...collectNavPaths(user.daily), ...collectNavPaths(user.account), ...collectNavPaths(user.admin)]
    const adminAccount = [...collectNavPaths(admin.daily), ...collectNavPaths(admin.account)]
    for (const hidden of HIDDEN_USER_ACCOUNT_PATHS) {
      expect(userPaths).not.toContain(hidden)
      expect(adminAccount).not.toContain(hidden)
    }
    expect(user.admin).toEqual([])
    expect(collectNavPaths(user.admin)).not.toEqual(expect.arrayContaining(['/admin/users']))
  })

  it('gives a regular user the short daily row and keeps the shop menu in the account list', () => {
    const nav = buildConsoleNav(input({ flags: { ...allFlags, payment: false } }))
    expect(nav.daily.map((item) => item.path)).toEqual([
      '/dashboard',
      '/keys',
      '/usage',
      '/model-plaza',
      '/redeem',
    ])
    expect(nav.daily.find((item) => item.path === '/redeem')?.label).toBe('nav.balance')
    const accountPaths = collectNavPaths(nav.account)
    expect(accountPaths).toContain('/profile')
    expect(accountPaths).toContain('/custom/shop')
    expect(accountPaths).not.toContain('/purchase')
    expect(accountPaths).not.toContain('/orders')
    expect(accountPaths).not.toContain('/custom/secret')
    expect(accountPaths.some((path) => path.startsWith('/admin'))).toBe(false)
  })

  it('shows in-app purchase links only when payment is enabled', () => {
    const enabled = buildConsoleNav(input({ flags: { ...allFlags, payment: true } }))
    const enabledPaths = collectNavPaths(enabled.account)
    expect(enabledPaths).toContain('/purchase')
    expect(enabledPaths).toContain('/orders')
    const disabled = buildConsoleNav(input({ flags: { ...allFlags, payment: false } }))
    const disabledPaths = collectNavPaths(disabled.account)
    expect(disabledPaths).not.toContain('/purchase')
    expect(disabledPaths).not.toContain('/orders')
  })

  it('keeps the full admin inventory, including subscriptions and channel monitor', () => {
    const nav = buildConsoleNav(input({ isAdmin: true }))
    expect(nav.daily.map((item) => item.path)).toEqual([
      '/admin/dashboard',
      '/keys',
      '/usage',
      '/model-plaza',
      '/redeem',
    ])
    expect(collectNavPaths(nav.admin)).toEqual(expect.arrayContaining(adminPaths))
    expect(collectNavPaths(nav.admin)).not.toContain('/monitor')
    expect(collectNavPaths(nav.admin)).not.toContain('/subscriptions')
    expect(collectNavPaths(nav.account)).toContain('/custom/shop')
    expect(collectNavPaths(nav.account)).not.toContain('/custom/secret')
  })

  it('drops admin-only entries when their flags are off, without dropping unrelated admin pages', () => {
    const nav = buildConsoleNav(input({
      isAdmin: true,
      flags: {
        ...allFlags,
        subscription: false,
        channelMonitor: false,
        adminPayment: false,
        riskControl: false,
        opsMonitoring: false,
      },
    }))
    const paths = collectNavPaths(nav.admin)
    expect(paths).not.toContain('/admin/subscriptions')
    expect(paths).not.toContain('/admin/channels/monitor')
    expect(paths).not.toContain('/admin/orders')
    expect(paths).not.toContain('/admin/prompt-audit')
    expect(paths).not.toContain('/admin/ops')
    expect(paths).toEqual(expect.arrayContaining(['/admin/users', '/admin/accounts', '/admin/settings', '/admin/groups']))
  })

  it('leaves the hidden routes registered for direct visits and aliases /balance once', () => {
    const router = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../router/index.ts'), 'utf8')
    const monitor = router.slice(router.indexOf("path: '/monitor'"), router.indexOf("path: '/admin/subscriptions'"))
    const subscriptions = router.slice(router.indexOf("path: '/subscriptions'"), router.indexOf("path: '/purchase'"))
    expect(monitor).toContain('requiresAdmin: false')
    expect(monitor).toContain('ChannelStatusView.vue')
    expect(subscriptions).toContain('requiresAdmin: false')
    expect(subscriptions).not.toContain('redirect:')
    expect(router).toContain("path: '/balance'")
    expect(router).toContain("redirect: '/redeem'")
    const redeem = router.slice(router.indexOf("path: '/redeem'"), router.indexOf("path: '/balance'"))
    expect(redeem).not.toContain('redirect:')
    expect(router).toContain("path: '/admin/subscriptions'")
  })
})

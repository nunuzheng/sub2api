/**
 * Console navigation.
 *
 * Hiding a link is not authorization. Admin routes stay behind `requiresAdmin`
 * in the router. `/monitor` (渠道状态) and `/subscriptions` (我的订阅) stay
 * registered for direct visits; they are omitted from the user account menu
 * only. Admin channel monitor and subscription management stay in the admin menu.
 *
 * `/balance` redirects to `/redeem` one way. `/redeem` is the balance page.
 */

export const HIDDEN_USER_ACCOUNT_PATHS = ['/monitor', '/subscriptions'] as const

export interface ConsoleNavItem {
  path: string
  label: string
  to?: string | { path: string; query?: Record<string, string> }
  iconSvg?: string
  children?: ConsoleNavItem[]
  expandOnly?: boolean
  domId?: string
  tour?: string
}

export interface ConsoleNavFlags {
  channelMonitor: boolean
  payment: boolean
  availableChannels: boolean
  subscription: boolean
  affiliate: boolean
  batchImage: boolean
  modelPlaza: boolean
  riskControl: boolean
  pluginManagement: boolean
  opsMonitoring: boolean
  adminPayment: boolean
}

export interface ConsoleNavMenuItem {
  id: string
  label: string
  icon_svg?: string
  visibility?: 'user' | 'admin'
  sort_order?: number
}

export interface ConsoleNavInput {
  t: (key: string) => string
  isAdmin: boolean
  isSimpleMode: boolean
  backendMode: boolean
  flags: ConsoleNavFlags
  purchaseLabel: string
  userCustomItems: ConsoleNavMenuItem[]
  adminCustomItems: ConsoleNavMenuItem[]
}

export interface ConsoleNavModel {
  daily: ConsoleNavItem[]
  admin: ConsoleNavItem[]
  account: ConsoleNavItem[]
}

interface Draft extends ConsoleNavItem {
  flag?: boolean
  hideInSimpleMode?: boolean
  children?: Draft[]
}

function visible(items: Draft[], simple: boolean): ConsoleNavItem[] {
  const out: ConsoleNavItem[] = []
  for (const item of items) {
    if (item.flag === false) continue
    if (simple && item.hideInSimpleMode) continue
    const children = item.children ? visible(item.children, simple) : undefined
    if (item.expandOnly && children && children.length === 0) continue
    out.push({
      path: item.path,
      label: item.label,
      to: item.to,
      iconSvg: item.iconSvg,
      children,
      expandOnly: item.expandOnly,
      domId: item.domId,
      tour: item.tour,
    })
  }
  return out
}

function customItems(items: ConsoleNavMenuItem[], visibility: 'user' | 'admin'): ConsoleNavItem[] {
  return items
    .filter((item) => item.visibility === visibility)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({
      path: `/custom/${item.id}`,
      label: item.label,
      iconSvg: item.icon_svg,
    }))
}

function buildSelf(input: ConsoleNavInput, withDashboard: boolean): Draft[] {
  const { t, flags, purchaseLabel } = input
  const items: Draft[] = []
  if (withDashboard) {
    items.push({ path: '/dashboard', label: t('nav.overview') })
  }
  items.push(
    { path: '/keys', label: t('nav.apiKeys'), tour: 'sidebar-my-keys' },
    { path: '/batch-image', label: t('nav.batchImage'), hideInSimpleMode: true, flag: flags.batchImage },
    { path: '/usage', label: t('nav.usage'), hideInSimpleMode: true },
    { path: '/available-channels', label: t('nav.availableChannels'), hideInSimpleMode: true, flag: flags.availableChannels },
    // 渠道状态 / 我的订阅 are intentionally not built. See HIDDEN_USER_ACCOUNT_PATHS.
    { path: '/purchase', label: purchaseLabel, hideInSimpleMode: true, flag: flags.payment },
    { path: '/orders', label: t('nav.myOrders'), hideInSimpleMode: true, flag: flags.payment },
    { path: '/redeem', label: t('nav.balance'), hideInSimpleMode: true },
    { path: '/affiliate', label: t('nav.affiliate'), hideInSimpleMode: true, flag: flags.affiliate },
    { path: '/profile', label: t('nav.profile') },
    ...customItems(input.userCustomItems, 'user'),
  )
  return items
}

function buildAdmin(input: ConsoleNavInput): Draft[] {
  const { t, flags } = input
  const items: Draft[] = [
    { path: '/admin/dashboard', label: t('nav.overview') },
    { path: '/admin/ops', label: t('nav.ops'), flag: flags.opsMonitoring },
    { path: '/admin/users', label: t('nav.users'), hideInSimpleMode: true },
    { path: '/admin/groups', label: t('nav.groups'), domId: 'sidebar-group-manage' },
    {
      path: '/admin/channels',
      label: t('nav.channelManagement'),
      hideInSimpleMode: true,
      expandOnly: true,
      children: [
        { path: '/admin/channels/pricing', label: t('nav.channelPricing') },
        { path: '/admin/channels/monitor', label: t('nav.channelMonitor'), flag: flags.channelMonitor },
      ],
    },
    { path: '/admin/subscriptions', label: t('nav.subscriptions'), hideInSimpleMode: true, flag: flags.subscription },
    { path: '/admin/accounts', label: t('nav.accounts'), domId: 'sidebar-channel-manage' },
    { path: '/admin/plugins', label: t('nav.plugins'), flag: flags.pluginManagement },
    { path: '/admin/announcements', label: t('nav.announcements') },
    { path: '/admin/proxies', label: t('nav.proxies') },
    {
      path: '/admin/security-audit',
      label: t('nav.securityAudit'),
      expandOnly: true,
      flag: flags.riskControl,
      children: [
        { path: '/admin/risk-control', label: t('nav.contentModeration') },
        { path: '/admin/prompt-audit', label: t('nav.promptAudit') },
      ],
    },
    { path: '/admin/redeem', label: t('nav.redeemCodes'), hideInSimpleMode: true, domId: 'sidebar-wallet' },
    { path: '/admin/promo-codes', label: t('nav.promoCodes'), hideInSimpleMode: true },
    {
      path: '/admin/affiliates',
      label: t('nav.affiliateManagement'),
      hideInSimpleMode: true,
      expandOnly: true,
      flag: flags.affiliate,
      children: [
        { path: '/admin/affiliates/invites', label: t('nav.affiliateInviteRecords') },
        { path: '/admin/affiliates/rebates', label: t('nav.affiliateRebateRecords') },
        { path: '/admin/affiliates/transfers', label: t('nav.affiliateTransferRecords') },
      ],
    },
    {
      path: '/admin/orders',
      label: t('nav.orderManagement'),
      hideInSimpleMode: true,
      expandOnly: true,
      flag: flags.adminPayment,
      children: [
        { path: '/admin/orders/dashboard', label: t('nav.paymentDashboard') },
        { path: '/admin/orders', label: t('nav.orderManagement') },
        { path: '/admin/orders/plans', label: t('nav.paymentPlans') },
      ],
    },
    { path: '/admin/usage', label: t('nav.usage') },
    { path: '/admin/audit-logs', label: t('nav.auditLogs'), hideInSimpleMode: true },
  ]

  const custom = customItems(input.adminCustomItems, 'admin')
  if (input.isSimpleMode) {
    const filtered = visible(items, true)
    filtered.push({ path: '/admin/settings', label: t('nav.settings') })
    filtered.push(...custom)
    return filtered
  }
  const full = visible(items, false)
  full.push({ path: '/admin/settings', label: t('nav.settings') })
  full.push(...custom)
  return full
}

function withoutPaths(items: ConsoleNavItem[], paths: Set<string>): ConsoleNavItem[] {
  return items.filter((item) => !paths.has(item.path))
}

export function buildConsoleNav(input: ConsoleNavInput): ConsoleNavModel {
  if (input.backendMode && !input.isAdmin) {
    return { daily: [], admin: [], account: [] }
  }

  const self = visible(buildSelf(input, !input.isAdmin), input.isSimpleMode)
  const daily: ConsoleNavItem[] = []
  const push = (path: string, label?: string, extra?: Partial<ConsoleNavItem>) => {
    const found = self.find((item) => item.path === path)
    if (path === '/admin/dashboard' && input.isAdmin) {
      daily.push({ path, label: label ?? input.t('nav.overview') })
      return
    }
    if (!found && path === '/model-plaza') {
      daily.push({
        path,
        label: label ?? input.t('nav.modelPlaza'),
        to: { path: '/model-plaza', query: { embedded: '1' } },
      })
      return
    }
    if (!found) return
    daily.push({ ...found, ...extra, label: label ?? found.label })
  }

  if (input.isAdmin) {
    push('/admin/dashboard')
  } else {
    push('/dashboard')
  }
  push('/keys')
  push('/usage')
  if (input.flags.modelPlaza && !input.isSimpleMode) {
    push('/model-plaza')
  }
  push('/redeem', input.t('nav.balance'))

  const dailyPaths = new Set(daily.map((item) => item.path))
  // Simple-mode admins previously had no personal section.
  const account = input.isAdmin && input.isSimpleMode
    ? []
    : withoutPaths(self, dailyPaths)
  let admin = input.isAdmin ? buildAdmin(input) : []
  admin = withoutPaths(admin, dailyPaths)

  return { daily, admin, account }
}

export function collectNavPaths(items: readonly ConsoleNavItem[]): string[] {
  const paths: string[] = []
  for (const item of items) {
    paths.push(item.path)
    if (item.children) paths.push(...collectNavPaths(item.children))
  }
  return paths
}

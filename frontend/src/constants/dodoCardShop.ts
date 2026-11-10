import { sanitizeUrl } from '@/utils/url'

/**
 * Public card shop for the payment-off recharge path.
 *
 * There is no settings field for the on-sale denominations. `payment_enabled`
 * still gates the in-app checkout. `purchase_subscription_url` is a separate
 * iframe feature and is not used here. `balance_low_notify_recharge_url` is
 * only the low-balance email link.
 *
 * A saved custom menu whose label contains「链动」and whose url is http(s)
 * wins over the confirmed public storefront, so an operator can move the shop
 * without a new API. Denominations stay the two amounts actually on sale.
 */
export const DODO_CARD_SHOP_URL = 'https://wzyp.cn/shop/5XL7LZDW'

export interface CardShopTier {
  id: string
  priceCny: number
  credits: number
}

export const DODO_CARD_TIERS: readonly CardShopTier[] = [
  { id: 'cny-10', priceCny: 10, credits: 10 },
  { id: 'cny-50', priceCny: 50, credits: 50 },
]

export interface CardShopMenuItem {
  label: string
  url?: string
}

/** True only after public settings loaded with in-app payment explicitly off. */
export function usesCnyCreditLedger(
  settingsLoaded: boolean,
  paymentEnabled: boolean | undefined,
): boolean {
  return settingsLoaded && paymentEnabled === false
}

export function resolveCardShopUrl(items: readonly CardShopMenuItem[] | null | undefined): string {
  for (const item of items ?? []) {
    if (!item.label.includes('链动')) continue
    const safe = sanitizeUrl(item.url ?? '')
    if (safe) return safe
  }
  return DODO_CARD_SHOP_URL
}

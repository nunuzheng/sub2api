import { describe, expect, it } from 'vitest'
import {
  DODO_CARD_SHOP_URL,
  DODO_CARD_TIERS,
  resolveCardShopUrl,
  usesCnyCreditLedger,
} from '../dodoCardShop'

describe('Dodo card shop config', () => {
  it('sells only the two confirmed amounts', () => {
    expect(DODO_CARD_TIERS.map((tier) => [tier.priceCny, tier.credits])).toEqual([
      [10, 10],
      [50, 50],
    ])
  })

  it('uses the CNY ledger only when loaded settings explicitly disable in-app payment', () => {
    expect(usesCnyCreditLedger(false, false)).toBe(false)
    expect(usesCnyCreditLedger(false, undefined)).toBe(false)
    expect(usesCnyCreditLedger(true, true)).toBe(false)
    expect(usesCnyCreditLedger(true, undefined)).toBe(false)
    expect(usesCnyCreditLedger(true, false)).toBe(true)
  })

  it('prefers a saved https 链动 menu and ignores unsafe urls', () => {
    expect(resolveCardShopUrl([
      { label: '链动小铺', url: 'https://shop.example/card' },
    ])).toBe('https://shop.example/card')
    expect(resolveCardShopUrl([
      { label: '链动小铺', url: 'javascript:alert(1)' },
    ])).toBe(DODO_CARD_SHOP_URL)
    expect(resolveCardShopUrl([])).toBe(DODO_CARD_SHOP_URL)
  })
})

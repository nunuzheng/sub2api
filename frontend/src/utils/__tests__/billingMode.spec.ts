import { describe, expect, it } from 'vitest'
import {
  BILLING_MODE_KIRO_CREDIT,
  BILLING_MODE_IMAGE,
  BILLING_MODE_TOKEN,
  BILLING_MODE_VIDEO,
  formatCreditCharge,
  getDisplayBillingMode,
  isImageUsage
} from '../billingMode'

describe('billingMode helpers', () => {
  it('prefers explicit video mode over image_count', () => {
    expect(
      getDisplayBillingMode({ image_count: 1, billing_mode: BILLING_MODE_VIDEO })
    ).toBe(BILLING_MODE_VIDEO)
    expect(isImageUsage({ image_count: 1, billing_mode: BILLING_MODE_VIDEO })).toBe(false)
  })

  it('infers image when image_count set and mode missing', () => {
    expect(getDisplayBillingMode({ image_count: 2, billing_mode: null })).toBe(BILLING_MODE_IMAGE)
  })

  it('formats a credit charge like the SuperGPT usage page', () => {
    expect(formatCreditCharge(0.544, 0.08)).toBe('0.544 credit × $0.08/credit')
  })

  it('keeps kiro credit mode even with image_count', () => {
    expect(
      getDisplayBillingMode({ image_count: 1, billing_mode: BILLING_MODE_KIRO_CREDIT })
    ).toBe(BILLING_MODE_KIRO_CREDIT)
    expect(isImageUsage({ image_count: 1, billing_mode: BILLING_MODE_KIRO_CREDIT })).toBe(false)
  })

  it('keeps token mode even with image_count', () => {
    expect(
      getDisplayBillingMode({ image_count: 1, billing_mode: BILLING_MODE_TOKEN })
    ).toBe(BILLING_MODE_TOKEN)
  })
})

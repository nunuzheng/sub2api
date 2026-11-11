import { describe, expect, it } from 'vitest'
import {
  describeDeepseekIdleDiscount,
  deepseekOfficialCnyTier,
} from '../deepseekIdleDiscount'

describe('describeDeepseekIdleDiscount', () => {
  it('maps the published call names and refuses unknown models', () => {
    expect(deepseekOfficialCnyTier('deepseek-flash')).toBe('flash')
    expect(deepseekOfficialCnyTier('deepseek-v4.1-flash')).toBe('flash')
    expect(deepseekOfficialCnyTier('deepseek-v4-flash')).toBe('flash')
    expect(deepseekOfficialCnyTier('deepseek-v4-pro')).toBe('pro')
    expect(deepseekOfficialCnyTier('deepseek-chat')).toBeNull()
    expect(deepseekOfficialCnyTier('gpt-5.6')).toBeNull()
  })

  it('states the idle-RMB fold from the site selling price', () => {
    expect(describeDeepseekIdleDiscount('deepseek-v4.1-flash', {
      input: 0.21, output: 0.84, cacheHit: 0.0042,
    })).toEqual({ fold: '2.1折', approximate: false })

    expect(describeDeepseekIdleDiscount('deepseek-v4-pro', {
      input: 0.924, output: 2.772, cacheHit: 0.0308,
    })).toEqual({ fold: '2.05折', approximate: true })

    expect(describeDeepseekIdleDiscount('deepseek-v4-flash', {
      input: 0.0336, output: 0.1344, cacheHit: 0.000672,
    })).toEqual({ fold: '0.336折', approximate: false })
  })

  it('does not invent one fold when the components disagree', () => {
    expect(describeDeepseekIdleDiscount('deepseek-v4-flash', {
      input: 0.21, output: 0.84, cacheHit: 0.02,
    })).toBeNull()
  })

  it('still compares input and output when cache hit is absent', () => {
    expect(describeDeepseekIdleDiscount('deepseek-flash', {
      input: 0.0336, output: 0.1344, cacheHit: null,
    })?.fold).toBe('0.336折')
  })
})

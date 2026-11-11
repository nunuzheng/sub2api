/**
 * Display-only reference for DeepSeek's published idle RMB list prices.
 * Not a billing input. Site ledger amounts are compared 1:1 with these yuan
 * figures; they are not converted from the USD catalog.
 *
 * Idle prices per million tokens (public pricing page):
 * Flash input / output / cache hit = 1 / 4 / 0.02
 * Pro input / output / cache hit = 4.5 / 13.5 / 0.15
 * Peak hours are a separate official window and are not used here.
 */

export interface CnyIdlePrices {
  inputPerMillion: number
  outputPerMillion: number
  cacheHitPerMillion: number
}

export const DEEPSEEK_OFFICIAL_CNY_IDLE = {
  flash: { inputPerMillion: 1, outputPerMillion: 4, cacheHitPerMillion: 0.02 },
  pro: { inputPerMillion: 4.5, outputPerMillion: 13.5, cacheHitPerMillion: 0.15 },
} as const satisfies Record<string, CnyIdlePrices>

export type DeepseekIdleTier = keyof typeof DEEPSEEK_OFFICIAL_CNY_IDLE

/** Known call names that share one published idle card. Other names get no discount. */
export function deepseekOfficialCnyTier(modelName: string): DeepseekIdleTier | null {
  const name = modelName.trim().toLowerCase()
  if (/^deepseek-v4-pro(?:$|[-/])/.test(name)) return 'pro'
  if (
    /^deepseek-flash(?:$|[-/])/.test(name) ||
    /^deepseek-v4\.1-flash(?:$|[-/])/.test(name) ||
    /^deepseek-v4-flash(?:$|[-/])/.test(name)
  ) {
    return 'flash'
  }
  return null
}

export interface SiteSellingPerMillion {
  input: number | null
  output: number | null
  cacheHit: number | null
}

export interface IdleDiscountLabel {
  /** Includes the 折 suffix, e.g. "2.1折". */
  fold: string
  approximate: boolean
}

/**
 * One fold number only when input, output, and cache hit (when present)
 * agree. Divergent components return null instead of a blended claim.
 */
export function describeDeepseekIdleDiscount(
  modelName: string,
  selling: SiteSellingPerMillion,
): IdleDiscountLabel | null {
  const tier = deepseekOfficialCnyTier(modelName)
  if (!tier) return null
  const ref = DEEPSEEK_OFFICIAL_CNY_IDLE[tier]
  const pairs: Array<[number | null, number]> = [
    [selling.input, ref.inputPerMillion],
    [selling.output, ref.outputPerMillion],
  ]
  if (selling.cacheHit != null) pairs.push([selling.cacheHit, ref.cacheHitPerMillion])
  const ratios: number[] = []
  for (const [site, official] of pairs) {
    if (site == null || !(official > 0) || !(site > 0) || !Number.isFinite(site)) return null
    ratios.push(site / official)
  }
  const base = ratios[0]
  if (!Number.isFinite(base) || base <= 0) return null
  if (ratios.some((ratio) => Math.abs(ratio - base) / base > 0.01)) return null
  return formatFold(base)
}

function formatFold(ratio: number): IdleDiscountLabel {
  const fold = ratio * 10
  if (fold >= 1) {
    const rounded = Math.round(fold * 100) / 100
    return {
      fold: `${trimZeros(rounded.toFixed(2))}折`,
      approximate: Math.abs(rounded - fold) > 1e-9,
    }
  }
  const rounded = Number(fold.toPrecision(3))
  return {
    fold: `${rounded}折`,
    approximate: Math.abs(rounded - fold) / fold > 1e-6,
  }
}

function trimZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

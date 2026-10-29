export const BILLING_MODE_TOKEN = 'token'
export const BILLING_MODE_PER_REQUEST = 'per_request'
export const BILLING_MODE_IMAGE = 'image'
export const BILLING_MODE_VIDEO = 'video'
export const BILLING_MODE_KIRO_CREDIT = 'kiro_credit'
export const BILLING_MODE_KIRO_CREDIT_MISSING = 'kiro_credit_missing'
export const BILLING_MODE_KIRO_CREDIT_ERROR = 'kiro_credit_error'

export function getBillingModeLabel(mode: string | null | undefined, t: (key: string) => string): string {
  switch (mode) {
    case BILLING_MODE_PER_REQUEST: return t('admin.usage.billingModePerRequest')
    case BILLING_MODE_IMAGE: return t('admin.usage.billingModeImage')
    case BILLING_MODE_VIDEO: return t('admin.usage.billingModeVideo')
    case BILLING_MODE_KIRO_CREDIT: return t('admin.usage.billingModeKiroCredit')
    case BILLING_MODE_KIRO_CREDIT_MISSING: return t('admin.usage.billingModeKiroCreditMissing')
    case BILLING_MODE_KIRO_CREDIT_ERROR: return t('admin.usage.billingModeKiroCreditError')
    default: return t('admin.usage.billingModeToken')
  }
}

export function getBillingModeBadgeClass(mode: string | null | undefined): string {
  switch (mode) {
    case BILLING_MODE_PER_REQUEST: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    case BILLING_MODE_IMAGE: return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
    case BILLING_MODE_VIDEO: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case BILLING_MODE_KIRO_CREDIT: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case BILLING_MODE_KIRO_CREDIT_MISSING: return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
    case BILLING_MODE_KIRO_CREDIT_ERROR: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  }
}

interface ImageBillingRow {
  image_count: number
  billing_mode?: string | null
  total_cost: number
}

export function isImageUsage(row: Pick<ImageBillingRow, 'image_count' | 'billing_mode'> | null | undefined): boolean {
  return (row?.image_count ?? 0) > 0 && row?.billing_mode !== BILLING_MODE_TOKEN && row?.billing_mode !== BILLING_MODE_VIDEO && !isKiroCreditMode(row?.billing_mode)
}

export function getDisplayBillingMode(row: Pick<ImageBillingRow, 'billing_mode' | 'image_count'> | null | undefined): string | null | undefined {
  // Explicit video/token modes always win over image_count heuristics.
  if (row?.billing_mode === BILLING_MODE_VIDEO || row?.billing_mode === BILLING_MODE_TOKEN || isKiroCreditMode(row?.billing_mode)) {
    return row.billing_mode
  }
  if ((row?.image_count ?? 0) > 0 && !row?.billing_mode) {
    return BILLING_MODE_IMAGE
  }
  return row?.billing_mode
}

export function isKiroCreditMode(mode: string | null | undefined): boolean {
  return mode === BILLING_MODE_KIRO_CREDIT || mode === BILLING_MODE_KIRO_CREDIT_MISSING || mode === BILLING_MODE_KIRO_CREDIT_ERROR
}

function trimCreditNumber(value: number, minFractionDigits: number): string {
  if (!Number.isFinite(value)) return ''
  const fixed = value.toFixed(8)
  const [whole, fraction = ''] = fixed.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const padded = trimmed.length < minFractionDigits ? trimmed.padEnd(minFractionDigits, '0') : trimmed
  return padded.length > 0 ? `${whole}.${padded}` : whole
}

// formatCreditCharge matches the SuperGPT usage-page口径: `0.544 credit × $0.08/credit`.
export function formatCreditCharge(credits: number, price: number): string {
  if (!Number.isFinite(credits) || !Number.isFinite(price)) return ''
  return `${trimCreditNumber(credits, 0)} credit × $${trimCreditNumber(price, 2)}/credit`
}

export function imageUnitPrice(row: Pick<ImageBillingRow, 'image_count' | 'total_cost'> | null): number {
  if (!row || row.image_count <= 0) return 0
  const total = row.total_cost ?? 0
  const price = total / row.image_count
  return Number.isFinite(price) ? price : 0
}

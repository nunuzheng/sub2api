/**
 * Platforms that have a dedicated mark in PlatformIcon.vue.
 * The generic globe fallback is not a brand logo: callers that must not
 * invent a mark (model plaza filters) skip the icon when this returns false.
 * Keep this list aligned with the non-fallback branches in PlatformIcon.vue.
 */
export const PLATFORM_BRAND_ICON_IDS = [
  'anthropic',
  'openai',
  'gemini',
  'antigravity',
  'grok',
  'kimi',
  'zhipu',
  'minimax',
  'opencode_go',
  'deepseek',
  'command_code',
  'cline',
  'composite',
] as const

const BRAND_ICONS = new Set<string>(PLATFORM_BRAND_ICON_IDS)

export function platformHasBrandIcon(platform: string | null | undefined): boolean {
  return typeof platform === 'string' && BRAND_ICONS.has(platform)
}

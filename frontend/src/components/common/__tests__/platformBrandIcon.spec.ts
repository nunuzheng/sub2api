import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlatformIcon from '../PlatformIcon.vue'
import { PLATFORM_BRAND_ICON_IDS, platformHasBrandIcon } from '../platformBrandIcon'

const GLOBE_PATH = 'M12 2C6.48 2'

describe('platformHasBrandIcon', () => {
  it('recognizes dedicated brand marks and refuses unknown platforms', () => {
    for (const id of ['anthropic', 'deepseek', 'gemini', 'grok', 'openai']) {
      expect(platformHasBrandIcon(id)).toBe(true)
    }
    expect(platformHasBrandIcon('typesafe')).toBe(false)
    expect(platformHasBrandIcon('acme_router')).toBe(false)
    expect(platformHasBrandIcon('')).toBe(false)
    expect(platformHasBrandIcon(null)).toBe(false)
  })

  it('renders a dedicated mark, not the generic globe, for each registered brand', () => {
    for (const id of PLATFORM_BRAND_ICON_IDS) {
      const wrapper = mount(PlatformIcon, { props: { platform: id } })
      const path = wrapper.get('path').attributes('d') ?? ''
      expect(path.startsWith(GLOBE_PATH), id).toBe(false)
      expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    }
  })

  it('keeps the globe only as the shared-icon fallback', () => {
    const wrapper = mount(PlatformIcon, { props: { platform: 'typesafe' } })
    expect(wrapper.get('path').attributes('d') ?? '').toContain(GLOBE_PATH)
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaFilterBar from '../PlazaFilterBar.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

function group(platform: string, id: number) {
  return { id, name: `${platform}-group`, platform, rate: 1 }
}

function mountBar(platforms: string[], selected = 'all') {
  return mount(PlazaFilterBar, {
    props: {
      platforms,
      groups: platforms.map((platform, index) => group(platform, index + 1)),
      rates: [1],
      platform: selected,
      groupId: 'all',
      rate: 'all',
      search: ''
    }
  })
}

function buttonByText(wrapper: ReturnType<typeof mountBar>, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text().trim() === text)
  expect(button, text).toBeTruthy()
  return button!
}

describe('PlazaFilterBar platform chips', () => {
  const platforms = ['anthropic', 'deepseek', 'gemini', 'grok', 'openai', 'typesafe', 'acme_router']

  it('puts a decorative brand mark only on known platforms', () => {
    const wrapper = mountBar(platforms)

    const all = buttonByText(wrapper, 'modelPlaza.filters.all')
    expect(all.find('svg').exists()).toBe(false)
    expect(all.attributes('aria-pressed')).toBe('true')
    expect(all.classes()).toContain('bg-violet-600')

    for (const id of ['anthropic', 'deepseek', 'gemini', 'grok', 'openai']) {
      const button = buttonByText(wrapper, id)
      const svg = button.get('svg')
      expect(svg.attributes('aria-hidden')).toBe('true')
      expect(svg.attributes('aria-label')).toBeUndefined()
      expect(button.attributes('aria-pressed')).toBe('false')
      expect(button.classes()).not.toContain('bg-violet-600')
    }

    for (const id of ['typesafe', 'acme_router']) {
      expect(buttonByText(wrapper, id).find('svg').exists()).toBe(false)
    }
  })

  it('does not invent a platform chip that the response did not return', () => {
    const wrapper = mountBar(['openai'])
    const labels = wrapper.findAll('[role="group"] button').map((button) => button.text().trim())
    expect(labels).toEqual(['modelPlaza.filters.all', 'openai'])
  })

  it('selects by the routing platform id and keeps the purple pressed state', async () => {
    const wrapper = mountBar(['deepseek', 'openai'], 'deepseek')
    const deepseek = buttonByText(wrapper, 'deepseek')
    expect(deepseek.attributes('aria-pressed')).toBe('true')
    expect(deepseek.classes()).toContain('bg-violet-600')
    expect(buttonByText(wrapper, 'modelPlaza.filters.all').attributes('aria-pressed')).toBe('false')

    await buttonByText(wrapper, 'openai').trigger('click')
    expect(wrapper.emitted('update:platform')?.[0]).toEqual(['openai'])
  })
})

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const topNavSource = readFileSync(resolve(dir, '../AppTopNav.vue'), 'utf8')
const homeViewSource = readFileSync(resolve(dir, '../../../views/HomeView.vue'), 'utf8')
const keyUsageViewSource = readFileSync(resolve(dir, '../../../views/KeyUsageView.vue'), 'utf8')

describe('site_logo sanitization', () => {
  it('HomeView applies sanitizeUrl to siteLogo', () => {
    expect(homeViewSource).toContain('sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo')
  })

  it('KeyUsageView applies sanitizeUrl to siteLogo', () => {
    expect(keyUsageViewSource).toContain('sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo')
  })

  it('AppTopNav sanitizes the console logo the same way', () => {
    expect(topNavSource).toContain("import { sanitizeUrl } from '@/utils/url'")
    expect(topNavSource).toContain('sanitizeUrl(appStore.siteLogo')
    expect(topNavSource).toContain('allowRelative: true')
    expect(topNavSource).toContain('allowDataUrl: true')
  })

  it('logo sanitizers allow relative paths and image data URLs', () => {
    for (const src of [topNavSource, homeViewSource, keyUsageViewSource]) {
      expect(src).toContain('allowRelative: true')
      expect(src).toContain('allowDataUrl: true')
    }
  })
})

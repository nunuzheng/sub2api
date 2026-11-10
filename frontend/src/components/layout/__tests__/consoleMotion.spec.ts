import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const style = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css'), 'utf8')

describe('console motion', () => {
  it('uses a short menu entrance and disables it under reduced motion', () => {
    expect(style).toContain('--motion-duration: 160ms')
    expect(style).toContain('@keyframes menuIn')
    expect(style).toContain('translateY(4px)')
    const reduced = style.slice(style.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toContain('.topnav-menu')
    expect(reduced).toContain('.balance-figure')
    expect(reduced).toContain('.btn')
    expect(reduced).toContain('animation: none !important')
    expect(reduced).toContain('transition: none !important')
    expect(reduced).toContain('transform: none !important')
    expect(reduced).toContain('.animate-spin')
    expect(reduced).toContain('.animate-ping')
    expect(reduced).not.toContain('animation-iteration-count: infinite')
  })
})

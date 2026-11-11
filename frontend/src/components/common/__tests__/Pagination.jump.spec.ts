import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Pagination from '../Pagination.vue'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)

function mountPagination() {
  return mount(Pagination, {
    props: { total: 200, page: 1, pageSize: 20, showJump: true, showPageSizeSelector: false },
    global: { stubs: { Icon: true } }
  })
}

describe('pagination jump input', () => {
  it.each(['click', 'enter'])('jumps to the entered numeric page using %s', async (action) => {
    const wrapper = mountPagination()
    const input = wrapper.get('input[type="number"]')
    await input.setValue('3')
    if (action === 'click') await wrapper.get('.btn').trigger('click')
    else await input.trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('update:page')).toEqual([[3]])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('clamps an entered page to the last page', async () => {
    const wrapper = mountPagination()
    await wrapper.get('input').setValue('99')
    await wrapper.get('.btn').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[10]])
  })

  it('ignores an empty jump input', async () => {
    const wrapper = mountPagination()
    await wrapper.get('.btn').trigger('click')
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })

  it('centers the page index in a three-slot footer and keeps page size out of that row', () => {
    const wrapper = mount(Pagination, {
      props: { total: 680, page: 1, pageSize: 20, showPageSizeSelector: false },
    })
    expect(wrapper.get('.pager-index').text()).toBe('1 / 34')
    expect(wrapper.get('.pager-bar').text()).not.toContain('pagination.perPage')
    expect(wrapper.get('.pager-bar').find('select').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('disables both directions when there are no pages and while the list is busy', () => {
    const empty = mount(Pagination, {
      props: { total: 0, page: 1, pageSize: 20, showPageSizeSelector: false },
    })
    expect(empty.get('.pager-index').text()).toBe('0 / 1')
    for (const button of empty.findAll('.pager-btn')) {
      expect(button.attributes('disabled')).toBeDefined()
    }

    const busy = mount(Pagination, {
      props: { total: 40, page: 1, pageSize: 20, disabled: true, showPageSizeSelector: false },
    })
    for (const button of busy.findAll('.pager-btn')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
    busy.get('.pager-btn:last-child').trigger('click')
    expect(busy.emitted('update:page')).toBeUndefined()
  })

  it('uses the count phrase beside a section title in both locales', () => {
    expect(zh.pagination.totalCount).toBe('共 {count} 条')
    expect(en.pagination.totalCount).toBe('{count} total')
    expect(zh.pagination.previous).toBe('上一页')
    expect(zh.pagination.next).toBe('下一页')
    expect(en.pagination.previous).toBe('Previous')
    expect(en.pagination.next).toBe('Next')
  })
})
